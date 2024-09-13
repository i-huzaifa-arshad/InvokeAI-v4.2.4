import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from 'app/store/store';
import { selectParamsSlice } from 'features/controlLayers/store/paramsSlice';
import type {
  CanvasControlLayerState,
  CanvasEntityIdentifier,
  CanvasEntityState,
  CanvasEntityType,
  CanvasInpaintMaskState,
  CanvasRasterLayerState,
  CanvasRegionalGuidanceState,
  CanvasState,
} from 'features/controlLayers/store/types';
import { getOptimalDimension } from 'features/parameters/util/optimalDimension';
import { assert } from 'tsafe';

/**
 * Selects the canvas slice from the root state
 */
export const selectCanvasSlice = (state: RootState) => state.canvas.present;

/**
 * Selects the total canvas entity count:
 * - Regions
 * - IP adapters
 * - Raster layers
 * - Control layers
 * - Inpaint masks
 *
 * All entities are counted, regardless of their state.
 */
const selectEntityCountAll = createSelector(selectCanvasSlice, (canvas) => {
  return (
    canvas.regions.entities.length +
    canvas.ipAdapters.entities.length +
    canvas.rasterLayers.entities.length +
    canvas.controlLayers.entities.length +
    canvas.inpaintMasks.entities.length
  );
});

const selectActiveRasterLayerEntities = createSelector(selectCanvasSlice, (canvas) =>
  canvas.rasterLayers.entities.filter((e) => e.isEnabled && e.objects.length > 0)
);

const selectActiveControlLayerEntities = createSelector(selectCanvasSlice, (canvas) =>
  canvas.controlLayers.entities.filter((e) => e.isEnabled && e.objects.length > 0)
);

const selectActiveInpaintMaskEntities = createSelector(selectCanvasSlice, (canvas) =>
  canvas.inpaintMasks.entities.filter((e) => e.isEnabled && e.objects.length > 0)
);

const selectActiveRegionalGuidanceEntities = createSelector(selectCanvasSlice, (canvas) =>
  canvas.regions.entities.filter((e) => e.isEnabled && e.objects.length > 0)
);

const selectActiveIPAdapterEntities = createSelector(selectCanvasSlice, (canvas) =>
  canvas.ipAdapters.entities.filter((e) => e.isEnabled)
);

/**
 * Selects the total _active_ canvas entity count:
 * - Regions
 * - IP adapters
 * - Raster layers
 * - Control layers
 * - Inpaint masks
 *
 * Active entities are those that are enabled and have at least one object.
 */
export const selectEntityCountActive = createSelector(
  selectActiveRasterLayerEntities,
  selectActiveControlLayerEntities,
  selectActiveInpaintMaskEntities,
  selectActiveRegionalGuidanceEntities,
  selectActiveIPAdapterEntities,
  (
    activeRasterLayerEntities,
    activeControlLayerEntities,
    activeInpaintMaskEntities,
    activeRegionalGuidanceEntities,
    activeIPAdapterEntities
  ) => {
    return (
      activeRasterLayerEntities.length +
      activeControlLayerEntities.length +
      activeInpaintMaskEntities.length +
      activeRegionalGuidanceEntities.length +
      activeIPAdapterEntities.length
    );
  }
);

/**
 * Selects if the canvas has any entities.
 */
export const selectHasEntities = createSelector(selectEntityCountAll, (count) => count > 0);

/**
 * Selects the optimal dimension for the canvas based on the currently-model
 */
export const selectOptimalDimension = createSelector(selectParamsSlice, (params) => {
  return getOptimalDimension(params.model);
});

/**
 * Selects a single entity from the canvas slice. If the entity identifier is narrowed to a specific type, the
 * return type will be narrowed as well.
 */
export function selectEntity<T extends CanvasEntityIdentifier>(
  state: CanvasState,
  entityIdentifier: T
): Extract<CanvasEntityState, T> | undefined {
  const { id, type } = entityIdentifier;

  let entity: CanvasEntityState | undefined = undefined;

  switch (type) {
    case 'raster_layer':
      entity = state.rasterLayers.entities.find((entity) => entity.id === id);
      break;
    case 'control_layer':
      entity = state.controlLayers.entities.find((entity) => entity.id === id);
      break;
    case 'inpaint_mask':
      entity = state.inpaintMasks.entities.find((entity) => entity.id === id);
      break;
    case 'regional_guidance':
      entity = state.regions.entities.find((entity) => entity.id === id);
      break;
    case 'ip_adapter':
      entity = state.ipAdapters.entities.find((entity) => entity.id === id);
      break;
  }

  // This cast is safe, but TS seems to be unable to infer the type
  return entity as Extract<CanvasEntityState, T>;
}

/**
 * Selected an entity from the canvas slice. If the entity is not found, an error is thrown.
 * Wrapper around {@link selectEntity}.
 */
export function selectEntityOrThrow<T extends CanvasEntityIdentifier>(
  state: CanvasState,
  entityIdentifier: T
): Extract<CanvasEntityState, T> {
  const entity = selectEntity(state, entityIdentifier);
  assert(entity, `Entity with id ${entityIdentifier.id} not found`);
  return entity;
}

