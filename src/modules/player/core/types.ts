// 播放器领域类型（前端移植：port of `src-tauri/src/player/state.rs`）。
// 三个正交维度持状态：Order（遍历顺序）× Repeat（终止策略）× ContentSource（内容来源）。

import type { QueueItem } from '@/shared/types/entities';

/** 内容来源（正交轴 3）：决定「队尾如何续歌」。 */
export type ContentSource = 'queue' | 'personal_fm';

/** 遍历顺序（正交轴 1）：决定「在队列内如何遍历」。 */
export type Order = 'sequential' | 'shuffle';

/** 终止策略（正交轴 2）：决定「队尾 / 曲终如何终止」。 */
export type Repeat = 'off' | 'all' | 'one';

/** 导航决策结果（`Step`）—— 上层据 contentSource 决定 End 后停还是续歌。 */
export type Step =
  | { type: 'play'; index: number }
  | { type: 'replayCurrent' }
  | { type: 'end' };

/** 引擎全量快照（崩溃/重载恢复）。 */
export interface PlayerSnapshot {
  queue: QueueItem[];
  current_index: number | null;
  order: Order;
  repeat: Repeat;
  content_source: ContentSource;
  fm_played_ids: number[];
}
