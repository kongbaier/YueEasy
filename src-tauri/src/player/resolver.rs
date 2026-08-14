//! 音频源解析：URL 获取 + 缓存 + 下载解码。
//!
//! 调用链：Player → resolver（NCM 取 URL → 缓存 → 下载解码）→ AudioEngine。

use tauri::AppHandle;

use crate::app::state::PlayerState;
use crate::music::netease::NcmState;
use crate::music::netease::entity::SongUrlResult;
use crate::music::service::NcmService;
use crate::player::audio::prepare_source;
use crate::player::state::QueueItem;

/// URL 解析：调 `NcmService::song_url`，取第一条非空 url。
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

/// URL 解析：track_id 命中 `last_url` 缓存则复用（LoopOne 重播），否则重新解析。
pub(crate) async fn resolve_url_or_cached(
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
pub(crate) async fn prepare_and_load(
    player: &PlayerState,
    url: &str,
    duration_secs: f64,
) -> Result<(), String> {
    let parsed = stream_download::http::reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let decoded = prepare_source(parsed).await?;
    let mut audio = player.audio.lock().unwrap();
    audio.load(decoded.source, decoded.real_duration, duration_secs);
    Ok(())
}
