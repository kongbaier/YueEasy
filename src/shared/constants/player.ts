// 播放器纯常量（shared/constants 为纯数据定义，各层可引）。

import type { RepeatMode } from '@/shared/types/player';

/** 终止策略循环：off → all → one → off。仅当 content_source == queue 时生效。 */
export const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = {
  off: 'all',
  all: 'one',
  one: 'off',
};
