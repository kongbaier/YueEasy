//! 播放器查询 IPC 命令（薄壳）：快照 / 队列 / 预加载 URL 解析（设计 §4.1 查询类）。

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::cmd::player::{resolve_url, PlayUrlInfo};
use crate::core::types::{PlayerSnapshot, QueueItem};
use crate::infra::ncm::NcmState;
use crate::state::PlayerState;

/// 解析播放 URL（预加载用）。当前曲目匹配 track_id → 用其完整字段；
/// 否则构造最小 QueueItem（仅 track_id 有效）。
#[tauri::command]
pub(crate) async fn resolve_play_url(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    track_id: u64,
    quality: Option<String>,
) -> Result<PlayUrlInfo, String> {
    let track = {
        let engine = player.engine.lock().unwrap();
        engine
            .current_track()
            .filter(|t| t.track_id == track_id)
            .cloned()
            .unwrap_or_else(|| QueueItem {
                track_id,
                title: String::new(),
                artist: String::new(),
                album: String::new(),
                cover_url: String::new(),
                duration_secs: 0.0,
            })
    };
    let url = resolve_url(&app, &ncm, &track, quality).await?;
    Ok(PlayUrlInfo { track, url })
}

/// 全量快照（WebView 重载恢复，设计 §7）。
#[tauri::command]
pub(crate) async fn get_player_snapshot(
    player: State<'_, PlayerState>,
) -> Result<PlayerSnapshot, String> {
    let snapshot = {
        let engine = player.engine.lock().unwrap();
        engine.snapshot()
    };
    Ok(snapshot)
}

/// 全量播放器状态（前端启动恢复，设计 §7）：快照 + 当前曲目。
#[derive(Serialize)]
pub struct FullPlayerState {
    pub snapshot: PlayerSnapshot,
    pub current_track: Option<QueueItem>,
}

/// 全量播放器状态（WebView 启动/重载恢复用）。快照内含 queue/current_index/mode/
/// fm_active/fm_played_ids/position_secs/playing；current_track 为便捷字段。
/// 比事件推送更可靠：事件在 setup 期发射时前端监听尚未挂载。
#[tauri::command]
pub(crate) async fn get_full_player_state(
    player: State<'_, PlayerState>,
) -> Result<FullPlayerState, String> {
    let (snapshot, current_track) = {
        let engine = player.engine.lock().unwrap();
        (engine.snapshot(), engine.current_track().cloned())
    };
    Ok(FullPlayerState {
        snapshot,
        current_track,
    })
}

/// 获取完整队列（可选，通常用 queue-changed 事件）。
#[tauri::command]
pub(crate) async fn get_queue(player: State<'_, PlayerState>) -> Result<Vec<QueueItem>, String> {
    let items = {
        let engine = player.engine.lock().unwrap();
        engine.queue_items().to_vec()
    };
    Ok(items)
}
