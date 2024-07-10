import { logger } from 'app/logging/logger';
import type { AppStartListening } from 'app/store/middleware/listenerMiddleware';
import { parseify } from 'common/util/serialize';
import { canvasSavedToGallery } from 'features/canvas/store/actions';
import { getBaseLayerBlob } from 'features/canvas/util/getBaseLayerBlob';
import { toast } from 'features/toast/toast';
import { t } from 'i18next';
import { imagesApi } from 'services/api/endpoints/images';

export const addCanvasSavedToGalleryListener = (startAppListening: AppStartListening) => {
  startAppListening({
    actionCreator: canvasSavedToGallery,
    effect: async (action, { dispatch, getState }) => {
      const log = logger('canvas');
      const state = getState();

      let blob;
      try {
        blob = await getBaseLayerBlob(state);
      } catch (err) {
        log.error(String(err));
        toast({
          id: 'CANVAS_SAVE_FAILED',
          title: t('toast.problemSavingCanvas'),
          description: t('toast.problemSavingCanvasDesc'),
          status: 'error',
        });
        return;
      }

      const { autoAddBoardId } = state.gallery;

      dispatch(
        imagesApi.endpoints.uploadImage.initiate({
          file: new File([blob], 'savedCanvas.png', {
            type: 'image/png',
          }),
          image_category: 'general',
          is_intermediate: false,
          board_id: autoAddBoardId === 'none' ? undefined : autoAddBoardId,
          crop_visible: true,
          postUploadAction: {
            type: 'TOAST',
            title: t('toast.canvasSavedGallery'),
          },
          metadata: {
            _canvas_objects: parseify(state.canvas.layerState.objects),
          },
        })
      );
    },
  });
};
