// 播放器纯常量（shared/constants 为纯数据定义，各层可引）。

import type { RustPlayMode } from '@/shared/types/player';

/** Rust 迭代策略循环：sequential → loop_all → loop_one → shuffle → sequential（设计 §2.6 + §4.1）。
 *  仅当 content_source == queue 时生效。 */
export const NEXT_RUST_STRATEGY: Record<RustPlayMode, RustPlayMode> = {
  sequential: 'loop_all',
  loop_all: 'loop_one',
  loop_one: 'shuffle',
  shuffle: 'sequential',
};
