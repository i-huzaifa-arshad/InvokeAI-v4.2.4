import type { PayloadAction, Selector } from '@reduxjs/toolkit';
import { createSelector, createSlice } from '@reduxjs/toolkit';
import type { PersistConfig, RootState } from 'app/store/store';
import type { RgbaColor } from 'features/controlLayers/store/types';

type CanvasSettingsState = {
  /**
   * Whether to show HUD (Heads-Up Display) on the canvas.
   */
  showHUD: boolean;
  /**
   * Whether to automatically save canvas generations to the gallery.
   *
   * When `sendToCanvas` is disabled, this setting is ignored, and images are always saved to the gallery.
   */
  autoSave: boolean;
  /**
   * Whether to clip lines and shapes to the generation bounding box. If disabled, lines and shapes will be clipped to
   * the canvas bounds.
   */
  clipToBbox: boolean;
  /**
   * Whether to show a dynamic grid on the canvas. If disabled, a checkerboard pattern will be shown instead.
   */
  dynamicGrid: boolean;
  /**
   * Whether to invert the scroll direction when adjusting the brush or eraser width with the scroll wheel.
   */
  invertScrollForToolWidth: boolean;
  /**
   * The width of the brush tool.
   */
  brushWidth: number;
  /**
   * The width of the eraser tool.
   */
  eraserWidth: number;
  /**
   * The color to use when drawing lines or filling shapes.
   */
  color: RgbaColor;
  /**
   * Whether to send generated images to canvas staging area. When disabled, generated images will be sent directly to
   * the gallery.
   */
  sendToCanvas: boolean;
  /**
   * Whether to composite inpainted/outpainted regions back onto the source image when saving canvas generations.
   *
   * If disabled, inpainted/outpainted regions will be saved with a transparent background.
   *
   * When `sendToCanvas` is disabled, this setting is ignored, masked regions will always be composited.
   */
  compositeMaskedRegions: boolean;
  /**
   * Whether to automatically process the filter when the filter configuration changes.
   */
  autoProcessFilter: boolean;
  /**
   * The snap-to-grid setting for the canvas.
   */
  snapToGrid: boolean;
  // TODO(psyche): These are copied from old canvas state, need to be implemented
  // imageSmoothing: boolean;
  // preserveMaskedArea: boolean;
  // cropToBboxOnSave: boolean;
};

const initialState: CanvasSettingsState = {
  autoSave: false,
  showHUD: true,
  clipToBbox: false,
  dynamicGrid: false,
  brushWidth: 50,
  eraserWidth: 50,
  invertScrollForToolWidth: false,
  color: { r: 31, g: 160, b: 224, a: 1 }, // invokeBlue.500
  sendToCanvas: false,
  compositeMaskedRegions: false,
  autoProcessFilter: true,
  snapToGrid: true,
};

export const canvasSettingsSlice = createSlice({
  name: 'canvasSettings',
  initialState,
  reducers: {
    settingsClipToBboxChanged: (state, action: PayloadAction<boolean>) => {
      state.clipToBbox = action.payload;
    },
    settingsDynamicGridToggled: (state) => {
      state.dynamicGrid = !state.dynamicGrid;
    },
    settingsAutoSaveToggled: (state) => {
      state.autoSave = !state.autoSave;
    },
    settingsShowHUDToggled: (state) => {
      state.showHUD = !state.showHUD;
    },
    settingsBrushWidthChanged: (state, action: PayloadAction<number>) => {
      state.brushWidth = Math.round(action.payload);
    },
    settingsEraserWidthChanged: (state, action: PayloadAction<number>) => {
      state.eraserWidth = Math.round(action.payload);
    },
    settingsColorChanged: (state, action: PayloadAction<RgbaColor>) => {
      state.color = action.payload;
    },
    settingsInvertScrollForToolWidthChanged: (state, action: PayloadAction<boolean>) => {
      state.invertScrollForToolWidth = action.payload;
    },
    settingsSendToCanvasChanged: (state, action: PayloadAction<boolean>) => {
      state.sendToCanvas = action.payload;
    },
    settingsCompositeMaskedRegionsChanged: (state, action: PayloadAction<boolean>) => {
      state.compositeMaskedRegions = action.payload;
    },
    settingsAutoProcessFilterToggled: (state) => {
      state.autoProcessFilter = !state.autoProcessFilter;
    },
    settingsSnapToGridToggled: (state) => {
      state.snapToGrid = !state.snapToGrid;
    },
  },
});

export const {
  settingsClipToBboxChanged,
  settingsAutoSaveToggled,
  settingsDynamicGridToggled,
  settingsShowHUDToggled,
  settingsBrushWidthChanged,
  settingsEraserWidthChanged,
  settingsColorChanged,
  settingsInvertScrollForToolWidthChanged,
  settingsSendToCanvasChanged,
  settingsCompositeMaskedRegionsChanged,
  settingsAutoProcessFilterToggled,
  settingsSnapToGridToggled,
} = canvasSettingsSlice.actions;

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const migrate = (state: any): any => {
  return state;
};

export const canvasSettingsPersistConfig: PersistConfig<CanvasSettingsState> = {
  name: canvasSettingsSlice.name,
  initialState,
  migrate,
  persistDenylist: [],
};

export const selectCanvasSettingsSlice = (s: RootState) => s.canvasSettings;
const createCanvasSettingsSelector = <T>(selector: Selector<CanvasSettingsState, T>) =>
  createSelector(selectCanvasSettingsSlice, selector);

export const selectAutoSave = createCanvasSettingsSelector((settings) => settings.autoSave);
export const selectDynamicGrid = createCanvasSettingsSelector((settings) => settings.dynamicGrid);
export const selectShowHUD = createCanvasSettingsSelector((settings) => settings.showHUD);
export const selectAutoProcessFilter = createCanvasSettingsSelector((settings) => settings.autoProcessFilter);
export const selectSnapToGrid = createCanvasSettingsSelector((settings) => settings.snapToGrid);
export const selectSendToCanvas = createCanvasSettingsSelector((canvasSettings) => canvasSettings.sendToCanvas);
