//! PlayerEngine —— 播放器领域引擎（TS `src/core/queue/QueueManager.ts` 的 Rust 移植，Phase C）
//!
//! 行为基准：
//! - `src/core/queue/QueueManager.test.ts`（TS 现状特性测试，逐条对照注释在测试中）
//! - `docs/player-rust-design.md` §2 + 附录 B（评审门决策 ①-④，必须遵守）
//!
//! 纯逻辑：零 I/O、零网络、零第三方类型（仅 std + serde derive）。core 无外部依赖。

use crate::core::types::{AdvanceResult, FmState, PlayMode, PlayerSnapshot, QueueItem};

// ── 内部小型 PRNG（xorshift64）──
// core 零外部依赖，不依赖 rand crate；构造时可注入种子保证测试确定性。

struct XorShift64 {
    state: u64,
}

impl XorShift64 {
    fn new(seed: u64) -> Self {
        // 状态为 0 时 xorshift 退化为全零输出，规避之
        let state = if seed == 0 { 0x9E37_79B9_7F4A_7C15 } else { seed };
        Self { state }
    }

    fn next_u64(&mut self) -> u64 {
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        x
    }

    /// [0, bound) 内的伪随机索引
    fn next_usize(&mut self, bound: usize) -> usize {
        debug_assert!(bound > 0);
        (self.next_u64() % bound as u64) as usize
    }
}

/// FM 进入前保存的原队列上下文（§2.1，enter/exit 的私有实现细节）。
struct SavedContext {
    queue: Vec<QueueItem>,
    index: Option<usize>,
    mode: PlayMode,
}

/// 播放器领域引擎：队列管理、播放模式决策、FM 状态机（§2.1）。
pub struct PlayerEngine {
    // === 对外可见状态 ===
    queue: Vec<QueueItem>,
    current_index: Option<usize>,
    mode: PlayMode,
    fm: FmState,

