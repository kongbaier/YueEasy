//! QueueEngine —— 播放器领域引擎（TS `src/core/queue/QueueManager.ts` 的 Rust 移植，Phase C）
//!
//! 行为基准：
//! - `src/core/queue/QueueManager.test.ts`（TS 现状特性测试，逐条对照注释在测试中）
//! - `docs/player-rust-design.md` §2 + 附录 B（评审门决策 ①-④，必须遵守）
//!
//! 纯逻辑：零 I/O、零网络、零第三方类型（仅 std + serde derive）。core 无外部依赖。
//!
//! 导航决策下沉到 `core/strategy.rs` 的 `PlayStrategy`（遍历顺序 `Order` × 终止策略 `Repeat`），
//! 「队尾如何续歌」由 `source`（`ContentSource`）决定，两者正交——引擎持有「导航策略」与「内容来源」两个独立维度。
//! 导航区分「手动切歌」（manual_next/manual_prev）与「自然结束」（on_track_end）两个独立入口：
//! Repeat::One 下手动切歌切走、自然结束重播当前曲；其余模式两者一致。

use crate::player::policy::{PlayStrategy, Step};
use crate::player::state::{ContentSource, Order, PlayerSnapshot, QueueItem, Repeat};

/// FM 进入前保存的原队列上下文（§2.1，enter/exit 的私有实现细节）。
struct SavedContext {
    queue: Vec<QueueItem>,
    index: Option<usize>,
    order: Order,
    repeat: Repeat,
}

/// 播放器领域引擎：队列管理、内容来源（`source`）× 导航策略（`order` × `repeat`）决策（§2.1 + §2.6）。
pub struct QueueEngine {
    // === 对外可见状态 ===
    queue: Vec<QueueItem>,
    current_index: Option<usize>,

    // === 内部状态（不对外暴露） ===
    /// 内容来源（Queue / PersonalFm）——决定队尾如何续歌。
    source: ContentSource,
    /// 导航策略（遍历顺序 × 终止策略 + Shuffle 排列状态）。始终有效，不与来源互斥。
    strategy: PlayStrategy,
    /// FM 进入前保存的原队列上下文（非 FM 时为 None）。
    fm_saved: Option<SavedContext>,
    /// FM 已播 id 列表（从原 FmState 拆出；Queue 源时为空）。
    fm_played_ids: Vec<u64>,
    /// 最近已知播放位置（秒）——位置持久化用（Phase F，快照仅存此值）。
    last_position: f64,
    /// 最近已知播放/暂停状态——位置持久化用（Phase F）。
    last_playing: bool,
}

impl Default for QueueEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl QueueEngine {
    // ── 构造 ──

    /// 构造空引擎（随机种子）。
    pub fn new() -> Self {
        Self::build_with_seed(random_seed())
    }

    /// 构造空引擎（注入种子，测试确定性）。
    #[cfg(test)]
    fn with_seed(seed: u64) -> Self {
        Self::build_with_seed(seed)
    }

    fn build_with_seed(seed: u64) -> Self {
        Self {
            queue: Vec::new(),
            current_index: None,
            source: ContentSource::Queue,
            strategy: PlayStrategy::new(Order::Sequential, Repeat::Off, seed),
            fm_saved: None,
            fm_played_ids: Vec::new(),
            last_position: 0.0,
            last_playing: false,
        }
    }

    /// 从快照恢复（WebView 重载 / 进程重启恢复，§7）。
    pub fn from_snapshot(snapshot: PlayerSnapshot) -> Self {
        let mut engine = Self::new();
        engine.queue = snapshot.queue;
        // 越界容错：current_index 钳制到合法范围
        engine.current_index = if engine.queue.is_empty() {
            None
        } else {
            snapshot.current_index.filter(|&i| i < engine.queue.len())
        };
        engine.fm_played_ids = snapshot.fm_played_ids;
        engine.source = snapshot.content_source;
        engine.last_position = snapshot.position_secs;
        engine.last_playing = snapshot.playing;
        // 导航策略始终跟随 order/repeat（Shuffle 排列惰性重建，不持久化）
        engine.strategy = PlayStrategy::new(snapshot.order, snapshot.repeat, random_seed());
        engine
    }

