import { logger } from 'app/logging/logger';
import type { AppStartListening } from 'app/store/middleware/listenerMiddleware';
import type { AppDispatch, RootState } from 'app/store/store';
import type { SerializableObject } from 'common/types';
import {
  bboxHeightChanged,
  bboxWidthChanged,
  controlLayerModelChanged,
  ipaModelChanged,
  rgIPAdapterModelChanged,
} from 'features/controlLayers/store/canvasSlice';
import { loraDeleted } from 'features/controlLayers/store/lorasSlice';
import { modelChanged, refinerModelChanged, vaeSelected } from 'features/controlLayers/store/paramsSlice';
import { selectCanvasSlice } from 'features/controlLayers/store/selectors';
import { getEntityIdentifier } from 'features/controlLayers/store/types';
import { calculateNewSize } from 'features/parameters/components/Bbox/calculateNewSize';
import { postProcessingModelChanged, upscaleModelChanged } from 'features/parameters/store/upscaleSlice';
import { zParameterModel, zParameterVAEModel } from 'features/parameters/types/parameterSchemas';
import { getIsSizeOptimal, getOptimalDimension } from 'features/parameters/util/optimalDimension';
import type { Logger } from 'roarr';
import { modelConfigsAdapterSelectors, modelsApi } from 'services/api/endpoints/models';
import type { AnyModelConfig } from 'services/api/types';
import {
  isControlNetOrT2IAdapterModelConfig,
  isIPAdapterModelConfig,
  isLoRAModelConfig,
  isNonRefinerMainModelConfig,
  isRefinerMainModelModelConfig,
  isSpandrelImageToImageModelConfig,
  isVAEModelConfig,
} from 'services/api/types';

const log = logger('models');

export const addModelsLoadedListener = (startAppListening: AppStartListening) => {
  startAppListening({
    predicate: modelsApi.endpoints.getModelConfigs.matchFulfilled,
    effect: (action, { getState, dispatch }) => {
      // models loaded, we need to ensure the selected model is available and if not, select the first one
      log.info({ models: action.payload.entities }, `Models loaded (${action.payload.ids.length})`);

      const state = getState();

      const models = modelConfigsAdapterSelectors.selectAll(action.payload);

      handleMainModels(models, state, dispatch, log);
      handleRefinerModels(models, state, dispatch, log);
      handleVAEModels(models, state, dispatch, log);
      handleLoRAModels(models, state, dispatch, log);
      handleControlAdapterModels(models, state, dispatch, log);
      handleSpandrelImageToImageModels(models, state, dispatch, log);
      handleIPAdapterModels(models, state, dispatch, log);
    },
  });
};

type ModelHandler = (
  models: AnyModelConfig[],
  state: RootState,
  dispatch: AppDispatch,
  log: Logger<SerializableObject>
) => undefined;

const handleMainModels: ModelHandler = (models, state, dispatch, log) => {
  const currentModel = state.params.model;
  const mainModels = models.filter(isNonRefinerMainModelConfig);
  if (mainModels.length === 0) {
    // No models loaded at all
    dispatch(modelChanged({ model: null }));
    return;
  }

  const isCurrentMainModelAvailable = currentModel ? mainModels.some((m) => m.key === currentModel.key) : false;
  if (isCurrentMainModelAvailable) {
    return;
  }

  const defaultModel = state.config.sd.defaultModel;
  const defaultModelInList = defaultModel ? mainModels.find((m) => m.key === defaultModel) : false;

  if (defaultModelInList) {
    const result = zParameterModel.safeParse(defaultModelInList);
    if (result.success) {
      dispatch(modelChanged({ model: defaultModelInList, previousModel: currentModel }));
      const { bbox } = selectCanvasSlice(state);
      const optimalDimension = getOptimalDimension(defaultModelInList);
      if (getIsSizeOptimal(bbox.rect.width, bbox.rect.height, optimalDimension)) {
        return;
      }
      const { width, height } = calculateNewSize(bbox.aspectRatio.value, optimalDimension * optimalDimension);

      dispatch(bboxWidthChanged({ width }));
      dispatch(bboxHeightChanged({ height }));
      return;
    }
  }

  const result = zParameterModel.safeParse(mainModels[0]);

  if (!result.success) {
    log.error({ error: result.error.format() }, 'Failed to parse main model');
    return;
  }

  dispatch(modelChanged({ model: result.data, previousModel: currentModel }));
};

