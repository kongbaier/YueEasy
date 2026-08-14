//! PlayerEngine —— 播放器领域引擎（TS `src/core/queue/QueueManager.ts` 的 Rust 移植，Phase C）
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

use crate::core::strategy::{PlayStrategy, Step};
use crate::core::types::{ContentSource, Order, PlayerSnapshot, QueueItem, Repeat};

/// FM 进入前保存的原队列上下文（§2.1，enter/exit 的私有实现细节）。
struct SavedContext {
    queue: Vec<QueueItem>,
    index: Option<usize>,
    order: Order,
    repeat: Repeat,
}

/// 播放器领域引擎：队列管理、内容来源（`source`）× 导航策略（`order` × `repeat`）决策（§2.1 + §2.6）。
pub struct PlayerEngine {
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

impl Default for PlayerEngine {
    fn default() -> Self {
        Self::new()
    }
}

impl PlayerEngine {
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

    // ── 播放控制 ──

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
        self.discard_fm();
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
        // 每次进入 FM 重置已播 id 列表（与原 FmState::Active { played_ids: Vec::new() } 等价）
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
        let removed = self.queue_delete(ci);
        removed
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

// ═══════════════════════════════════════════════════════════════════════════
// 单元测试
//
// 对照基准：`src/core/queue/QueueManager.test.ts`。每个用例注释标注对齐的 TS
// 行号；附录 B 明确改变的语义（差异③/④、单曲 FM 模型、play_track 单曲替换）
// 作为 Rust 新行为单独注明。策略化后 `next` 与「曲目自然结束」统一（Sequential
// 队尾停止，不再区分手动 next 环绕 / 自动结束暂停）。
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ── 测试工厂 ──

    fn make_item(id: u64) -> QueueItem {
        QueueItem {
            track_id: id,
            title: format!("song-{}", id),
            artist: format!("artist-{}", id),
            album: format!("album-{}", id),
            cover_url: format!("https://cover/{}", id),
            duration_secs: 180.0,
        }
    }

    fn items(n: u64) -> Vec<QueueItem> {
        (0..n).map(make_item).collect()
    }

    /// 固定种子 + append 构造：queue=[0..n)，index=0，Sequential 模式。
    fn setup(n: u64) -> PlayerEngine {
        let mut e = PlayerEngine::with_seed(42);
        e.append(items(n));
        e
    }

    /// 断言 manual_next() 为 Play 并返回索引。
    fn next_index(e: &mut PlayerEngine) -> usize {
        match e.manual_next() {
            Step::Play(i) => i,
            other => panic!("expected Play, got {:?}", other),
        }
    }

    fn ids_of(e: &PlayerEngine) -> Vec<u64> {
        e.queue_items().iter().map(|t| t.track_id).collect()
    }

    // ── 构造与状态访问器（→ current_track / queue_items / current_index / mode / snapshot） ──

    #[test]
    fn setup_builds_queue_and_starts_at_first() {
        // 对齐 TS line 54-62（constructor with tracks starts at index 0）
        let e = setup(3);
        assert_eq!(e.queue_items().len(), 3);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 0);
        assert_eq!(e.order(), Order::Sequential);
        assert_eq!(e.repeat(), Repeat::Off);
        assert!(!e.is_fm_active());
    }

    // ── Sequential 模式导航（→ next / prev） ──

    #[test]
    fn sequential_next_moves_forward() {
        // 对齐 TS line 86-90
        let mut e = setup(4);
        e.play_queue_at(1);
        assert_eq!(next_index(&mut e), 2);
        assert_eq!(e.current_track().unwrap().track_id, 2);
    }

    #[test]
    fn sequential_next_at_end_returns_end() {
        // 统一语义：Sequential 手动 next 在队尾停止（不再环绕；与 LoopAll 区分）
        let mut e = setup(4);
        e.play_queue_at(3);
        assert!(matches!(e.manual_next(), Step::End));
        assert_eq!(e.current_index(), Some(3)); // 位置不变，保持当前曲
        assert_eq!(e.current_track().unwrap().track_id, 3);
    }

