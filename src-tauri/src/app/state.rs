//! 应用共享状态：点赞状态（音频/队列权威已迁前端，PlayerState 已删除）。

use std::collections::HashSet;
use std::sync::{Arc, Mutex};

/// 点赞状态：liked_ids 的权威集合在 Rust。
pub struct LikeState {
    pub liked_ids: Arc<Mutex<HashSet<u64>>>,
}

impl Default for LikeState {
    fn default() -> Self {
        Self {
            liked_ids: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}
