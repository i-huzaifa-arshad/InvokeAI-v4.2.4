import type { IconButtonProps } from '@invoke-ai/ui-library';
import { IconButton } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { setActiveTab } from 'features/ui/store/uiSlice';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiGearSixBold } from 'react-icons/pi';

export const NavigateToModelManagerButton = memo((props: Omit<IconButtonProps, 'aria-label'>) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const disabledTabs = useAppSelector((s) => s.config.disabledTabs);
  const shouldShowButton = useMemo(() => !disabledTabs.includes('models'), [disabledTabs]);

  const handleClick = useCallback(() => {
    dispatch(setActiveTab('models'));
  }, [dispatch]);

  if (!shouldShowButton) {
    return null;
  }

  return (
    <IconButton
      icon={<PiGearSixBold />}
      tooltip={`${t('common.goTo')} ${t('ui.tabs.modelsTab')}`}
      aria-label={`${t('common.goTo')} ${t('ui.tabs.modelsTab')}`}
      onClick={handleClick}
      size="sm"
      variant="ghost"
      {...props}
    />
  );
});

NavigateToModelManagerButton.displayName = 'NavigateToModelManagerButton';
