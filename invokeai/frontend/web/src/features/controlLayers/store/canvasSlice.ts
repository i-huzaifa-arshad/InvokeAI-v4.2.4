import type { PayloadAction, UnknownAction } from '@reduxjs/toolkit';
import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { PersistConfig } from 'app/store/store';
import { moveOneToEnd, moveOneToStart, moveToEnd, moveToStart } from 'common/util/arrayUtils';
import { deepClone } from 'common/util/deepClone';
import { roundDownToMultiple, roundToMultiple } from 'common/util/roundDownToMultiple';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { getPrefixedId } from 'features/controlLayers/konva/util';
import { modelChanged } from 'features/controlLayers/store/paramsSlice';
import {
  selectAllEntities,
  selectAllEntitiesOfType,
  selectEntity,
  selectRegionalGuidanceIPAdapter,
} from 'features/controlLayers/store/selectors';
import type {
  CanvasInpaintMaskState,
  FillStyle,
  RegionalGuidanceIPAdapterConfig,
  RgbColor,
} from 'features/controlLayers/store/types';
import { getScaledBoundingBoxDimensions } from 'features/controlLayers/util/getScaledBoundingBoxDimensions';
import { simplifyFlatNumbersArray } from 'features/controlLayers/util/simplify';
import { zModelIdentifierField } from 'features/nodes/types/common';
import { calculateNewSize } from 'features/parameters/components/Bbox/calculateNewSize';
import { ASPECT_RATIO_MAP, initialAspectRatioState } from 'features/parameters/components/Bbox/constants';
import type { AspectRatioID } from 'features/parameters/components/Bbox/types';
import { getIsSizeOptimal, getOptimalDimension } from 'features/parameters/util/optimalDimension';
import type { IRect } from 'konva/lib/types';
import { isEqual, merge, omit } from 'lodash-es';
import { atom } from 'nanostores';
import type { UndoableOptions } from 'redux-undo';
import type {
  ControlNetModelConfig,
  ImageDTO,
  IPAdapterModelConfig,
  S,
  T2IAdapterModelConfig,
} from 'services/api/types';
import { assert } from 'tsafe';

import type {
  BoundingBoxScaleMethod,
  CanvasControlLayerState,
  CanvasEntityIdentifier,
  CanvasIPAdapterState,
  CanvasRasterLayerState,
  CanvasRegionalGuidanceState,
  CanvasState,
  CLIPVisionModelV2,
  ControlModeV2,
  ControlNetConfig,
  EntityBrushLineAddedPayload,
  EntityEraserLineAddedPayload,
  EntityIdentifierPayload,
  EntityMovedPayload,
  EntityRasterizedPayload,
  EntityRectAddedPayload,
  IPMethodV2,
  T2IAdapterConfig,
} from './types';
import {
  getEntityIdentifier,
  imageDTOToImageWithDims,
  initialControlNet,
  initialIPAdapter,
  isRenderableEntity,
} from './types';

const DEFAULT_MASK_COLORS: RgbColor[] = [
  { r: 121, g: 157, b: 219 }, // rgb(121, 157, 219)
  { r: 131, g: 214, b: 131 }, // rgb(131, 214, 131)
  { r: 250, g: 225, b: 80 }, // rgb(250, 225, 80)
  { r: 220, g: 144, b: 101 }, // rgb(220, 144, 101)
  { r: 224, g: 117, b: 117 }, // rgb(224, 117, 117)
  { r: 213, g: 139, b: 202 }, // rgb(213, 139, 202)
  { r: 161, g: 120, b: 214 }, // rgb(161, 120, 214)
];

const getRGMaskFill = (state: CanvasState): RgbColor => {
  const lastFill = state.regions.entities.slice(-1)[0]?.fill.color;
  let i = DEFAULT_MASK_COLORS.findIndex((c) => isEqual(c, lastFill));
  if (i === -1) {
    i = 0;
  }
  i = (i + 1) % DEFAULT_MASK_COLORS.length;
  const fill = DEFAULT_MASK_COLORS[i];
  assert(fill, 'This should never happen');
  return fill;
};

const initialInpaintMaskState: CanvasInpaintMaskState = {
  id: getPrefixedId('inpaint_mask'),
  name: null,
  type: 'inpaint_mask',
  isEnabled: true,
  isLocked: false,
  objects: [],
  opacity: 1,
  position: { x: 0, y: 0 },
  fill: {
    style: 'diagonal',
    color: { r: 255, g: 122, b: 0 }, // some orange color
  },
};

const initialState: CanvasState = {
  _version: 3,
  selectedEntityIdentifier: getEntityIdentifier(initialInpaintMaskState),
  bookmarkedEntityIdentifier: getEntityIdentifier(initialInpaintMaskState),
  rasterLayers: {
    isHidden: false,
    entities: [],
  },
  controlLayers: {
    isHidden: false,
    entities: [],
  },
  inpaintMasks: {
    isHidden: false,
    entities: [deepClone(initialInpaintMaskState)],
  },
  regions: {
    isHidden: false,
    entities: [],
  },
  ipAdapters: { entities: [] },
  bbox: {
    rect: { x: 0, y: 0, width: 512, height: 512 },
    optimalDimension: 512,
    aspectRatio: deepClone(initialAspectRatioState),
    scaleMethod: 'auto',
    scaledSize: {
      width: 512,
      height: 512,
    },
  },
};

