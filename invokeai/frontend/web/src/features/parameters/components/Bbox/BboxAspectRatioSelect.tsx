import type { ComboboxOption, SystemStyleObject } from '@invoke-ai/ui-library';
import { Combobox, FormControl, FormLabel } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import type { SingleValue } from 'chakra-react-select';
import { InformationalPopover } from 'common/components/InformationalPopover/InformationalPopover';
import { bboxAspectRatioIdChanged } from 'features/controlLayers/store/canvasSlice';
import { selectAspectRatioID } from 'features/controlLayers/store/selectors';
import { ASPECT_RATIO_OPTIONS } from 'features/parameters/components/Bbox/constants';
import { isAspectRatioID } from 'features/parameters/components/Bbox/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const BboxAspectRatioSelect = memo(() => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const id = useAppSelector(selectAspectRatioID);

  const onChange = useCallback(
    (v: SingleValue<ComboboxOption>) => {
      if (!v || !isAspectRatioID(v.value)) {
        return;
      }
      dispatch(bboxAspectRatioIdChanged({ id: v.value }));
    },
    [dispatch]
  );

  const value = useMemo(() => ASPECT_RATIO_OPTIONS.filter((o) => o.value === id)[0], [id]);

  return (
    <FormControl>
      <InformationalPopover feature="paramAspect">
        <FormLabel>{t('parameters.aspect')}</FormLabel>
      </InformationalPopover>
      <Combobox value={value} onChange={onChange} options={ASPECT_RATIO_OPTIONS} sx={selectStyles} />
    </FormControl>
  );
});

BboxAspectRatioSelect.displayName = 'BboxAspectRatioSelect';

const selectStyles: SystemStyleObject = { minW: 24 };
