import type { ComboboxOnChange } from '@invoke-ai/ui-library';
import { Combobox, FormControl, FormLabel } from '@invoke-ai/ui-library';
import { InformationalPopover } from 'common/components/InformationalPopover/InformationalPopover';
import type { IPMethodV2 } from 'features/controlLayers/util/controlAdapters';
import { isIPMethodV2 } from 'features/controlLayers/util/controlAdapters';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { assert } from 'tsafe';

type Props = {
  method: IPMethodV2;
  onChange: (method: IPMethodV2) => void;
};

export const IPAdapterMethod = memo(({ method, onChange }: Props) => {
  const { t } = useTranslation();
  const options: { label: string; value: IPMethodV2 }[] = useMemo(
    () => [
      { label: t('controlnet.full'), value: 'full' },
      { label: `${t('controlnet.style')} (${t('common.beta')})`, value: 'style' },
      { label: `${t('controlnet.composition')} (${t('common.beta')})`, value: 'composition' },
    ],
    [t]
  );
  const _onChange = useCallback<ComboboxOnChange>(
    (v) => {
      assert(isIPMethodV2(v?.value));
      onChange(v.value);
    },
    [onChange]
  );
  const value = useMemo(() => options.find((o) => o.value === method), [options, method]);

  return (
    <FormControl>
      <InformationalPopover feature="ipAdapterMethod">
        <FormLabel>{t('controlnet.ipAdapterMethod')}</FormLabel>
      </InformationalPopover>
      <Combobox value={value} options={options} onChange={_onChange} />
    </FormControl>
  );
});

IPAdapterMethod.displayName = 'IPAdapterMethod';