export const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    // undoable canvas state
    //#region Raster layers
    rasterLayerAdded: {
      reducer: (
        state,
        action: PayloadAction<{
          id: string;
          overrides?: Partial<CanvasRasterLayerState>;
          isSelected?: boolean;
          isMergingVisible?: boolean;
        }>
      ) => {
        const { id, overrides, isSelected, isMergingVisible } = action.payload;
        const entity: CanvasRasterLayerState = {
          id,
          name: null,
          type: 'raster_layer',
          isEnabled: true,
          isLocked: false,
          objects: [],
          opacity: 1,
          position: { x: 0, y: 0 },
        };
        merge(entity, overrides);

        if (isMergingVisible) {
          // When merging visible, we delete all disabled layers
          state.rasterLayers.entities = state.rasterLayers.entities.filter((layer) => !layer.isEnabled);
        }

        state.rasterLayers.entities.push(entity);

        if (isSelected) {
          state.selectedEntityIdentifier = getEntityIdentifier(entity);
        }
      },
      prepare: (payload: {
        overrides?: Partial<CanvasRasterLayerState>;
        isSelected?: boolean;
        isMergingVisible?: boolean;
      }) => ({
        payload: { ...payload, id: getPrefixedId('raster_layer') },
      }),
    },
    rasterLayerRecalled: (state, action: PayloadAction<{ data: CanvasRasterLayerState }>) => {
      const { data } = action.payload;
      state.rasterLayers.entities.push(data);
      state.selectedEntityIdentifier = getEntityIdentifier(data);
    },
    rasterLayerConvertedToControlLayer: {
      reducer: (
        state,
        action: PayloadAction<
          EntityIdentifierPayload<{ newId: string; overrides?: Partial<CanvasControlLayerState> }, 'raster_layer'>
        >
      ) => {
        const { entityIdentifier, newId, overrides } = action.payload;
        const layer = selectEntity(state, entityIdentifier);
        if (!layer) {
          return;
        }

        // Convert the raster layer to control layer
        const controlLayerState: CanvasControlLayerState = {
          ...deepClone(layer),
          id: newId,
          type: 'control_layer',
          controlAdapter: deepClone(initialControlNet),
          withTransparencyEffect: true,
        };

        merge(controlLayerState, overrides);

        // Remove the raster layer
        state.rasterLayers.entities = state.rasterLayers.entities.filter((layer) => layer.id !== entityIdentifier.id);

        // Add the converted control layer
        state.controlLayers.entities.push(controlLayerState);

        state.selectedEntityIdentifier = { type: controlLayerState.type, id: controlLayerState.id };
      },
      prepare: (
        payload: EntityIdentifierPayload<{ overrides?: Partial<CanvasControlLayerState> } | undefined, 'raster_layer'>
      ) => ({
        payload: { ...payload, newId: getPrefixedId('control_layer') },
      }),
    },
    //#region Control layers
    controlLayerAdded: {
      reducer: (
        state,
        action: PayloadAction<{ id: string; overrides?: Partial<CanvasControlLayerState>; isSelected?: boolean }>
      ) => {
        const { id, overrides, isSelected } = action.payload;
        const entity: CanvasControlLayerState = {
          id,
          name: null,
          type: 'control_layer',
          isEnabled: true,
          isLocked: false,
          withTransparencyEffect: true,
          objects: [],
          opacity: 1,
          position: { x: 0, y: 0 },
          controlAdapter: deepClone(initialControlNet),
        };
        merge(entity, overrides);
        state.controlLayers.entities.push(entity);
        if (isSelected) {
          state.selectedEntityIdentifier = getEntityIdentifier(entity);
        }
      },
      prepare: (payload: { overrides?: Partial<CanvasControlLayerState>; isSelected?: boolean }) => ({
        payload: { ...payload, id: getPrefixedId('control_layer') },
      }),
    },
    controlLayerRecalled: (state, action: PayloadAction<{ data: CanvasControlLayerState }>) => {
      const { data } = action.payload;
      state.controlLayers.entities.push(data);
      state.selectedEntityIdentifier = { type: 'control_layer', id: data.id };
    },
    controlLayerConvertedToRasterLayer: {
      reducer: (state, action: PayloadAction<EntityIdentifierPayload<{ newId: string }, 'control_layer'>>) => {
        const { entityIdentifier, newId } = action.payload;
        const layer = selectEntity(state, entityIdentifier);
        if (!layer) {
          return;
        }

        // Convert the raster layer to control layer
        const rasterLayerState: CanvasRasterLayerState = {
          ...omit(deepClone(layer), ['type', 'controlAdapter', 'withTransparencyEffect']),
          id: newId,
          type: 'raster_layer',
        };

        // Remove the control layer
        state.controlLayers.entities = state.controlLayers.entities.filter((layer) => layer.id !== entityIdentifier.id);

        // Add the new raster layer
        state.rasterLayers.entities.push(rasterLayerState);

        state.selectedEntityIdentifier = { type: rasterLayerState.type, id: rasterLayerState.id };
      },
      prepare: (payload: EntityIdentifierPayload<void, 'control_layer'>) => ({
        payload: { ...payload, newId: getPrefixedId('raster_layer') },
      }),
    },
    controlLayerModelChanged: (
      state,
      action: PayloadAction<
        EntityIdentifierPayload<
          {
            modelConfig: ControlNetModelConfig | T2IAdapterModelConfig | null;
          },
          'control_layer'
        >
      >
    ) => {
      const { entityIdentifier, modelConfig } = action.payload;
      const layer = selectEntity(state, entityIdentifier);
      if (!layer || !layer.controlAdapter) {
        return;
      }
      if (!modelConfig) {
        layer.controlAdapter.model = null;
        return;
      }
      layer.controlAdapter.model = zModelIdentifierField.parse(modelConfig);

      // We may need to convert the CA to match the model
      if (layer.controlAdapter.type === 't2i_adapter' && layer.controlAdapter.model.type === 'controlnet') {
        // Converting from T2I Adapter to ControlNet - add `controlMode`
        const controlNetConfig: ControlNetConfig = {
          ...layer.controlAdapter,
          type: 'controlnet',
          controlMode: 'balanced',
        };
        layer.controlAdapter = controlNetConfig;
      } else if (layer.controlAdapter.type === 'controlnet' && layer.controlAdapter.model.type === 't2i_adapter') {
        // Converting from ControlNet to T2I Adapter - remove `controlMode`
        const { controlMode: _, ...rest } = layer.controlAdapter;
        const t2iAdapterConfig: T2IAdapterConfig = { ...rest, type: 't2i_adapter' };
        layer.controlAdapter = t2iAdapterConfig;
      }
    },
    controlLayerControlModeChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ controlMode: ControlModeV2 }, 'control_layer'>>
    ) => {
      const { entityIdentifier, controlMode } = action.payload;
      const layer = selectEntity(state, entityIdentifier);
      if (!layer || !layer.controlAdapter || layer.controlAdapter.type !== 'controlnet') {
        return;
      }
      layer.controlAdapter.controlMode = controlMode;
    },
    controlLayerWeightChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ weight: number }, 'control_layer'>>
    ) => {
      const { entityIdentifier, weight } = action.payload;
      const layer = selectEntity(state, entityIdentifier);
      if (!layer || !layer.controlAdapter) {
        return;
      }
      layer.controlAdapter.weight = weight;
    },
    controlLayerBeginEndStepPctChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ beginEndStepPct: [number, number] }, 'control_layer'>>
    ) => {
      const { entityIdentifier, beginEndStepPct } = action.payload;
      const layer = selectEntity(state, entityIdentifier);
      if (!layer || !layer.controlAdapter) {
        return;
      }
      layer.controlAdapter.beginEndStepPct = beginEndStepPct;
    },
    controlLayerWithTransparencyEffectToggled: (
      state,
      action: PayloadAction<EntityIdentifierPayload<void, 'control_layer'>>
    ) => {
      const { entityIdentifier } = action.payload;
      const layer = selectEntity(state, entityIdentifier);
      if (!layer) {
        return;
      }
      layer.withTransparencyEffect = !layer.withTransparencyEffect;
    },
    //#region IP Adapters
    ipaAdded: {
      reducer: (
        state,
        action: PayloadAction<{ id: string; overrides?: Partial<CanvasIPAdapterState>; isSelected?: boolean }>
      ) => {
        const { id, overrides, isSelected } = action.payload;
        const entity: CanvasIPAdapterState = {
          id,
          type: 'ip_adapter',
          name: null,
          isLocked: false,
          isEnabled: true,
          ipAdapter: deepClone(initialIPAdapter),
        };
        merge(entity, overrides);
        state.ipAdapters.entities.push(entity);
        if (isSelected) {
          state.selectedEntityIdentifier = getEntityIdentifier(entity);
        }
      },
      prepare: (payload?: { overrides?: Partial<CanvasIPAdapterState>; isSelected?: boolean }) => ({
        payload: { ...payload, id: getPrefixedId('ip_adapter') },
      }),
    },
    ipaRecalled: (state, action: PayloadAction<{ data: CanvasIPAdapterState }>) => {
      const { data } = action.payload;
      state.ipAdapters.entities.push(data);
      state.selectedEntityIdentifier = { type: 'ip_adapter', id: data.id };
    },
    ipaImageChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ imageDTO: ImageDTO | null }, 'ip_adapter'>>
    ) => {
      const { entityIdentifier, imageDTO } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.image = imageDTO ? imageDTOToImageWithDims(imageDTO) : null;
    },
    ipaMethodChanged: (state, action: PayloadAction<EntityIdentifierPayload<{ method: IPMethodV2 }, 'ip_adapter'>>) => {
      const { entityIdentifier, method } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.method = method;
    },
    ipaModelChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ modelConfig: IPAdapterModelConfig | null }, 'ip_adapter'>>
    ) => {
      const { entityIdentifier, modelConfig } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.model = modelConfig ? zModelIdentifierField.parse(modelConfig) : null;
    },
    ipaCLIPVisionModelChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ clipVisionModel: CLIPVisionModelV2 }, 'ip_adapter'>>
    ) => {
      const { entityIdentifier, clipVisionModel } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.clipVisionModel = clipVisionModel;
    },
    ipaWeightChanged: (state, action: PayloadAction<EntityIdentifierPayload<{ weight: number }, 'ip_adapter'>>) => {
      const { entityIdentifier, weight } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.weight = weight;
    },
    ipaBeginEndStepPctChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ beginEndStepPct: [number, number] }, 'ip_adapter'>>
    ) => {
      const { entityIdentifier, beginEndStepPct } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapter.beginEndStepPct = beginEndStepPct;
    },
    //#region Regional Guidance
    rgAdded: {
      reducer: (
        state,
        action: PayloadAction<{ id: string; overrides?: Partial<CanvasRegionalGuidanceState>; isSelected?: boolean }>
      ) => {
        const { id, overrides, isSelected } = action.payload;
        const entity: CanvasRegionalGuidanceState = {
          id,
          name: null,
          isLocked: false,
          type: 'regional_guidance',
          isEnabled: true,
          objects: [],
          fill: {
            style: 'solid',
            color: getRGMaskFill(state),
          },
          opacity: 0.5,
          position: { x: 0, y: 0 },
          autoNegative: false,
          positivePrompt: '',
          negativePrompt: null,
          ipAdapters: [],
        };
        merge(entity, overrides);
        state.regions.entities.push(entity);
        if (isSelected) {
          state.selectedEntityIdentifier = getEntityIdentifier(entity);
        }
      },
      prepare: (payload?: { overrides?: Partial<CanvasRegionalGuidanceState>; isSelected?: boolean }) => ({
        payload: { ...payload, id: getPrefixedId('regional_guidance') },
      }),
    },
    rgRecalled: (state, action: PayloadAction<{ data: CanvasRegionalGuidanceState }>) => {
      const { data } = action.payload;
      state.regions.entities.push(data);
      state.selectedEntityIdentifier = { type: 'regional_guidance', id: data.id };
    },
    rgPositivePromptChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ prompt: string | null }, 'regional_guidance'>>
    ) => {
      const { entityIdentifier, prompt } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.positivePrompt = prompt;
    },
    rgNegativePromptChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ prompt: string | null }, 'regional_guidance'>>
    ) => {
      const { entityIdentifier, prompt } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.negativePrompt = prompt;
    },
    rgAutoNegativeToggled: (state, action: PayloadAction<EntityIdentifierPayload<void, 'regional_guidance'>>) => {
      const { entityIdentifier } = action.payload;
      const rg = selectEntity(state, entityIdentifier);
      if (!rg) {
        return;
      }
      rg.autoNegative = !rg.autoNegative;
    },
    rgIPAdapterAdded: {
      reducer: (
        state,
        action: PayloadAction<
          EntityIdentifierPayload<
            { ipAdapterId: string; overrides?: Partial<RegionalGuidanceIPAdapterConfig> },
            'regional_guidance'
          >
        >
      ) => {
        const { entityIdentifier, overrides, ipAdapterId } = action.payload;
        const entity = selectEntity(state, entityIdentifier);
        if (!entity) {
          return;
        }
        const ipAdapter = { ...deepClone(initialIPAdapter), id: ipAdapterId };
        merge(ipAdapter, overrides);
        entity.ipAdapters.push(ipAdapter);
      },
      prepare: (
        payload: EntityIdentifierPayload<{ overrides?: Partial<RegionalGuidanceIPAdapterConfig> }, 'regional_guidance'>
      ) => ({
        payload: { ...payload, ipAdapterId: getPrefixedId('regional_guidance_ip_adapter') },
      }),
    },
    rgIPAdapterDeleted: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ ipAdapterId: string }, 'regional_guidance'>>
    ) => {
      const { entityIdentifier, ipAdapterId } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.ipAdapters = entity.ipAdapters.filter((ipAdapter) => ipAdapter.id !== ipAdapterId);
    },
    rgIPAdapterImageChanged: (
      state,
      action: PayloadAction<
        EntityIdentifierPayload<{ ipAdapterId: string; imageDTO: ImageDTO | null }, 'regional_guidance'>
      >
    ) => {
      const { entityIdentifier, ipAdapterId, imageDTO } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.image = imageDTO ? imageDTOToImageWithDims(imageDTO) : null;
    },
    rgIPAdapterWeightChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ ipAdapterId: string; weight: number }, 'regional_guidance'>>
    ) => {
      const { entityIdentifier, ipAdapterId, weight } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.weight = weight;
    },
    rgIPAdapterBeginEndStepPctChanged: (
      state,
      action: PayloadAction<
        EntityIdentifierPayload<{ ipAdapterId: string; beginEndStepPct: [number, number] }, 'regional_guidance'>
      >
    ) => {
      const { entityIdentifier, ipAdapterId, beginEndStepPct } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.beginEndStepPct = beginEndStepPct;
    },
    rgIPAdapterMethodChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ ipAdapterId: string; method: IPMethodV2 }, 'regional_guidance'>>
    ) => {
      const { entityIdentifier, ipAdapterId, method } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.method = method;
    },
    rgIPAdapterModelChanged: (
      state,
      action: PayloadAction<
        EntityIdentifierPayload<
          {
            ipAdapterId: string;
            modelConfig: IPAdapterModelConfig | null;
          },
          'regional_guidance'
        >
      >
    ) => {
      const { entityIdentifier, ipAdapterId, modelConfig } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.model = modelConfig ? zModelIdentifierField.parse(modelConfig) : null;
    },
    rgIPAdapterCLIPVisionModelChanged: (
      state,
      action: PayloadAction<
        EntityIdentifierPayload<{ ipAdapterId: string; clipVisionModel: CLIPVisionModelV2 }, 'regional_guidance'>
      >
    ) => {
      const { entityIdentifier, ipAdapterId, clipVisionModel } = action.payload;
      const ipAdapter = selectRegionalGuidanceIPAdapter(state, entityIdentifier, ipAdapterId);
      if (!ipAdapter) {
        return;
      }
      ipAdapter.clipVisionModel = clipVisionModel;
    },
    //#region Inpaint mask
    inpaintMaskAdded: {
      reducer: (
        state,
        action: PayloadAction<{
          id: string;
          overrides?: Partial<CanvasInpaintMaskState>;
          isSelected?: boolean;
          isMergingVisible?: boolean;
        }>
      ) => {
        const { id, overrides, isSelected, isMergingVisible } = action.payload;
        const entity: CanvasInpaintMaskState = {
          id,
          name: null,
          type: 'inpaint_mask',
          isEnabled: true,
          isLocked: false,
          objects: [],
          opacity: 1,
          position: { x: 0, y: 0 },
          fill: {
            style: 'diagonal',
            color: { r: 255, g: 122, b: 0 }, // some orange color
          },
        };
        merge(entity, overrides);

        if (isMergingVisible) {
          // When merging visible, we delete all disabled layers
          state.inpaintMasks.entities = state.inpaintMasks.entities.filter((layer) => !layer.isEnabled);
        }

        state.inpaintMasks.entities.push(entity);

        if (isSelected) {
          state.selectedEntityIdentifier = getEntityIdentifier(entity);
        }
      },
      prepare: (payload?: {
        overrides?: Partial<CanvasInpaintMaskState>;
        isSelected?: boolean;
        isMergingVisible?: boolean;
      }) => ({
        payload: { ...payload, id: getPrefixedId('inpaint_mask') },
      }),
    },
    inpaintMaskRecalled: (state, action: PayloadAction<{ data: CanvasInpaintMaskState }>) => {
      const { data } = action.payload;
      state.inpaintMasks.entities = [data];
      state.selectedEntityIdentifier = { type: 'inpaint_mask', id: data.id };
    },
    //#region BBox
    bboxScaledWidthChanged: (state, action: PayloadAction<number>) => {
      state.bbox.scaledSize.width = action.payload;
      if (state.bbox.aspectRatio.isLocked) {
        state.bbox.scaledSize.height = roundToMultiple(state.bbox.scaledSize.width / state.bbox.aspectRatio.value, 8);
      }
    },
    bboxScaledHeightChanged: (state, action: PayloadAction<number>) => {
      state.bbox.scaledSize.height = action.payload;
      if (state.bbox.aspectRatio.isLocked) {
        state.bbox.scaledSize.width = roundToMultiple(state.bbox.scaledSize.height * state.bbox.aspectRatio.value, 8);
      }
    },
    bboxScaleMethodChanged: (state, action: PayloadAction<BoundingBoxScaleMethod>) => {
      state.bbox.scaleMethod = action.payload;
      syncScaledSize(state);
    },
    bboxChangedFromCanvas: (state, action: PayloadAction<IRect>) => {
      state.bbox.rect = action.payload;

      // TODO(psyche): Figure out a way to handle this without resetting the aspect ratio on every change.
      // This action is dispatched when the user resizes or moves the bbox from the canvas. For now, when the user
      // resizes the bbox from the canvas, we unlock the aspect ratio.
      state.bbox.aspectRatio.value = state.bbox.rect.width / state.bbox.rect.height;
      state.bbox.aspectRatio.id = 'Free';

      syncScaledSize(state);
    },
    bboxWidthChanged: (
      state,
      action: PayloadAction<{ width: number; updateAspectRatio?: boolean; clamp?: boolean }>
    ) => {
      const { width, updateAspectRatio, clamp } = action.payload;
      state.bbox.rect.width = clamp ? Math.max(roundDownToMultiple(width, 8), 64) : width;

      if (state.bbox.aspectRatio.isLocked) {
        state.bbox.rect.height = roundToMultiple(state.bbox.rect.width / state.bbox.aspectRatio.value, 8);
      }

      if (updateAspectRatio || !state.bbox.aspectRatio.isLocked) {
        state.bbox.aspectRatio.value = state.bbox.rect.width / state.bbox.rect.height;
        state.bbox.aspectRatio.id = 'Free';
        state.bbox.aspectRatio.isLocked = false;
      }

      syncScaledSize(state);
    },
    bboxHeightChanged: (
      state,
      action: PayloadAction<{ height: number; updateAspectRatio?: boolean; clamp?: boolean }>
    ) => {
      const { height, updateAspectRatio, clamp } = action.payload;

      state.bbox.rect.height = clamp ? Math.max(roundDownToMultiple(height, 8), 64) : height;

      if (state.bbox.aspectRatio.isLocked) {
        state.bbox.rect.width = roundToMultiple(state.bbox.rect.height * state.bbox.aspectRatio.value, 8);
      }

      if (updateAspectRatio || !state.bbox.aspectRatio.isLocked) {
        state.bbox.aspectRatio.value = state.bbox.rect.width / state.bbox.rect.height;
        state.bbox.aspectRatio.id = 'Free';
        state.bbox.aspectRatio.isLocked = false;
      }

      syncScaledSize(state);
    },
    bboxAspectRatioLockToggled: (state) => {
      state.bbox.aspectRatio.isLocked = !state.bbox.aspectRatio.isLocked;
      syncScaledSize(state);
    },
    bboxAspectRatioIdChanged: (state, action: PayloadAction<{ id: AspectRatioID }>) => {
      const { id } = action.payload;
      state.bbox.aspectRatio.id = id;
      if (id === 'Free') {
        state.bbox.aspectRatio.isLocked = false;
      } else {
        state.bbox.aspectRatio.isLocked = true;
        state.bbox.aspectRatio.value = ASPECT_RATIO_MAP[id].ratio;
        const { width, height } = calculateNewSize(
          state.bbox.aspectRatio.value,
          state.bbox.rect.width * state.bbox.rect.height
        );
        state.bbox.rect.width = width;
        state.bbox.rect.height = height;
      }

      syncScaledSize(state);
    },
    bboxDimensionsSwapped: (state) => {
      state.bbox.aspectRatio.value = 1 / state.bbox.aspectRatio.value;
      if (state.bbox.aspectRatio.id === 'Free') {
        const newWidth = state.bbox.rect.height;
        const newHeight = state.bbox.rect.width;
        state.bbox.rect.width = newWidth;
        state.bbox.rect.height = newHeight;
      } else {
        const { width, height } = calculateNewSize(
          state.bbox.aspectRatio.value,
          state.bbox.rect.width * state.bbox.rect.height
        );
        state.bbox.rect.width = width;
        state.bbox.rect.height = height;
        state.bbox.aspectRatio.id = ASPECT_RATIO_MAP[state.bbox.aspectRatio.id].inverseID;
      }

      syncScaledSize(state);
    },
    bboxSizeOptimized: (state) => {
      if (state.bbox.aspectRatio.isLocked) {
        const { width, height } = calculateNewSize(state.bbox.aspectRatio.value, state.bbox.optimalDimension ** 2);
        state.bbox.rect.width = width;
        state.bbox.rect.height = height;
      } else {
        state.bbox.aspectRatio = deepClone(initialAspectRatioState);
        state.bbox.rect.width = state.bbox.optimalDimension;
        state.bbox.rect.height = state.bbox.optimalDimension;
      }

      syncScaledSize(state);
    },
    //#region Shared entity
    entitySelected: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        // Cannot select a non-existent entity
        return;
      }
      state.selectedEntityIdentifier = entityIdentifier;
    },
    bookmarkedEntityChanged: (state, action: PayloadAction<{ entityIdentifier: CanvasEntityIdentifier | null }>) => {
      const { entityIdentifier } = action.payload;
      if (!entityIdentifier) {
        state.bookmarkedEntityIdentifier = null;
        return;
      }
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        // Cannot select a non-existent entity
        return;
      }
      state.bookmarkedEntityIdentifier = entityIdentifier;
    },
    entityNameChanged: (state, action: PayloadAction<EntityIdentifierPayload<{ name: string | null }>>) => {
      const { entityIdentifier, name } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.name = name;
    },
    entityReset: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      } else if (isRenderableEntity(entity)) {
        entity.isEnabled = true;
        entity.objects = [];
        entity.position = { x: 0, y: 0 };
      } else {
        assert(false, 'Not implemented');
      }
    },
    entityDuplicated: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      const newEntity = deepClone(entity);
      if (newEntity.name) {
        newEntity.name = `${newEntity.name} (Copy)`;
      }
      switch (newEntity.type) {
        case 'raster_layer':
          newEntity.id = getPrefixedId('raster_layer');
          state.rasterLayers.entities.push(newEntity);
          break;
        case 'control_layer':
          newEntity.id = getPrefixedId('control_layer');
          state.controlLayers.entities.push(newEntity);
          break;
        case 'regional_guidance':
          newEntity.id = getPrefixedId('regional_guidance');
          state.regions.entities.push(newEntity);
          break;
        case 'ip_adapter':
          newEntity.id = getPrefixedId('ip_adapter');
          state.ipAdapters.entities.push(newEntity);
          break;
        case 'inpaint_mask':
          newEntity.id = getPrefixedId('inpaint_mask');
          state.inpaintMasks.entities.push(newEntity);
          break;
      }

      state.selectedEntityIdentifier = getEntityIdentifier(newEntity);
    },
    entityIsEnabledToggled: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.isEnabled = !entity.isEnabled;
    },
    entityIsLockedToggled: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.isLocked = !entity.isLocked;
    },
    entityFillColorChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ color: RgbColor }, 'inpaint_mask' | 'regional_guidance'>>
    ) => {
      const { color, entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.fill.color = color;
    },
    entityFillStyleChanged: (
      state,
      action: PayloadAction<EntityIdentifierPayload<{ style: FillStyle }, 'inpaint_mask' | 'regional_guidance'>>
    ) => {
      const { style, entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      entity.fill.style = style;
    },
    entityMoved: (state, action: PayloadAction<EntityMovedPayload>) => {
      const { entityIdentifier, position } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      if (isRenderableEntity(entity)) {
        entity.position = position;
      }
    },
    entityRasterized: (state, action: PayloadAction<EntityRasterizedPayload>) => {
      const { entityIdentifier, imageObject, position, replaceObjects } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      if (isRenderableEntity(entity)) {
        if (replaceObjects) {
          entity.objects = [imageObject];
          entity.position = position;
        }
      }
    },
    entityBrushLineAdded: (state, action: PayloadAction<EntityBrushLineAddedPayload>) => {
      const { entityIdentifier, brushLine } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      if (!isRenderableEntity(entity)) {
        assert(false, `Cannot add a brush line to a non-drawable entity of type ${entity.type}`);
      }

      // TODO(psyche): If we add the object without splatting, the renderer will see it as the same object and not
      // re-render it (reference equality check). I don't like this behaviour.
      entity.objects.push({ ...brushLine, points: simplifyFlatNumbersArray(brushLine.points) });
    },
    entityEraserLineAdded: (state, action: PayloadAction<EntityEraserLineAddedPayload>) => {
      const { entityIdentifier, eraserLine } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      if (!isRenderableEntity(entity)) {
        assert(false, `Cannot add a eraser line to a non-drawable entity of type ${entity.type}`);
      }

      // TODO(psyche): If we add the object without splatting, the renderer will see it as the same object and not
      // re-render it (reference equality check). I don't like this behaviour.
      entity.objects.push({ ...eraserLine, points: simplifyFlatNumbersArray(eraserLine.points) });
    },
    entityRectAdded: (state, action: PayloadAction<EntityRectAddedPayload>) => {
      const { entityIdentifier, rect } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }

      if (!isRenderableEntity(entity)) {
        assert(false, `Cannot add a rect to a non-drawable entity of type ${entity.type}`);
      }

      // TODO(psyche): If we add the object without splatting, the renderer will see it as the same object and not
      // re-render it (reference equality check). I don't like this behaviour.
      entity.objects.push({ ...rect });
    },
    entityDeleted: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;

      let selectedEntityIdentifier: CanvasState['selectedEntityIdentifier'] = null;
      const allEntities = selectAllEntities(state);
      const index = allEntities.findIndex((entity) => entity.id === entityIdentifier.id);
      const nextIndex = allEntities.length > 1 ? (index + 1) % allEntities.length : -1;
      if (nextIndex !== -1) {
        const nextEntity = allEntities[nextIndex];
        if (nextEntity) {
          selectedEntityIdentifier = getEntityIdentifier(nextEntity);
        }
      }

      switch (entityIdentifier.type) {
        case 'raster_layer':
          state.rasterLayers.entities = state.rasterLayers.entities.filter((layer) => layer.id !== entityIdentifier.id);
          break;
        case 'control_layer':
          state.controlLayers.entities = state.controlLayers.entities.filter((rg) => rg.id !== entityIdentifier.id);
          break;
        case 'regional_guidance':
          state.regions.entities = state.regions.entities.filter((rg) => rg.id !== entityIdentifier.id);
          break;
        case 'ip_adapter':
          state.ipAdapters.entities = state.ipAdapters.entities.filter((rg) => rg.id !== entityIdentifier.id);
          break;
        case 'inpaint_mask':
          state.inpaintMasks.entities = state.inpaintMasks.entities.filter((rg) => rg.id !== entityIdentifier.id);
          break;
      }

      state.selectedEntityIdentifier = selectedEntityIdentifier;
    },
    entityArrangedForwardOne: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      moveOneToEnd(selectAllEntitiesOfType(state, entity.type), entity);
    },
    entityArrangedToFront: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      moveToEnd(selectAllEntitiesOfType(state, entity.type), entity);
    },
    entityArrangedBackwardOne: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      moveOneToStart(selectAllEntitiesOfType(state, entity.type), entity);
    },
    entityArrangedToBack: (state, action: PayloadAction<EntityIdentifierPayload>) => {
      const { entityIdentifier } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      moveToStart(selectAllEntitiesOfType(state, entity.type), entity);
    },
    entityOpacityChanged: (state, action: PayloadAction<EntityIdentifierPayload<{ opacity: number }>>) => {
      const { entityIdentifier, opacity } = action.payload;
      const entity = selectEntity(state, entityIdentifier);
      if (!entity) {
        return;
      }
      if (entity.type === 'ip_adapter') {
        return;
      }
      entity.opacity = opacity;
    },
    allEntitiesOfTypeIsHiddenToggled: (state, action: PayloadAction<{ type: CanvasEntityIdentifier['type'] }>) => {
      const { type } = action.payload;

      switch (type) {
        case 'raster_layer':
          state.rasterLayers.isHidden = !state.rasterLayers.isHidden;
          break;
        case 'control_layer':
          state.controlLayers.isHidden = !state.controlLayers.isHidden;
          break;
        case 'inpaint_mask':
          state.inpaintMasks.isHidden = !state.inpaintMasks.isHidden;
          break;
        case 'regional_guidance':
          state.regions.isHidden = !state.regions.isHidden;
          break;
        case 'ip_adapter':
          // no-op
          break;
      }
    },
    allEntitiesDeleted: (state) => {
      state.ipAdapters = deepClone(initialState.ipAdapters);
      state.rasterLayers = deepClone(initialState.rasterLayers);
      state.controlLayers = deepClone(initialState.controlLayers);
      state.regions = deepClone(initialState.regions);
      state.inpaintMasks = deepClone(initialState.inpaintMasks);

      state.selectedEntityIdentifier = deepClone(initialState.selectedEntityIdentifier);
    },
    canvasReset: (state) => {
      const newState = deepClone(initialState);

      // We need to retain the optimal dimension across resets, as it is changed only when the model changes. Copy it
      // from the old state, then recalculate the bbox size & scaled size.
      newState.bbox.optimalDimension = state.bbox.optimalDimension;
      const rect = calculateNewSize(
        newState.bbox.aspectRatio.value,
        newState.bbox.optimalDimension * newState.bbox.optimalDimension
      );
      newState.bbox.rect.width = rect.width;
      newState.bbox.rect.height = rect.height;
      syncScaledSize(newState);

      return newState;
    },
    canvasUndo: () => {},
    canvasRedo: () => {},
    canvasClearHistory: () => {},
  },
  extraReducers(builder) {
    builder.addCase(modelChanged, (state, action) => {
      const { model, previousModel } = action.payload;

      // If the model base changes (e.g. SD1.5 -> SDXL), we need to change a few things
      if (model === null || previousModel?.base === model.base) {
        return;
      }

      // Update the bbox size to match the new model's optimal size
      const optimalDimension = getOptimalDimension(model);

      state.bbox.optimalDimension = optimalDimension;

      if (!getIsSizeOptimal(state.bbox.rect.width, state.bbox.rect.height, optimalDimension)) {
        const bboxDims = calculateNewSize(state.bbox.aspectRatio.value, optimalDimension * optimalDimension);
        state.bbox.rect.width = bboxDims.width;
        state.bbox.rect.height = bboxDims.height;
        syncScaledSize(state);
      }
    });
  },
});

