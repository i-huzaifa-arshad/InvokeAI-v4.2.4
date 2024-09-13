import { $alt, IconButton } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { INTERACTION_SCOPES } from 'common/hooks/interactionScopes';
import { $canvasManager } from 'features/controlLayers/store/canvasSlice';
import { memo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { PiArrowCounterClockwiseBold } from 'react-icons/pi';

export const CanvasToolbarResetViewButton = memo(() => {
  const { t } = useTranslation();
  const canvasManager = useStore($canvasManager);
  const isCanvasActive = useStore(INTERACTION_SCOPES.canvas.$isActive);

  const resetZoom = useCallback(() => {
    if (!canvasManager) {
      return;
    }
    canvasManager.stage.setScale(1);
  }, [canvasManager]);

  const resetView = useCallback(() => {
    if (!canvasManager) {
      return;
    }
    canvasManager.stage.fitLayersToStage();
  }, [canvasManager]);

  const onReset = useCallback(() => {
    if ($alt.get()) {
      resetView();
    } else {
      resetZoom();
    }
  }, [resetView, resetZoom]);

  useHotkeys('r', resetView, { enabled: isCanvasActive }, [isCanvasActive]);
  useHotkeys('alt+r', resetZoom, { enabled: isCanvasActive }, [isCanvasActive]);

  return (
    <IconButton
      tooltip={t('controlLayers.resetView')}
      aria-label={t('controlLayers.resetView')}
      onClick={onReset}
      icon={<PiArrowCounterClockwiseBold />}
      variant="link"
    />
  );
});

CanvasToolbarResetViewButton.displayName = 'CanvasToolbarResetViewButton';
