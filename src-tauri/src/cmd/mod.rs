//! IPC 命令层：所有 `#[tauri::command]` 集中在此，只做参数透传与返回 Entity，
//! 不承载业务逻辑。命令注册唯一入口见 `lib.rs::generate_handler`。

pub mod accent;
pub mod cache;
pub mod history;
pub mod like;
pub mod media_session;
pub mod ncm;
pub mod query;