const handleRefinerModels: ModelHandler = (models, state, dispatch, _log) => {
  const currentRefinerModel = state.params.refinerModel;
  const refinerModels = models.filter(isRefinerMainModelModelConfig);
  if (models.length === 0) {
    // No models loaded at all
    dispatch(refinerModelChanged(null));
    return;
  }

  const isCurrentRefinerModelAvailable = currentRefinerModel
    ? refinerModels.some((m) => m.key === currentRefinerModel.key)
    : false;

  if (!isCurrentRefinerModelAvailable) {
    dispatch(refinerModelChanged(null));
    return;
  }
};

const handleVAEModels: ModelHandler = (models, state, dispatch, log) => {
  const currentVae = state.params.vae;

  if (currentVae === null) {
    // null is a valid VAE! it means "use the default with the main model"
    return;
  }
  const vaeModels = models.filter(isVAEModelConfig);

  const isCurrentVAEAvailable = vaeModels.some((m) => m.key === currentVae.key);

  if (isCurrentVAEAvailable) {
    return;
  }

  const firstModel = vaeModels[0];

  if (!firstModel) {
    // No custom VAEs loaded at all; use the default
    dispatch(vaeSelected(null));
    return;
  }

  const result = zParameterVAEModel.safeParse(firstModel);

  if (!result.success) {
    log.error({ error: result.error.format() }, 'Failed to parse VAE model');
    return;
  }

  dispatch(vaeSelected(result.data));
};

const handleLoRAModels: ModelHandler = (models, state, dispatch, _log) => {
  const loraModels = models.filter(isLoRAModelConfig);
  state.loras.loras.forEach((lora) => {
    const isLoRAAvailable = loraModels.some((m) => m.key === lora.model.key);
    if (isLoRAAvailable) {
      return;
    }
    dispatch(loraDeleted({ id: lora.id }));
  });
};

const handleControlAdapterModels: ModelHandler = (models, state, dispatch, _log) => {
  const caModels = models.filter(isControlNetOrT2IAdapterModelConfig);
  selectCanvasSlice(state).controlLayers.entities.forEach((entity) => {
    const isModelAvailable = caModels.some((m) => m.key === entity.controlAdapter.model?.key);
    if (isModelAvailable) {
      return;
    }
    dispatch(controlLayerModelChanged({ entityIdentifier: getEntityIdentifier(entity), modelConfig: null }));
  });
};

const handleIPAdapterModels: ModelHandler = (models, state, dispatch, _log) => {
  const ipaModels = models.filter(isIPAdapterModelConfig);
  selectCanvasSlice(state).ipAdapters.entities.forEach((entity) => {
    const isModelAvailable = ipaModels.some((m) => m.key === entity.ipAdapter.model?.key);
    if (isModelAvailable) {
      return;
    }
    dispatch(ipaModelChanged({ entityIdentifier: getEntityIdentifier(entity), modelConfig: null }));
  });

  selectCanvasSlice(state).regions.entities.forEach((entity) => {
    entity.ipAdapters.forEach(({ id: ipAdapterId, model }) => {
      const isModelAvailable = ipaModels.some((m) => m.key === model?.key);
      if (isModelAvailable) {
        return;
      }
      dispatch(
        rgIPAdapterModelChanged({ entityIdentifier: getEntityIdentifier(entity), ipAdapterId, modelConfig: null })
      );
    });
  });
};

const handleSpandrelImageToImageModels: ModelHandler = (models, state, dispatch, _log) => {
  const { upscaleModel: currentUpscaleModel, postProcessingModel: currentPostProcessingModel } = state.upscale;
  const upscaleModels = models.filter(isSpandrelImageToImageModelConfig);
  const firstModel = upscaleModels[0] || null;

  const isCurrentUpscaleModelAvailable = currentUpscaleModel
    ? upscaleModels.some((m) => m.key === currentUpscaleModel.key)
    : false;

  if (!isCurrentUpscaleModelAvailable) {
    dispatch(upscaleModelChanged(firstModel));
  }

  const isCurrentPostProcessingModelAvailable = currentPostProcessingModel
    ? upscaleModels.some((m) => m.key === currentPostProcessingModel.key)
    : false;

  if (!isCurrentPostProcessingModelAvailable) {
    dispatch(postProcessingModelChanged(firstModel));
  }
};
