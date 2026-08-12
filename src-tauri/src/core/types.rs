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

/// 内容来源（设计 §2.6：与「迭代策略」正交的两条分类轴之一）。
/// `Queue` 走本地队列；`PersonalFm` 走 NCM 个性推荐（SDK 推送）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContentSource {
    /// 本地队列（受 `IterationStrategy` 控制）。
    Queue,
    /// 私人漫游（FM，SDK 推送；策略字段被忽略）。
    PersonalFm,
}

/// 迭代策略（设计 §2.4 + §2.6：与「内容来源」正交的另一条分类轴）。
/// 仅当 `ContentSource == Queue` 时生效；FM 模式强制忽略策略。
/// `snake_case` 序列化（IPC 模式字符串与事件 wire 对齐，设计 §4.1/§4.2）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayMode {
    /// 顺序播放。队尾不环绕。
    Sequential,
    /// 列表循环。队尾自动绕回首。
    LoopAll,
    /// 单曲循环。导航冻结在当前曲目。
    LoopOne,
    /// 随机播放。按内部排列循环前进。
    Shuffle,
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

/// 曲目自然结束后的引擎决策（cmd 层据此执行 I/O）。
/// 与 AdvanceResult 不同：此处不含 URL（URL 是 I/O 产物，应在 cmd 层解析）。
/// 与 `next()` 的差异：手动 next 在 Sequential 末尾环绕，`on_track_end()` 保持暂停。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AfterEndAction {
    /// 推进到指定索引（cmd 层 resolve_url 后返回 PlayUrlInfo）。
    PlayNext(usize),
    /// 重播当前曲（LoopOne；cmd 层读 last_url 缓存或重新 resolve）。
    ReplayCurrent,
    /// FM 模式需要新曲（cmd 层取 personal_fm）。
    NeedFmTrack,
    /// 队列耗尽（Sequential 末尾 / 空队列），保持暂停。
    Stopped,
}

/// 引擎全量快照（设计 §7 崩溃/重载恢复 + 评审要求含 played_ids）。
/// 硬切换：新字段 `iteration_strategy` + `content_source`，旧字段 `mode` / `fm_active` 不再存在。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlayerSnapshot {
    /// 当前队列（FM 激活时为单曲 FM 队列）。
    pub queue: Vec<QueueItem>,
    pub current_index: Option<usize>,
    pub iteration_strategy: PlayMode,
    pub content_source: ContentSource,
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
