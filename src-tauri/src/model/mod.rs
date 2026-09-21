//! 数据处理层：json → Response → Entity（序列化后即前端 Ui Model）。
//!
//! `response`（Response DTO）→ `mapper`（归一）→ `entity`（Entity）。
//! 本层是纯函数，**不得**依赖 `ncm_api_rs` / `tauri` / 任何网络或状态，
//! 唯一的外部依赖是 [`error`] 里对 [`crate::netease::error::NetError`] 的转换。
pub mod entity;
pub mod error;
pub mod mapper;
pub mod response;
