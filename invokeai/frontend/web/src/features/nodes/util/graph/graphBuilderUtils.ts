import type { RootState } from 'app/store/store';
import type { BoardField } from 'features/nodes/types/common';
import { activeTabNameSelector } from 'features/ui/store/uiSelectors';

/**
 * Gets the board field, based on the autoAddBoardId setting.
 */
export const getBoardField = (state: RootState): BoardField | undefined => {
  const { autoAddBoardId } = state.gallery;
  if (autoAddBoardId === 'none') {
    return undefined;
  }
  return { board_id: autoAddBoardId };
};

/**
 * Gets the SDXL style prompts, based on the concat setting.
 */
export const getSDXLStylePrompts = (state: RootState): { positiveStylePrompt: string; negativeStylePrompt: string } => {
  const { positivePrompt, negativePrompt, positivePrompt2, negativePrompt2, shouldConcatPrompts } =
    state.controlLayers.present;

  return {
    positiveStylePrompt: shouldConcatPrompts ? positivePrompt : positivePrompt2,
    negativeStylePrompt: shouldConcatPrompts ? negativePrompt : negativePrompt2,
  };
};

/**
 * Gets the is_intermediate field, based on the active tab and shouldAutoSave setting.
 */
export const getIsIntermediate = (state: RootState) => {
  const activeTabName = activeTabNameSelector(state);
  if (activeTabName === 'canvas') {
    return !state.canvas.shouldAutoSave;
  }
  return false;
};
