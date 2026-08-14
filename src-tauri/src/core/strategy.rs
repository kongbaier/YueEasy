//! 播放模式导航策略：统一「手动切歌」与「自然结束」两个入口的导航计算（纯逻辑，零 I/O）。
//!
//! 与「内容来源」（`ContentSource`）正交——导航策略只管「有限列表内 current → 下一个 index」，
//! 「队尾如何续歌」由 cmd 层根据 content_source 决定（Queue 停止、PersonalFm 续歌、Heartbeat 同 Queue）。
//!
//! 关键语义（2026-08 重构）：**手动切歌与自然结束是两个独立入口**——
//! - `manual_next(current, len) -> Step`：手动按「下一首」
//! - `manual_prev(current, len) -> Option<usize>`：手动按「上一首」
//! - `on_track_end(current, len) -> Step`：曲目自然播完（默认与手动切歌一致，LoopOne 覆盖为重播当前）
//!
//! Shuffle 持有排列状态，`manual_next`/`manual_prev` 内按需惰性重建（无需 `on_queue_changed` 回调）。

use crate::core::types::PlayMode;

/// 导航决策结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// 播放 queue[idx]。
    Play(usize),
    /// 重播当前曲目（LoopOne 自然结束）。
    ReplayCurrent,
    /// 队列尽头（Sequential 末尾 / 空队列）——结束（是否续歌由内容来源决定）。
    End,
}

/// 内部小型 PRNG（xorshift64）—— core 零外部依赖，构造时注入种子保证测试确定性。
pub(crate) struct XorShift64 {
    state: u64,
}

impl XorShift64 {
    pub(crate) fn new(seed: u64) -> Self {
        // 状态为 0 时 xorshift 退化为全零输出，规避之
        let state = if seed == 0 {
            0x9E37_79B9_7F4A_7C15
        } else {
            seed
        };
        Self { state }
    }

    /// [0, bound) 内的伪随机索引
    pub(crate) fn next_usize(&mut self, bound: usize) -> usize {
        debug_assert!(bound > 0);
        let mut x = self.state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.state = x;
        (x % bound as u64) as usize
    }
}

/// 播放导航策略：统一手动/自动导航。每个 PlayMode 一个实现（FM 已从策略中剥离为内容来源）。
pub trait PlayStrategy: Send + Sync {
    /// 手动按「下一首」。
    fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step;
    /// 手动按「上一首」。
    fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize>;
    /// 曲目自然播完——默认与手动切歌一致（LoopOne 覆盖为重播当前）。
    fn on_track_end(&mut self, current: Option<usize>, len: usize) -> Step {
        self.manual_next(current, len)
    }
}

// ── Sequential：顺序播放，队尾停止 ──

pub struct Sequential;

impl PlayStrategy for Sequential {
    fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step {
        match current {
            Some(ci) if ci + 1 < len => Step::Play(ci + 1),
            _ => Step::End,
        }
    }

    fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        current.map(|ci| if ci == 0 { len - 1 } else { ci - 1 })
    }
}

// ── LoopAll：列表循环，队尾绕回首 ──

pub struct LoopAll;

impl PlayStrategy for LoopAll {
    fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step {
        match current {
            Some(ci) if len > 0 => Step::Play(if ci + 1 < len { ci + 1 } else { 0 }),
            _ => Step::End,
        }
    }

    fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        current.map(|ci| if ci == 0 { len - 1 } else { ci - 1 })
    }
}

// ── LoopOne：单曲循环。手动切歌 = 列表循环（切走）；自然结束 = 重播当前 ──

pub struct LoopOne;

impl PlayStrategy for LoopOne {
    // 手动下一首：与 LoopAll 一致（切到下一首，队尾环绕）
    fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step {
        match current {
            Some(ci) if len > 0 => Step::Play(if ci + 1 < len { ci + 1 } else { 0 }),
            _ => Step::End,
        }
    }

    // 自然结束：重播当前曲（单曲循环语义）
    fn on_track_end(&mut self, current: Option<usize>, _len: usize) -> Step {
        current.map_or(Step::End, |_| Step::ReplayCurrent)
    }

    fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        current.map(|ci| if ci == 0 { len - 1 } else { ci - 1 })
    }
}

// ── Shuffle：随机排列循环（持有排列状态，惰性重建） ──

pub struct Shuffle {
    order: Vec<usize>,
    pos: usize,
    rng: XorShift64,
}

impl Shuffle {
    pub(crate) fn new(seed: u64) -> Self {
        Self {
            order: Vec::new(),
            pos: 0,
            rng: XorShift64::new(seed),
        }
    }

    /// Fisher-Yates 重建排列，并以 current 为锚定位 pos（惰性：len 不符才重建）。
    fn rebuild(&mut self, current: Option<usize>, len: usize) {
        if len == 0 {
            self.order.clear();
            self.pos = 0;
            return;
        }
        let mut order: Vec<usize> = (0..len).collect();
        for i in (1..len).rev() {
            let j = self.rng.next_usize(i + 1);
            order.swap(i, j);
        }
        self.pos = current
            .and_then(|ci| order.iter().position(|&x| x == ci))
            .unwrap_or(0);
        self.order = order;
    }
}

impl PlayStrategy for Shuffle {
    fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step {
        if len == 0 {
            return Step::End;
        }
        if self.order.len() != len {
            self.rebuild(current, len);
        }
        self.pos = (self.pos + 1) % self.order.len();
        Step::Play(self.order[self.pos])
    }

    fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        if self.order.len() != len {
            self.rebuild(current, len);
        }
        self.pos = if self.pos == 0 {
            self.order.len() - 1
        } else {
            self.pos - 1
        };
        Some(self.order[self.pos])
    }
}

/// 由 PlayMode 构造队列导航策略（Shuffle 用 seed 初始化随机源）。
pub fn strategy_for(mode: PlayMode, seed: u64) -> Box<dyn PlayStrategy> {
    match mode {
        PlayMode::Sequential => Box::new(Sequential),
        PlayMode::LoopAll => Box::new(LoopAll),
        PlayMode::LoopOne => Box::new(LoopOne),
        PlayMode::Shuffle => Box::new(Shuffle::new(seed)),
    }
}
