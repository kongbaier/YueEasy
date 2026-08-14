//! 播放器领域：队列状态机（queue）+ 导航策略（policy）+ 领域类型（state）+ 音频引擎（audio）+ 编排（orchestrator）+ 音源解析（resolver）。
pub mod audio;
pub mod event;
pub mod orchestrator;
pub mod policy;
pub mod queue;
pub mod resolver;
pub mod state;

pub use queue::QueueEngine;
