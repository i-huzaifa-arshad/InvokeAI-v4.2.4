import { createSelector } from '@reduxjs/toolkit';
import { createMemoizedSelector } from 'app/store/createMemoizedSelector';
import { useAppSelector } from 'app/store/storeHooks';
import {
  isControlAdapterLayer,
  isRegionalGuidanceLayer,
  selectControlLayersSlice,
} from 'features/controlLayers/store/controlLayersSlice';
import { useMemo } from 'react';
import { assert } from 'tsafe';

export const useLayerPositivePrompt = (layerId: string) => {
  const selectLayer = useMemo(
    () =>
      createSelector(selectControlLayersSlice, (controlLayers) => {
        const layer = controlLayers.present.layers.find((l) => l.id === layerId);
        assert(isRegionalGuidanceLayer(layer), `Layer ${layerId} not found or not an RP layer`);
        assert(layer.positivePrompt !== null, `Layer ${layerId} does not have a positive prompt`);
        return layer.positivePrompt;
      }),
    [layerId]
  );
  const prompt = useAppSelector(selectLayer);
  return prompt;
};

export const useLayerNegativePrompt = (layerId: string) => {
  const selectLayer = useMemo(
    () =>
      createSelector(selectControlLayersSlice, (controlLayers) => {
        const layer = controlLayers.present.layers.find((l) => l.id === layerId);
        assert(isRegionalGuidanceLayer(layer), `Layer ${layerId} not found or not an RP layer`);
        assert(layer.negativePrompt !== null, `Layer ${layerId} does not have a negative prompt`);
        return layer.negativePrompt;
      }),
    [layerId]
  );
  const prompt = useAppSelector(selectLayer);
  return prompt;
};

export const useLayerIsEnabled = (layerId: string) => {
  const selectLayer = useMemo(
    () =>
      createSelector(selectControlLayersSlice, (controlLayers) => {
        const layer = controlLayers.present.layers.find((l) => l.id === layerId);
        assert(layer, `Layer ${layerId} not found`);
        return layer.isEnabled;
      }),
    [layerId]
  );
  const isVisible = useAppSelector(selectLayer);
  return isVisible;
};

export const useLayerType = (layerId: string) => {
  const selectLayer = useMemo(
    () =>
      createSelector(selectControlLayersSlice, (controlLayers) => {
        const layer = controlLayers.present.layers.find((l) => l.id === layerId);
        assert(layer, `Layer ${layerId} not found`);
        return layer.type;
      }),
    [layerId]
  );
  const type = useAppSelector(selectLayer);
  return type;
};

export const useLayerOpacity = (layerId: string) => {
  const selectLayer = useMemo(
    () =>
      createMemoizedSelector(selectControlLayersSlice, (controlLayers) => {
        const layer = controlLayers.present.layers.filter(isControlAdapterLayer).find((l) => l.id === layerId);
        assert(layer, `Layer ${layerId} not found`);
        return { opacity: Math.round(layer.opacity * 100), isFilterEnabled: layer.isFilterEnabled };
      }),
    [layerId]
  );
  const opacity = useAppSelector(selectLayer);
  return opacity;
};
