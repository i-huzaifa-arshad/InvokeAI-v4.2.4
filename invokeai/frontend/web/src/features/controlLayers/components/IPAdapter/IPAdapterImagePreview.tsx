import { Flex, useShiftModifier } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { $isConnected } from 'app/hooks/useSocketIO';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import IAIDndImage from 'common/components/IAIDndImage';
import IAIDndImageIcon from 'common/components/IAIDndImageIcon';
import { bboxHeightChanged, bboxWidthChanged } from 'features/controlLayers/store/canvasSlice';
import { selectOptimalDimension } from 'features/controlLayers/store/selectors';
import type { ImageWithDims } from 'features/controlLayers/store/types';
import type { ImageDraggableData, TypesafeDroppableData } from 'features/dnd/types';
import { calculateNewSize } from 'features/parameters/components/Bbox/calculateNewSize';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiArrowCounterClockwiseBold, PiRulerBold } from 'react-icons/pi';
import { useGetImageDTOQuery } from 'services/api/endpoints/images';
import type { ImageDTO, PostUploadAction } from 'services/api/types';

type Props = {
  image: ImageWithDims | null;
  onChangeImage: (imageDTO: ImageDTO | null) => void;
  ipAdapterId: string; // required for the dnd/upload interactions
  droppableData: TypesafeDroppableData;
  postUploadAction: PostUploadAction;
};

export const IPAdapterImagePreview = memo(
  ({ image, onChangeImage, ipAdapterId, droppableData, postUploadAction }: Props) => {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const isConnected = useStore($isConnected);
    const optimalDimension = useAppSelector(selectOptimalDimension);
    const shift = useShiftModifier();

    const { currentData: controlImage, isError: isErrorControlImage } = useGetImageDTOQuery(
      image?.image_name ?? skipToken
    );
    const handleResetControlImage = useCallback(() => {
      onChangeImage(null);
    }, [onChangeImage]);

    const handleSetControlImageToDimensions = useCallback(() => {
      if (!controlImage) {
        return;
      }

      const options = { updateAspectRatio: true, clamp: true };
      if (shift) {
        const { width, height } = controlImage;
        dispatch(bboxWidthChanged({ width, ...options }));
        dispatch(bboxHeightChanged({ height, ...options }));
      } else {
        const { width, height } = calculateNewSize(
          controlImage.width / controlImage.height,
          optimalDimension * optimalDimension
        );
        dispatch(bboxWidthChanged({ width, ...options }));
        dispatch(bboxHeightChanged({ height, ...options }));
      }
    }, [controlImage, dispatch, optimalDimension, shift]);

    const draggableData = useMemo<ImageDraggableData | undefined>(() => {
      if (controlImage) {
        return {
          id: ipAdapterId,
          payloadType: 'IMAGE_DTO',
          payload: { imageDTO: controlImage },
        };
      }
    }, [controlImage, ipAdapterId]);

    useEffect(() => {
      if (isConnected && isErrorControlImage) {
        handleResetControlImage();
      }
    }, [handleResetControlImage, isConnected, isErrorControlImage]);

    return (
      <Flex position="relative" w={36} h={36} alignItems="center">
        <IAIDndImage
          draggableData={draggableData}
          droppableData={droppableData}
          imageDTO={controlImage}
          postUploadAction={postUploadAction}
        />

        {controlImage && (
          <Flex position="absolute" flexDir="column" top={2} insetInlineEnd={2} gap={1}>
            <IAIDndImageIcon
              onClick={handleResetControlImage}
              icon={<PiArrowCounterClockwiseBold size={16} />}
              tooltip={t('controlnet.resetControlImage')}
            />
            <IAIDndImageIcon
              onClick={handleSetControlImageToDimensions}
              icon={<PiRulerBold size={16} />}
              tooltip={
                shift ? t('controlnet.setControlImageDimensionsForce') : t('controlnet.setControlImageDimensions')
              }
            />
          </Flex>
        )}
      </Flex>
    );
  }
);

IPAdapterImagePreview.displayName = 'IPAdapterImagePreview';
