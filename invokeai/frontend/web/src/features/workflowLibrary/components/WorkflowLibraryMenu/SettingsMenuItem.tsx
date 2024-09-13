import { MenuItem } from '@invoke-ai/ui-library';
import { useWorkflowEditorSettingsModal } from 'features/nodes/components/flow/panels/TopRightPanel/WorkflowEditorSettings';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { RiSettings4Line } from 'react-icons/ri';

const DownloadWorkflowMenuItem = () => {
  const { t } = useTranslation();
  const modal = useWorkflowEditorSettingsModal();

  return (
    <MenuItem as="button" icon={<RiSettings4Line />} onClick={modal.setTrue}>
      {t('nodes.workflowSettings')}
    </MenuItem>
  );
};

export default memo(DownloadWorkflowMenuItem);
