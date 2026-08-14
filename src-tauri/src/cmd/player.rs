//! 播放器 IPC 命令（薄壳）：播放控制 + 队列操作，全部走 `PlayerState` + `NcmState`。
//!
//! Phase 3（音频迁移 Rust）：播放命令不再返回 URL 给前端，而是在 Rust 侧完成
//! 「URL 解析 → 下载解码 → AudioEngine.load/play」，前端退化为纯命令 + 事件订阅。
//!
//! 锁纪律（设计 §3.3，违反即返工）：任何 `.await` 之前必须释放 engine/audio 锁。
//! 模式 = `{ let mut e = player.engine.lock().unwrap(); e.method(...) }` → 锁释放 → await
//! （URL 解析 / FM 取歌 / 下载解码等 I/O 全部在锁外）。

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::core::strategy::Step;
use crate::core::types::{ContentSource, Order, QueueItem, Repeat};
use crate::infra::audio::engine::{prepare_source, AudioStatus};
use crate::infra::ncm::entity::SongUrlResult;
use crate::infra::ncm::NcmState;
use crate::service::ncm_service::NcmService;
use crate::state::{emit_player_event, persist_snapshot, PlayerEvent, PlayerState};

/// 播放命令返回（`resolve_play_url` 预加载用；播放命令已不返回此值）。
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

/// URL 解析辅助：track_id 命中 `last_url` 缓存则复用（LoopOne 重播），否则重新解析。
async fn resolve_url_or_cached(
    app: &AppHandle,
    player: &PlayerState,
    ncm: &NcmState,
    track: &QueueItem,
) -> Result<String, String> {
    let cached = player.last_url.lock().unwrap().clone();
    if let Some((tid, url)) = cached {
        if tid == track.track_id {
            return Ok(url);
        }
    }
    resolve_url(app, ncm, track, None).await
}

/// 下载解码 URL → `AudioEngine.load`（自动播放）。I/O 全在锁外，仅 load 时短暂持音频锁。
/// 真实解码时长优先（`DecodedSource.real_duration`），缺失回退 NCM 元数据 `duration_secs`。
async fn prepare_and_load(player: &PlayerState, url: &str, duration_secs: f64) -> Result<(), String> {
    let parsed = stream_download::http::reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let decoded = prepare_source(parsed).await?;
    let mut audio = player.audio.lock().unwrap();
    audio.load(decoded.source, decoded.real_duration, duration_secs);
    Ok(())
}

/// 推「当前状态」：track + index + source + order + repeat（切歌 / 档位变化时）。
fn emit_current(app: &AppHandle, player: &PlayerState) {
    let (track, index, source, order, repeat) = {
        let engine = player.engine.lock().unwrap();
        (
            engine.current_track().cloned(),
            engine.current_index(),
            engine.source(),
            engine.order(),
            engine.repeat(),
        )
    };
    emit_player_event(app, PlayerEvent::Current { track, index, source, order, repeat });
}

/// 队列突变后推全量（设计 §4.3：全量保证前后端一致；不做 100ms 去抖）。
fn emit_queue(app: &AppHandle, player: &PlayerState) {
    let (items, current_index) = {
        let engine = player.engine.lock().unwrap();
        (engine.queue_items().to_vec(), engine.current_index())
    };
    emit_player_event(app, PlayerEvent::Queue { items, current_index });
}

/// 推播放状态（playing = 播放 / 暂停 / 结束）。
fn emit_playing(app: &AppHandle, playing: bool) {
    emit_player_event(app, PlayerEvent::Playing { playing });
}

/// 推进入口：区分手动切歌与自然结束（LoopOne 下两者语义不同）。
#[derive(Clone, Copy)]
enum AdvanceEntry {
    /// 手动按「下一首」（play_next / 媒体键 / fm_trash 移除后推进）。
    ManualNext,
    /// 曲目自然播完（ended watcher）。
    TrackEnd,
}

