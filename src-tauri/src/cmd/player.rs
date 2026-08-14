//! 播放器 IPC 命令（薄壳）：只做参数透传，业务编排在 `player::{resolver, orchestrator}`。

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::app::state::{persist_snapshot, PlayerState};
use crate::music::netease::NcmState;
use crate::music::service::NcmService;
use crate::player::audio::AudioStatus;
use crate::player::orchestrator::{
    advance_once, emit_current, emit_playing, emit_queue, play_current_track, AdvanceEntry,
};
use crate::player::resolver::{prepare_and_load, resolve_url};
use crate::player::state::{ContentSource, Order, QueueItem, Repeat};

/// 播放命令返回（`resolve_play_url` 预加载用）。
#[derive(Serialize)]
pub struct PlayUrlInfo {
    pub track: QueueItem,
    pub url: String,
}

// ── 播放控制 ───────────────────────────────────────────

/// 播放指定单曲，替换当前上下文。
#[tauri::command]
pub(crate) async fn play_track(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    track: QueueItem,
) -> Result<(), String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.play_track(track).clone()
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(&player, &url, track.duration_secs).await?;
    emit_current(&app, &player);
    emit_queue(&app, &player);
    emit_playing(&app, true);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 替换整个队列并播放。空队列 → Err。
#[tauri::command]
pub(crate) async fn replace_and_play(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    tracks: Vec<QueueItem>,
    start_index: Option<usize>,
) -> Result<(), String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.replace_play(tracks, start_index).cloned()
    };
    let Some(track) = track else {
        return Err("empty queue".to_string());
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(&player, &url, track.duration_secs).await?;
    emit_current(&app, &player);
    emit_queue(&app, &player);
    emit_playing(&app, true);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 从队列指定位置播放。越界 → Err。
#[tauri::command]
pub(crate) async fn play_queue_at(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    index: usize,
) -> Result<(), String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.play_queue_at(index).cloned()
    };
    let Some(track) = track else {
        return Err(format!("队列索引 {index} 越界"));
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(&player, &url, track.duration_secs).await?;
    emit_current(&app, &player);
    emit_queue(&app, &player);
    emit_playing(&app, true);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 下一首（模式决策；FM 下取歌）。
#[tauri::command]
pub(crate) async fn play_next(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<(), String> {
    advance_once(&app, &player, &ncm, AdvanceEntry::ManualNext).await
}

/// 上一首。无上一曲 → Err。
#[tauri::command]
pub(crate) async fn play_prev(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<(), String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.prev().cloned()
    };
    let Some(track) = track else {
        return Err("无上一曲".to_string());
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(&player, &url, track.duration_secs).await?;
    emit_current(&app, &player);
    emit_queue(&app, &player);
    emit_playing(&app, true);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 设置终止策略（"off" / "all" / "one"）。非法值 → Err。
#[tauri::command]
pub(crate) async fn set_repeat(
    app: AppHandle,
    player: State<'_, PlayerState>,
    repeat: String,
) -> Result<(), String> {
    let repeat = match repeat.as_str() {
        "off" => Repeat::Off,
        "all" => Repeat::All,
        "one" => Repeat::One,
        _ => return Err(format!("未知终止策略：{repeat}")),
    };
    {
        let mut engine = player.engine.lock().unwrap();
        engine.set_repeat(repeat);
    }
    emit_current(&app, &player);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 设置遍历顺序（随机播放开关）。true = shuffle，false = sequential。
#[tauri::command]
pub(crate) async fn set_shuffle(
    app: AppHandle,
    player: State<'_, PlayerState>,
    shuffle: bool,
) -> Result<(), String> {
    {
        let mut engine = player.engine.lock().unwrap();
        engine.set_order(if shuffle {
            Order::Shuffle
        } else {
            Order::Sequential
        });
    }
    emit_current(&app, &player);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 跳转到指定位置（前端松手提交；SMTC 位置同步）。Rust 音频引擎为 seek 权威。
#[tauri::command]
pub(crate) async fn seek(
    app: AppHandle,
    player: State<'_, PlayerState>,
    position_secs: f64,
) -> Result<(), String> {
    {
        let mut audio = player.audio.lock().unwrap();
        audio.seek(position_secs);
    }
    crate::platform::media_session::update_position(&app, position_secs)
}

/// 播放（暂停/结束后恢复）。Rust 音频引擎为权威。
#[tauri::command]
pub(crate) async fn play(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<(), String> {
    let empty = {
        let audio = player.audio.lock().unwrap();
        audio.is_empty()
    };
    if empty {
        // 无已加载 source：重新加载当前曲目（防御 restore 失败等场景）。
        let track = {
            let engine = player.engine.lock().unwrap();
            engine.current_track().cloned()
        };
        if let Some(track) = track {
            let url = resolve_url(&app, &ncm, &track, None).await?;
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            prepare_and_load(&player, &url, track.duration_secs).await?;
            emit_playing(&app, true);
            return Ok(());
        }
    }
    {
        let mut audio = player.audio.lock().unwrap();
        audio.play();
    }
    emit_playing(&app, true);
    Ok(())
}

/// 暂停。
#[tauri::command]
pub(crate) async fn pause(app: AppHandle, player: State<'_, PlayerState>) -> Result<(), String> {
    {
        let mut audio = player.audio.lock().unwrap();
        audio.pause();
    }
    emit_playing(&app, false);
    Ok(())
}

/// 设置音量（0.0..=1.0）。
#[tauri::command]
pub(crate) async fn set_volume(player: State<'_, PlayerState>, volume: f32) -> Result<(), String> {
    let mut audio = player.audio.lock().unwrap();
    audio.set_volume(volume);
    Ok(())
}

/// 查询当前播放位置/状态（前端进度条周期校准用；返回 (position_secs, playing)）。
#[tauri::command]
pub(crate) async fn get_position(player: State<'_, PlayerState>) -> Result<(f64, bool), String> {
    let audio = player.audio.lock().unwrap();
    let pos = audio.get_pos().as_secs_f64();
    let playing = audio.status() == AudioStatus::Playing;
    let clamped = match audio.duration() {
        Some(d) => pos.min(d.as_secs_f64()),
        None => pos,
    };
    Ok((clamped, playing))
}

/// 切换内容来源（"queue" / "personal_fm"）。
#[tauri::command]
pub(crate) async fn set_content_source(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    source: String,
) -> Result<(), String> {
    let source = match source.as_str() {
        "queue" => ContentSource::Queue,
        "personal_fm" => ContentSource::PersonalFm,
        _ => return Err(format!("未知内容来源：{source}")),
    };
    match source {
        ContentSource::Queue => {
            let track = {
                let mut engine = player.engine.lock().unwrap();
                engine.exit_fm().cloned()
            };
            let Some(track) = track else {
                return Err("当前无曲目".to_string());
            };
            let url = resolve_url(&app, &ncm, &track, None).await?;
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            prepare_and_load(&player, &url, track.duration_secs).await?;
            emit_current(&app, &player);
            emit_queue(&app, &player);
            emit_playing(&app, true);
            persist_snapshot(&app, &player);
            Ok(())
        }
        ContentSource::PersonalFm => {
            let songs = NcmService::personal_fm(&app, &ncm)
                .await
                .map_err(|e| e.to_string())?;
            let track = songs
                .first()
                .map(NcmService::song_to_queue_item)
                .ok_or_else(|| "FM 暂无可用曲目".to_string())?;
            {
                let mut engine = player.engine.lock().unwrap();
                engine.enter_fm(track.clone());
            }
            let url = resolve_url(&app, &ncm, &track, None).await?;
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            prepare_and_load(&player, &url, track.duration_secs).await?;
            emit_current(&app, &player);
            emit_queue(&app, &player);
            emit_playing(&app, true);
            persist_snapshot(&app, &player);
            Ok(())
        }
    }
}

// ── 队列操作 ───────────────

/// 追加到队尾。
#[tauri::command]
pub(crate) async fn append_to_queue(
    app: AppHandle,
    player: State<'_, PlayerState>,
    tracks: Vec<QueueItem>,
) -> Result<(), String> {
    let before_index = {
        let engine = player.engine.lock().unwrap();
        engine.current_index()
    };
    {
        let mut engine = player.engine.lock().unwrap();
        engine.append(tracks);
    }
    emit_queue(&app, &player);
    if before_index.is_none() {
        emit_current(&app, &player);
    }
    persist_snapshot(&app, &player);
    Ok(())
}

/// 插入当前曲目之后。
#[tauri::command]
pub(crate) async fn insert_next(
    app: AppHandle,
    player: State<'_, PlayerState>,
    track: QueueItem,
) -> Result<(), String> {
    let before_index = {
        let engine = player.engine.lock().unwrap();
        engine.current_index()
    };
    {
        let mut engine = player.engine.lock().unwrap();
        engine.insert_next(track);
    }
    emit_queue(&app, &player);
    if before_index.is_none() {
        emit_current(&app, &player);
    }
    persist_snapshot(&app, &player);
    Ok(())
}

/// 移除指定位置曲目。
#[tauri::command]
pub(crate) async fn remove_from_queue(
    app: AppHandle,
    player: State<'_, PlayerState>,
    index: usize,
) -> Result<(), String> {
    let before_track_id = {
        let engine = player.engine.lock().unwrap();
        engine.current_track().map(|t| t.track_id)
    };
    {
        let mut engine = player.engine.lock().unwrap();
        engine.remove_at(index);
    }
    emit_queue(&app, &player);
    let after = {
        let engine = player.engine.lock().unwrap();
        engine.current_track().cloned()
    };
    if after.as_ref().map(|t| t.track_id) != before_track_id {
        emit_current(&app, &player);
    }
    persist_snapshot(&app, &player);
    Ok(())
}

/// 清空队列。
#[tauri::command]
pub(crate) async fn clear_queue(
    app: AppHandle,
    player: State<'_, PlayerState>,
) -> Result<(), String> {
    {
        let mut engine = player.engine.lock().unwrap();
        engine.clear();
    }
    {
        let mut audio = player.audio.lock().unwrap();
        audio.stop();
    }
    emit_queue(&app, &player);
    emit_current(&app, &player);
    emit_playing(&app, false);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 漫游垃圾桶 / 「不感兴趣」：上报当前 FM 曲到 NCM 垃圾桶 + 从 FM 队列移除 + 播下一首。
#[tauri::command]
pub(crate) async fn fm_trash(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<(), String> {
    let removed_id = {
        let mut engine = player.engine.lock().unwrap();
        if !engine.is_fm_active() {
            return Err("当前不在漫游状态".to_string());
        }
        let removed = engine
            .remove_fm_current()
            .ok_or_else(|| "无当前 FM 曲目".to_string())?;
        removed.track_id
    };
    NcmService::fm_trash(&app, &ncm, removed_id as i64)
        .await
        .map_err(|e| e.to_string())?;
    play_current_track(&app, &player, &ncm).await
}
