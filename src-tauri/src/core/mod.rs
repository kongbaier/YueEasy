//! 播放器领域引擎（core 层：纯逻辑，零 I/O、零外部依赖，仅 std + serde derive）
//!
//! 目录结构对应设计 §1.1：
//! - `engine.rs`   — PlayerEngine：队列管理、FM 状态机
//! - `strategy.rs` — PlayStrategy：Sequential/LoopAll/LoopOne/Shuffle 的手动切歌（manual_next/manual_prev）与自然结束（on_track_end）导航策略
//! - `types.rs`    — 领域类型：QueueItem / ContentSource / PlayMode / PlayerSnapshot

pub mod engine;
pub mod strategy;
pub mod types;

pub use engine::PlayerEngine;
