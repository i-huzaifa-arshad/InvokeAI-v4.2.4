import { Flex, Text } from '@invoke-ai/ui-library';
import { useAppSelector } from 'app/store/storeHooks';
import { memo } from 'react';
import { useBoardName } from 'services/api/hooks/useBoardName';

type Props = {
  onClick: () => void;
};

const GalleryBoardName = (props: Props) => {
  const selectedBoardId = useAppSelector((s) => s.gallery.selectedBoardId);
  const boardName = useBoardName(selectedBoardId);

  return (
    <Flex
      onClick={props.onClick}
      as="button"
      h="full"
      w="full"
      borderWidth={1}
      borderRadius="base"
      alignItems="center"
      justifyContent="center"
      px={2}
    >
      <Text fontWeight="semibold" fontSize="md" noOfLines={1} wordBreak="break-all" color="base.200">
        {boardName}
      </Text>
    </Flex>
  );
};

export default memo(GalleryBoardName);
