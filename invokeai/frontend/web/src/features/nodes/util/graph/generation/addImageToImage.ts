import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import type { CanvasState, Dimensions } from 'features/controlLayers/store/types';
import type { Graph } from 'features/nodes/util/graph/generation/Graph';
import { isEqual } from 'lodash-es';
import type { Invocation } from 'services/api/types';

export const addImageToImage = async (
  g: Graph,
  manager: CanvasManager,
  l2i: Invocation<'l2i'>,
  denoise: Invocation<'denoise_latents'>,
  vaeSource: Invocation<'main_model_loader' | 'sdxl_model_loader' | 'seamless' | 'vae_loader'>,
  originalSize: Dimensions,
  scaledSize: Dimensions,
  bbox: CanvasState['bbox'],
  denoising_start: number,
  fp32: boolean
): Promise<Invocation<'img_resize' | 'l2i'>> => {
  denoise.denoising_start = denoising_start;

  const { image_name } = await manager.compositor.getCompositeRasterLayerImageDTO(bbox.rect);

  if (!isEqual(scaledSize, originalSize)) {
    // Resize the initial image to the scaled size, denoise, then resize back to the original size
    const resizeImageToScaledSize = g.addNode({
      type: 'img_resize',
      id: getPrefixedId('initial_image_resize_in'),
      image: { image_name },
      ...scaledSize,
    });
    const i2l = g.addNode({ id: 'i2l', type: 'i2l', fp32 });
    const resizeImageToOriginalSize = g.addNode({
      type: 'img_resize',
      id: getPrefixedId('initial_image_resize_out'),
      ...originalSize,
    });

    g.addEdge(vaeSource, 'vae', i2l, 'vae');
    g.addEdge(resizeImageToScaledSize, 'image', i2l, 'image');
    g.addEdge(i2l, 'latents', denoise, 'latents');
    g.addEdge(l2i, 'image', resizeImageToOriginalSize, 'image');

    // This is the new output node
    return resizeImageToOriginalSize;
  } else {
    // No need to resize, just decode
    const i2l = g.addNode({ id: 'i2l', type: 'i2l', image: { image_name }, fp32 });
    g.addEdge(vaeSource, 'vae', i2l, 'vae');
    g.addEdge(i2l, 'latents', denoise, 'latents');
    return l2i;
  }
};
