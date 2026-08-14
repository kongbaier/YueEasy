//! 播放器领域引擎（core 层：纯逻辑，零 I/O、零外部依赖，仅 std + serde derive）
//!
//! 目录结构对应设计 §1.1：
//! - `engine.rs`   — PlayerEngine：队列管理、FM 状态机
//! - `strategy.rs` — PlayStrategy：遍历顺序（order）× 终止策略（repeat）的导航（manual_next/manual_prev/on_track_end）
//! - `types.rs`    — 领域类型：QueueItem / ContentSource / Order / Repeat / PlayerSnapshot

pub mod engine;
pub mod strategy;
pub mod types;

pub use engine::PlayerEngine;
