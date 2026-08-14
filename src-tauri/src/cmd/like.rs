//! 点赞 IPC 命令（薄壳）：点赞状态权威在 Rust `LikeState`。
//!
//! 迁移（对齐播放器模式）：前端 `stores/like.ts` 退化为纯镜像 + 乐观更新，
//! 数据一致性的权威是 `LikeState.liked_ids`。喜欢列表的拉取（likelist）也收敛到
//! `like_init`（登录后 Rust 端拉取），前端只触发 + 读镜像事件。

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::music::netease::NcmState;
use crate::music::service::NcmService;
use crate::app::state::LikeState;

/// `liked-ids-changed` 全量事件（`like_init` 推送）。
#[derive(Serialize, Clone)]
pub(crate) struct LikedIdsChanged {
    pub ids: Vec<u64>,
}

/// `liked-toggled` 增量事件（`like_toggle` 推送）。
#[derive(Serialize, Clone)]
pub(crate) struct LikedToggled {
    pub track_id: u64,
    pub liked: bool,
}

/// 登录后初始化：Rust 端拉取 NCM 喜欢列表填充权威集合，推全量事件，并返回 ids。
/// 前端不再自行拉 likelist，只 invoke 本命令 + 读镜像。
#[tauri::command]
pub(crate) async fn like_init(
    app: AppHandle,
    state: State<'_, LikeState>,
    ncm: State<'_, NcmState>,
    uid: i64,
) -> Result<Vec<u64>, String> {
    let list = NcmService::like_list(&app, &ncm, uid)
        .await
        .map_err(|e| e.to_string())?;
    let ids: Vec<u64> = list.ids.into_iter().map(|id| id as u64).collect();
    {
        let mut liked = state.liked_ids.lock().unwrap();
        *liked = ids.iter().copied().collect();
    }
    let _ = app.emit("liked-ids-changed", LikedIdsChanged { ids: ids.clone() });
    Ok(ids)
}

/// 点赞/取消点赞：调 NCM，成功后更新权威集合并推增量事件。
/// 失败不更新集合，返回 Err（由前端回滚乐观状态）。
#[tauri::command]
pub(crate) async fn like_toggle(
    app: AppHandle,
    state: State<'_, LikeState>,
    ncm: State<'_, NcmState>,
    id: u64,
    like: bool,
) -> Result<(), String> {
    NcmService::like(&app, &ncm, id as i64, Some(like))
        .await
        .map_err(|e| e.to_string())?;
    {
        let mut ids = state.liked_ids.lock().unwrap();
        if like {
            ids.insert(id);
        } else {
            ids.remove(&id);
        }
    }
    let _ = app.emit(
        "liked-toggled",
        LikedToggled {
            track_id: id,
            liked: like,
        },
    );
    Ok(())
}

/// 查询点赞集合（启动恢复/调试用）。
#[tauri::command]
pub(crate) async fn like_get_ids(
    state: State<'_, LikeState>,
) -> Result<Vec<u64>, String> {
    let ids = state.liked_ids.lock().unwrap().iter().copied().collect();
    Ok(ids)
}
