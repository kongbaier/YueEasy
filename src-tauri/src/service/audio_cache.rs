//! 音频缓存编排：远端播放地址 → 字节 → 磁盘（`storage::audio_cache`）。
//!
//! 只做三件与「取音频字节」有关、且**不该进文件层**的事：
//! 1. 地址护栏（scheme / host 白名单 / 大小上限）——前端传进来的 URL 不能是任意地址
//! 2. 后台下载（`spawn_download`，fire-and-forget，失败只记日志）
//! 3. 在途去重（同一首不并发下载两遍）
//!
//! 文件读写 / LRU 淘汰全在 `storage::audio_cache`，本层不含 fs 逻辑（因此可只测纯函数）。

use std::sync::OnceLock;
use std::time::Duration;

use reqwest::Client;
use tokio::sync::Semaphore;

use crate::storage::audio_cache::{self, AudioCache, MAX_FILE_BYTES};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

/// NCM 音频 CDN 只认这些域名后缀；其余一律拒（防前端传入任意地址当下载器用）。
const ALLOWED_HOST_SUFFIXES: &[&str] = &["126.net"];

/// 下载音频用的 UA（默认 reqwest UA 有概率被 CDN 拒绝）。
const DOWNLOAD_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
     (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/// 并发下载上限：预取 + 快速切歌可能同时触发多首，限量避免抢带宽 / 抢连接。
const MAX_CONCURRENT_DOWNLOADS: usize = 2;

fn downloads() -> &'static Semaphore {
    static SEM: OnceLock<Semaphore> = OnceLock::new();
    SEM.get_or_init(|| Semaphore::new(MAX_CONCURRENT_DOWNLOADS))
}

fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .user_agent(DOWNLOAD_UA)
            .build()
            .unwrap_or_default()
    })
}

/// 后台落盘（fire-and-forget）：调用方拿到播放 URL 后触发，不等待、不感知失败。
pub fn spawn_download(cache: AudioCache, track_id: u64, url: String, level: Option<String>) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = download_and_store(&cache, track_id, url, level).await {
            log::debug!("[audio-cache] 落盘失败 track={track_id}: {e}");
        }
    });
}

/// 下载并写入缓存；已有缓存 / 已有关闭开关 / 已有在途下载均视为成功（幂等）。
pub async fn download_and_store(
    cache: &AudioCache,
    track_id: u64,
    url: String,
    level: Option<String>,
) -> Result<(), String> {
    if cache.limit() == 0 {
        return Err("音频缓存已关闭".to_string());
    }
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("非法播放地址: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(format!("不支持的协议: {}", parsed.scheme()));
    }
    let host = parsed.host_str().unwrap_or_default();
    if !is_allowed_host(host) {
        return Err(format!("非音乐 CDN 地址，已拒绝缓存: {host}"));
    }
    // 已缓存 → 不重复下载（get 顺带刷新 LRU 时间戳，属于合理记账）
    if cache.get(track_id, level.as_deref()).is_some() {
        return Ok(());
    }
    let key = audio_cache::cache_key(track_id, level.as_deref());
    if !cache.begin_inflight(&key) {
        return Ok(()); // 已有同曲下载在跑
    }
    let _guard = InflightGuard {
        cache: cache.clone(),
        key,
    };

    let ext = ext_from_url(parsed.as_str());
    // 排队等一个下载位（拿到 permit 才开始拉流；超出并发上限的请求在这里排队）
    let _permit = downloads()
        .acquire()
        .await
        .map_err(|e| format!("下载队列不可用: {e}"))?;
    let resp = client()
        .get(parsed)
        .send()
        .await
        .map_err(|e| format!("下载失败: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("下载失败: HTTP {}", resp.status()));
    }
    if let Some(len) = resp.content_length() {
        if len > MAX_FILE_BYTES {
            return Err(format!("音频过大（{len} 字节，上限 {MAX_FILE_BYTES}），已丢弃"));
        }
    }
    let bytes = resp.bytes().await.map_err(|e| format!("读取响应失败: {e}"))?;
    let path = cache.store(track_id, level.as_deref(), &ext, &bytes)?;
    log::debug!("[audio-cache] 已缓存 {} -> {:?}", track_id, path);
    Ok(())
}

/// 在途标记的 RAII 释放：任何返回路径（含 `?` 提前返回）都会清标记。
struct InflightGuard {
    cache: AudioCache,
    key: String,
}

impl Drop for InflightGuard {
    fn drop(&mut self) {
        self.cache.end_inflight(&self.key);
    }
}

fn is_allowed_host(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    ALLOWED_HOST_SUFFIXES
        .iter()
        .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
}

/// 从播放地址推导扩展名：`<audio>` 依赖扩展名判定 MIME，认不出的一律按 mp3。
pub fn ext_from_url(url: &str) -> String {
    let path = url.split(['?', '#']).next().unwrap_or_default();
    let ext = path
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    match ext.as_str() {
        "mp3" | "m4a" | "flac" | "wav" | "ogg" | "aac" => ext,
        _ => "mp3".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_only_ncm_cdn_hosts() {
        assert!(is_allowed_host("m701.music.126.net"));
        assert!(is_allowed_host("m804.music.126.net"));
        assert!(is_allowed_host("126.net"));
        assert!(!is_allowed_host("evil.com"));
        assert!(!is_allowed_host("126.net.evil.com"));
        assert!(!is_allowed_host("music.126.net.cn"));
        assert!(!is_allowed_host(""));
    }

    #[test]
    fn ext_from_url_strips_query() {
        assert_eq!(
            ext_from_url("http://m701.music.126.net/2024/x.mp3?authSecret=abc&x=1"),
            "mp3"
        );
        assert_eq!(
            ext_from_url("http://m701.music.126.net/2024/x.FLAC?authSecret=abc"),
            "flac"
        );
        assert_eq!(
            ext_from_url("http://m701.music.126.net/2024/x.m4a"),
            "m4a"
        );
        // 认不出 → mp3（不能给 bin/无扩展名，否则 MIME 判定失败播不出来）
        assert_eq!(ext_from_url("http://m701.music.126.net/2024/track"), "mp3");
        assert_eq!(
            ext_from_url("http://m701.music.126.net/2024/x.exe?a=1"),
            "mp3"
        );
    }

    #[tokio::test]
    async fn rejects_non_cdn_host_without_touching_network() {
        let dir = std::env::temp_dir().join(format!(
            "yueeasy-audio-cache-svc-test-{}",
            std::process::id()
        ));
        let cache = AudioCache::new(dir, 1024 * 1024);
        let err = download_and_store(&cache, 1, "https://evil.com/a.mp3".to_string(), None)
            .await
            .unwrap_err();
        assert!(err.contains("非音乐 CDN"));
    }

    #[tokio::test]
    async fn disabled_cache_skips_download() {
        let dir = std::env::temp_dir().join(format!(
            "yueeasy-audio-cache-svc-test-off-{}",
            std::process::id()
        ));
        let cache = AudioCache::new(dir, 0);
        let err = download_and_store(
            &cache,
            1,
            "http://m701.music.126.net/a.mp3".to_string(),
            None,
        )
        .await
        .unwrap_err();
        assert!(err.contains("已关闭"));
    }
}
