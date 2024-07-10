import {
  Button,
  ButtonGroup,
  Flex,
  Icon,
  IconButton,
  Kbd,
  ListItem,
  Tooltip,
  UnorderedList,
} from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import {
  comparedImagesSwapped,
  comparisonFitChanged,
  comparisonModeChanged,
  comparisonModeCycled,
  imageToCompareChanged,
} from 'features/gallery/store/gallerySlice';
import { memo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Trans, useTranslation } from 'react-i18next';
import { PiArrowsOutBold, PiQuestion, PiSwapBold, PiXBold } from 'react-icons/pi';

export const CompareToolbar = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const comparisonMode = useAppSelector((s) => s.gallery.comparisonMode);
  const comparisonFit = useAppSelector((s) => s.gallery.comparisonFit);
  const setComparisonModeSlider = useCallback(() => {
    dispatch(comparisonModeChanged('slider'));
  }, [dispatch]);
  const setComparisonModeSideBySide = useCallback(() => {
    dispatch(comparisonModeChanged('side-by-side'));
  }, [dispatch]);
  const setComparisonModeHover = useCallback(() => {
    dispatch(comparisonModeChanged('hover'));
  }, [dispatch]);
  const swapImages = useCallback(() => {
    dispatch(comparedImagesSwapped());
  }, [dispatch]);
  useHotkeys('c', swapImages, [swapImages]);
  const toggleComparisonFit = useCallback(() => {
    dispatch(comparisonFitChanged(comparisonFit === 'contain' ? 'fill' : 'contain'));
  }, [dispatch, comparisonFit]);
  const exitCompare = useCallback(() => {
    dispatch(imageToCompareChanged(null));
  }, [dispatch]);
  useHotkeys('esc', exitCompare, [exitCompare]);
  const nextMode = useCallback(() => {
    dispatch(comparisonModeCycled());
  }, [dispatch]);
  useHotkeys('m', nextMode, [nextMode]);

  return (
    <Flex w="full" gap={2}>
      <Flex flex={1} justifyContent="center">
        <Flex gap={2} marginInlineEnd="auto">
          <IconButton
            icon={<PiSwapBold />}
            aria-label={`${t('gallery.swapImages')} (C)`}
            tooltip={`${t('gallery.swapImages')} (C)`}
            onClick={swapImages}
          />
          {comparisonMode !== 'side-by-side' && (
            <IconButton
              aria-label={t('gallery.stretchToFit')}
              tooltip={t('gallery.stretchToFit')}
              onClick={toggleComparisonFit}
              colorScheme={comparisonFit === 'fill' ? 'invokeBlue' : 'base'}
              variant="outline"
              icon={<PiArrowsOutBold />}
            />
          )}
        </Flex>
      </Flex>
      <Flex flex={1} gap={4} justifyContent="center">
        <ButtonGroup variant="outline">
          <Button
            flexShrink={0}
            onClick={setComparisonModeSlider}
            colorScheme={comparisonMode === 'slider' ? 'invokeBlue' : 'base'}
          >
            {t('gallery.slider')}
          </Button>
          <Button
            flexShrink={0}
            onClick={setComparisonModeSideBySide}
            colorScheme={comparisonMode === 'side-by-side' ? 'invokeBlue' : 'base'}
          >
            {t('gallery.sideBySide')}
          </Button>
          <Button
            flexShrink={0}
            onClick={setComparisonModeHover}
            colorScheme={comparisonMode === 'hover' ? 'invokeBlue' : 'base'}
          >
            {t('gallery.hover')}
          </Button>
        </ButtonGroup>
      </Flex>
      <Flex flex={1} justifyContent="center">
        <Flex gap={2} marginInlineStart="auto" alignItems="center">
          <Tooltip label={<CompareHelp />}>
            <Flex alignItems="center">
              <Icon boxSize={8} color="base.500" as={PiQuestion} lineHeight={0} />
            </Flex>
          </Tooltip>
          <IconButton
            icon={<PiXBold />}
            aria-label={`${t('gallery.exitCompare')} (Esc)`}
            tooltip={`${t('gallery.exitCompare')} (Esc)`}
            onClick={exitCompare}
          />
        </Flex>
      </Flex>
    </Flex>
  );
});

CompareToolbar.displayName = 'CompareToolbar';

const CompareHelp = () => {
  return (
    <UnorderedList>
      <ListItem>
        <Trans i18nKey="gallery.compareHelp1" components={{ Kbd: <Kbd /> }}></Trans>
      </ListItem>
      <ListItem>
        <Trans i18nKey="gallery.compareHelp2" components={{ Kbd: <Kbd /> }}></Trans>
      </ListItem>
      <ListItem>
        <Trans i18nKey="gallery.compareHelp3" components={{ Kbd: <Kbd /> }}></Trans>
      </ListItem>
      <ListItem>
        <Trans i18nKey="gallery.compareHelp4" components={{ Kbd: <Kbd /> }}></Trans>
      </ListItem>
    </UnorderedList>
  );
};
