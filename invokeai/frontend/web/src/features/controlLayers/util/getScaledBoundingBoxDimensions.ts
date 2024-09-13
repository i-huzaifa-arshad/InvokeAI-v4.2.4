import { roundToMultiple } from 'common/util/roundDownToMultiple';
import type { Dimensions } from 'features/controlLayers/store/types';

/**
 * Scales the bounding box dimensions to the optimal dimension. The optimal dimensions should be the trained dimension
 * for the model. For example, 1024 for SDXL or 512 for SD1.5.
 * @param dimensions The un-scaled bbox dimensions
 * @param optimalDimension The optimal dimension to scale the bbox to
 */
export const getScaledBoundingBoxDimensions = (
  dimensions: Dimensions,
  optimalDimension: number,
  gridSize: number = 64
): Dimensions => {
  const { width, height } = dimensions;

  const scaledDimensions = { width, height };
  const targetArea = optimalDimension * optimalDimension;
  const aspectRatio = width / height;
  let currentArea = width * height;
  let maxDimension = optimalDimension - gridSize;
  while (currentArea < targetArea) {
    maxDimension += gridSize;
    if (width === height) {
      scaledDimensions.width = optimalDimension;
      scaledDimensions.height = optimalDimension;
      break;
    } else {
      if (aspectRatio > 1) {
        scaledDimensions.width = maxDimension;
        scaledDimensions.height = roundToMultiple(maxDimension / aspectRatio, gridSize);
      } else if (aspectRatio < 1) {
        scaledDimensions.height = maxDimension;
        scaledDimensions.width = roundToMultiple(maxDimension * aspectRatio, gridSize);
      }
      currentArea = scaledDimensions.width * scaledDimensions.height;
    }
  }

  return scaledDimensions;
};