    // === 内部状态（不对外暴露） ===
    shuffle_order: Vec<usize>,
    shuffle_pos: usize,
    fm_saved: Option<SavedContext>,
    rng: XorShift64,
    /// 前端上报的当前播放位置（秒）——位置持久化用（Phase F，快照仅存此值）。
    last_position: f64,
    /// 前端上报的播放/暂停状态——位置持久化用（Phase F）。
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
            mode: PlayMode::Sequential,
            fm: FmState::Idle,
            shuffle_order: Vec::new(),
            shuffle_pos: 0,
            fm_saved: None,
            rng: XorShift64::new(seed),
            last_position: 0.0,
            last_playing: false,
        }
    }

    /// 从快照恢复（WebView 重载 / 进程重启恢复，§7）。
    /// Phase D 未接线（持久化在 Phase E），仅测试使用；保留为设计 API。
    #[allow(dead_code)]
    pub fn from_snapshot(snapshot: PlayerSnapshot) -> Self {
        let mut engine = Self::new();
        engine.queue = snapshot.queue;
        // 越界容错：current_index 钳制到合法范围
        engine.current_index = if engine.queue.is_empty() {
            None
        } else {
            snapshot.current_index.filter(|&i| i < engine.queue.len())
        };
        engine.mode = snapshot.mode;
        engine.last_position = snapshot.position_secs;
        engine.last_playing = snapshot.playing;
        if snapshot.fm_active {
            if let Some(track) = engine
                .current_index
                .and_then(|i| engine.queue.get(i))
                .cloned()
            {
                engine.fm = FmState::Active {
                    current_track: track,
                    played_ids: snapshot.fm_played_ids,
                };
            }
        }
        engine.reshuffle_if_needed();
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
            self.reshuffle_if_needed();
            return &self.queue[pos];
        }
        // 替换为单曲上下文
        self.queue = vec![track];
        self.current_index = Some(0);
        self.reset_reported_position();
        self.reshuffle_if_needed();
        &self.queue[0]
    }

    /// 替换整个队列并从指定位置播放。退出 FM 并丢弃快照。空队列返回 None。
    /// 对齐 TS `replaceAndPlay(tracks, startIndex)`。
    pub fn replace_play(&mut self, tracks: Vec<QueueItem>, start_index: Option<usize>) -> Option<&QueueItem> {
        // 退出 FM 且丢弃快照（不复用 exit_fm 的恢复逻辑，对齐 play_track 新曲分支）
        self.discard_fm();
        if tracks.is_empty() {
            self.queue.clear();
            self.current_index = None;
            self.reshuffle_if_needed();
            return None;
        }
        let len = tracks.len();
        let idx = start_index.unwrap_or(0).min(len - 1); // 越界钳制到末尾
        self.queue = tracks;
        self.current_index = Some(idx);
        self.reset_reported_position();
        self.reshuffle_if_needed();
        Some(&self.queue[idx])
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
        self.reshuffle_if_needed();
        self.current_track()
    }

    /// 下一首（根据 mode 决策）。FM 模式下返回 NeedFmTrack。
    pub fn next(&mut self) -> AdvanceResult {
        if self.is_fm_active() {
            return AdvanceResult::NeedFmTrack;
        }
        let Some(ci) = self.current_index else {
            return AdvanceResult::EndOfQueue;
        };
        if self.queue.is_empty() {
            return AdvanceResult::EndOfQueue;
        }
        match self.mode {
            PlayMode::Sequential => {
                if ci + 1 < self.queue.len() {
                    self.current_index = Some(ci + 1);
                    self.reset_reported_position();
                    AdvanceResult::PlayTrack(ci + 1)
                } else {
                    // 队尾不环绕（附录 B 决策③；TS 为环绕回 0）
                    AdvanceResult::EndOfQueue
                }
            }
            PlayMode::LoopOne => {
                // 保持当前曲目（对齐 TS RepeatOne）
                AdvanceResult::PlayTrack(ci)
            }
            PlayMode::Shuffle => {
                if self.shuffle_order.is_empty() {
                    self.rebuild_shuffle();
                }
                self.shuffle_pos = (self.shuffle_pos + 1) % self.shuffle_order.len();
                let idx = self.shuffle_order[self.shuffle_pos];
                self.current_index = Some(idx);
                self.reset_reported_position();
                AdvanceResult::PlayTrack(idx)
            }
        }
    }

    /// 上一首。空队列返回 None；FM 模式下不支持（返回 None）。
    /// 对齐 TS `retreat`：Sequential 队首环绕到队尾、LoopOne 保持、Shuffle 在排列内后退。
    pub fn prev(&mut self) -> Option<&QueueItem> {
        if self.is_fm_active() {
            return None;
        }
        let ci = self.current_index?;
        if self.queue.is_empty() {
            return None;
        }
        match self.mode {
            PlayMode::Sequential => {
                self.current_index = Some(if ci == 0 { self.queue.len() - 1 } else { ci - 1 });
                self.reset_reported_position();
            }
            PlayMode::LoopOne => {
                // 保持当前曲目（对齐 TS RepeatOne retreat）
            }
            PlayMode::Shuffle => {
                if self.shuffle_order.is_empty() {
                    self.rebuild_shuffle();
                }
                self.shuffle_pos = if self.shuffle_pos == 0 {
                    self.shuffle_order.len() - 1
                } else {
                    self.shuffle_pos - 1
                };
                let idx = self.shuffle_order[self.shuffle_pos];
                self.current_index = Some(idx);
                self.reset_reported_position();
            }
        }
        self.current_track()
    }

    /// 曲目自然播放结束。语义同 next（附录 B 决策③）。
    pub fn on_track_end(&mut self) -> AdvanceResult {
        self.next()
    }

    // ── 队列操作 ──

    /// 追加到队尾（按 track_id 去重，对齐 TS `append`/`appendMany`）。空队列自动播放。
    /// FM 激活时先退出 FM（恢复快照）再追加，不回 FM（附录 B 决策④）。
    pub fn append(&mut self, tracks: Vec<QueueItem>) {
        if self.is_fm_active() {
            self.exit_fm(); // 决策④
        }
        let was_empty = self.queue.is_empty();
        let mut added_any = false;
        for track in tracks {
            if !self.queue.iter().any(|t| t.track_id == track.track_id) {
                self.queue.push(track);
                added_any = true;
            }
        }
        if was_empty && added_any {
            self.current_index = Some(0);
            self.reset_reported_position();
        }
        self.reshuffle_if_needed();
    }

    /// 插入当前曲目之后（按 track_id 去重，对齐 TS `insertNext`）。空队列自动播放。
    /// FM 激活时先退出 FM（恢复快照）再插入——与决策④同语义，保持单曲 FM 模型不变量。
    pub fn insert_next(&mut self, track: QueueItem) {
        if self.is_fm_active() {
            self.exit_fm();
        }
        if self.queue.iter().any(|t| t.track_id == track.track_id) {
            return;
        }
        let insert_at = self.current_index.map_or(0, |ci| ci + 1);
        self.queue.insert(insert_at.min(self.queue.len()), track);
        if self.current_index.is_none() {
            self.current_index = Some(0);
            self.reset_reported_position();
        }
        self.reshuffle_if_needed();
    }

    /// 移除指定位置曲目。越界为 no-op（对齐 TS `removeAt` 越界拒绝）。
    /// FM 激活时先退出 FM（恢复快照）再按恢复后的队列移除。
    /// 移除当前位置之前 → index 减一；移除当前位置 → 保持（下一首滑入）并钳制；
    /// 移除当前位置之后 → index 不变。
    pub fn remove_at(&mut self, index: usize) {
        if self.is_fm_active() {
            self.exit_fm(); // FM 守卫：先恢复快照再按原队列移除（保持单曲 FM 模型不变量）
        }
        if index >= self.queue.len() {
            return;
        }
        let Some(ci) = self.current_index else {
            self.queue.remove(index);
            self.reshuffle_if_needed();
            return;
        };
        if index < ci {
            self.queue.remove(index);
            self.current_index = Some(ci - 1);
        } else if index == ci {
            self.queue.remove(index);
            if self.queue.is_empty() {
                self.current_index = None;
            } else if ci >= self.queue.len() {
                // 移除的是队尾当前曲 → 钳制到新队尾
                self.current_index = Some(self.queue.len() - 1);
            }
            // 其余情况：当前索引保持不变（下一首滑入）→ 当前曲目已变化，重置位置
            self.reset_reported_position();
        } else {
            self.queue.remove(index);
            // 移除当前之后：current_index 不变
        }
        self.reshuffle_if_needed();
    }

    /// 清空队列并重置索引。退出 FM 并丢弃快照（对齐 TS `clear`）。
    pub fn clear(&mut self) {
        self.discard_fm();
        self.queue.clear();
        self.current_index = None;
        self.reset_reported_position();
        self.reshuffle_if_needed();
    }

    /// 重建随机序列（仅 Shuffle 模式下影响导航）。
    pub fn shuffle(&mut self) {
        self.rebuild_shuffle();
    }

    // ── 模式 ──

    /// 设置播放模式。切到 Shuffle 时重建随机序列并锚定当前位置（对齐 TS `setMode`）。
    pub fn set_mode(&mut self, mode: PlayMode) {
        self.mode = mode;
        if mode == PlayMode::Shuffle {
            self.rebuild_shuffle();
        }
    }

    // ── FM ──

    /// 进入 FM（单曲模型，§2.5）。保存当前队列上下文，设置初始曲目。
    /// 已在 FM 中再次进入不覆盖原快照（对齐 TS `enterFm`）。
    pub fn enter_fm(&mut self, initial_track: QueueItem) {
        if !self.is_fm_active() {
            self.fm_saved = Some(SavedContext {
                queue: std::mem::take(&mut self.queue),
                index: self.current_index,
                mode: self.mode,
            });
        }
        self.current_index = Some(0);
        self.queue = vec![initial_track.clone()];
        self.reset_reported_position();
        self.fm = FmState::Active {
            current_track: initial_track,
            played_ids: Vec::new(),
        };
    }

    /// 退出 FM。恢复原队列上下文。非 FM 状态调用为 no-op（附录 B 决策②守卫）。
    pub fn exit_fm(&mut self) -> Option<&QueueItem> {
        if !self.is_fm_active() {
            return self.current_track(); // 守卫：不碰队列
        }
        self.fm = FmState::Idle;
        if let Some(ctx) = self.fm_saved.take() {
            self.queue = ctx.queue;
            self.current_index = ctx.index;
            self.mode = ctx.mode;
            self.reset_reported_position();
            self.reshuffle_if_needed();
            self.current_track()
        } else {
            // FM 激活但无快照（from_snapshot 恢复场景）→ 清空是合理行为（§2.5）
            self.queue.clear();
            self.current_index = None;
            None
        }
    }

    /// FM 切歌：cmd 层从服务端取歌后调用，替换单曲（queue=[track], index=0，保留 played_ids）。
    pub fn set_fm_track(&mut self, track: QueueItem) {
        if let FmState::Active { current_track, .. } = &mut self.fm {
            *current_track = track.clone();
            self.queue = vec![track];
            self.current_index = Some(0);
            self.reset_reported_position();
            self.reshuffle_if_needed();
        }
    }

    /// 记录当前 FM 曲目已播放（加入 played_ids，服务端上报用）。
    /// Phase D 未接线（FM 上报在 Phase E），仅测试使用；保留为设计 API。
    #[allow(dead_code)]
    pub fn fm_record_played(&mut self) {
        if let FmState::Active { current_track, played_ids } = &mut self.fm {
            played_ids.push(current_track.track_id);
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

    /// Phase D 未接线（镜像/MirrorStore 在 Phase E），保留为设计 API。
    #[allow(dead_code)]
    pub fn mode(&self) -> PlayMode {
        self.mode
    }

    pub fn is_fm_active(&self) -> bool {
        matches!(self.fm, FmState::Active { .. })
    }

    /// 全量快照（§7 + 评审要求：含 fm_played_ids）。
    pub fn snapshot(&self) -> PlayerSnapshot {
        let (fm_active, fm_played_ids) = match &self.fm {
            FmState::Active { played_ids, .. } => (true, played_ids.clone()),
            FmState::Idle => (false, Vec::new()),
        };
        PlayerSnapshot {
            queue: self.queue.clone(),
            current_index: self.current_index,
            mode: self.mode,
            fm_active,
            fm_played_ids,
            position_secs: self.last_position,
            playing: self.last_playing,
        }
    }

    /// 前端上报播放进度/状态（`report_position` 命令薄壳写入；仅持久化用途）。
    pub fn report_position(&mut self, position_secs: f64, playing: bool) {
        self.last_position = position_secs.max(0.0);
        self.last_playing = playing;
    }

    // ── 内部 ──

    /// 退出 FM 并丢弃快照（play_track / clear 用，对齐 TS「主动操作放弃漫游快照」）。
    fn discard_fm(&mut self) {
        self.fm = FmState::Idle;
        self.fm_saved = None;
    }

    /// 当前曲目变化：重置已上报位置（位置按曲目归属，切歌后旧曲目的位置对新曲目无效）。
    /// 播放状态保留（切歌后通常继续播放）。
    fn reset_reported_position(&mut self) {
        self.last_position = 0.0;
    }

    /// Shuffle 模式下重建随机序列（附录 B 决策①：队列/索引突变后修复 TS shuffle 失活 bug）。
    /// 所有改变队列长度或 current_index 的突变末尾调用。
    fn reshuffle_if_needed(&mut self) {
        if self.mode == PlayMode::Shuffle {
            self.rebuild_shuffle();
        }
    }

    /// 重建 shuffle_order（Fisher-Yates，用内部 xorshift64），并以当前 current_index
    /// 为锚定位 shuffle_pos —— 与 TS `ShuffleStrategy`（`position = shuffled.indexOf(current)`）
    /// 相同的锚定语义，但修复了「队列变更后序列失活 → 越界/undefined」缺陷。
    fn rebuild_shuffle(&mut self) {
        let n = self.queue.len();
        if n == 0 {
            self.shuffle_order.clear();
            self.shuffle_pos = 0;
            return;
        }
        let mut order: Vec<usize> = (0..n).collect();
        for i in (1..n).rev() {
            let j = self.rng.next_usize(i + 1);
            order.swap(i, j);
        }
        self.shuffle_pos = self
            .current_index
            .and_then(|ci| order.iter().position(|&x| x == ci))
            .unwrap_or(0);
        self.shuffle_order = order;
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
// 作为 Rust 新行为单独注明。
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

    /// 断言 next() 为 PlayTrack 并返回索引。
    fn next_index(e: &mut PlayerEngine) -> usize {
        match e.next() {
            AdvanceResult::PlayTrack(i) => i,
            other => panic!("expected PlayTrack, got {:?}", other),
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
        assert_eq!(e.mode(), PlayMode::Sequential);
        assert!(!e.is_fm_active());
    }

    // ── Sequential 模式导航（→ next / prev / on_track_end） ──

    #[test]
    fn sequential_next_moves_forward() {
        // 对齐 TS line 86-90
        let mut e = setup(4);
        e.play_queue_at(1);
        assert_eq!(next_index(&mut e), 2);
        assert_eq!(e.current_track().unwrap().track_id, 2);
    }

    #[test]
    fn sequential_next_at_end_returns_end_of_queue() {
        // 差异③：TS 队尾环绕回 0（line 92-95）；Rust 返回 EndOfQueue、位置不变
        let mut e = setup(4);
        e.play_queue_at(3);
        assert!(matches!(e.next(), AdvanceResult::EndOfQueue));
        assert_eq!(e.current_index(), Some(3)); // 位置不变
        assert_eq!(e.current_track().unwrap().track_id, 3);
    }

    #[test]
    fn sequential_on_track_end_at_end_returns_end_of_queue() {
        // 差异③：TS advanceOnEnd 环绕（line 107-110）；Rust EndOfQueue
        let mut e = setup(4);
        e.play_queue_at(3);
        assert!(matches!(e.on_track_end(), AdvanceResult::EndOfQueue));
        assert_eq!(e.current_index(), Some(3));
    }

    #[test]
    fn sequential_prev_moves_back_and_wraps_at_first() {
        // 对齐 TS line 97-105（prev 仍环绕；Rust 仅 next/on_track_end 不环绕）
        let mut e = setup(4);
        e.play_queue_at(2);
        assert_eq!(e.prev().unwrap().track_id, 1);
        e.play_queue_at(0);
        assert_eq!(e.prev().unwrap().track_id, 3);
    }

    // ── RepeatOne（LoopOne）模式导航 ──

    #[test]
    fn repeat_one_navigation_keeps_current() {
        // 对齐 TS line 116-130
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_mode(PlayMode::LoopOne);
        assert!(matches!(e.next(), AdvanceResult::PlayTrack(2)));
        assert!(matches!(e.on_track_end(), AdvanceResult::PlayTrack(2)));
        assert_eq!(e.prev().unwrap().track_id, 2);
        assert_eq!(e.current_index(), Some(2));
    }

    #[test]
    fn set_mode_loop_one_freezes_navigation() {
        // 对齐 TS line 132-138
        let mut e = setup(4);
        e.play_queue_at(1);
        e.set_mode(PlayMode::LoopOne);
        assert_eq!(e.mode(), PlayMode::LoopOne);
        assert!(matches!(e.next(), AdvanceResult::PlayTrack(1)));
        assert_eq!(e.prev().unwrap().track_id, 1);
    }

    // ── Shuffle 模式导航（固定种子 → 确定性排列） ──

    #[test]
    fn shuffle_advance_follows_permutation_without_revisit_and_wraps() {
        // 对齐 TS line 144-166（确定性排列 + 不重复不变式 + 一轮后环绕）
        let mut e = setup(4);
        e.set_mode(PlayMode::Shuffle);
        let mut seen = Vec::new();
        for _ in 0..4 {
            seen.push(next_index(&mut e));
        }
        // 恰好是同一组曲目的一种排列：无重复、覆盖全部 4 个索引
        let mut sorted = seen.clone();
        sorted.sort();
        assert_eq!(sorted, vec![0, 1, 2, 3]);
        // 环绕：第 5 次回到第 1 次的结果（新一轮）
        assert_eq!(next_index(&mut e), seen[0]);
    }

    #[test]
    fn shuffle_is_deterministic_for_same_seed() {
        // Rust 新行为：固定种子 → 两个引擎产生相同导航序列
        let mut e1 = setup(4);
        e1.set_mode(PlayMode::Shuffle);
        let mut e2 = setup(4);
        e2.set_mode(PlayMode::Shuffle);
        for _ in 0..4 {
            assert_eq!(next_index(&mut e1), next_index(&mut e2));
        }
    }

    #[test]
    fn shuffle_prev_returns_previously_played() {
        // 对齐 TS line 168-175
        let mut e = setup(4);
        e.set_mode(PlayMode::Shuffle);
        let first = next_index(&mut e);
        let _second = next_index(&mut e);
        assert_eq!(e.prev().unwrap().track_id, first as u64); // 回到上一首
        assert_eq!(e.prev().unwrap().track_id, 0); // 再退回到起点曲目 id 0
    }

    #[test]
    fn set_mode_shuffle_reanchors_at_current_index() {
        // 对齐 TS line 177-183
        let mut e = setup(4);
        let _ = e.next(); // sequential: 0 → 1
        e.set_mode(PlayMode::Shuffle); // 锚定在 index 1
        let idx = next_index(&mut e);
        assert!(idx < 4);
        assert_ne!(idx, 1);
        assert_eq!(e.prev().unwrap().track_id, 1); // prev 回到锚定曲目
    }

    #[test]
    fn shuffle_public_method_rebuilds_navigation_in_range() {
        // 公开 shuffle() 重建排列后，next 仍产生覆盖全队列且不越界的序列
        let mut e = setup(4);
        e.set_mode(PlayMode::Shuffle);
        e.shuffle();
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
        e.set_mode(PlayMode::Shuffle);
        e.play_track(make_item(99));
        assert_eq!(e.current_index(), Some(0));
        assert!(matches!(e.next(), AdvanceResult::PlayTrack(0)));
        assert!(e.current_track().is_some());
    }

    #[test]
    fn reshuffle_play_existing_in_shuffle_syncs_position() {
        // TS line 206-213 的 bug 场景（跳转 index 后 shuffle 位置不同步 → next 返回陈旧位置）：
        // Rust reshuffle 以新 current_index 为锚，next 从新位置继续，prev 回到跳转曲目
        let mut e = setup(4);
        e.set_mode(PlayMode::Shuffle);
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
        e.set_mode(PlayMode::Shuffle);
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
        e.set_mode(PlayMode::Shuffle);
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
        // 正常替换 + 起点播放：queue=[0,1,2]@0 → replace_play([10,11,12], 1)
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
        // 空队列 → None、队列清空、索引复位
        let mut e = setup(3);
        e.play_queue_at(2);
        assert!(e.replace_play(Vec::new(), None).is_none());
        assert_eq!(e.queue_items().len(), 0);
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn replace_play_start_index_out_of_range_clamps() {
        // start_index 越界 → 钳制到末尾；start_index=None → 从 0 播放
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
        // FM 中调用 → 退出 FM 且丢弃快照（不恢复原队列），新队列生效
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
        // Shuffle 模式下替换队列后，next 可导航且在范围内
        let mut e = setup(4);
        e.set_mode(PlayMode::Shuffle);
        let played = e.replace_play(items(5), Some(0));
        assert_eq!(played.unwrap().track_id, 0);
        assert_eq!(e.mode(), PlayMode::Shuffle); // 模式保留
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
        // 多次 append 跨批次去重：append([1,2]); append([2,3]) → 最终无重复
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

    // ── FM 状态机（单曲 FM 模型，Phase C 新增；TS line 465-584 的多曲目 FM
    //     语义被设计 §2.5 单曲模型替代，见附录 B 末尾说明） ──

    #[test]
    fn fm_full_flow_single_track_model() {
        // 单曲 FM 模型全流程：enter → next==NeedFmTrack → record_played →
        // set_fm_track → next==NeedFmTrack → exit_fm 恢复原队列/index/mode
        let mut e = setup(3); // [0,1,2]@0
        e.play_queue_at(1);
        e.set_mode(PlayMode::LoopOne);
        e.enter_fm(make_item(100));
        assert!(e.is_fm_active());
        assert_eq!(ids_of(&e), vec![100]);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.current_track().unwrap().track_id, 100);

        // FM 中 next / on_track_end → NeedFmTrack（由 cmd 层取歌后 set_fm_track）
        assert!(matches!(e.next(), AdvanceResult::NeedFmTrack));
        assert!(matches!(e.on_track_end(), AdvanceResult::NeedFmTrack));
        // FM 中 prev 不支持
        assert!(e.prev().is_none());

        // fm_record_played：把当前曲目 id 加入 played_ids
        e.fm_record_played();
        assert_eq!(e.snapshot().fm_played_ids, vec![100]);

        // set_fm_track：替换单曲，保留 played_ids
        e.set_fm_track(make_item(101));
        assert_eq!(e.current_track().unwrap().track_id, 101);
        assert_eq!(e.current_index(), Some(0));
        assert_eq!(e.snapshot().fm_played_ids, vec![100]);

        // 再 next → NeedFmTrack
        assert!(matches!(e.next(), AdvanceResult::NeedFmTrack));

        // exit_fm：恢复原队列 / index / mode
        let restored = e.exit_fm().expect("restored track");
        assert_eq!(restored.track_id, 1);
        assert!(!e.is_fm_active());
        assert_eq!(e.mode(), PlayMode::LoopOne);
        assert_eq!(e.current_index(), Some(1));
        assert_eq!(ids_of(&e), vec![0, 1, 2]);
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
        // 与决策④同语义的扩展：FM 中 insert_next 先退出 FM 再插入（保持单曲 FM 模型不变量）
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
        // FM 激活时 play_queue_at → 先退出 FM（恢复快照）再按恢复后的队列播放
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
        // FM 激活时 remove_at → 先退出 FM（恢复快照）再按恢复后的队列移除
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
    fn set_fm_track_non_fm_is_noop() {
        // 非 FM 调用 set_fm_track → 静默跳过、无 panic、状态不变
        let mut e = setup(2);
        e.set_fm_track(make_item(99));
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
    fn snapshot_roundtrip_restores_state() {
        let mut e = setup(4);
        e.play_queue_at(2);
        e.set_mode(PlayMode::Shuffle);
        let snap = e.snapshot();
        let mut restored = PlayerEngine::from_snapshot(snap);
        assert_eq!(restored.snapshot(), e.snapshot()); // 往返一致
        assert_eq!(restored.current_index(), Some(2));
        assert_eq!(restored.current_track().unwrap().track_id, 2);
        assert_eq!(restored.mode(), PlayMode::Shuffle);
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
        e.set_fm_track(make_item(200));
        let snap = e.snapshot();
        assert!(snap.fm_active);
        assert_eq!(snap.fm_played_ids, vec![100]);
        let mut restored = PlayerEngine::from_snapshot(snap);
        assert!(restored.is_fm_active());
        assert_eq!(restored.current_track().unwrap().track_id, 200);
        assert_eq!(restored.snapshot().fm_played_ids, vec![100]);
        assert!(matches!(restored.next(), AdvanceResult::NeedFmTrack));
    }

    #[test]
    fn snapshot_serde_json_roundtrip() {
        // serde derive 为编译期（Phase D 事件序列化），JSON 往返一致性验证
        let mut e = setup(3);
        e.play_queue_at(1);
        e.set_mode(PlayMode::LoopOne);
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
            mode: PlayMode::Sequential,
            fm_active: false,
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
        // 对齐 TS line 589-595（差异：TS 返回 -1；Rust 语义为 EndOfQueue / None）
        let mut e = setup(0);
        assert!(matches!(e.next(), AdvanceResult::EndOfQueue));
        assert!(matches!(e.on_track_end(), AdvanceResult::EndOfQueue));
        assert!(e.prev().is_none());
        assert_eq!(e.current_index(), None);
        assert!(e.current_track().is_none());
    }

    #[test]
    fn empty_queue_any_mode_ends() {
        // 决策③：空队列任何模式 next/on_track_end → EndOfQueue
        for mode in [PlayMode::Sequential, PlayMode::LoopOne, PlayMode::Shuffle] {
            let mut e = setup(0);
            e.set_mode(mode);
            assert!(
                matches!(e.next(), AdvanceResult::EndOfQueue),
                "empty queue next in mode {:?} should EndOfQueue",
                mode
            );
            assert!(matches!(e.on_track_end(), AdvanceResult::EndOfQueue));
        }
    }

    #[test]
    fn single_track_sequential_next_ends_queue() {
        // 差异（注明）：TS 单曲 sequential 环绕回自己（line 603-608）；
        // Rust 决策③ 不环绕 → EndOfQueue、位置不变；prev 对齐 TS 环绕回自己
        let mut e = setup(1);
        assert_eq!(e.current_index(), Some(0));
        assert!(matches!(e.next(), AdvanceResult::EndOfQueue));
        assert_eq!(e.current_index(), Some(0)); // 位置不变
        assert!(matches!(e.on_track_end(), AdvanceResult::EndOfQueue));
        assert_eq!(e.prev().unwrap().track_id, 0);
    }

    #[test]
    fn single_track_loop_one_keeps_current() {
        let mut e = setup(1);
        e.set_mode(PlayMode::LoopOne);
        assert!(matches!(e.next(), AdvanceResult::PlayTrack(0)));
        assert!(matches!(e.on_track_end(), AdvanceResult::PlayTrack(0)));
        assert_eq!(e.prev().unwrap().track_id, 0);
    }

    #[test]
    fn single_track_shuffle_stays_on_only_track() {
        // 对齐 TS line 610-615
        let mut e = setup(1);
        e.set_mode(PlayMode::Shuffle);
        assert!(matches!(e.next(), AdvanceResult::PlayTrack(0)));
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
