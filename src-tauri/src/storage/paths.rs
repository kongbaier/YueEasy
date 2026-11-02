use std::path::PathBuf;

/// 应用标识（与 `tauri.conf.json` 的 `identifier` 一致，也是数据 / 缓存目录名）。
const APP_ID: &str = "com.kongbai.yueeasy";

/// 应用数据目录（数据库、cookie、播放历史等本地数据的统一根目录）。
///
/// Windows 上 `dirs::data_dir()` = `%APPDATA%`（Roaming）：需要随用户漫游的数据放这里。
pub fn data_dir() -> PathBuf {
    dirs::data_dir().expect("failed to resolve app data dir").join(APP_ID)
}

/// 应用缓存根目录：`%LOCALAPPDATA%\<identifier>\cache`。
///
/// Windows 上 `dirs::data_local_dir()` = `%LOCALAPPDATA%`（Local）：可再生的缓存不进 Roaming，
/// 避免随漫游账号同步；被系统「磁盘清理」扫掉也只损失缓存。
pub fn cache_dir() -> PathBuf {
    dirs::data_local_dir()
        .expect("failed to resolve app local data dir")
        .join(APP_ID)
        .join("cache")
}

/// 音频文件缓存目录：`%LOCALAPPDATA%\<identifier>\cache\audio`。
pub fn audio_cache_dir() -> PathBuf {
    cache_dir().join("audio")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_dir_is_under_local_app_data() {
        let dir = cache_dir();
        assert!(dir.ends_with("com.kongbai.yueeasy/cache") || dir.ends_with("com.kongbai.yueeasy\\cache"));
        assert_eq!(audio_cache_dir(), dir.join("audio"));
    }
}
