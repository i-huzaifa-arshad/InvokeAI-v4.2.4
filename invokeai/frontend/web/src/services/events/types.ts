import type { S } from 'services/api/types';

export type ModelLoadStartedEvent = S['ModelLoadStartedEvent'];
export type ModelLoadCompleteEvent = S['ModelLoadCompleteEvent'];

export type InvocationStartedEvent = S['InvocationStartedEvent'];
export type InvocationDenoiseProgressEvent = S['InvocationDenoiseProgressEvent'];
export type InvocationCompleteEvent = S['InvocationCompleteEvent'];
export type InvocationErrorEvent = S['InvocationErrorEvent'];
export type ProgressImage = InvocationDenoiseProgressEvent['progress_image'];

export type ModelInstallDownloadStartedEvent = S['ModelInstallDownloadStartedEvent'];
export type ModelInstallDownloadProgressEvent = S['ModelInstallDownloadProgressEvent'];
export type ModelInstallDownloadsCompleteEvent = S['ModelInstallDownloadsCompleteEvent'];
export type ModelInstallCompleteEvent = S['ModelInstallCompleteEvent'];
export type ModelInstallErrorEvent = S['ModelInstallErrorEvent'];
export type ModelInstallStartedEvent = S['ModelInstallStartedEvent'];
export type ModelInstallCancelledEvent = S['ModelInstallCancelledEvent'];

export type DownloadStartedEvent = S['DownloadStartedEvent'];
export type DownloadProgressEvent = S['DownloadProgressEvent'];
export type DownloadCompleteEvent = S['DownloadCompleteEvent'];
export type DownloadCancelledEvent = S['DownloadCancelledEvent'];
export type DownloadErrorEvent = S['DownloadErrorEvent'];

export type QueueItemStatusChangedEvent = S['QueueItemStatusChangedEvent'];

export type BulkDownloadStartedEvent = S['BulkDownloadStartedEvent'];
export type BulkDownloadCompleteEvent = S['BulkDownloadCompleteEvent'];
export type BulkDownloadFailedEvent = S['BulkDownloadErrorEvent'];

type ClientEmitSubscribeQueue = {
  queue_id: string;
};
type ClientEmitUnsubscribeQueue = ClientEmitSubscribeQueue;
type ClientEmitSubscribeBulkDownload = {
  bulk_download_id: string;
};
type ClientEmitUnsubscribeBulkDownload = ClientEmitSubscribeBulkDownload;

export type ServerToClientEvents = {
  invocation_denoise_progress: (payload: InvocationDenoiseProgressEvent) => void;
  invocation_complete: (payload: InvocationCompleteEvent) => void;
  invocation_error: (payload: InvocationErrorEvent) => void;
  invocation_started: (payload: InvocationStartedEvent) => void;
  download_started: (payload: DownloadStartedEvent) => void;
  download_progress: (payload: DownloadProgressEvent) => void;
  download_complete: (payload: DownloadCompleteEvent) => void;
  download_cancelled: (payload: DownloadCancelledEvent) => void;
  download_error: (payload: DownloadErrorEvent) => void;
  model_load_started: (payload: ModelLoadStartedEvent) => void;
  model_install_started: (payload: ModelInstallStartedEvent) => void;
  model_install_download_started: (payload: ModelInstallDownloadStartedEvent) => void;
  model_install_download_progress: (payload: ModelInstallDownloadProgressEvent) => void;
  model_install_downloads_complete: (payload: ModelInstallDownloadsCompleteEvent) => void;
  model_install_complete: (payload: ModelInstallCompleteEvent) => void;
  model_install_error: (payload: ModelInstallErrorEvent) => void;
  model_install_cancelled: (payload: ModelInstallCancelledEvent) => void;
  model_load_complete: (payload: ModelLoadCompleteEvent) => void;
  queue_item_status_changed: (payload: QueueItemStatusChangedEvent) => void;
  bulk_download_started: (payload: BulkDownloadStartedEvent) => void;
  bulk_download_complete: (payload: BulkDownloadCompleteEvent) => void;
  bulk_download_error: (payload: BulkDownloadFailedEvent) => void;
};

export type ClientToServerEvents = {
  connect: () => void;
  disconnect: () => void;
  subscribe_queue: (payload: ClientEmitSubscribeQueue) => void;
  unsubscribe_queue: (payload: ClientEmitUnsubscribeQueue) => void;
  subscribe_bulk_download: (payload: ClientEmitSubscribeBulkDownload) => void;
  unsubscribe_bulk_download: (payload: ClientEmitUnsubscribeBulkDownload) => void;
};