    #[test]
    fn loop_all_next_at_end_wraps_to_zero() {
        // LoopAll：队尾自动环绕回 0
        let mut e = setup(4);
        e.play_queue_at(3);
        e.set_repeat(Repeat::All);
        assert!(matches!(e.manual_next(), Step::Play(0)));
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 0);
    }

    #[test]
    fn loop_one_manual_next_advances_to_next() {
        // LoopOne 手动下一首 = 列表循环（切走），与 LoopAll 一致
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_repeat(Repeat::One);
        assert!(matches!(e.manual_next(), Step::Play(3)));
        assert_eq!(e.current_index(), Some(3));
        assert_eq!(e.current_track().unwrap().track_id, 3);
    }

    #[test]
    fn loop_one_track_end_replays_current() {
        // LoopOne 自然结束 = 重播当前曲（不切走）
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_repeat(Repeat::One);
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent));
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(e.current_track().unwrap().track_id, 2);
    }

    #[test]
    fn empty_queue_next_returns_end() {
        let mut e = setup(0);
        assert!(matches!(e.manual_next(), Step::End));
        assert_eq!(e.current_index(), None);
    }

    #[test]
    fn fm_next_returns_fetch_fm() {
        let mut e = setup(3);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        assert!(matches!(e.manual_next(), Step::End)); // FM 下 next 返回队尾信号 End（续歌由 cmd 层据 source 决策）
    }

    #[test]
    fn sequential_prev_moves_back_and_wraps_at_first() {
        // 对齐 TS line 97-105（prev 环绕）
        let mut e = setup(4);
        e.play_queue_at(2);
        assert_eq!(e.prev().unwrap().track_id, 1);
        e.play_queue_at(0);
        assert_eq!(e.prev().unwrap().track_id, 3);
    }

    // ── RepeatOne（LoopOne）模式导航 ──

    #[test]
    fn repeat_one_manual_next_advances_and_track_end_replays() {
        // 对齐 TS line 116-130（更新语义：手动切歌切走，自然结束重播当前）
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_repeat(Repeat::One);
        assert!(matches!(e.manual_next(), Step::Play(3))); // 手动切走
        assert_eq!(e.prev().unwrap().track_id, 2); // prev 回到切歌前
        e.play_queue_at(2);
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent)); // 自然结束重播
        assert_eq!(e.current_index(), Some(2));
    }

    #[test]
    fn set_mode_loop_one_manual_next_advances() {
        // 对齐 TS line 132-138（更新语义）
        let mut e = setup(4);
        e.play_queue_at(1);
        e.set_repeat(Repeat::One);
        assert_eq!(e.repeat(), Repeat::One);
        assert!(matches!(e.manual_next(), Step::Play(2))); // 手动切到下一首
        assert_eq!(e.prev().unwrap().track_id, 1); // prev 回到上一首
        e.play_queue_at(1);
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent)); // 自然结束重播当前
    }

    // ── Shuffle 模式导航（固定种子 → 确定性排列） ──

    #[test]
    fn shuffle_off_covers_each_index_once_then_ends() {
        // 随机遍历 + 终止策略 off：覆盖全部索引一次后队尾停止（不环绕）
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        let mut seen = vec![e.current_index().unwrap()]; // 起点 = 当前曲
        for _ in 0..3 {
            seen.push(next_index(&mut e));
        }
        // 无重复、覆盖全部 4 个索引（起点 + 3 次前进）
        let mut sorted = seen.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2, 3]);
        // off：遍历完一轮后队尾停止
        assert!(matches!(e.manual_next(), Step::End));
    }

    #[test]
    fn shuffle_all_wraps_to_first() {
        // 随机遍历 + 列表循环：一轮后环绕回第一首
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.set_repeat(Repeat::All);
        let mut seen = Vec::new();
        for _ in 0..4 {
            seen.push(next_index(&mut e));
        }
        let mut sorted = seen.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2, 3]);
        assert_eq!(next_index(&mut e), seen[0]); // 环绕新一轮
    }

    #[test]
    fn shuffle_one_replays_current_on_end() {
        // 随机遍历 + 单曲循环：自然结束重播当前
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.set_repeat(Repeat::One);
        let _ = next_index(&mut e);
        let current = e.current_index();
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent));
        assert_eq!(e.current_index(), current);
    }

    #[test]
    fn shuffle_is_deterministic_for_same_seed() {
        // Rust 新行为：固定种子 → 两个引擎产生相同导航序列
        let mut e1 = setup(4);
        e1.set_order(Order::Shuffle);
        e1.set_repeat(Repeat::All);
        let mut e2 = setup(4);
        e2.set_order(Order::Shuffle);
        e2.set_repeat(Repeat::All);
        for _ in 0..4 {
            assert_eq!(next_index(&mut e1), next_index(&mut e2));
        }
    }

    #[test]
    fn shuffle_prev_returns_previously_played() {
        // 对齐 TS line 168-175
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        let first = next_index(&mut e);
        let _second = next_index(&mut e);
        assert_eq!(e.prev().unwrap().track_id, first as u64); // 回到上一首
        assert_eq!(e.prev().unwrap().track_id, 0); // 再退回到起点曲目 id 0
    }

    #[test]
    fn set_mode_shuffle_reanchors_at_current_index() {
        // 对齐 TS line 177-183
        let mut e = setup(4);
        let _ = e.manual_next(); // sequential: 0 → 1
        e.set_order(Order::Shuffle); // 锚定在 index 1
        let idx = next_index(&mut e);
        assert!(idx < 4);
        assert_ne!(idx, 1);
        assert_eq!(e.prev().unwrap().track_id, 1); // prev 回到锚定曲目
    }

    #[test]
    fn set_mode_shuffle_again_rebuilds_navigation_in_range() {
        // 重新随机 = 再次 set_order(Shuffle)（set_order 推进 seed → 新排列）
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.set_repeat(Repeat::All);
        e.set_order(Order::Shuffle); // 重新随机
        let mut seen = Vec::new();
        for _ in 0..4 {
            seen.push(next_index(&mut e));
        }
        let mut sorted = seen.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2, 3]); // 同一组索引的一种排列，全部在范围内
        assert!(e.current_track().is_some());
    }

    // ── reshuffle 修复（决策①：不复刻 TS shuffle 失活 bug，对齐 TS line 194-224 的场景） ──

    #[test]
    fn reshuffle_play_new_track_in_shuffle_keeps_navigation_valid() {
        // TS line 194-204 的 bug 场景（next 返回 undefined / currentTrack null）：
        // Rust 中 play_track(新曲) 替换为单曲上下文并 reshuffle → 导航不越界不 undefined
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.play_track(make_item(99));
        assert_eq!(e.current_index(), Some(0));
        // 单曲随机 + off → 队尾停止（不再环绕回自己），导航不越界不 panic
        assert!(matches!(e.manual_next(), Step::End));
        assert!(e.current_track().is_some());
    }

    #[test]
    fn reshuffle_play_existing_in_shuffle_syncs_position() {
        // TS line 206-213 的 bug 场景（跳转 index 后 shuffle 位置不同步 → next 返回陈旧位置）：
        // Rust reshuffle 以新 current_index 为锚，next 从新位置继续，prev 回到跳转曲目
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.play_track(make_item(2));
        assert_eq!(e.current_index(), Some(2));
        let idx = next_index(&mut e);
        assert!(idx < 4);
        assert_ne!(idx, 2);
        assert_eq!(e.prev().unwrap().track_id, 2);
    }

    #[test]
    fn reshuffle_remove_at_in_shuffle_stays_in_bounds() {
        // TS line 215-224 的 bug 场景（shuffle 序列越界 → currentTrack null）：
        // Rust remove_at 后 reshuffle → 后续 next 索引始终在队列范围内
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        let _ = next_index(&mut e); // 前进（结果必 ≠ 0，见排列不变量）
        let ci = e.current_index().unwrap();
        assert_ne!(ci, 0);
        e.remove_at(0);
        assert_eq!(e.current_index(), Some(ci - 1));
        let idx = next_index(&mut e);
        assert!(idx < 3, "shuffle idx {} out of bounds", idx);
        assert!(e.current_track().is_some());
    }

    #[test]
    fn reshuffle_append_in_shuffle_stays_in_bounds() {
        // Rust 新行为（修复场景扩展）：append 后 shuffle 序列保持有效
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        e.append(vec![make_item(4)]);
        assert_eq!(e.queue_items().len(), 5);
        let idx = next_index(&mut e);
        assert!(idx < 5);
        assert!(e.current_track().is_some());
    }

    // ── exit_fm 守卫（决策②，对齐 TS line 516-523 的 bug 场景） ──

    #[test]
    fn exit_fm_on_non_fm_is_noop() {
        // TS 现状：非 FM 调用 exitFm() 静默清空队列；Rust 守卫：no-op 不碰队列
        let mut e = setup(3);
        let before = e.current_track().unwrap().track_id;
        let res = e.exit_fm();
        assert!(res.is_some());
        assert_eq!(res.unwrap().track_id, before);
        assert!(!e.is_fm_active());
        assert_eq!(e.queue_items().len(), 3);
        assert_eq!(e.current_index(), Some(0));
    }

    // ── 队列操作：play_track / play_queue_at（→ play_track / play_queue_at） ──

    #[test]
    fn play_track_existing_jumps_without_duplicate() {
        // 对齐 TS line 283-289
        let mut e = setup(4);
        e.play_track(make_item(3));
        assert_eq!(e.current_index(), Some(3));
        assert_eq!(e.queue_items().len(), 4);
        assert_eq!(ids_of(&e), vec![0, 1, 2, 3]);
    }

    #[test]
    fn play_track_new_replaces_with_single_track() {
        // Rust 差异（任务规格明示）：TS play(新曲) 插入当前之后（line 291-297，
        // 结果 [0,1,99,2,3]）；Rust 替换为单曲上下文（对齐 TS replace 语义）→ [99]
        let mut e = setup(4);
        e.play_queue_at(1);
        e.play_track(make_item(99));
        assert_eq!(ids_of(&e), vec![99]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 99);
    }

    #[test]
    fn play_track_on_empty_creates_single_track() {
        // 对齐 TS line 299-304
        let mut e = PlayerEngine::with_seed(1);
        e.play_track(make_item(5));
        assert_eq!(ids_of(&e), vec![5]);
        assert_eq!(e.current_index(), Some(0));
    }

    #[test]
    fn play_track_exits_fm_and_discards_snapshot() {
        // 对齐 TS line 306-313（play 退出 FM 并丢弃快照）
        let mut e = setup(3);
        e.enter_fm(make_item(1));
        assert!(e.is_fm_active());
        e.play_track(make_item(99));
        assert!(!e.is_fm_active());
        assert_eq!(e.current_track().unwrap().track_id, 99);
        assert_eq!(e.current_index(), Some(0));
    }

    #[test]
    fn play_queue_at_jumps_and_rejects_out_of_range() {
        // 对齐 TS select（line 429-440）
        let mut e = setup(4);
        assert!(e.play_queue_at(2).is_some());
        assert_eq!(e.current_index(), Some(2));
        assert!(e.play_queue_at(4).is_none());
        assert!(e.play_queue_at(99).is_none());
        assert_eq!(e.current_index(), Some(2)); // 拒绝越界后位置不变
    }

    // ── 队列操作：replace_play（对齐 TS replaceAndPlay，Phase C 评审门新增） ──

    #[test]
    fn replace_play_replaces_queue_and_starts_at_index() {
        let mut e = setup(3);
        let played = e.replace_play(vec![make_item(10), make_item(11), make_item(12)], Some(1));
        assert_eq!(played.unwrap().track_id, 11);
        assert_eq!(ids_of(&e), vec![10, 11, 12]);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(e.current_track().unwrap().track_id, 11);
        assert!(!e.is_fm_active());
    }

    #[test]
    fn replace_play_empty_queue_returns_none_and_resets() {
        let mut e = setup(3);
        e.play_queue_at(2);
        assert!(e.replace_play(Vec::new(), None).is_none());
        assert_eq!(e.queue_items().len(), 0);
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn replace_play_start_index_out_of_range_clamps() {
        let mut e = setup(3);
        let played = e.replace_play(vec![make_item(10), make_item(11), make_item(12)], Some(99));
        assert_eq!(played.unwrap().track_id, 12);
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(e.current_track().unwrap().track_id, 12);

        let mut e2 = setup(3);
        let played2 = e2.replace_play(vec![make_item(10), make_item(11), make_item(12)], None);
        assert_eq!(played2.unwrap().track_id, 10);
        assert_eq!(e2.current_index(), Some(0));
    }

    #[test]
    fn replace_play_in_fm_exits_and_discards_snapshot() {
        let mut e = setup(3);
        e.play_queue_at(1);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        let played_id = e
            .replace_play(vec![make_item(20), make_item(21)], Some(1))
            .map(|t| t.track_id);
        assert!(!e.is_fm_active());
        assert_eq!(played_id, Some(21));
        assert_eq!(ids_of(&e), vec![20, 21]);
        assert_eq!(e.current_index(), Some(1));
        // 快照已丢弃：再 exit_fm 不应恢复出原队列 [0,1,2]
        assert!(e.exit_fm().is_some());
        assert_eq!(ids_of(&e), vec![20, 21]); // 保持新队列
    }

    #[test]
    fn replace_play_in_shuffle_navigates_after_call() {
        let mut e = setup(4);
        e.set_order(Order::Shuffle);
        let played = e.replace_play(items(5), Some(0));
        assert_eq!(played.unwrap().track_id, 0);
        assert_eq!(e.order(), Order::Shuffle); // 遍历顺序保留
        assert_eq!(e.queue_items().len(), 5);
        let idx = next_index(&mut e);
        assert!(idx < 5, "shuffle idx {} out of bounds", idx);
        assert!(e.current_track().is_some());
    }

    // ── 队列操作：append / insert_next ──

    #[test]
    fn append_keeps_current_position() {
        // 对齐 TS line 319-325
        let mut e = setup(3);
        e.play_queue_at(1);
        e.append(vec![make_item(3)]);
        assert_eq!(ids_of(&e), vec![0, 1, 2, 3]);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(e.current_track().unwrap().track_id, 1);
    }

    #[test]
    fn append_is_dupe_safe() {
        // 对齐 TS line 327-332
        let mut e = setup(3);
        e.append(vec![make_item(1)]);
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
        assert_eq!(e.queue_items().len(), 3);
    }

    #[test]
    fn append_to_empty_auto_plays() {
        // 对齐 TS line 334-339
        let mut e = PlayerEngine::with_seed(7);
        e.append(vec![make_item(7)]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 7);
    }

    #[test]
    fn append_batch_dedupes() {
        // 对齐 TS appendMany（line 362-367）：批量追加 + 去重计数
        let mut e = setup(2);
        e.append(vec![make_item(2), make_item(3), make_item(2)]); // 2 重复
        assert_eq!(ids_of(&e), vec![0, 1, 2, 3]);
    }

    #[test]
    fn append_cross_batch_dedupes() {
        // 多次 append 跨批次去重
        let mut e = PlayerEngine::with_seed(11);
        e.append(vec![make_item(1), make_item(2)]);
        e.append(vec![make_item(2), make_item(3)]);
        assert_eq!(ids_of(&e), vec![1, 2, 3]);
        assert_eq!(e.queue_items().len(), 3);
    }

    #[test]
    fn insert_next_inserts_after_current() {
        // 对齐 TS line 341-347
        let mut e = setup(4);
        e.play_queue_at(1);
        e.insert_next(make_item(99));
        assert_eq!(ids_of(&e), vec![0, 1, 99, 2, 3]);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(e.current_track().unwrap().track_id, 1);
    }

    #[test]
    fn insert_next_is_dupe_safe() {
        // 对齐 TS line 349-354
        let mut e = setup(3);
        e.insert_next(make_item(2));
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
        assert_eq!(e.queue_items().len(), 3);
    }

    #[test]
    fn insert_next_into_empty_auto_plays() {
        // 对齐 TS line 356-360
        let mut e = PlayerEngine::with_seed(8);
        e.insert_next(make_item(8));
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 8);
    }

    // ── 队列操作：remove_at / clear ──

    #[test]
    fn remove_at_before_current_decrements_index() {
        // 对齐 TS line 382-388
        let mut e = setup(5);
        e.play_queue_at(3);
        e.remove_at(1);
        assert_eq!(ids_of(&e), vec![0, 2, 3, 4]);
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(e.current_track().unwrap().track_id, 3);
    }

    #[test]
    fn remove_at_current_keeps_index_next_slides_in() {
        // 对齐 TS line 390-396
        let mut e = setup(5);
        e.play_queue_at(2);
        e.remove_at(2);
        assert_eq!(ids_of(&e), vec![0, 1, 3, 4]);
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(e.current_track().unwrap().track_id, 3);
    }

    #[test]
    fn remove_at_current_last_clamps_to_new_end() {
        // 对齐 TS line 398-404
        let mut e = setup(4);
        e.play_queue_at(3);
        e.remove_at(3);
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(e.current_track().unwrap().track_id, 2);
    }

    #[test]
    fn remove_at_after_current_leaves_index() {
        // 对齐 TS line 406-411
        let mut e = setup(5);
        e.play_queue_at(1);
        e.remove_at(3);
        assert_eq!(ids_of(&e), vec![0, 1, 2, 4]);
        assert_eq!(e.current_index(), Some(1));
    }

    #[test]
    fn remove_at_out_of_range_is_noop() {
        // 对齐 TS line 413-419
        let mut e = setup(3);
        e.play_queue_at(1);
        e.remove_at(3);
        e.remove_at(99);
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
        assert_eq!(e.current_index(), Some(1));
    }

    #[test]
    fn remove_at_last_remaining_empties_queue() {
        // 对齐 TS line 421-427
        let mut e = setup(1);
        e.remove_at(0);
        assert_eq!(e.queue_items().len(), 0);
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn clear_empties_queue_and_resets_index() {
        // 对齐 TS line 442-448
        let mut e = setup(4);
        e.play_queue_at(2);
        e.clear();
        assert_eq!(e.queue_items().len(), 0);
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn clear_exits_fm_and_discards_snapshot() {
        // 对齐 TS line 450-457
        let mut e = setup(3);
        e.enter_fm(make_item(1));
        e.clear();
        assert!(!e.is_fm_active());
        assert_eq!(e.queue_items().len(), 0);
    }

    // ── FM 状态机（多曲流式模型，P1 改造） ──

    #[test]
    fn fm_full_flow_streaming_model() {
        // 多曲 FM 模型全流程（P1）：enter → next==End(队尾) → append_fm 续歌 → next 播新歌 → exit_fm 恢复
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.enter_fm(make_item(100)); // 默认 Sequential
        assert!(e.is_fm_active());
        assert_eq!(ids_of(&e), vec![100]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 100);

        // FM 下（Sequential）next → End（队尾信号，续歌由 cmd 层据 source 决策）
        assert!(matches!(e.manual_next(), Step::End));
        // FM 下 prev 由导航策略决定（单曲环绕回自己；多曲 FM 队列时才有真实上一首）

        // fm_record_played：把当前曲目 id 加入 played_ids
        e.fm_record_played();
        assert_eq!(e.snapshot().fm_played_ids, vec![100]);

        // append_fm 续歌：追加新曲到 FM 队列尾 → 再 next 播下一首（多曲流式）
        e.append_fm(vec![make_item(101), make_item(102)]);
        assert_eq!(ids_of(&e), vec![100, 101, 102]);
        assert!(matches!(e.manual_next(), Step::Play(1)));
        assert_eq!(e.current_track().unwrap().track_id, 101);

        // exit_fm：恢复原队列 / index / mode
        let restored = e.exit_fm().expect("restored track");
        assert_eq!(restored.track_id, 1);
        assert!(!e.is_fm_active());
        assert_eq!(e.order(), Order::Sequential);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
    }

    #[test]
    fn fm_loop_one_keeps_current_track() {
        // 正交化新语义：FM 下 mode=LoopOne → 自然结束重播当前曲（漫游中「单曲循环多听几遍」），不前进。
        let mut e = setup(3);
        e.play_queue_at(1);
        e.set_repeat(Repeat::One);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        // 手动下一首：单曲 FM 队列环绕回自己（Play(0)）；自然结束：重播当前（ReplayCurrent）
        assert!(matches!(e.manual_next(), Step::Play(0)));
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent));
        assert_eq!(e.current_track().unwrap().track_id, 100);
        // exit_fm 恢复 mode=LoopOne
        let restored = e.exit_fm().expect("restored");
        assert_eq!(restored.track_id, 1);
        assert!(!e.is_fm_active());
        assert_eq!(e.repeat(), Repeat::One);
        assert_eq!(e.current_index(), Some(1));
    }

    #[test]
    fn enter_fm_reentry_keeps_original_snapshot() {
        // 对齐 TS line 498-506（已在 FM 中再次进入不覆盖原快照）
        let mut e = setup(3);
        e.play_queue_at(1);
        e.enter_fm(make_item(100));
        e.enter_fm(make_item(200));
        assert!(e.is_fm_active());
        assert_eq!(e.current_track().unwrap().track_id, 200);
        let restored = e.exit_fm().expect("restored");
        assert_eq!(restored.track_id, 1);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
    }

    #[test]
    fn enter_fm_from_empty_queue_exit_empties() {
        // 对齐 TS line 491-496 + 508-514（进入前无队列 → 退出后为空）
        let mut e = PlayerEngine::with_seed(5);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        assert!(e.exit_fm().is_none());
        assert_eq!(e.queue_items().len(), 0);
        assert_eq!(e.current_index(), None);
    }

    #[test]
    fn append_in_fm_exits_fm_restores_then_appends() {
        // 差异④：FM 中 append → 先退出 FM（恢复快照）再追加，不回 FM
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.append(vec![make_item(3)]); // [0,1,2,3]@1
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        e.append(vec![make_item(9)]);
        assert!(!e.is_fm_active());
        assert_eq!(ids_of(&e), vec![0, 1, 2, 3, 9]);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(e.current_track().unwrap().track_id, 1);
    }

    #[test]
    fn insert_next_in_fm_exits_fm_first() {
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.enter_fm(make_item(100));
        e.insert_next(make_item(99));
        assert!(!e.is_fm_active());
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(ids_of(&e), vec![0, 1, 99, 2]);
    }

    #[test]
    fn play_queue_at_in_fm_exits_fm_first() {
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        let played_id = e.play_queue_at(2).map(|t| t.track_id);
        assert!(!e.is_fm_active());
        assert_eq!(played_id, Some(2));
        assert_eq!(e.current_index(), Some(2));
        assert_eq!(ids_of(&e), vec![0, 1, 2]); // 恢复后的队列，非单曲 FM 队列
    }

    #[test]
    fn remove_at_in_fm_exits_fm_first() {
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        e.remove_at(0);
        assert!(!e.is_fm_active());
        // 恢复后 [0,1,2]@1，移除 index 0（在当前之前）→ 队列 [1,2]、index 减一为 0
        assert_eq!(ids_of(&e), vec![1, 2]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 1);
    }

    #[test]
    fn append_fm_non_fm_is_noop() {
        // 非 FM 调用 append_fm → 静默跳过、无 panic、状态不变
        let mut e = setup(2);
        e.append_fm(vec![make_item(99)]);
        assert!(!e.is_fm_active());
        assert_eq!(ids_of(&e), vec![0, 1]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 0);
    }

    #[test]
    fn fm_record_played_non_fm_is_noop() {
        // 非 FM 调用 fm_record_played → 静默跳过、无 panic、played_ids 保持空
        let mut e = setup(2);
        e.fm_record_played();
        assert!(!e.is_fm_active());
        assert_eq!(e.snapshot().fm_played_ids, Vec::<u64>::new());
        assert_eq!(ids_of(&e), vec![0, 1]);
    }

    // ── 快照（§7 + 评审要求：含 played_ids） ──

    #[test]
    fn report_position_persists_and_restores_playback_state() {
        // 崩溃续播链路（音频迁移 Rust 后）：watcher 周期 report_position → snapshot → from_snapshot。
        // 断言位置/状态经快照往返一致（restore_playback 依赖此值决定 seek + 恢复播放）。
        let mut e = setup(3);
        e.play_queue_at(1);
        e.report_position(42.5, true);
        let snap = e.snapshot();
        assert_eq!(snap.position_secs, 42.5);
        assert!(snap.playing);
        let restored = PlayerEngine::from_snapshot(snap);
        assert_eq!(restored.snapshot().position_secs, 42.5);
        assert!(restored.snapshot().playing);
        // 切歌重置位置：旧曲目的位置对新曲目无效（reset_reported_position 语义）
        e.play_queue_at(2);
        assert_eq!(e.snapshot().position_secs, 0.0);
    }

    #[test]
    fn snapshot_roundtrip_restores_state() {
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_order(Order::Shuffle);
        let snap = e.snapshot();
        let mut restored = PlayerEngine::from_snapshot(snap);
        assert_eq!(restored.snapshot(), e.snapshot()); // 往返一致
        assert_eq!(restored.current_index(), Some(2));
        assert_eq!(restored.current_track().unwrap().track_id, 2);
        assert_eq!(restored.order(), Order::Shuffle);
        assert!(!restored.is_fm_active());
        // 恢复后 shuffle 导航仍有效、不越界
        let idx = next_index(&mut restored);
        assert!(idx < 4);
    }

    #[test]
    fn snapshot_roundtrip_fm_preserves_played_ids() {
        let mut e = setup(4);
        e.enter_fm(make_item(100));
        e.fm_record_played();
        e.append_fm(vec![make_item(200)]);
        let snap = e.snapshot();
        assert!(matches!(snap.content_source, ContentSource::PersonalFm));
        assert_eq!(snap.fm_played_ids, vec![100]);
        assert_eq!(snap.queue.len(), 2); // 多曲 FM 队列
        let mut restored = PlayerEngine::from_snapshot(snap);
        assert!(restored.is_fm_active());
        assert_eq!(restored.current_track().unwrap().track_id, 100);
        assert_eq!(restored.snapshot().fm_played_ids, vec![100]);
        assert!(matches!(restored.manual_next(), Step::Play(1)));
    }

    #[test]
    fn snapshot_serde_json_roundtrip() {
        // serde derive 为编译期（Phase D 事件序列化），JSON 往返一致性验证
        let mut e = setup(3);
        e.play_queue_at(1);
        e.set_repeat(Repeat::One);
        let snap = e.snapshot();
        let json = serde_json::to_string(&snap).unwrap();
        let back: PlayerSnapshot = serde_json::from_str(&json).unwrap();
        assert_eq!(back, snap);
    }

    #[test]
    fn from_snapshot_out_of_range_index_is_clamped() {
        // 快照 index=5 而 queue 只有 2 → 越界过滤为 None（钳制语义，不 panic）
        let snap = PlayerSnapshot {
            queue: items(2),
            current_index: Some(5),
            order: Order::Sequential,
            repeat: Repeat::Off,
            content_source: ContentSource::Queue,
            fm_played_ids: Vec::new(),
            position_secs: 42.0,
            playing: true,
        };
        let e = PlayerEngine::from_snapshot(snap);
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
        assert_eq!(e.queue_items().len(), 2);
    }

    // ── 边界：空队列 / 单曲队列 / 越界 ──

    #[test]
    fn empty_queue_navigation() {
        // 对齐 TS line 589-595（差异：TS 返回 -1；Rust 语义为 End / None）
        let mut e = setup(0);
        assert!(matches!(e.manual_next(), Step::End));
        assert!(e.prev().is_none());
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn empty_queue_any_mode_ends() {
        // 决策③：空队列任何 order × repeat 组合 next → End
        for order in [Order::Sequential, Order::Shuffle] {
            for repeat in [Repeat::Off, Repeat::All, Repeat::One] {
                let mut e = setup(0);
                e.set_order(order);
                e.set_repeat(repeat);
                assert!(
                    matches!(e.manual_next(), Step::End),
                    "empty queue next ({:?} x {:?}) should End",
                    order,
                    repeat
                );
            }
        }
    }

    #[test]
    fn single_track_sequential_next_returns_end() {
        // 统一语义：单曲 Sequential 队尾停止（不再环绕回自己）；prev 环绕回自己
        let mut e = setup(1);
        assert_eq!(e.current_index(), Some(0));
        assert!(matches!(e.manual_next(), Step::End));
        assert_eq!(e.current_index(), Some(0)); // 位置不变
        assert_eq!(e.prev().unwrap().track_id, 0);
    }

    #[test]
    fn single_track_loop_one_keeps_current() {
        // 单曲 LoopOne：手动切歌环绕回自己（Play(0)）；自然结束重播当前（ReplayCurrent）
        let mut e = setup(1);
        e.set_repeat(Repeat::One);
        assert!(matches!(e.manual_next(), Step::Play(0)));
        assert!(matches!(e.on_track_end(), Step::ReplayCurrent));
        assert_eq!(e.prev().unwrap().track_id, 0);
    }

    #[test]
    fn single_track_shuffle_all_wraps_to_self() {
        // 单曲随机 + 列表循环：手动切歌环绕回唯一曲
        let mut e = setup(1);
        e.set_order(Order::Shuffle);
        e.set_repeat(Repeat::All);
        assert!(matches!(e.manual_next(), Step::Play(0)));
        assert_eq!(e.current_track().unwrap().track_id, 0);
    }

    #[test]
    fn play_queue_at_out_of_range_rejected() {
        let mut e = setup(4);
        assert!(e.play_queue_at(4).is_none());
        assert!(e.play_queue_at(99).is_none());
        assert!(e.current_track().is_some()); // 队列不受影响
    }
}
