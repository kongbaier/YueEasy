// 播放器领域 wire 类型（前端唯一权威后，仅保留引擎/UI 实际使用的类型）。
// 历史 wire 镜像（FullPlayerState / PlayerEventPayload / PlayUrlInfo / 快照）已随前端权威化废弃。

import type { Song } from './entities';

/** Track = Song 实体的别名（兼容旧 import）。 */
export type Track = Song;

/** 遍历顺序（正交轴 1）。 */
export type Order = 'sequential' | 'shuffle';

/** 终止策略（正交轴 2）。 */
export type RepeatMode = 'off' | 'all' | 'one';

/** 内容来源（正交轴 3）。 */
export type RustContentSource = 'queue' | 'personal_fm';
