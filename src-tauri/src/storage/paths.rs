use std::path::PathBuf;

/// 应用数据目录（缓存、数据库等本地数据的统一根目录）。
pub fn data_dir() -> PathBuf {
    dirs::data_dir()
        .expect("failed to resolve app data dir")
        .join("com.kongbai.yueeasy")
}
