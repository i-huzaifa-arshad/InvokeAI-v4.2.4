import { Box, Divider, Flex, Icon, IconButton } from '@invoke-ai/ui-library';
import { ControlAdapterModelCombobox } from 'features/controlLayers/components/ControlAndIPAdapter/ControlAdapterModelCombobox';
import type {
  ControlModeV2,
  ControlNetConfigV2,
  ProcessorConfig,
  T2IAdapterConfigV2,
} from 'features/controlLayers/util/controlAdapters';
import type { TypesafeDroppableData } from 'features/dnd/types';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretUpBold } from 'react-icons/pi';
import { useToggle } from 'react-use';
import type { ControlNetModelConfig, ImageDTO, PostUploadAction, T2IAdapterModelConfig } from 'services/api/types';

import { ControlAdapterBeginEndStepPct } from './ControlAdapterBeginEndStepPct';
import { ControlAdapterControlModeSelect } from './ControlAdapterControlModeSelect';
import { ControlAdapterImagePreview } from './ControlAdapterImagePreview';
import { ControlAdapterProcessorConfig } from './ControlAdapterProcessorConfig';
import { ControlAdapterProcessorTypeSelect } from './ControlAdapterProcessorTypeSelect';
import { ControlAdapterWeight } from './ControlAdapterWeight';

type Props = {
  controlAdapter: ControlNetConfigV2 | T2IAdapterConfigV2;
  onChangeBeginEndStepPct: (beginEndStepPct: [number, number]) => void;
  onChangeControlMode: (controlMode: ControlModeV2) => void;
  onChangeWeight: (weight: number) => void;
  onChangeProcessorConfig: (processorConfig: ProcessorConfig | null) => void;
  onChangeModel: (modelConfig: ControlNetModelConfig | T2IAdapterModelConfig) => void;
  onChangeImage: (imageDTO: ImageDTO | null) => void;
  onErrorLoadingImage: () => void;
  onErrorLoadingProcessedImage: () => void;
  droppableData: TypesafeDroppableData;
  postUploadAction: PostUploadAction;
};

export const ControlAdapter = memo(
  ({
    controlAdapter,
    onChangeBeginEndStepPct,
    onChangeControlMode,
    onChangeWeight,
    onChangeProcessorConfig,
    onChangeModel,
    onChangeImage,
    onErrorLoadingImage,
    onErrorLoadingProcessedImage,
    droppableData,
    postUploadAction,
  }: Props) => {
    const { t } = useTranslation();
    const [isExpanded, toggleIsExpanded] = useToggle(false);

    return (
      <Flex flexDir="column" gap={3} position="relative" w="full">
        <Flex gap={3} alignItems="center" w="full">
          <Box minW={0} w="full" transitionProperty="common" transitionDuration="0.1s">
            <ControlAdapterModelCombobox modelKey={controlAdapter.model?.key ?? null} onChange={onChangeModel} />
          </Box>

          <IconButton
            size="sm"
            tooltip={isExpanded ? t('controlnet.hideAdvanced') : t('controlnet.showAdvanced')}
            aria-label={isExpanded ? t('controlnet.hideAdvanced') : t('controlnet.showAdvanced')}
            onClick={toggleIsExpanded}
            variant="ghost"
            icon={
              <Icon
                boxSize={4}
                as={PiCaretUpBold}
                transform={isExpanded ? 'rotate(0deg)' : 'rotate(180deg)'}
                transitionProperty="common"
                transitionDuration="normal"
              />
            }
          />
        </Flex>
        <Flex gap={3} w="full">
          <Flex flexDir="column" gap={3} w="full" h="full">
            {controlAdapter.type === 'controlnet' && (
              <ControlAdapterControlModeSelect
                controlMode={controlAdapter.controlMode}
                onChange={onChangeControlMode}
              />
            )}
            <ControlAdapterWeight weight={controlAdapter.weight} onChange={onChangeWeight} />
            <ControlAdapterBeginEndStepPct
              beginEndStepPct={controlAdapter.beginEndStepPct}
              onChange={onChangeBeginEndStepPct}
            />
          </Flex>
          <Flex alignItems="center" justifyContent="center" h={36} w={36} aspectRatio="1/1">
            <ControlAdapterImagePreview
              controlAdapter={controlAdapter}
              onChangeImage={onChangeImage}
              droppableData={droppableData}
              postUploadAction={postUploadAction}
              onErrorLoadingImage={onErrorLoadingImage}
              onErrorLoadingProcessedImage={onErrorLoadingProcessedImage}
            />
          </Flex>
        </Flex>
        {isExpanded && (
          <>
            <Divider />
            <Flex flexDir="column" gap={3} w="full">
              <ControlAdapterProcessorTypeSelect
                config={controlAdapter.processorConfig}
                onChange={onChangeProcessorConfig}
              />
              <ControlAdapterProcessorConfig
                config={controlAdapter.processorConfig}
                onChange={onChangeProcessorConfig}
              />
            </Flex>
          </>
        )}
      </Flex>
    );
  }
);

ControlAdapter.displayName = 'ControlAdapter';
