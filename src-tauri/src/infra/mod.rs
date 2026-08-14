//! 基础设施层：第三方库适配与平台能力。
//! - `ncm`：包 ncm-api-rs 的网络适配（客户端 + entity/raw/mapper + 状态实例）
//! - `storage`：本地持久化（paths/db/cache/play_history）
//! - `platform`：OS 集成（tray/window/media_session/accent_color）
//! - `audio`：音频播放引擎（rodio + stream-download）
pub mod audio;
pub mod ncm;
pub mod platform;
pub mod storage;
