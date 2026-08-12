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

/// 播放模式（设计 §2.4：枚举 + match，不用策略 trait）。
/// `snake_case` 序列化：Sequential → "sequential"、LoopOne → "loop_one"、Shuffle → "shuffle"
/// （IPC 模式字符串与 `player:mode-changed` 事件 wire 对齐，设计 §4.1/§4.2）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayMode {
    /// 顺序播放。队尾不环绕（附录 B 决策③）。
    Sequential,
    /// 单曲循环。导航冻结在当前曲目。
    LoopOne,
    /// 随机播放。按内部排列循环前进。
    Shuffle,
}

/// FM 状态机（设计 §2.5：枚举 + 内联迁移）。
/// 单曲 FM 模型：`Active` 只承载一首当前曲目 + 已播 id 上报列表。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum FmState {
    Idle,
    Active {
        current_track: QueueItem,
        /// 服务端上报用（fm_record_played 累计）。
        played_ids: Vec<u64>,
    },
}

/// 推进结果（设计 §2.2）：把 FM 的异步依赖变成引擎的声明式输出。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AdvanceResult {
    /// 已推进，播放 queue[idx]。
    PlayTrack(usize),
    /// FM 模式，需从服务端取歌（cmd 层取歌后调 `set_fm_track`）。
    NeedFmTrack,
    /// 队列已尽（Sequential 队尾 / 空队列）。
    EndOfQueue,
}

/// 引擎全量快照（设计 §7 崩溃/重载恢复 + 评审要求含 played_ids）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    /// 当前队列（FM 激活时为单曲 FM 队列）。
    pub queue: Vec<QueueItem>,
    pub current_index: Option<usize>,
    pub mode: PlayMode,
    pub fm_active: bool,
    /// FM 已播 id 列表（FM 未激活时为空）。
    pub fm_played_ids: Vec<u64>,
    /// 前端上报的当前播放位置（秒）。仅供重启恢复；AudioCore 才是权威。
    /// `#[serde(default)]`：兼容旧版落盘快照（无此字段）。
    #[serde(default)]
    pub position_secs: f64,
    /// 前端上报的播放/暂停状态（上次已知）。仅供重启恢复。
    #[serde(default)]
    pub playing: bool,
}