/// 共享「推进」逻辑：手动下一首（`play_next`）与自然结束（ended watcher）共用，
/// 仅导航入口不同（`manual_next` vs `on_track_end`）。
/// 推进结果在 Rust 侧直接落地音频（下载 + 播放）。
async fn advance_once(
    app: &AppHandle,
    player: &PlayerState,
    ncm: &NcmState,
    entry: AdvanceEntry,
) -> Result<(), String> {
    // FM 流式：End 时续歌追加后重新推进，直至 Play / ReplayCurrent 或 Queue 停止。
    loop {
        let step = {
            let mut engine = player.engine.lock().unwrap();
            match entry {
                AdvanceEntry::ManualNext => engine.manual_next(),
                AdvanceEntry::TrackEnd => engine.on_track_end(),
            }
        };
        match step {
            Step::Play(idx) => {
                let track = {
                    let engine = player.engine.lock().unwrap();
                    engine.queue_items()[idx].clone()
                };
                let url = resolve_url_or_cached(app, player, ncm, &track).await?;
                *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
                prepare_and_load(player, &url, track.duration_secs).await?;
                emit_queue(app, player);
                emit_current(app, player);
                emit_playing(app, true);
                persist_snapshot(app, player);
                return Ok(());
            }
            Step::ReplayCurrent => {
                // LoopOne 自然结束：重播当前曲（last_url 缓存命中则免请求）
                let track = {
                    let engine = player.engine.lock().unwrap();
                    engine.current_track().cloned()
                };
                let Some(track) = track else {
                    // 理论不可达（ReplayCurrent 仅在 current 存在时返回）；防御性按队列结束处理
                    return Err("queue ended".to_string());
                };
                let url = resolve_url_or_cached(app, player, ncm, &track).await?;
                *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
                prepare_and_load(player, &url, track.duration_secs).await?;
                emit_current(app, player);
                emit_playing(app, true);
                persist_snapshot(app, player);
                return Ok(());
            }
            Step::End => {
                // 队尾：内容来源决定「停止」还是「续歌」
                let source = {
                    let engine = player.engine.lock().unwrap();
                    engine.snapshot().content_source
                };
                match source {
                    ContentSource::PersonalFm => {
                        // FM 续歌：取歌追加到 FM 队列，再推进播下一首（await 在锁外）
                        let songs = NcmService::personal_fm(app, ncm)
                            .await
                            .map_err(|e| e.to_string())?;
                        let tracks: Vec<QueueItem> = songs
                            .iter()
                            .map(NcmService::song_to_queue_item)
                            .collect();
                        if tracks.is_empty() {
                            return Err("FM 暂无可用曲目".to_string());
                        }
                        let appended = {
                            let mut engine = player.engine.lock().unwrap();
                            let before = engine.queue_items().len();
                            engine.append_fm(tracks);
                            engine.queue_items().len() > before
                        };
                        if !appended {
                            // 追加后队列未增长（全部去重）→ 避免死循环，停止
                            return Err("FM 续歌无新曲目".to_string());
                        }
                        continue; // 重新推进到新追加的曲目
                    }
                    _ => {
                        // Queue：队列耗尽，真正停止音源（pause 停 rodio + 状态 Paused），
                        // 否则仅改枚举会让 rodio 继续播到末尾、get_pos 越过 duration。
                        emit_playing(app, false);
                        {
                            let mut audio = player.audio.lock().unwrap();
                            audio.pause();
                        }
                        // 队列耗尽：playing=false 落盘，重启后不会误恢复播放
                        persist_snapshot(app, player);
                        return Err("queue ended".to_string());
                    }
                }
            }
        }
    }
}

/// 播放「当前曲目」（不推进索引）。无当前曲目时（队列空）走 `advance_once` 续歌。
/// 供 `fm_trash`（移除当前曲后播滑入的下一首）等需要「就地播当前」的场景。
async fn play_current_track(
    app: &AppHandle,
    player: &PlayerState,
    ncm: &NcmState,
) -> Result<(), String> {
    let track = {
        let engine = player.engine.lock().unwrap();
        engine.current_track().cloned()
    };
    let Some(track) = track else {
        // 无当前曲（队列空）→ 续歌/停止（fm_trash 用户主动操作，按手动推进）
        return advance_once(app, player, ncm, AdvanceEntry::ManualNext).await;
    };
    let url = resolve_url_or_cached(app, player, ncm, &track).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(player, &url, track.duration_secs).await?;
    emit_current(app, player);
    emit_playing(app, true);
    persist_snapshot(app, player);
    Ok(())
}

// ── 播放控制（设计 §4.1） ───────────────────────────────────────────

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
    crate::infra::platform::media_session::update_position(&app, position_secs)
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
        // 无已加载 source：重新加载当前曲目（防御 restore 失败等场景，避免「点播放无声音」）
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
pub(crate) async fn pause(
    app: AppHandle,
    player: State<'_, PlayerState>,
) -> Result<(), String> {
    {
        let mut audio = player.audio.lock().unwrap();
        audio.pause();
    }
    emit_playing(&app, false);
    Ok(())
}

/// 设置音量（0.0..=1.0）。
#[tauri::command]
pub(crate) async fn set_volume(
    player: State<'_, PlayerState>,
    volume: f32,
) -> Result<(), String> {
    let mut audio = player.audio.lock().unwrap();
    audio.set_volume(volume);
    Ok(())
}

/// 查询当前播放位置/状态（前端进度条周期校准用；返回 (position_secs, playing)）。
///
/// 位置钳制：`pos` 取 min(pos, duration)。真实解码位置在 ended 边界可能略越 duration
/// （流式总时长与元数据不一致时），若不钳制，前端校准会把 currentTime 推到 > duration，
/// 进度条「超出」。此处是服务端数据校正，而非 UI 层 clamp。
#[tauri::command]
pub(crate) async fn get_position(
    player: State<'_, PlayerState>,
) -> Result<(f64, bool), String> {
    let audio = player.audio.lock().unwrap();
    let pos = audio.get_pos().as_secs_f64();
    let playing = audio.status() == AudioStatus::Playing;
    // 钳制到真实/元数据时长（duration 已在 load 时优先取解码真实时长，缺失回退元数据）。
    let clamped = match audio.duration() {
        Some(d) => pos.min(d.as_secs_f64()),
        None => pos,
    };
    Ok((clamped, playing))
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
                .iter()
                .next()
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

// ── 队列操作（设计 §4.1；每次突变后推全量 QueueChanged） ───────────────

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
    // 空队列追加后 current_index 从 None → Some(0)，前端需据此从「暂无音乐」切到第一首
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
    // 空队列插入后 current_index 从 None → Some(0)
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
    // 当前曲变化（含清空到 None）都推 current，前端据此清空 currentTrack
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
        // 清空后停止音频，避免旧 source 残留导致「能播放无声音」
        let mut audio = player.audio.lock().unwrap();
        audio.stop();
    }
    emit_queue(&app, &player);
    emit_current(&app, &player); // 清空后 current 变 null，前端据此清空显示
    emit_playing(&app, false);
    persist_snapshot(&app, &player);
    Ok(())
}

