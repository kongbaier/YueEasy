//! 播放器领域引擎（core 层：纯逻辑，零 I/O、零外部依赖，仅 std + serde derive）
//!
//! 目录结构对应设计 §1.1：
//! - `engine.rs` — PlayerEngine：队列管理、内容来源/迭代策略决策
//! - `types.rs`  — 领域类型：QueueItem / ContentSource / PlayMode / AdvanceResult / PlayerSnapshot

pub mod engine;
pub mod types;

pub use engine::PlayerEngine;