    /// 播放指定曲目。已在队列中 → 跳转（对齐 TS `play(existing)`）；否则替换为单曲上下文
    /// （对齐 TS `replace` 语义，任务规格明示；与 TS `play(new)` 的 insert-after 不同）。
    /// 退出 FM 并丢弃快照（对齐 TS `play`：用户主动点歌放弃漫游快照）。
    pub fn play_track(&mut self, track: QueueItem) -> &QueueItem {
        self.discard_fm();
        if let Some(pos) = self.queue.iter().position(|t| t.track_id == track.track_id) {
            self.current_index = Some(pos);
            self.reset_reported_position();
            return &self.queue[pos];
        }
        // 替换为单曲上下文
        self.queue_replace(vec![track], Some(0));
        self.current_track().unwrap()
    }

    /// 替换整个队列并从指定位置播放。退出 FM 并丢弃快照。空队列返回 None。
    /// 对齐 TS `replaceAndPlay(tracks, startIndex)`。
    pub fn replace_play(
        &mut self,
        tracks: Vec<QueueItem>,
        start_index: Option<usize>,
    ) -> Option<&QueueItem> {
        if self.source == ContentSource::PersonalFm {
            self.discard_fm();
        }

        self.queue_replace(tracks, start_index);
        self.current_track()
    }

    /// 从队列指定位置播放。越界返回 None（对齐 TS `select`）。
    /// FM 激活时先退出 FM（恢复快照）再按恢复后的队列执行。
    pub fn play_queue_at(&mut self, index: usize) -> Option<&QueueItem> {
        if self.is_fm_active() {
            self.exit_fm(); // FM 守卫：先恢复快照再按原队列执行
        }
        if index >= self.queue.len() {
            return None;
        }
        self.current_index = Some(index);
        self.reset_reported_position();
        self.current_track()
    }

    /// 手动切下一首（用户点「下一首」按钮 / 媒体键 / SMTC）。
    /// 返回 `Play(idx)` / `ReplayCurrent` / `End`。`End` 后续行为由 `source` 决定
    /// （cmd 层：Queue 停止、PersonalFm 续歌）。
    pub fn manual_next(&mut self) -> Step {
        let current = self.current_index;
        let len = self.queue.len();
        let step = self.strategy.manual_next(current, len);
        if let Step::Play(idx) = step {
            self.current_index = Some(idx);
            self.reset_reported_position();
        }
        step
    }

    /// 曲目自然播完（ended watcher 检测后调用）。
    /// 与「手动切下一首」是两个独立入口：LoopOne 下自然结束重播当前曲，手动切歌切走。
    pub fn on_track_end(&mut self) -> Step {
        let current = self.current_index;
        let len = self.queue.len();
        let step = self.strategy.on_track_end(current, len);
        if let Step::Play(idx) = step {
            self.current_index = Some(idx);
            self.reset_reported_position();
        }
        step
    }

    /// 手动切上一首。无上一首返回 None。
    pub fn prev(&mut self) -> Option<&QueueItem> {
        let current = self.current_index;
        let len = self.queue.len();
        let idx = self.strategy.manual_prev(current, len)?;
        self.current_index = Some(idx);
        self.reset_reported_position();
        self.current_track()
    }

    // ── 队列操作 ──

    /// 追加到队尾（按 track_id 去重，对齐 TS `append`/`appendMany`）。空队列自动播放。
    /// FM 激活时先退出 FM（恢复快照）再追加，不回 FM（附录 B 决策④）。
    pub fn append(&mut self, tracks: Vec<QueueItem>) {
        if self.is_fm_active() {
            self.exit_fm(); // 决策④
        }
        self.queue_add(self.queue.len(), &tracks);
    }

    /// 插入当前曲目之后（按 track_id 去重，对齐 TS `insertNext`）。空队列自动播放。
    /// FM 激活时先退出 FM（恢复快照）再插入——与决策④同语义，保持单曲 FM 模型不变量。
    pub fn insert_next(&mut self, track: QueueItem) {
        if self.is_fm_active() {
            self.exit_fm();
        }
        let at = self.current_index.map_or(0, |ci| ci + 1);
        self.queue_add(at, &[track]);
    }

    /// 移除指定位置曲目。越界为 no-op（对齐 TS `removeAt` 越界拒绝）。
    /// FM 激活时先退出 FM（恢复快照）再按恢复后的队列移除。
    pub fn remove_at(&mut self, index: usize) {
        if self.is_fm_active() {
            self.exit_fm(); // FM 守卫：先恢复快照再按原队列移除（保持单曲 FM 模型不变量）
        }
        self.queue_delete(index);
    }

