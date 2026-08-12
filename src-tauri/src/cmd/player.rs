//! 播放器 IPC 命令（薄壳）：播放控制 + 队列操作，全部走 `PlayerState` + `NcmState`。
//!
//! 锁纪律（设计 §3.3，违反即返工）：任何 `.await` 之前必须释放 engine 锁。
//! 模式 = `{ let mut e = player.engine.lock().unwrap(); e.method(...) }` → 锁释放 → await
//! （URL / FM 取歌等 I/O 全部在锁外）。engine 方法返回 `&QueueItem` 的用 `.cloned()` 先取出。

use serde::Serialize;
use tauri::{AppHandle, State};

use crate::core::types::{AdvanceResult, AfterEndAction, ContentSource, PlayMode, QueueItem};
use crate::infra::ncm::entity::SongUrlResult;
use crate::infra::ncm::NcmState;
use crate::service::ncm_service::NcmService;
use crate::state::{emit_player_event, persist_snapshot, PlayerEvent, PlayerState};

/// 播放命令返回：当前曲目 + 已解析播放地址（设计 §4.4，切歌无间断优先）。
#[derive(Serialize)]
pub struct PlayUrlInfo {
    pub track: QueueItem,
    pub url: String,
}

/// URL 解析辅助（player.rs 内，query.rs 复用 → pub(crate)）。
/// 调 `NcmService::song_url`，取第一条非空 url。
pub(crate) async fn resolve_url(
    app: &AppHandle,
    ncm: &NcmState,
    track: &QueueItem,
    level: Option<String>,
) -> Result<String, String> {
    let result: SongUrlResult = NcmService::song_url(app, ncm, track.track_id as i64, level)
        .await
        .map_err(|e| e.to_string())?;
    result
        .data
        .into_iter()
        .map(|u| u.url)
        .find(|u| !u.is_empty())
        .ok_or_else(|| format!("无法获取曲目 {} 的播放地址", track.track_id))
}

/// 共享「手动推进」逻辑：`play_next` / `fm_trash` 走 `engine.next()`（Sequential 末尾环绕）。
/// 注意：与 `decide_after_end`（曲目自然结束，走 `engine.on_track_end()`）语义不同——
/// 手动 next 在 Sequential 末尾环绕回 0，end 后策略保持暂停。
async fn advance_once(
    app: &AppHandle,
    player: &PlayerState,
    ncm: &NcmState,
) -> Result<PlayUrlInfo, String> {
    let result = {
        let mut engine = player.engine.lock().unwrap();
        engine.next()
    };
    match result {
        AdvanceResult::PlayTrack(idx) => {
            let track = {
                let engine = player.engine.lock().unwrap();
                engine.queue_items()[idx].clone()
            };
            let url = resolve_url(app, ncm, &track, None).await?;
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            emit_queue_changed(app, player);
            emit_player_event(app, PlayerEvent::TrackChanged { track: track.clone() });
            persist_snapshot(app, player);
            Ok(PlayUrlInfo { track, url })
        }
        AdvanceResult::NeedFmTrack => {
            // await 在锁外：先取 FM 曲目，再回锁 set_fm_track
            let songs = NcmService::personal_fm(app, ncm)
                .await
                .map_err(|e| e.to_string())?;
            let track = songs
                .iter()
                .next()
                .map(NcmService::song_to_queue_item)
                .ok_or_else(|| "FM 暂无可用曲目".to_string())?;
            let url = resolve_url(app, ncm, &track, None).await?;
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            {
                let mut engine = player.engine.lock().unwrap();
                engine.set_fm_track(track.clone());
            }
            emit_queue_changed(app, player);
            emit_player_event(app, PlayerEvent::TrackChanged { track: track.clone() });
            persist_snapshot(app, player);
            Ok(PlayUrlInfo { track, url })
        }
        AdvanceResult::EndOfQueue => {
            emit_player_event(app, PlayerEvent::QueueEnded);
            Err("queue ended".to_string())
        }
    }
}

/// 队列突变后推全量 QueueChanged（设计 §4.3：全量保证前后端一致；不做 100ms 去抖）。
fn emit_queue_changed(app: &AppHandle, player: &PlayerState) {
    let (items, current_index) = {
        let engine = player.engine.lock().unwrap();
        (engine.queue_items().to_vec(), engine.current_index())
    };
    emit_player_event(app, PlayerEvent::QueueChanged { items, current_index });
}

// ── 播放控制（设计 §4.1） ───────────────────────────────────────────

/// 播放指定单曲，替换当前上下文。
#[tauri::command]
pub(crate) async fn play_track(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    track: QueueItem,
) -> Result<PlayUrlInfo, String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.play_track(track).clone()
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(PlayUrlInfo { track, url })
}

/// 替换整个队列并播放。空队列 → Err。
#[tauri::command]
pub(crate) async fn replace_and_play(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    tracks: Vec<QueueItem>,
    start_index: Option<usize>,
) -> Result<PlayUrlInfo, String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.replace_play(tracks, start_index).cloned()
    };
    let Some(track) = track else {
        return Err("empty queue".to_string());
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(PlayUrlInfo { track, url })
}