export const {
  canvasReset,
  canvasUndo,
  canvasRedo,
  canvasClearHistory,
  // All entities
  entitySelected,
  bookmarkedEntityChanged,
  entityNameChanged,
  entityReset,
  entityIsEnabledToggled,
  entityIsLockedToggled,
  entityFillColorChanged,
  entityFillStyleChanged,
  entityMoved,
  entityDuplicated,
  entityRasterized,
  entityBrushLineAdded,
  entityEraserLineAdded,
  entityRectAdded,
  entityDeleted,
  entityArrangedForwardOne,
  entityArrangedToFront,
  entityArrangedBackwardOne,
  entityArrangedToBack,
  entityOpacityChanged,
  // allEntitiesDeleted, // currently unused
  allEntitiesOfTypeIsHiddenToggled,
  // bbox
  bboxChangedFromCanvas,
  bboxScaledWidthChanged,
  bboxScaledHeightChanged,
  bboxScaleMethodChanged,
  bboxWidthChanged,
  bboxHeightChanged,
  bboxAspectRatioLockToggled,
  bboxAspectRatioIdChanged,
  bboxDimensionsSwapped,
  bboxSizeOptimized,
  // Raster layers
  rasterLayerAdded,
  // rasterLayerRecalled,
  rasterLayerConvertedToControlLayer,
  // Control layers
  controlLayerAdded,
  // controlLayerRecalled,
  controlLayerConvertedToRasterLayer,
  controlLayerModelChanged,
  controlLayerControlModeChanged,
  controlLayerWeightChanged,
  controlLayerBeginEndStepPctChanged,
  controlLayerWithTransparencyEffectToggled,
  // IP Adapters
  ipaAdded,
  // ipaRecalled,
  ipaImageChanged,
  ipaMethodChanged,
  ipaModelChanged,
  ipaCLIPVisionModelChanged,
  ipaWeightChanged,
  ipaBeginEndStepPctChanged,
  // Regions
  rgAdded,
  // rgRecalled,
  rgPositivePromptChanged,
  rgNegativePromptChanged,
  rgAutoNegativeToggled,
  rgIPAdapterAdded,
  rgIPAdapterDeleted,
  rgIPAdapterImageChanged,
  rgIPAdapterWeightChanged,
  rgIPAdapterBeginEndStepPctChanged,
  rgIPAdapterMethodChanged,
  rgIPAdapterModelChanged,
  rgIPAdapterCLIPVisionModelChanged,
  // Inpaint mask
  inpaintMaskAdded,
  // inpaintMaskRecalled,
} = canvasSlice.actions;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const migrate = (state: any): any => {
  return state;
};

