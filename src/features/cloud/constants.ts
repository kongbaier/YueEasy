import type { CloudFile, Song } from '@/shared/types/uiModels';

/** 云盘分页步长（每次「加载更多」放大这么多 limit）。 */
export const CLOUD_PAGE_SIZE = 30;

/**
 * 已匹配到曲库的云盘文件：`song` 一定存在。
 * 只有这类文件能进列表（可播放），未匹配的只有文件名，仅在计数里出现。
 */
export type CloudTrack = CloudFile & { song: Song };
