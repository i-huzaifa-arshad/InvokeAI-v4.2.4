import { Box, Flex, IconButton } from '@invoke-ai/ui-library';
import { createSelector } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { BeginEndStepPct } from 'features/controlLayers/components/common/BeginEndStepPct';
import { CanvasEntitySettingsWrapper } from 'features/controlLayers/components/common/CanvasEntitySettingsWrapper';
import { Weight } from 'features/controlLayers/components/common/Weight';
import { IPAdapterMethod } from 'features/controlLayers/components/IPAdapter/IPAdapterMethod';
import { useEntityIdentifierContext } from 'features/controlLayers/contexts/EntityIdentifierContext';
import { useIsSavingCanvas, usePullBboxIntoIPAdapter } from 'features/controlLayers/hooks/saveCanvasHooks';
import {
  ipaBeginEndStepPctChanged,
  ipaCLIPVisionModelChanged,
  ipaImageChanged,
  ipaMethodChanged,
  ipaModelChanged,
  ipaWeightChanged,
} from 'features/controlLayers/store/canvasSlice';
import { selectCanvasSlice, selectEntityOrThrow } from 'features/controlLayers/store/selectors';
import type { CLIPVisionModelV2, IPMethodV2 } from 'features/controlLayers/store/types';
import type { IPAImageDropData } from 'features/dnd/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiBoundingBoxBold } from 'react-icons/pi';
import type { ImageDTO, IPAdapterModelConfig, IPALayerImagePostUploadAction } from 'services/api/types';

import { IPAdapterImagePreview } from './IPAdapterImagePreview';
import { IPAdapterModel } from './IPAdapterModel';

export const IPAdapterSettings = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const entityIdentifier = useEntityIdentifierContext('ip_adapter');
  const selectIPAdapter = useMemo(
    () => createSelector(selectCanvasSlice, (s) => selectEntityOrThrow(s, entityIdentifier).ipAdapter),
    [entityIdentifier]
  );
  const ipAdapter = useAppSelector(selectIPAdapter);

  const onChangeBeginEndStepPct = useCallback(
    (beginEndStepPct: [number, number]) => {
      dispatch(ipaBeginEndStepPctChanged({ entityIdentifier, beginEndStepPct }));
    },
    [dispatch, entityIdentifier]
  );

  const onChangeWeight = useCallback(
    (weight: number) => {
      dispatch(ipaWeightChanged({ entityIdentifier, weight }));
    },
    [dispatch, entityIdentifier]
  );

  const onChangeIPMethod = useCallback(
    (method: IPMethodV2) => {
      dispatch(ipaMethodChanged({ entityIdentifier, method }));
    },
    [dispatch, entityIdentifier]
  );

  const onChangeModel = useCallback(
    (modelConfig: IPAdapterModelConfig) => {
      dispatch(ipaModelChanged({ entityIdentifier, modelConfig }));
    },
    [dispatch, entityIdentifier]
  );

  const onChangeCLIPVisionModel = useCallback(
    (clipVisionModel: CLIPVisionModelV2) => {
      dispatch(ipaCLIPVisionModelChanged({ entityIdentifier, clipVisionModel }));
    },
    [dispatch, entityIdentifier]
  );

  const onChangeImage = useCallback(
    (imageDTO: ImageDTO | null) => {
      dispatch(ipaImageChanged({ entityIdentifier, imageDTO }));
    },
    [dispatch, entityIdentifier]
  );

  const droppableData = useMemo<IPAImageDropData>(
    () => ({ actionType: 'SET_IPA_IMAGE', context: { id: entityIdentifier.id }, id: entityIdentifier.id }),
    [entityIdentifier.id]
  );
  const postUploadAction = useMemo<IPALayerImagePostUploadAction>(
    () => ({ type: 'SET_IPA_IMAGE', id: entityIdentifier.id }),
    [entityIdentifier.id]
  );
  const pullBboxIntoIPAdapter = usePullBboxIntoIPAdapter(entityIdentifier);
  const isSaving = useIsSavingCanvas();

  return (
    <CanvasEntitySettingsWrapper>
      <Flex flexDir="column" gap={4} position="relative" w="full">
        <Flex gap={3} alignItems="center" w="full">
          <Box minW={0} w="full" transitionProperty="common" transitionDuration="0.1s">
            <IPAdapterModel
              modelKey={ipAdapter.model?.key ?? null}
              onChangeModel={onChangeModel}
              clipVisionModel={ipAdapter.clipVisionModel}
              onChangeCLIPVisionModel={onChangeCLIPVisionModel}
            />
          </Box>
          <IconButton
            onClick={pullBboxIntoIPAdapter}
            isLoading={isSaving.isTrue}
            variant="ghost"
            aria-label={t('controlLayers.pullBboxIntoIPAdapter')}
            tooltip={t('controlLayers.pullBboxIntoIPAdapter')}
            icon={<PiBoundingBoxBold />}
          />
        </Flex>
        <Flex gap={4} w="full" alignItems="center">
          <Flex flexDir="column" gap={3} w="full">
            <IPAdapterMethod method={ipAdapter.method} onChange={onChangeIPMethod} />
            <Weight weight={ipAdapter.weight} onChange={onChangeWeight} />
            <BeginEndStepPct beginEndStepPct={ipAdapter.beginEndStepPct} onChange={onChangeBeginEndStepPct} />
          </Flex>
          <Flex alignItems="center" justifyContent="center" h={36} w={36} aspectRatio="1/1">
            <IPAdapterImagePreview
              image={ipAdapter.image ?? null}
              onChangeImage={onChangeImage}
              ipAdapterId={entityIdentifier.id}
              droppableData={droppableData}
              postUploadAction={postUploadAction}
            />
          </Flex>
        </Flex>
      </Flex>
    </CanvasEntitySettingsWrapper>
  );
});

IPAdapterSettings.displayName = 'IPAdapterSettings';
