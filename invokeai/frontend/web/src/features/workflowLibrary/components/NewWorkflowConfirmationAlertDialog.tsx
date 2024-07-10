import { ConfirmationAlertDialog, Flex, Text, useDisclosure } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { nodeEditorReset } from 'features/nodes/store/nodesSlice';
import { workflowModeChanged } from 'features/nodes/store/workflowSlice';
import { toast } from 'features/toast/toast';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  renderButton: (onClick: () => void) => JSX.Element;
};

export const NewWorkflowConfirmationAlertDialog = memo((props: Props) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isTouched = useAppSelector((s) => s.workflow.isTouched);

  const handleNewWorkflow = useCallback(() => {
    dispatch(nodeEditorReset());
    dispatch(workflowModeChanged('edit'));

    toast({
      id: 'NEW_WORKFLOW_CREATED',
      title: t('workflows.newWorkflowCreated'),
      status: 'success',
    });

    onClose();
  }, [dispatch, onClose, t]);

  const onClick = useCallback(() => {
    if (!isTouched) {
      handleNewWorkflow();
      return;
    }
    onOpen();
  }, [handleNewWorkflow, isTouched, onOpen]);

  return (
    <>
      {props.renderButton(onClick)}

      <ConfirmationAlertDialog
        isOpen={isOpen}
        onClose={onClose}
        title={t('nodes.newWorkflow')}
        acceptCallback={handleNewWorkflow}
      >
        <Flex flexDir="column" gap={2}>
          <Text>{t('nodes.newWorkflowDesc')}</Text>
          <Text variant="subtext">{t('nodes.newWorkflowDesc2')}</Text>
        </Flex>
      </ConfirmationAlertDialog>
    </>
  );
});

NewWorkflowConfirmationAlertDialog.displayName = 'NewWorkflowConfirmationAlertDialog';
