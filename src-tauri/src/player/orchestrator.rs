//! 播放编排：command → state transition → 事件广播 + 后台任务。
//!
//! 锁纪律：任何 `.await` 之前必须释放 engine/audio 锁。

use tauri::{AppHandle, Manager};

use crate::app::state::{persist_snapshot, PlayerState};
use crate::music::netease::NcmState;
use crate::music::service::NcmService;
use crate::player::audio::AudioStatus;
use crate::player::event::{emit_player_event, PlayerEvent};
use crate::player::policy::Step;
use crate::player::resolver::{prepare_and_load, resolve_url_or_cached};
use crate::player::state::{ContentSource, QueueItem};

/// 推「当前状态」：track + index + source + order + repeat（切歌 / 档位变化时）。
pub(crate) fn emit_current(app: &AppHandle, player: &PlayerState) {
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
    emit_player_event(
        app,
        PlayerEvent::Current {
            track,
            index,
            source,
            order,
            repeat,
        },
    );
}

/// 队列突变后推全量。
pub(crate) fn emit_queue(app: &AppHandle, player: &PlayerState) {
    let (items, current_index) = {
        let engine = player.engine.lock().unwrap();
        (engine.queue_items().to_vec(), engine.current_index())
    };
    emit_player_event(
        app,
        PlayerEvent::Queue {
            items,
            current_index,
        },
    );
}

/// 推播放状态。
pub(crate) fn emit_playing(app: &AppHandle, playing: bool) {
    emit_player_event(app, PlayerEvent::Playing { playing });
}

/// 推进入口：区分手动切歌与自然结束（LoopOne 下两者语义不同）。
#[derive(Clone, Copy)]
pub(crate) enum AdvanceEntry {
    ManualNext,
    TrackEnd,
}

/// 共享「推进」逻辑：手动下一首与自然结束共用，仅导航入口不同。
/// 推进结果在 Rust 侧直接落地音频（下载 + 播放）。
pub(crate) async fn advance_once(
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
                        let songs = NcmService::personal_fm(app, ncm)
                            .await
                            .map_err(|e| e.to_string())?;
                        let tracks: Vec<QueueItem> =
                            songs.iter().map(NcmService::song_to_queue_item).collect();
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
                            return Err("FM 续歌无新曲目".to_string());
                        }
                        continue;
                    }
                    _ => {
                        // Queue：队列耗尽，真正停止音源（pause 停 rodio + 状态 Paused）。
                        emit_playing(app, false);
                        {
                            let mut audio = player.audio.lock().unwrap();
                            audio.pause();
                        }
                        persist_snapshot(app, player);
                        return Err("queue ended".to_string());
                    }
                }
            }
        }
    }
}

/// 播放「当前曲目」（不推进索引）。无当前曲目时走 `advance_once` 续歌。
pub(crate) async fn play_current_track(
    app: &AppHandle,
    player: &PlayerState,
    ncm: &NcmState,
) -> Result<(), String> {
    let track = {
        let engine = player.engine.lock().unwrap();
        engine.current_track().cloned()
    };
    let Some(track) = track else {
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

/// 启动 ended 检测后台任务：周期检查音频是否播完，播完则自动推进。
pub(crate) fn start_ended_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(500));
        loop {
            interval.tick().await;
            let player = app.state::<PlayerState>();
            let should_advance = {
                let audio = player.audio.lock().unwrap();
                let playing = audio.status() == AudioStatus::Playing;
                playing && audio.is_empty()
            };
            if should_advance {
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
            }
        }
    });
}