/**
 * Selects all entities of the given type.
 */
export function selectAllEntitiesOfType<T extends CanvasEntityState['type']>(
  state: CanvasState,
  type: T
): Extract<CanvasEntityState, { type: T }>[] {
  let entities: CanvasEntityState[] = [];

  switch (type) {
    case 'raster_layer':
      entities = state.rasterLayers.entities;
      break;
    case 'control_layer':
      entities = state.controlLayers.entities;
      break;
    case 'inpaint_mask':
      entities = state.inpaintMasks.entities;
      break;
    case 'regional_guidance':
      entities = state.regions.entities;
      break;
    case 'ip_adapter':
      entities = state.ipAdapters.entities;
      break;
  }

  // This cast is safe, but TS seems to be unable to infer the type
  return entities as Extract<CanvasEntityState, { type: T }>[];
}

/**
 * Selects all entities, in the order they are displayed in the list.
 */
export function selectAllEntities(state: CanvasState): CanvasEntityState[] {
  // These are in the same order as they are displayed in the list!
  return [
    ...state.inpaintMasks.entities.toReversed(),
    ...state.regions.entities.toReversed(),
    ...state.ipAdapters.entities.toReversed(),
    ...state.controlLayers.entities.toReversed(),
    ...state.rasterLayers.entities.toReversed(),
  ];
}

/**
 * Selects all _renderable_ entities:
 * - Raster layers
 * - Control layers
 * - Inpaint masks
 * - Regional guidance
 */
export function selectAllRenderableEntities(
  state: CanvasState
): (CanvasRasterLayerState | CanvasControlLayerState | CanvasInpaintMaskState | CanvasRegionalGuidanceState)[] {
  return [
    ...state.rasterLayers.entities,
    ...state.controlLayers.entities,
    ...state.inpaintMasks.entities,
    ...state.regions.entities,
  ];
}

/**
 * Selects the IP adapter for the specific Regional Guidance layer.
 */
export function selectRegionalGuidanceIPAdapter(
  state: CanvasState,
  entityIdentifier: CanvasEntityIdentifier<'regional_guidance'>,
  ipAdapterId: string
) {
  const entity = selectEntity(state, entityIdentifier);
  if (!entity) {
    return undefined;
  }
  return entity.ipAdapters.find((ipAdapter) => ipAdapter.id === ipAdapterId);
}

export const selectBbox = createSelector(selectCanvasSlice, (canvas) => canvas.bbox);

export const selectSelectedEntityIdentifier = createSelector(
  selectCanvasSlice,
  (canvas) => canvas.selectedEntityIdentifier
);

export const selectBookmarkedEntityIdentifier = createSelector(
  selectCanvasSlice,
  (canvas) => canvas.bookmarkedEntityIdentifier
);

export const selectCanvasMayUndo = (state: RootState) => state.canvas.past.length > 0;
export const selectCanvasMayRedo = (state: RootState) => state.canvas.future.length > 0;
export const selectSelectedEntityFill = createSelector(
  selectCanvasSlice,
  selectSelectedEntityIdentifier,
  (canvas, selectedEntityIdentifier) => {
    if (!selectedEntityIdentifier) {
      return null;
    }
    const entity = selectEntity(canvas, selectedEntityIdentifier);
    if (!entity) {
      return null;
    }
    if (entity.type !== 'inpaint_mask' && entity.type !== 'regional_guidance') {
      return null;
    }
    return entity.fill;
  }
);

const selectRasterLayersIsHidden = createSelector(selectCanvasSlice, (canvas) => canvas.rasterLayers.isHidden);
const selectControlLayersIsHidden = createSelector(selectCanvasSlice, (canvas) => canvas.controlLayers.isHidden);
const selectInpaintMasksIsHidden = createSelector(selectCanvasSlice, (canvas) => canvas.inpaintMasks.isHidden);
const selectRegionalGuidanceIsHidden = createSelector(selectCanvasSlice, (canvas) => canvas.regions.isHidden);

/**
 * Returns the hidden selector for the given entity type.
 */
export const getIsHiddenSelector = (type: CanvasEntityType) => {
  switch (type) {
    case 'raster_layer':
      return selectRasterLayersIsHidden;
    case 'control_layer':
      return selectControlLayersIsHidden;
    case 'inpaint_mask':
      return selectInpaintMasksIsHidden;
    case 'regional_guidance':
      return selectRegionalGuidanceIsHidden;
    default:
      assert(false, 'Unhandled entity type');
  }
};

export const selectWidth = createSelector(selectCanvasSlice, (canvas) => canvas.bbox.rect.width);
export const selectHeight = createSelector(selectCanvasSlice, (canvas) => canvas.bbox.rect.height);
export const selectAspectRatioID = createSelector(selectCanvasSlice, (canvas) => canvas.bbox.aspectRatio.id);
export const selectAspectRatioValue = createSelector(selectCanvasSlice, (canvas) => canvas.bbox.aspectRatio.value);