    /// 清空队列并重置索引。退出 FM 并丢弃快照（对齐 TS `clear`）。
    pub fn clear(&mut self) {
        self.discard_fm();
        self.queue_clear();
    }

    // ── 模式（order × repeat） ──

    /// 设置终止策略（off/all/one）。不影响遍历顺序与已生成的随机排列。
    pub fn set_repeat(&mut self, repeat: Repeat) {
        self.strategy.set_repeat(repeat);
    }

    /// 设置遍历顺序（sequential/shuffle）。进入 Shuffle 时重建随机序列并锚定当前位置。
    /// 来源与策略正交：改 order/repeat 不影响 source。
    pub fn set_order(&mut self, order: Order) {
        self.strategy.set_order(order);
    }

    // ── FM ──

    /// 进入 FM（单曲模型，§2.5）。保存当前队列上下文，设置初始曲目，切换到 `PersonalFm` 来源。
    /// 已在 FM 中再次进入不覆盖原快照（对齐 TS `enterFm`）。
    pub fn enter_fm(&mut self, initial_track: QueueItem) {
        if !self.is_fm_active() {
            self.fm_saved = Some(SavedContext {
                queue: std::mem::take(&mut self.queue),
                index: self.current_index,
                order: self.strategy.order(),
                repeat: self.strategy.repeat(),
            });
        }
        self.source = ContentSource::PersonalFm;
        self.queue_replace(vec![initial_track], Some(0));
        self.fm_played_ids.clear();
    }

    /// 退出内容来源回到 `Queue`：
    /// - PersonalFm：恢复进入前保存的原队列上下文（含 order/repeat）；无快照则清空（§2.5）。
    /// - Queue：no-op。
    pub fn exit_fm(&mut self) -> Option<&QueueItem> {
        match self.source {
            ContentSource::PersonalFm => {
                self.fm_played_ids.clear();
                self.source = ContentSource::Queue;
                if let Some(ctx) = self.fm_saved.take() {
                    self.queue = ctx.queue;
                    self.current_index = ctx.index;
                    self.strategy.set_order(ctx.order);
                    self.strategy.set_repeat(ctx.repeat);
                    self.reset_reported_position();
                    self.current_track()
                } else {
                    // FM 激活但无快照（from_snapshot 恢复场景）→ 清空是合理行为（§2.5）
                    self.queue_clear();
                    None
                }
            }
            ContentSource::Queue => self.current_track(),
        }
    }

    /// FM 续歌（流式）：向 FM 队列尾部追加曲目（按 track_id 去重）。非 FM 调用为 no-op。
    /// 用于「播放到队尾 → personal_fm 取新歌 → 追加」的无限流模型（P1）。
    pub fn append_fm(&mut self, tracks: Vec<QueueItem>) {
        if !self.is_fm_active() {
            return;
        }
        self.queue_add(self.queue.len(), &tracks);
    }

    /// FM「不感兴趣」：移除当前 FM 曲目并返回被移除的曲（供 cmd 层上报 + 播下一首）。
    /// 移除后队列内下一首滑入；若队列空 current_index 置 None。非 FM 返回 None。
    pub fn remove_fm_current(&mut self) -> Option<QueueItem> {
        if !self.is_fm_active() {
            return None;
        }
        let ci = self.current_index?;
        self.queue_delete(ci)
    }

    /// 记录当前 FM 曲目已播放（加入 played_ids）。
    /// 多曲 FM 下无服务端消费点（personal_fm 服务端自管理），保留供快照契约与测试，后续清理。
    #[allow(dead_code)]
    pub fn fm_record_played(&mut self) {
        if self.is_fm_active() {
            if let Some(track) = self.current_track() {
                self.fm_played_ids.push(track.track_id);
            }
        }
    }

    // ── 只读查询 ──

    pub fn current_track(&self) -> Option<&QueueItem> {
        self.current_index.and_then(|i| self.queue.get(i))
    }

    pub fn current_index(&self) -> Option<usize> {
        self.current_index
    }

    pub fn queue_items(&self) -> &[QueueItem] {
        &self.queue
    }

