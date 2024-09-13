import { createMemoizedSelector } from 'app/store/createMemoizedSelector';
import { useAppSelector } from 'app/store/storeHooks';
import { selectAutoAddBoardId } from 'features/gallery/store/gallerySelectors';
import { toast } from 'features/toast/toast';
import { selectActiveTab } from 'features/ui/store/uiSelectors';
import { useCallback, useEffect, useState } from 'react';
import type { Accept, FileRejection } from 'react-dropzone';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useUploadImageMutation } from 'services/api/endpoints/images';
import type { PostUploadAction } from 'services/api/types';

const accept: Accept = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg', '.png'],
};

const selectPostUploadAction = createMemoizedSelector(selectActiveTab, (activeTabName) => {
  let postUploadAction: PostUploadAction = { type: 'TOAST' };

  if (activeTabName === 'upscaling') {
    postUploadAction = { type: 'SET_UPSCALE_INITIAL_IMAGE' };
  }

  return postUploadAction;
});

export const useFullscreenDropzone = () => {
  const { t } = useTranslation();
  const autoAddBoardId = useAppSelector(selectAutoAddBoardId);
  const [isHandlingUpload, setIsHandlingUpload] = useState<boolean>(false);
  const postUploadAction = useAppSelector(selectPostUploadAction);
  const [uploadImage] = useUploadImageMutation();

  const fileRejectionCallback = useCallback(
    (rejection: FileRejection) => {
      setIsHandlingUpload(true);

      toast({
        id: 'UPLOAD_FAILED',
        title: t('toast.uploadFailed'),
        description: rejection.errors.map((error) => error.message).join('\n'),
        status: 'error',
      });
    },
    [t]
  );

  const fileAcceptedCallback = useCallback(
    (file: File) => {
      uploadImage({
        file,
        image_category: 'user',
        is_intermediate: false,
        postUploadAction,
        board_id: autoAddBoardId === 'none' ? undefined : autoAddBoardId,
      });
    },
    [autoAddBoardId, postUploadAction, uploadImage]
  );

  const onDrop = useCallback(
    (acceptedFiles: Array<File>, fileRejections: Array<FileRejection>) => {
      if (fileRejections.length > 1) {
        toast({
          id: 'UPLOAD_FAILED',
          title: t('toast.uploadFailed'),
          description: t('toast.uploadFailedInvalidUploadDesc'),
          status: 'error',
        });
        return;
      }

      fileRejections.forEach((rejection: FileRejection) => {
        fileRejectionCallback(rejection);
      });

      acceptedFiles.forEach((file: File) => {
        fileAcceptedCallback(file);
      });
    },
    [t, fileAcceptedCallback, fileRejectionCallback]
  );

  const onDragOver = useCallback(() => {
    setIsHandlingUpload(true);
  }, []);

  const dropzone = useDropzone({
    accept,
    noClick: true,
    onDrop,
    onDragOver,
    multiple: false,
    noKeyboard: true,
  });

  useEffect(() => {
    // This is a hack to allow pasting images into the uploader
    const handlePaste = (e: ClipboardEvent) => {
      if (!dropzone.inputRef.current) {
        return;
      }

      if (e.clipboardData?.files) {
        // Set the files on the dropzone.inputRef
        dropzone.inputRef.current.files = e.clipboardData.files;
        // Dispatch the change event, dropzone catches this and we get to use its own validation
        dropzone.inputRef.current?.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    // Add the paste event listener
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [dropzone.inputRef]);

  return { dropzone, isHandlingUpload, setIsHandlingUpload };
};
