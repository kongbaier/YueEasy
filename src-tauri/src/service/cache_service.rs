//! 缓存领域服务：浅包 `infra::storage::cache`。IPC 薄壳在 `cmd/cache.rs`。

use crate::infra::storage::cache::CacheState;

pub struct CacheService;

impl CacheService {
    pub fn get(state: &CacheState, key: &str) -> Result<Option<String>, String> {
        state.get(key)
    }

    pub fn set(state: &CacheState, key: &str, value: &str) -> Result<(), String> {
        state.set(key, value)
    }

    pub fn delete(state: &CacheState, key: &str) -> Result<(), String> {
        state.delete(key)
    }

    pub fn clear(state: &CacheState, prefix: &str) -> Result<(), String> {
        state.clear(prefix)
    }

    pub fn size(state: &CacheState) -> Result<u64, String> {
        state.size()
    }
}
