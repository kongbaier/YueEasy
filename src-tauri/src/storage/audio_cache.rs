//! 音频文件磁盘缓存（纯文件系统层，不触网）。
//!
//! 目录布局：`%LOCALAPPDATA%\<identifier>\cache\audio\{trackId}-{level}.{ext}`。
//! 容量控制走「扫描目录 + mtime 作 LRU」：命中即 touch（刷新 mtime），超限按 mtime 升序淘汰。
//! 不用索引文件 / DB 表——省掉一致性维护，几千个文件的目录扫描成本可接受。
//!
//! 下载编排（远端 URL → 字节）在 `service/audio_cache.rs`，IPC 在 `commands/audio_cache.rs`。

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use serde::Serialize;

use super::paths;

/// 单文件上限：正常 320kbps 无损级别的音频远小于此，超限视为异常响应。
pub const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
/// 「有效缓存」最小字节数：0 字节 / 被截断的残file 一律当作未命中并删除。
const MIN_VALID_BYTES: u64 = 4 * 1024;
/// 淘汰豁免窗口：最近这么长时间内被「用过」的文件不删（正在播放 / 刚落盘）。
const EVICT_GRACE: Duration = Duration::from_secs(120);
/// 残留 `.part`（进程被杀留下的半截）清理前的宽限期。
const PART_GRACE: Duration = Duration::from_secs(120);
/// 单次扫描上限：防御性护栏，目录异常膨胀时宁可不淘汰也不做超大排序。
const MAX_SCAN_ENTRIES: usize = 20_000;
/// 默认容量上限（前端启动后会下发真实设置值覆盖）。
const DEFAULT_LIMIT_BYTES: u64 = 1024 * 1024 * 1024;

/// 缓存统计（IPC wire 形状：camelCase，与前端 `AudioCacheStats` 对应）。
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheStats {
    pub count: u64,
    pub total_bytes: u64,
}

/// 音频缓存句柄。内部 `Arc`，可廉价 clone 后移进后台任务。
#[derive(Clone)]
pub struct AudioCache {
    inner: Arc<Inner>,
}

struct Inner {
    dir: PathBuf,
    /// 容量上限（字节）；`0` = 关闭缓存（不读不写）。
    limit: AtomicU64,
    /// 在途下载 key 集合：同一首不并发下载。
    in_flight: Mutex<HashSet<String>>,
    /// `{trackId}-{level}` → 文件路径（首次使用时扫描目录惰性构建）。
    index: Mutex<Option<HashMap<String, PathBuf>>>,
}

/// 缓存 key（也是文件主名）：`{trackId}-{level}`，缺省音质写作 `default`。
pub fn cache_key(track_id: u64, level: Option<&str>) -> String {
    let level = level
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .unwrap_or("default");
    format!("{track_id}-{level}")
}

impl Default for AudioCache {
    fn default() -> Self {
        Self::new(paths::audio_cache_dir(), DEFAULT_LIMIT_BYTES)
    }
}

impl AudioCache {
    pub fn new(dir: PathBuf, limit: u64) -> Self {
        Self {
            inner: Arc::new(Inner {
                dir,
                limit: AtomicU64::new(limit),
                in_flight: Mutex::new(HashSet::new()),
                index: Mutex::new(None),
            }),
        }
    }

    pub fn dir(&self) -> &Path {
        &self.inner.dir
    }

    pub fn limit(&self) -> u64 {
        self.inner.limit.load(Ordering::Relaxed)
    }

    /// 下发容量上限；缩小时立即淘汰超出的部分。
    pub fn set_limit(&self, bytes: u64) {
        self.inner.limit.store(bytes, Ordering::Relaxed);
        self.trim();
    }

    /// 命中判断：存在 + 大小合法 + 缓存开启。命中会 touch mtime（LRU 记账）。
    pub fn get(&self, track_id: u64, level: Option<&str>) -> Option<PathBuf> {
        if self.limit() == 0 {
            return None;
        }
        let key = cache_key(track_id, level);
        let path = self.with_index(|index| index.get(&key).cloned())?;
        match fs::metadata(&path) {
            Ok(meta) if meta.is_file() && meta.len() >= MIN_VALID_BYTES => {
                touch(&path);
                Some(path)
            }
            // 文件被外部删掉 / 半截 / 0 字节：清索引并删文件（下次重下）
            _ => {
                self.with_index(|index| index.remove(&key));
                let _ = fs::remove_file(&path);
                None
            }
        }
    }

