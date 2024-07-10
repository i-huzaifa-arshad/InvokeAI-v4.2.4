import { Button, Flex, IconButton, Spacer } from '@invoke-ai/ui-library';
import { ELLIPSIS, useGalleryPagination } from 'features/gallery/hooks/useGalleryPagination';
import { useCallback } from 'react';
import { PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';

export const GalleryPagination = () => {
  const { goPrev, goNext, isPrevEnabled, isNextEnabled, pageButtons, goToPage, currentPage, total } =
    useGalleryPagination();

  const onClickPrev = useCallback(() => {
    goPrev();
  }, [goPrev]);

  const onClickNext = useCallback(() => {
    goNext();
  }, [goNext]);

  if (!total) {
    return null;
  }

  return (
    <Flex gap={2} alignItems="center" w="full">
      <IconButton
        size="sm"
        aria-label="prev"
        icon={<PiCaretLeftBold />}
        onClick={onClickPrev}
        isDisabled={!isPrevEnabled}
        variant="ghost"
      />
      <Spacer />
      {pageButtons.map((page, i) => {
        if (page === ELLIPSIS) {
          return (
            <Button size="sm" key={`ellipsis_${i}`} variant="link" isDisabled>
              ...
            </Button>
          );
        }
        return (
          <Button
            size="sm"
            key={page}
            onClick={goToPage.bind(null, page - 1)}
            variant={currentPage === page - 1 ? 'solid' : 'outline'}
          >
            {page}
          </Button>
        );
      })}
      <Spacer />
      <IconButton
        size="sm"
        aria-label="next"
        icon={<PiCaretRightBold />}
        onClick={onClickNext}
        isDisabled={!isNextEnabled}
        variant="ghost"
      />
    </Flex>
  );
};