// ── 位置持久化（Phase F：前端周期性上报，快照仅存此值） ─────────────────

/// 启动恢复：若上次播放中，则解析当前曲目 URL 并恢复播放（seek 到上次位置）。
/// 音频迁移 Rust 后由后端在启动时调用，取代前端 `restorePlayerState` 的 load+seek+play。
#[tauri::command]
pub(crate) async fn restore_playback(
    app: AppHandle,
    player: State<'_, PlayerState>,
    ncm: State<'_, NcmState>,
) -> Result<(), String> {
    let (track, position_secs, playing) = {
        let engine = player.engine.lock().unwrap();
        let snapshot = engine.snapshot();
        (
            engine.current_track().cloned(),
            snapshot.position_secs,
            snapshot.playing,
        )
    };
    let Some(track) = track else {
        return Ok(());
    };
    let url = resolve_url(&app, &ncm, &track, None).await?;
    *player.last_url.lock().unwrap() = Some((track.track_id, url.clone()));
    prepare_and_load(&player, &url, track.duration_secs).await?;
    if position_secs > 0.0 {
        let mut audio = player.audio.lock().unwrap();
        audio.seek(position_secs);
    }
    if playing {
        emit_playing(&app, true);
    } else {
        // 上次暂停：加载好 source 后保持暂停，避免「点播放无 source 一直 0」
        let mut audio = player.audio.lock().unwrap();
        audio.pause();
        emit_playing(&app, false);
    }
    Ok(())
}

/// 漫游垃圾桶 / 「不感兴趣」：上报当前 FM 曲到 NCM 垃圾桶 + 从 FM 队列移除 + 播下一首。
/// 非 FM 状态 → Err。移除后队列内下一首滑入；队列空则走 advance_once 续歌。
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

/// 启动 ended 检测 + 位置持久化后台任务：
/// 1. ended 检测：周期检查音频是否播完，播完则自动推进（与曲目自然结束统一语义）。
///    音频迁移 Rust 后，此任务取代前端 AudioCore 的 ended 事件 + decide_after_end 调用链。
/// 2. 位置持久化：前端已不再上报 `report_position`（进度权威在 Rust），由本任务周期把
///    真实音频位置/状态写入引擎快照 + SQLite，保证「崩溃续播」（设计 §7 测试 A）不失效。
///    节流：每 10 tick（≈5s）或位移 ≥1s 写一次，避免频繁写盘。
pub(crate) fn start_ended_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        let mut tick_count: u64 = 0;
        let mut last_persisted_pos: f64 = -1.0;
        loop {
            interval.tick().await;
            tick_count += 1;
            let player = app.state::<PlayerState>();
            let (should_advance, pos, playing) = {
                let audio = player.audio.lock().unwrap();
                let pos = audio.get_pos().as_secs_f64();
                let playing = audio.status() == AudioStatus::Playing;
                (
                    playing && audio.duration().is_some_and(|d| pos >= d.as_secs_f64()),
                    pos,
                    playing,
                )
            };
            if should_advance {
                // 方向1：ended 成立即真正停音源（pause 停 rodio + 状态 Paused）+ 广播 playing=false，
                // 消除「切歌下载解码空窗」里前端 rAF 无上界插值导致的 currentTime 反复超出 duration。
                // 注意：不能用 set_status(Paused) — 那只改枚举，rodio 仍继续播到末尾、get_pos 越过 duration。
                // 新曲 load 成功后 advance_once 内会 emit_playing(true) 恢复。
                {
                    let mut audio = player.audio.lock().unwrap();
                    audio.pause();
                }
                emit_playing(&app, false);
                let ncm = app.state::<NcmState>();
                if let Err(e) = advance_once(&app, &player, &ncm, AdvanceEntry::TrackEnd).await {
                    if e != "queue ended" {
                        log::warn!("[ended watcher] 自动推进失败: {e}");
                    }
                }
                continue; // 切歌后位置重置，下一 tick 起重新累计
            }
            let should_persist =
                tick_count % 10 == 0 || (pos - last_persisted_pos).abs() >= 1.0;
            if should_persist {
                last_persisted_pos = pos;
                {
                    let mut engine = player.engine.lock().unwrap();
                    engine.report_position(pos, playing);
                }
                persist_snapshot(&app, &player);
            }
        }
    });
}