    /// 写盘：`.part` 临时文件 → rename（原子替换），写完顺带淘汰。
    pub fn store(
        &self,
        track_id: u64,
        level: Option<&str>,
        ext: &str,
        bytes: &[u8],
    ) -> Result<PathBuf, String> {
        if self.limit() == 0 {
            return Err("音频缓存已关闭".to_string());
        }
        let size = bytes.len() as u64;
        if size < MIN_VALID_BYTES {
            return Err(format!("音频数据过小（{size} 字节），已丢弃"));
        }
        if size > MAX_FILE_BYTES {
            return Err(format!("音频数据过大（{size} 字节），已丢弃"));
        }
        fs::create_dir_all(&self.inner.dir).map_err(|e| e.to_string())?;

        let key = cache_key(track_id, level);
        let name = format!("{key}.{}", normalize_ext(ext));
        let path = self.inner.dir.join(&name);
        let tmp = self
            .inner
            .dir
            .join(format!("{name}.{}.part", std::process::id()));

        fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
        if let Err(e) = fs::rename(&tmp, &path) {
            let _ = fs::remove_file(&tmp);
            return Err(e.to_string());
        }

        // 换音质后旧扩展名文件会留下孤儿：同 key 的旧路径不同则删除
        let old = self.with_index(|index| index.insert(key, path.clone()));
        if let Some(old) = old {
            if old != path {
                let _ = fs::remove_file(old);
            }
        }

        self.trim();
        Ok(path)
    }

    /// 删除该曲目的所有音质变体（音频报错后重解析用）。
    pub fn remove(&self, track_id: u64) {
        let prefix = format!("{track_id}-");
        let stale = self.with_index(|index| {
            let keys: Vec<String> = index
                .keys()
                .filter(|k| k.starts_with(&prefix))
                .cloned()
                .collect();
            keys.into_iter()
                .filter_map(|k| index.remove(&k))
                .collect::<Vec<_>>()
        });
        for path in stale {
            let _ = fs::remove_file(path);
        }
    }

    /// 清空缓存目录。
    pub fn clear(&self) -> Result<(), String> {
        self.with_index(|index| index.clear());
        fs::create_dir_all(&self.inner.dir).map_err(|e| e.to_string())?;
        let mut first_err: Option<String> = None;
        let entries = fs::read_dir(&self.inner.dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Err(e) = fs::remove_file(&path) {
                    first_err.get_or_insert(e.to_string());
                }
            }
        }
        match first_err {
            Some(e) => Err(e),
            None => Ok(()),
        }
    }

    pub fn stats(&self) -> AudioCacheStats {
        let paths = self.with_index(|index| index.values().cloned().collect::<Vec<_>>());
        let mut stats = AudioCacheStats::default();
        for path in paths {
            if let Ok(meta) = fs::metadata(&path) {
                if meta.is_file() {
                    stats.count += 1;
                    stats.total_bytes += meta.len();
                }
            }
        }
        stats
    }

    /// 在途标记：`true` = 本次调用获得下载权；`false` = 已有同 key 下载在跑。
    pub fn begin_inflight(&self, key: &str) -> bool {
        let mut set = self
            .inner
            .in_flight
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        set.insert(key.to_string())
    }

    pub fn end_inflight(&self, key: &str) {
        let mut set = self
            .inner
            .in_flight
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        set.remove(key);
    }

    /// 按 mtime 升序淘汰，直到总大小回到上限内；返回删除文件数。
    ///
    /// - 最近 [`EVICT_GRACE`] 内用过的文件跳过（正在播的那首不能被删）
    /// - 顺手清掉超期的残留 `.part`
    pub fn trim(&self) -> usize {
        let limit = self.limit();
        let Ok(entries) = fs::read_dir(&self.inner.dir) else {
            return 0;
        };
        let now = SystemTime::now();
        let mut files: Vec<(String, PathBuf, u64, SystemTime)> = Vec::new();
        for entry in entries.flatten() {
            let Ok(meta) = entry.metadata() else { continue };
            if !meta.is_file() {
                continue;
            }
            let path = entry.path();
            let modified = meta.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            if path.extension().and_then(|e| e.to_str()) == Some("part") {
                if now.duration_since(modified).unwrap_or_default() >= PART_GRACE {
                    let _ = fs::remove_file(&path);
                }
                continue;
            }
            let Some(key) = path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            files.push((key.to_string(), path, meta.len(), modified));
        }

        if limit == 0 {
            return 0;
        }
        let mut total: u64 = files.iter().map(|f| f.2).sum();
        if total <= limit {
            return 0;
        }
        if files.len() > MAX_SCAN_ENTRIES {
            log::warn!(
                "[audio-cache] {} 个文件超出扫描上限，跳过淘汰",
                files.len()
            );
            return 0;
        }

        files.sort_by(|a, b| a.3.cmp(&b.3));
        let mut removed = 0usize;
        for (key, path, size, modified) in files {
            if total <= limit {
                break;
            }
            if now.duration_since(modified).unwrap_or_default() < EVICT_GRACE {
                continue;
            }
            if fs::remove_file(&path).is_ok() {
                total = total.saturating_sub(size);
                removed += 1;
                self.with_index(|index| index.remove(&key));
            }
        }
        if removed > 0 {
            log::debug!("[audio-cache] 淘汰 {removed} 个文件，当前 {} 字节", total);
        }
        removed
    }

    /// 惰性构建 / 复用内存索引。构建失败（目录不存在等）时返回空表。
    fn with_index<R>(&self, f: impl FnOnce(&mut HashMap<String, PathBuf>) -> R) -> R {
        let mut guard = self.inner.index.lock().unwrap_or_else(|e| e.into_inner());
        if guard.is_none() {
            let mut index: HashMap<String, PathBuf> = HashMap::new();
            if let Ok(entries) = fs::read_dir(&self.inner.dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("part") {
                        continue;
                    }
                    let Some(key) = path.file_stem().and_then(|s| s.to_str()) else {
                        continue;
                    };
                    index.insert(key.to_string(), path);
                }
            }
            *guard = Some(index);
        }
        f(guard.as_mut().expect("index initialized above"))
    }
}

