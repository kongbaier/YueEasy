//! 播放器领域引擎（core 层：纯逻辑，零 I/O、零外部依赖，仅 std + serde derive）
//!
//! 目录结构对应设计 §1.1：
//! - `engine.rs` — PlayerEngine：队列管理、播放模式决策、FM 状态机
//! - `types.rs`  — 领域类型：QueueItem / PlayMode / FmState / AdvanceResult / PlayerSnapshot

pub mod engine;
pub mod types;

pub use engine::PlayerEngine;
