import type { RootState } from 'app/store/store';
import { isInitialImageLayer, isRegionalGuidanceLayer } from 'features/controlLayers/store/controlLayersSlice';
import { fetchModelConfigWithTypeGuard } from 'features/metadata/util/modelFetchingHelpers';
import {
  CLIP_SKIP,
  CONTROL_LAYERS_GRAPH,
  DENOISE_LATENTS,
  LATENTS_TO_IMAGE,
  MAIN_MODEL_LOADER,
  NEGATIVE_CONDITIONING,
  NEGATIVE_CONDITIONING_COLLECT,
  NOISE,
  POSITIVE_CONDITIONING,
  POSITIVE_CONDITIONING_COLLECT,
  VAE_LOADER,
} from 'features/nodes/util/graph/constants';
import { addControlLayers } from 'features/nodes/util/graph/generation/addControlLayers';
import { addHRF } from 'features/nodes/util/graph/generation/addHRF';
import { addLoRAs } from 'features/nodes/util/graph/generation/addLoRAs';
import { addNSFWChecker } from 'features/nodes/util/graph/generation/addNSFWChecker';
import { addSeamless } from 'features/nodes/util/graph/generation/addSeamless';
import { addWatermarker } from 'features/nodes/util/graph/generation/addWatermarker';
import type { GraphType } from 'features/nodes/util/graph/generation/Graph';
import { Graph } from 'features/nodes/util/graph/generation/Graph';
import { getBoardField } from 'features/nodes/util/graph/graphBuilderUtils';
import type { Invocation } from 'services/api/types';
import { isNonRefinerMainModelConfig } from 'services/api/types';
import { assert } from 'tsafe';

export const buildGenerationTabGraph = async (state: RootState): Promise<GraphType> => {
  const {
    model,
    cfgScale: cfg_scale,
    cfgRescaleMultiplier: cfg_rescale_multiplier,
    scheduler,
    steps,
    clipSkip: skipped_layers,
    shouldUseCpuNoise,
    vaePrecision,
    seed,
    vae,
  } = state.generation;
  const { positivePrompt, negativePrompt } = state.controlLayers.present;
  const { width, height } = state.controlLayers.present.size;

  assert(model, 'No model found in state');

  const g = new Graph(CONTROL_LAYERS_GRAPH);
  const modelLoader = g.addNode({
    type: 'main_model_loader',
    id: MAIN_MODEL_LOADER,
    model,
  });
  const clipSkip = g.addNode({
    type: 'clip_skip',
    id: CLIP_SKIP,
    skipped_layers,
  });
  const posCond = g.addNode({
    type: 'compel',
    id: POSITIVE_CONDITIONING,
    prompt: positivePrompt,
  });
  const posCondCollect = g.addNode({
    type: 'collect',
    id: POSITIVE_CONDITIONING_COLLECT,
  });
  const negCond = g.addNode({
    type: 'compel',
    id: NEGATIVE_CONDITIONING,
    prompt: negativePrompt,
  });
  const negCondCollect = g.addNode({
    type: 'collect',
    id: NEGATIVE_CONDITIONING_COLLECT,
  });
  const noise = g.addNode({
    type: 'noise',
    id: NOISE,
    seed,
    width,
    height,
    use_cpu: shouldUseCpuNoise,
  });
  const denoise = g.addNode({
    type: 'denoise_latents',
    id: DENOISE_LATENTS,
    cfg_scale,
    cfg_rescale_multiplier,
    scheduler,
    steps,
    denoising_start: 0,
    denoising_end: 1,
  });
  const l2i = g.addNode({
    type: 'l2i',
    id: LATENTS_TO_IMAGE,
    fp32: vaePrecision === 'fp32',
    board: getBoardField(state),
    // This is the terminal node and must always save to gallery.
    is_intermediate: false,
    use_cache: false,
  });
  const vaeLoader =
    vae?.base === model.base
      ? g.addNode({
          type: 'vae_loader',
          id: VAE_LOADER,
          vae_model: vae,
        })
      : null;

  let imageOutput: Invocation<'l2i'> | Invocation<'img_nsfw'> | Invocation<'img_watermark'> = l2i;

  g.addEdge(modelLoader, 'unet', denoise, 'unet');
  g.addEdge(modelLoader, 'clip', clipSkip, 'clip');
  g.addEdge(clipSkip, 'clip', posCond, 'clip');
  g.addEdge(clipSkip, 'clip', negCond, 'clip');
  g.addEdge(posCond, 'conditioning', posCondCollect, 'item');
  g.addEdge(negCond, 'conditioning', negCondCollect, 'item');
  g.addEdge(posCondCollect, 'collection', denoise, 'positive_conditioning');
  g.addEdge(negCondCollect, 'collection', denoise, 'negative_conditioning');
  g.addEdge(noise, 'noise', denoise, 'noise');
  g.addEdge(denoise, 'latents', l2i, 'latents');

  const modelConfig = await fetchModelConfigWithTypeGuard(model.key, isNonRefinerMainModelConfig);
  assert(modelConfig.base === 'sd-1' || modelConfig.base === 'sd-2');

  g.upsertMetadata({
    generation_mode: 'txt2img',
    cfg_scale,
    cfg_rescale_multiplier,
    height,
    width,
    positive_prompt: positivePrompt,
    negative_prompt: negativePrompt,
    model: Graph.getModelMetadataField(modelConfig),
    seed,
    steps,
    rand_device: shouldUseCpuNoise ? 'cpu' : 'cuda',
    scheduler,
    clip_skip: skipped_layers,
    vae: vae ?? undefined,
  });

  const seamless = addSeamless(state, g, denoise, modelLoader, vaeLoader);

  addLoRAs(state, g, denoise, modelLoader, seamless, clipSkip, posCond, negCond);

  // We might get the VAE from the main model, custom VAE, or seamless node.
  const vaeSource = seamless ?? vaeLoader ?? modelLoader;
  g.addEdge(vaeSource, 'vae', l2i, 'vae');

  const addedLayers = await addControlLayers(
    state,
    g,
    modelConfig.base,
    denoise,
    posCond,
    negCond,
    posCondCollect,
    negCondCollect,
    noise,
    vaeSource
  );

  const isHRFAllowed = !addedLayers.some((l) => isInitialImageLayer(l) || isRegionalGuidanceLayer(l));
  if (isHRFAllowed && state.hrf.hrfEnabled) {
    imageOutput = addHRF(state, g, denoise, noise, l2i, vaeSource);
  }

  if (state.system.shouldUseNSFWChecker) {
    imageOutput = addNSFWChecker(g, imageOutput);
  }

  if (state.system.shouldUseWatermarker) {
    imageOutput = addWatermarker(g, imageOutput);
  }

  g.setMetadataReceivingNode(imageOutput);
  return g.getGraph();
};