/// 从队列指定位置播放。越界 → Err。
#[tauri::command]
pub(crate) async fn play_queue_at(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    index: usize,
) -> Result<PlayUrlInfo, String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.play_queue_at(index).cloned()
    };
    let Some(track) = track else {
        return Err(format!("队列索引 {index} 越界"));
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(PlayUrlInfo { track, url })
}

/// 下一首（模式决策；FM 下取歌）。
#[tauri::command]
pub(crate) async fn play_next(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<PlayUrlInfo, String> {
    advance_once(&app, &player, &ncm).await
}

/// 上一首。无上一曲 → Err。
#[tauri::command]
pub(crate) async fn play_prev(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<PlayUrlInfo, String> {
    let track = {
        let mut engine = player.engine.lock().unwrap();
        engine.prev().cloned()
    };
    let Some(track) = track else {
        return Err("无上一曲".to_string());
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(PlayUrlInfo { track, url })
}

/// 曲目自然结束后由前端调用（替代 advance_on_end）。
/// 按 engine.on_track_end() 决策返回 PlayUrlInfo 或 Err("queue ended")。
/// Stopped 走 Err("queue ended") 路径，与前端 isQueueEnded 协议保持兼容。
#[tauri::command]
pub(crate) async fn decide_after_end(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<PlayUrlInfo, String> {
    let action = {
        let mut engine = player.engine.lock().unwrap();
        engine.on_track_end()
    };
    match action {
        AfterEndAction::PlayNext(idx) => {
            let track = {
                let engine = player.engine.lock().unwrap();
                engine.queue_items()[idx].clone()
            };
            let url = resolve_url(&app, &ncm, &track, None).await?;
            // 更新 last_url 缓存
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            emit_queue_changed(&app, &player);
            emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
            persist_snapshot(&app, &player);
            Ok(PlayUrlInfo { track, url })
        }
        AfterEndAction::ReplayCurrent => {
            let track = {
                let engine = player.engine.lock().unwrap();
                engine.current_track()
                    .ok_or_else(|| "no current track".to_string())?
                    .clone()
            };
            // 优先用 last_url 缓存（track_id 匹配），避免重复 NCM URL 请求
            let url = {
                let cache = player.last_url.lock().unwrap().clone();
                match cache {
                    Some((tid, u)) if tid == track.track_id => u,
                    _ => {
                        let u = resolve_url(&app, &ncm, &track, None).await?;
                        *player.last_url.lock().unwrap() = Some((track.track_id, u.clone()));
                        u
                    }
                }
            };
            // LoopOne 不需要切歌：保留 current_index、不 emit TrackChanged（引擎已重置位置）
            persist_snapshot(&app, &player);
            Ok(PlayUrlInfo { track, url })
        }
        AfterEndAction::NeedFmTrack => {
            // 复用 advance_once 的 FM 分支逻辑（await 在锁外）
            let songs = NcmService::personal_fm(&app, &ncm)
                .await
                .map_err(|e| e.to_string())?;
            let track = songs
                .iter()
                .next()
                .map(NcmService::song_to_queue_item)
                .ok_or_else(|| "FM 暂无可用曲目".to_string())?;
            let url = resolve_url(&app, &ncm, &track, None).await?;
            {
                let mut engine = player.engine.lock().unwrap();
                engine.set_fm_track(track.clone());
            }
            *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
            emit_queue_changed(&app, &player);
            emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
            persist_snapshot(&app, &player);
            Ok(PlayUrlInfo { track, url })
        }
        AfterEndAction::Stopped => {
            emit_player_event(&app, PlayerEvent::QueueEnded);
            Err("queue ended".to_string())
        }
    }
}

/// 设置迭代策略（"sequential" / "loop_all" / "loop_one" / "shuffle"）。非法值 → Err。
/// FM 模式下策略字段被引擎忽略（§2.6：content_source 决定行为来源）。
#[tauri::command]
pub(crate) async fn set_iteration_strategy(
    app: AppHandle,
    player: State<'_, PlayerState>,
    strategy: String,
) -> Result<(), String> {
    let strategy = match strategy.as_str() {
        "sequential" => PlayMode::Sequential,
        "loop_all" => PlayMode::LoopAll,
        "loop_one" => PlayMode::LoopOne,
        "shuffle" => PlayMode::Shuffle,
        _ => return Err(format!("未知迭代策略：{strategy}")),
    };
    {
        let mut engine = player.engine.lock().unwrap();
        engine.set_mode(strategy);
    }
    emit_player_event(&app, PlayerEvent::IterationStrategyChanged { iteration_strategy: strategy });
    persist_snapshot(&app, &player);
    Ok(())
}

/// 跳转到指定位置（前端松手提交；SMTC 位置同步）。
#[tauri::command]
pub(crate) async fn seek(app: AppHandle, position_secs: f64) -> Result<(), String> {
    emit_player_event(&app, PlayerEvent::SeekTo { position_secs });
    crate::infra::platform::media_session::update_position(&app, position_secs)
}

/// 切换内容来源（"queue" / "personal_fm"）。
/// - queue：退出 FM（恢复原队列上下文）；无当前曲目 → Err。
/// - personal_fm：从 NCM 取一首 FM 曲目作为初始单曲；与原 `enter_fm` 语义一致
///   （每次调用都重新取歌 + 替换单曲 + 重置 played_ids）。
/// 非法值 → Err。
#[tauri::command]
pub(crate) async fn set_content_source(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
    source: String,
) -> Result<PlayUrlInfo, String> {
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
            emit_player_event(
                &app,
                PlayerEvent::ContentSourceChanged { source: ContentSource::Queue },
            );
            emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
            emit_queue_changed(&app, &player);
            persist_snapshot(&app, &player);
            Ok(PlayUrlInfo { track, url })
        }
        ContentSource::PersonalFm => {
            let songs = NcmService::personal_fm(&app, &ncm)
                .await
                .map_err(|e| e.to_string())?;
            let track = songs
                .iter()
                .next()
                .map(NcmService::song_to_queue_item)
                .ok_or_else(|| "FM 暂无可用曲目".to_string())?;
            {
                let mut engine = player.engine.lock().unwrap();
                engine.enter_fm(track.clone());
            }
            let url = resolve_url(&app, &ncm, &track, None).await?;
            emit_player_event(
                &app,
                PlayerEvent::ContentSourceChanged { source: ContentSource::PersonalFm },
            );
            emit_player_event(&app, PlayerEvent::TrackChanged { track: track.clone() });
            emit_queue_changed(&app, &player);
            persist_snapshot(&app, &player);
            Ok(PlayUrlInfo { track, url })
        }
    }
}

// ── 队列操作（设计 §4.1；每次突变后推全量 QueueChanged） ───────────────

/// 追加到队尾。
#[tauri::command]
pub(crate) async fn append_to_queue(
    app: AppHandle,
    player: State<'_, PlayerState>,
    tracks: Vec<QueueItem>,
) -> Result<(), String> {
    {
        let mut engine = player.engine.lock().unwrap();
        engine.append(tracks);
    }
    emit_queue_changed(&app, &player);
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
    {
        let mut engine = player.engine.lock().unwrap();
        engine.insert_next(track);
    }
    emit_queue_changed(&app, &player);
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
    emit_queue_changed(&app, &player);
    // remove_at 语义核查：删除当前曲目时引擎自动跳到下一曲（队尾钳制 / 清空），
    // FM 守卫会先恢复原队列 → 当前曲目变化时补发 TrackChanged 镜像。
    let after = {
        let engine = player.engine.lock().unwrap();
        engine.current_track().cloned()
    };
    if after.as_ref().map(|t| t.track_id) != before_track_id {
        if let Some(track) = after {
            emit_player_event(&app, PlayerEvent::TrackChanged { track });
        }
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
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(())
}

/// 随机重排（仅 Shuffle 模式影响导航）。
#[tauri::command]
pub(crate) async fn shuffle_queue(
    app: AppHandle,
    player: State<'_, PlayerState>,
) -> Result<(), String> {
    {
        let mut engine = player.engine.lock().unwrap();
        engine.shuffle();
    }
    emit_queue_changed(&app, &player);
    persist_snapshot(&app, &player);
    Ok(())
}

// ── 位置持久化（Phase F：前端周期性上报，快照仅存此值） ─────────────────

/// 前端上报当前播放位置/状态（位置持久化，设计 §7）。薄壳：写入引擎 + 持久化。
/// 不推事件——纯持久化用途，播放进度的权威是前端 AudioCore。
#[tauri::command]
pub(crate) async fn report_position(
    app: AppHandle,
    player: State<'_, PlayerState>,
    position_secs: f64,
    playing: bool,
) -> Result<(), String> {
    {
        let mut engine = player.engine.lock().unwrap();
        engine.report_position(position_secs, playing);
    }
    persist_snapshot(&app, &player);
    Ok(())
}

/// 漫游垃圾桶：上报当前 FM 曲目到 NCM 垃圾桶 + 推进到下一首。
/// 非 FM 状态 → Err。FM 推进复用 advance_once 的 NeedFmTrack 路径。
#[tauri::command]
pub(crate) async fn fm_trash(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<PlayUrlInfo, String> {
    // 锁内：上报 played_ids + 拿当前曲目 ID
    let current_track_id = {
        let mut engine = player.engine.lock().unwrap();
        if !engine.is_fm_active() {
            return Err("当前不在漫游状态".to_string());
        }
        let track_id = engine
            .current_track()
            .ok_or_else(|| "无当前 FM 曲目".to_string())?
            .track_id;
        engine.fm_record_played(); // 加入 played_ids（FM 上报用）
        track_id
    };
    // 锁外：NCM 上报（网络 I/O）
    NcmService::fm_trash(&app, &ncm, current_track_id as i64)
        .await
        .map_err(|e| e.to_string())?;
    // 复用 advance_once 的 NeedFmTrack 路径取下一首 FM 曲
    advance_once(&app, &player, &ncm).await
}
