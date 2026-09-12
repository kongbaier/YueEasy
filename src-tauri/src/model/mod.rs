//! 数据处理层：wire → 领域。
//!
//! `raw`（原始响应 DTO）→ `mapper`（归一）→ `entity`（对外实体）。
//! 本层是纯函数，**不得**依赖 `ncm_api_rs` / `tauri` / 任何网络或状态，
//! 唯一的外部依赖是 [`error`] 里对 [`crate::netease::error::NetError`] 的转换。
pub mod entity;
pub mod error;
pub mod mapper;
pub mod raw;
