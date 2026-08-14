//! 播放导航策略：正交组合「遍历顺序（`Order`）」×「终止策略（`Repeat`）」（纯逻辑，零 I/O）。
//!
//! 与「内容来源」（`ContentSource`）正交——导航策略只管「有限列表内 current → 下一个 index」，
//! 「队尾如何续歌」由 cmd 层根据 content_source 决定（Queue 停止、PersonalFm 续歌）。
//!
//! 关键语义：
//! - **手动切歌**（`manual_next`）与**自然结束**（`on_track_end`）是两个独立入口——
//!   `Repeat::One` 下手动切歌切走（环绕）、自然结束重播当前曲；其余模式两者一致。
//! - **遍历顺序**（`Order`）决定遍历路径：Sequential 按索引、Shuffle 按内部排列（惰性重建）。
//! - **终止策略**（`Repeat`）决定边界行为：Off 队尾停止、All 环绕、One 重播当前。

use crate::player::state::{Order, Repeat};

/// 导航决策结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Step {
    /// 播放 queue[idx]。
    Play(usize),
    /// 重播当前曲目（Repeat::One 自然结束）。
    ReplayCurrent,
    /// 队列尽头（Off 末尾 / 空队列）——结束（是否续歌由内容来源决定）。
    End,
}

/// 种子推进常数（每次进入 Shuffle 推进，保证「重新随机」产生新排列）。
const SEED_ADVANCE: u64 = 0x9E37_79B9_7F4A_7C15;

/// 内部小型 PRNG（xorshift64）—— core 零外部依赖，构造时注入种子保证测试确定性。
pub(crate) struct XorShift64 {
    state: u64,
}

impl XorShift64 {
    pub(crate) fn new(seed: u64) -> Self {
        // 状态为 0 时 xorshift 退化为全零输出，规避之
        let state = if seed == 0 { SEED_ADVANCE } else { seed };
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

/// 播放导航策略：持有遍历顺序 + 终止策略 + Shuffle 排列状态。
/// 单一具体实现（不再按模式分 struct），正交组合两轴。
pub struct PlayStrategy {
    order: Order,
    repeat: Repeat,
    /// Shuffle 排列（仅 order == Shuffle 时使用；惰性重建，同一 seed 下排列稳定）。
    shuffled: Vec<usize>,
    /// Shuffle 排列的构造种子（进入 Shuffle 时推进，保证「重新随机」产生新排列）。
    seed: u64,
}

impl PlayStrategy {
    pub fn new(order: Order, repeat: Repeat, seed: u64) -> Self {
        Self {
            order,
            repeat,
            shuffled: Vec::new(),
            seed,
        }
    }

    pub fn order(&self) -> Order {
        self.order
    }

    pub fn repeat(&self) -> Repeat {
        self.repeat
    }

    /// 设置终止策略（不影响遍历顺序与已生成的随机排列）。
    pub fn set_repeat(&mut self, repeat: Repeat) {
        self.repeat = repeat;
    }

    /// 设置遍历顺序。进入 Shuffle 时推进种子并清空排列 → 下次导航生成全新排列。
    pub fn set_order(&mut self, order: Order) {
        if order == Order::Shuffle {
            self.seed = self.seed.wrapping_add(SEED_ADVANCE);
            self.shuffled.clear();
        }
        self.order = order;
    }

    /// 手动按「下一首」：Off 队尾停止；All/One 环绕（One 手动切歌 = 切走）。
    pub fn manual_next(&mut self, current: Option<usize>, len: usize) -> Step {
        let wrap = self.repeat != Repeat::Off;
        self.next_index(current, len, wrap)
    }

    /// 曲目自然播完：One 重播当前；All 环绕；Off 队尾停止。
    pub fn on_track_end(&mut self, current: Option<usize>, len: usize) -> Step {
        if self.repeat == Repeat::One {
            return current.map_or(Step::End, |_| Step::ReplayCurrent);
        }
        self.next_index(current, len, self.repeat == Repeat::All)
    }

    /// 手动按「上一首」：环绕（Sequential 与 Shuffle 均环绕）。
    pub fn manual_prev(&mut self, current: Option<usize>, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        match self.order {
            Order::Sequential => current.map(|ci| if ci == 0 { len - 1 } else { ci - 1 }),
            Order::Shuffle => {
                if self.shuffled.len() != len {
                    self.rebuild(current, len);
                }
                let cur_pos = self.current_pos(current);
                let prev_pos = if cur_pos == 0 { len - 1 } else { cur_pos - 1 };
                Some(self.shuffled[prev_pos])
            }
        }
    }

    /// 计算下一个队列索引（wrap 控制队尾是否环绕）。
    fn next_index(&mut self, current: Option<usize>, len: usize, wrap: bool) -> Step {
        if len == 0 {
            return Step::End;
        }
        let idx = match self.order {
            Order::Sequential => match current {
                Some(ci) if ci + 1 < len => Some(ci + 1),
                Some(_) if wrap => Some(0),
                _ => None,
            },
            Order::Shuffle => {
                if self.shuffled.len() != len {
                    self.rebuild(current, len);
                }
                let cur_pos = self.current_pos(current);
                let next_pos = cur_pos + 1;
                if next_pos < len {
                    Some(self.shuffled[next_pos])
                } else if wrap {
                    Some(self.shuffled[0])
                } else {
                    None
                }
            }
        };
        match idx {
            Some(i) => Step::Play(i),
            None => Step::End,
        }
    }

    /// 当前队列索引在排列中的位置（未命中则回退 0）。
    fn current_pos(&self, current: Option<usize>) -> usize {
        current
            .and_then(|ci| self.shuffled.iter().position(|&x| x == ci))
            .unwrap_or(0)
    }

    /// Fisher-Yates 重建排列，并把 current 旋转到首位（线性遍历起点，对齐 player.js shuffle 语义）。
    /// 惰性：len 不符才重建。
    fn rebuild(&mut self, current: Option<usize>, len: usize) {
        if len == 0 {
            self.shuffled.clear();
            return;
        }
        let mut order: Vec<usize> = (0..len).collect();
        let mut rng = XorShift64::new(self.seed);
        for i in (1..len).rev() {
            let j = rng.next_usize(i + 1);
            order.swap(i, j);
        }
        if let Some(ci) = current {
            if let Some(idx) = order.iter().position(|&x| x == ci) {
                order.rotate_left(idx);
            }
        }
        self.shuffled = order;
    }
}