export const canvasPersistConfig: PersistConfig<CanvasState> = {
  name: canvasSlice.name,
  initialState,
  migrate,
  persistDenylist: [],
};

const syncScaledSize = (state: CanvasState) => {
  if (state.bbox.scaleMethod === 'auto') {
    // Sync both aspect ratio and size
    const { width, height } = state.bbox.rect;
    state.bbox.scaledSize = getScaledBoundingBoxDimensions({ width, height }, state.bbox.optimalDimension);
  } else if (state.bbox.scaleMethod === 'manual' && state.bbox.aspectRatio.isLocked) {
    // Only sync the aspect ratio if manual & locked
    state.bbox.scaledSize = calculateNewSize(
      state.bbox.aspectRatio.value,
      state.bbox.scaledSize.width * state.bbox.scaledSize.height,
      64
    );
  }
};

let filter = true;

export const canvasUndoableConfig: UndoableOptions<CanvasState, UnknownAction> = {
  limit: 64,
  undoType: canvasUndo.type,
  redoType: canvasRedo.type,
  clearHistoryType: canvasClearHistory.type,
  filter: (action, _state, _history) => {
    // Ignore all actions from other slices
    if (!action.type.startsWith(canvasSlice.name)) {
      return false;
    }
    // Throttle rapid actions of the same type
    filter = actionsThrottlingFilter(action);
    return filter;
  },
  // This is pretty spammy, leave commented out unless you need it
  // debug: import.meta.env.MODE === 'development',
};

const doNotGroupMatcher = isAnyOf(entityBrushLineAdded, entityEraserLineAdded, entityRectAdded);

// Store rapid actions of the same type at most once every x time.
// See: https://github.com/omnidan/redux-undo/blob/master/examples/throttled-drag/util/undoFilter.js
const THROTTLE_MS = 1000;
let ignoreRapid = false;
let prevActionType: string | null = null;
function actionsThrottlingFilter(action: UnknownAction) {
  // If the actions are of a different type, reset the throttle and allow the action
  if (action.type !== prevActionType || doNotGroupMatcher(action)) {
    ignoreRapid = false;
    prevActionType = action.type;
    return true;
  }
  // Else, if the actions are of the same type, throttle them. Ignore the action if the flag is set.
  if (ignoreRapid) {
    return false;
  }
  // We are allowing this action - set the flag and a timeout to clear it.
  ignoreRapid = true;
  window.setTimeout(() => {
    ignoreRapid = false;
  }, THROTTLE_MS);
  return true;
}

export const $lastCanvasProgressEvent = atom<S['InvocationDenoiseProgressEvent'] | null>(null);
/**
 * The global canvas manager instance.
 */
export const $canvasManager = atom<CanvasManager | null>(null);