    /// 仅测试使用（wire 判别见 snapshot/事件）。
    #[allow(dead_code)]
    pub fn order(&self) -> Order {
        self.strategy.order()
    }

    /// 仅测试使用（wire 判别见 snapshot/事件）。
    #[allow(dead_code)]
    pub fn repeat(&self) -> Repeat {
        self.strategy.repeat()
    }

    pub fn is_fm_active(&self) -> bool {
        self.source == ContentSource::PersonalFm
    }

    pub fn source(&self) -> ContentSource {
        self.source
    }

    /// 全量快照（§7 + 评审要求：含 fm_played_ids）。
    pub fn snapshot(&self) -> PlayerSnapshot {
        PlayerSnapshot {
            queue: self.queue.clone(),
            current_index: self.current_index,
            order: self.strategy.order(),
            repeat: self.strategy.repeat(),
            content_source: self.source,
            fm_played_ids: self.fm_played_ids.clone(),
            position_secs: self.last_position,
            playing: self.last_playing,
        }
    }

    /// 上报播放进度/状态（`start_ended_watcher` 周期写入；仅持久化用途）。
    pub fn report_position(&mut self, position_secs: f64, playing: bool) {
        self.last_position = position_secs.max(0.0);
        self.last_playing = playing;
    }

    // ── 内部 ──

    // ── 队列基础原语（所有队列修改的唯一入口；index 一致性在此统一维护） ──

    /// 基础增：去重后插入到指定位置。插入后维护 index：空队列首次插入自动 Some(0)。
    /// 返回是否插入了任何曲。
    fn queue_add(&mut self, at: usize, tracks: &[QueueItem]) -> bool {
        let mut idx = at.min(self.queue.len());
        let mut added = false;
        for t in tracks {
            if self.queue.iter().any(|x| x.track_id == t.track_id) {
                continue;
            }
            self.queue.insert(idx, t.clone());
            idx += 1;
            added = true;
        }
        if added && self.current_index.is_none() && !self.queue.is_empty() {
            self.current_index = Some(0);
            self.reset_reported_position();
        }
        added
    }

    /// 基础删：删除指定位置。删除后维护 index（空→None；删当前曲之前→前移；删当前曲→下一首滑入/钳制尾）。
    /// 返回被删除的曲（越界 None）。
    fn queue_delete(&mut self, index: usize) -> Option<QueueItem> {
        if index >= self.queue.len() {
            return None;
        }
        let old_ci = self.current_index;
        let removed = self.queue.remove(index);
        self.current_index = match old_ci {
            None => None,
            Some(ci) => {
                if self.queue.is_empty() {
                    None
                } else if index < ci {
                    Some(ci - 1)
                } else if index == ci {
                    Some(ci.min(self.queue.len() - 1))
                } else {
                    Some(ci)
                }
            }
        };
        if old_ci == Some(index) {
            // 删除的是当前曲 → 当前曲变化，重置位置
            self.reset_reported_position();
        }
        Some(removed)
    }

    /// 基础清空：清空队列 + index=None。
    fn queue_clear(&mut self) {
        self.queue.clear();
        self.current_index = None;
        self.reset_reported_position();
    }

    /// 基础替换：替换整个队列并从 start 位置起播。空队列 → 清空；start 越界钳制到尾。
    fn queue_replace(&mut self, tracks: Vec<QueueItem>, start: Option<usize>) {
        if tracks.is_empty() {
            self.queue_clear();
            return;
        }
        let idx = start.unwrap_or(0).min(tracks.len() - 1);
        self.queue = tracks;
        self.current_index = Some(idx);
        self.reset_reported_position();
    }

    /// 退出 FM 并丢弃快照（play_track / clear / replace_play 用，对齐 TS「主动操作放弃漫游快照」）。
    fn discard_fm(&mut self) {
        self.source = ContentSource::Queue;
        self.fm_saved = None;
        self.fm_played_ids.clear();
    }

    /// 当前曲目变化：重置已上报位置（位置按曲目归属，切歌后旧曲目的位置对新曲目无效）。
    fn reset_reported_position(&mut self) {
        self.last_position = 0.0;
    }
}

/// 随机种子：以系统时间纳秒为熵源（core 零外部依赖，仅 std）。
fn random_seed() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_nanos() as u64
}

#[cfg(test)]
#[path = "queue_test.rs"]
mod tests;
