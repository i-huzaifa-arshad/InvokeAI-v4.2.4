import { Badge, Box, Flex, IconButton, Text } from '@invoke-ai/ui-library';
import { useInstallModel } from 'features/modelManagerV2/hooks/useInstallModel';
import ModelBaseBadge from 'features/modelManagerV2/subpanels/ModelManagerPanel/ModelBaseBadge';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiPlusBold } from 'react-icons/pi';
import type { GetStarterModelsResponse } from 'services/api/endpoints/models';

type Props = {
  result: GetStarterModelsResponse[number];
};
export const StarterModelsResultItem = ({ result }: Props) => {
  const { t } = useTranslation();
  const allSources = useMemo(() => {
    const _allSources = [result.source];
    if (result.dependencies) {
      _allSources.push(...result.dependencies.map((d) => d.source));
    }
    return _allSources;
  }, [result]);
  const [installModel] = useInstallModel();

  const onClick = useCallback(() => {
    for (const source of allSources) {
      installModel({ source });
    }
  }, [allSources, installModel]);

  return (
    <Flex alignItems="center" justifyContent="space-between" w="100%" gap={3}>
      <Flex fontSize="sm" flexDir="column">
        <Flex gap={3}>
          <Badge h="min-content">{result.type.replace('_', ' ')}</Badge>
          <ModelBaseBadge base={result.base} />
          <Text fontWeight="semibold">{result.name}</Text>
        </Flex>
        <Text variant="subtext">{result.description}</Text>
      </Flex>
      <Box>
        {result.is_installed ? (
          <Badge>{t('common.installed')}</Badge>
        ) : (
          <IconButton aria-label={t('modelManager.install')} icon={<PiPlusBold />} onClick={onClick} size="sm" />
        )}
      </Box>
    </Flex>
  );
};
