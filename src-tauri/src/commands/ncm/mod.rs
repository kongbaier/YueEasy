//! NCM 命令层：薄壳宏 + 分域模块。
//!
//! 每个命令都是「参数透传 → service」，命令签名 = service 签名（去掉 `state`），
//! 所以三处重复（命令声明 / 转手调用 / 参数列表）在这里收敛成一处。
//! `lib.rs::generate_handler` 的注册仍逐条显式列出——IPC 入口表要能一眼看全。

pub mod auth;
pub mod comment;
pub mod discover;
pub mod playlist;
pub mod search;
pub mod song;

/// 生成一个「参数透传 → service」的 `#[tauri::command]` 薄壳。
///
/// ```ignore
/// command!(ncm_song_detail(state, ids: Vec<i64>) -> Vec<Song> => song_detail);
/// command!(ncm_fm_trash(state, id: i64) => fm_trash);   // service 返回 Result<()>
/// ```
///
/// 带业务逻辑的命令（如 `resolve_play_url` 的 `Ok(None)` 归一、`like_*` 的状态维护）
/// 不适用，仍手写在各自模块里。
macro_rules! command {
    ($name:ident ( $state:ident $(, $arg:ident : $ty:ty )* ) -> $ret:ty => $method:ident) => {
        #[tauri::command]
        pub(crate) async fn $name(
            $state: tauri::State<'_, crate::netease::NcmState>,
            $($arg: $ty,)*
        ) -> crate::model::error::Result<$ret> {
            crate::service::NcmService::$method(&$state $(, $arg)*).await
        }
    };
    ($name:ident ( $state:ident $(, $arg:ident : $ty:ty )* ) => $method:ident) => {
        #[tauri::command]
        pub(crate) async fn $name(
            $state: tauri::State<'_, crate::netease::NcmState>,
            $($arg: $ty,)*
        ) -> crate::model::error::Result<()> {
            crate::service::NcmService::$method(&$state $(, $arg)*).await
        }
    };
}

pub(crate) use command;