/// 刷新 mtime（LRU 记账）。失败无副作用：只影响淘汰顺序。
fn touch(path: &Path) {
    let res = fs::OpenOptions::new()
        .write(true)
        .open(path)
        .and_then(|f| f.set_modified(SystemTime::now()));
    if let Err(e) = res {
        log::debug!("[audio-cache] touch 失败 {:?}: {}", path, e);
    }
}

/// 扩展名白名单：不认识的统一当 mp3（`<audio>` 依赖扩展名判定 MIME）。
fn normalize_ext(ext: &str) -> &str {
    match ext.trim().trim_start_matches('.').to_ascii_lowercase().as_str() {
        "mp3" => "mp3",
        "m4a" => "m4a",
        "flac" => "flac",
        "wav" => "wav",
        "ogg" => "ogg",
        "aac" => "aac",
        _ => "mp3",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicUsize;

    static SEQ: AtomicUsize = AtomicUsize::new(0);

    /// 每个测试一个独立临时目录（无需额外依赖）。
    fn temp_cache(limit: u64) -> (AudioCache, PathBuf) {
        let dir = std::env::temp_dir().join(format!(
            "yueeasy-audio-cache-test-{}-{}",
            std::process::id(),
            SEQ.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        (AudioCache::new(dir.clone(), limit), dir)
    }

    fn payload(size: usize) -> Vec<u8> {
        vec![7u8; size.max(MIN_VALID_BYTES as usize)]
    }

    fn age(path: &Path, secs: u64) {
        let when = SystemTime::now() - Duration::from_secs(secs);
        fs::OpenOptions::new()
            .write(true)
            .open(path)
            .unwrap()
            .set_modified(when)
            .unwrap();
    }

    #[test]
    fn store_then_get_roundtrip() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        let path = cache.store(1, None, "mp3", &payload(5000)).unwrap();
        assert!(path.exists());
        assert_eq!(cache.get(1, None), Some(path));
        // 不同音质互不覆盖
        assert!(cache.get(1, Some("exhigh")).is_none());
    }

    #[test]
    fn truncated_file_is_missed_and_removed() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        let path = cache.store(2, None, "mp3", &payload(5000)).unwrap();
        fs::write(&path, b"ab").unwrap(); // 模拟半截文件
        assert!(cache.get(2, None).is_none());
        assert!(!path.exists());
    }

    #[test]
    fn oversized_and_tiny_payloads_are_rejected() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        assert!(cache.store(3, None, "mp3", b"abc").is_err());
    }

    #[test]
    fn trim_evicts_oldest_first() {
        // 上限 = 2 个文件大小
        let size = MIN_VALID_BYTES as usize;
        let (cache, _dir) = temp_cache((size as u64) * 2);
        let a = cache.store(10, None, "mp3", &payload(size)).unwrap();
        let b = cache.store(11, None, "mp3", &payload(size)).unwrap();
        age(&a, 600);
        age(&b, 300);
        // 第三个写入触发淘汰：a（最旧）被删
        let c = cache.store(12, None, "mp3", &payload(size)).unwrap();
        assert!(!a.exists(), "最旧文件应被淘汰");
        assert!(b.exists());
        assert!(c.exists());
        assert!(cache.stats().total_bytes <= size as u64 * 2);
    }

    #[test]
    fn trim_spares_recently_used_files() {
        let size = MIN_VALID_BYTES as usize;
        let (cache, _dir) = temp_cache((size as u64) * 2);
        let a = cache.store(20, None, "mp3", &payload(size)).unwrap();
        let b = cache.store(21, None, "mp3", &payload(size)).unwrap();
        // a 刚被「用过」（mtime=now，落在豁免窗口内），b 很旧
        age(&b, 600);
        let _ = cache.store(22, None, "mp3", &payload(size)).unwrap();
        assert!(a.exists(), "豁免窗口内的文件不应被删");
        assert!(!b.exists(), "过期文件应被淘汰");
    }

    #[test]
    fn remove_drops_all_variants() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        cache.store(30, None, "mp3", &payload(5000)).unwrap();
        cache.store(30, Some("lossless"), "flac", &payload(6000)).unwrap();
        assert_eq!(cache.stats().count, 2);
        cache.remove(30);
        assert!(cache.get(30, None).is_none());
        assert!(cache.get(30, Some("lossless")).is_none());
        assert_eq!(cache.stats().count, 0);
    }

    #[test]
    fn disabled_cache_reads_and_writes_nothing() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        let path = cache.store(40, None, "mp3", &payload(5000)).unwrap();
        cache.set_limit(0);
        assert!(cache.get(40, None).is_none());
        assert!(cache.store(41, None, "mp3", &payload(5000)).is_err());
        // 关闭不清空已有文件（由用户显式清除）
        assert!(path.exists());
    }

    #[test]
    fn set_limit_shrinks_existing_files() {
        let size = MIN_VALID_BYTES as usize;
        let (cache, _dir) = temp_cache(1024 * 1024);
        let a = cache.store(50, None, "mp3", &payload(size)).unwrap();
        let b = cache.store(51, None, "mp3", &payload(size)).unwrap();
        age(&a, 600);
        age(&b, 600);
        cache.set_limit(size as u64); // 只够一个
        let stats = cache.stats();
        assert_eq!(stats.count, 1);
        assert!(b.exists(), "mtime 较新的保留");
        assert!(!a.exists());
    }

    #[test]
    fn clear_empties_directory() {
        let (cache, dir) = temp_cache(1024 * 1024);
        cache.store(60, None, "mp3", &payload(5000)).unwrap();
        cache.clear().unwrap();
        assert_eq!(cache.stats().count, 0);
        assert_eq!(fs::read_dir(&dir).unwrap().count(), 0);
    }

    #[test]
    fn inflight_is_exclusive() {
        let (cache, _dir) = temp_cache(1024 * 1024);
        assert!(cache.begin_inflight("1-default"));
        assert!(!cache.begin_inflight("1-default"));
        cache.end_inflight("1-default");
        assert!(cache.begin_inflight("1-default"));
    }

    #[test]
    fn ext_is_normalized() {
        assert_eq!(normalize_ext("MP3"), "mp3");
        assert_eq!(normalize_ext(".flac"), "flac");
        assert_eq!(normalize_ext("m4a"), "m4a");
        assert_eq!(normalize_ext("exe"), "mp3");
    }

    #[test]
    fn cache_key_defaults_level() {
        assert_eq!(cache_key(123, None), "123-default");
        assert_eq!(cache_key(123, Some("  ")), "123-default");
        assert_eq!(cache_key(123, Some("exhigh")), "123-exhigh");
    }
}
