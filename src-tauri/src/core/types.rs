//! 播放器领域类型（Phase C：PlayerEngine 领域引擎）
//!
//! 参考 `docs/player-rust-design.md` §2.2。这是引擎自己的领域类型，不是 ncm Entity。
//! serde 为编译期 derive（Phase D 事件序列化需要）。

use serde::{Deserialize, Serialize};

/// 队列条目 —— 引擎自有领域类型（字段即 wire 名，与 `shared/types/entities.ts` 对应）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct QueueItem {
    pub track_id: u64,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover_url: String,
    pub duration_secs: f64,
}

/// 内容来源（正交轴 3）：决定「队尾如何续歌」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentSource {
    /// 本地队列（由用户操作填充；队尾行为交终止策略决定）。
    Queue,
    /// 私人漫游（FM，流式逐首续接；`personal_fm` 取歌）。
    PersonalFm,
}

/// 遍历顺序（正交轴 1）：决定「在队列内如何遍历」。
/// `snake_case` 序列化（IPC 字符串与事件 wire 对齐）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Order {
    /// 顺序遍历。
    Sequential,
    /// 随机遍历（内部持排列，进入时重建）。
    Shuffle,
}

/// 终止策略（正交轴 2）：决定「队尾 / 曲终如何终止」。
/// `snake_case` 序列化。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Repeat {
    /// 末尾停止。
    Off,
    /// 列表循环（队尾绕回首）。
    All,
    /// 单曲循环（自然结束重播当前曲）。
    One,
}

/// 引擎全量快照（设计 §7 崩溃/重载恢复 + 评审要求含 played_ids）。
/// 正交化：`order`（遍历顺序）+ `repeat`（终止策略）+ `content_source`（内容来源）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    /// 当前队列（FM 激活时为 FM 队列）。
    pub queue: Vec<QueueItem>,
    pub current_index: Option<usize>,
    pub order: Order,
    pub repeat: Repeat,
    pub content_source: ContentSource,
    /// FM 已播 id 列表（FM 未激活时为空）。
    pub fm_played_ids: Vec<u64>,
    /// 最近已知播放位置（秒）。仅供重启恢复；AudioCore 才是权威。
    /// `#[serde(default)]`：兼容旧版落盘快照（无此字段）。
    #[serde(default)]
    pub position_secs: f64,
    /// 最近已知播放/暂停状态（上次已知）。仅供重启恢复。
    #[serde(default)]
    pub playing: bool,
}
