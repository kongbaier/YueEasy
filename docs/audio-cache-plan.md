# 音频缓存实施计划（T1 + T2）

> **状态：已实施**（T1 + T2 全部落地；`cargo test` 41 项全绿、`tsc --noEmit` / `pnpm build` / `pnpm lint` 通过。
> 未做真机播放验证的部分见文末「实施记录」。）

> 目标：在现有「URL 缓存 + 元数据缓存」之上，补上**音频文件磁盘缓存**（本地优先 + 后台落盘 + 容量上限），
> 并顺手修掉「单曲循环每次都重新 load 音频」的起播空隙。
> 范围上限锁在 T2：**不做** Service Worker / 自建 MediaSource / 全队列预下载 / React Query 全量持久化。

## 0. 为什么做（收益排序）

1. **稳定性**：播放 URL 带签名会过期、CDN 会 403、断网就停。本地文件没有签名、不看网络。
2. **体感**：回切 / 循环 / 重启后首播从「重新走 media load」变成「直接读本地」，毫秒级起播。
3. **省流量**（附带）：同一首第二次起零流量。

已知取舍：**第一次播放某首歌时会多一份下行流量**（一边流播一边落盘，≈2x）。
不采用「先下完再播」（首播变慢，违背音乐应用直觉），也不采用「边播边写 yt-dlp 式分片缓存」（等于自研流式层，超出 T2）。

---

## 1. 设计决策（先说清，再动手）

| 决策点 | 结论 | 理由 |
|---|---|---|
| 缓存位置 | `%LOCALAPPDATA%\com.kongbai.yueeasy\cache\audio\` | 与用户要求一致；`com.kongbai.yueeasy` = 应用 identifier，与现有 `paths::data_dir()` 的命名保持一致（`%APPDATA%` 那份继续放 DB / cookie，缓存只进 Local，符合 Windows 目录语义） |
| 目录解析 | `dirs::data_local_dir()`（已有依赖），**不**透传 `AppHandle` | 与 `storage/paths.rs::data_dir()` 同款；保持 service 层签名无 AppHandle（AGENTS §5） |
| 文件命名 | `{trackId}-{level}.{ext}`，`level` 缺省写作 `default`，`ext` 取 URL 路径后缀（mp3/m4a/flac） | 未来上「音质设置」时不串味；同一首的不同音质不互相覆盖 |
| 下载方 | **Rust 侧**（`reqwest`） | 前端 `fetch` CDN 受 CORS 限制；Rust 侧还能顺手做 host 白名单与大小护栏 |
| 播放入口 | `convertFileSrc(path)` + 直接给 `<audio src>` | 需要开 `assetProtocol`（见 §2.4）；Tauri asset 协议支持 Range，seek 正常 |
| 容量控制 | 全盘扫描 + mtime 作 LRU（命中时 touch），超限按 mtime 升序淘汰 | 不引入索引文件 / 不引 DB 表；`File::set_modified`（Rust ≥1.75）即可 touch |
| 淘汰豁免 | mtime 在最近 120s 内的文件不删 | 正在播的那首被删会直接炸音频 |
| 写入原子性 | 先写 `*.part` → `fs::rename` | 避免半截文件被当作命中（半截文件的 `error` 会走 §3.5 的重试路径，浪费两次播放） |
| 关闭开关 | `audioCacheLimitMB = 0` → 不读不写（等价回到当前行为） | 出问题用户可自助止血；也是回归兜底 |
| 失效联动 | `invalidateUrl(trackId)` 时同时删本地文件 | 本地文件损坏时只清内存缓存会无限续命坏文件 |

---

## 2. Rust 侧改动

### 2.1 `src-tauri/src/storage/paths.rs`

```rust
/// 应用缓存根目录：%LOCALAPPDATA%\<identifier>\cache
pub fn cache_dir() -> PathBuf;
/// 音频缓存目录：%LOCALAPPDATA%\<identifier>\cache\audio
pub fn audio_cache_dir() -> PathBuf;
```

### 2.2 `src-tauri/src/storage/audio_cache.rs`（纯文件系统层，可单测）

```rust
pub struct AudioCacheStats { pub count: u64, pub total_bytes: u64 }

pub struct AudioCache {
    dir: PathBuf,
    limit: AtomicU64,          // 字节；0 = 关闭
    in_flight: Mutex<HashSet<String>>, // 在途 key，防重复下载
}
impl Default for AudioCache { /* dir = paths::audio_cache_dir(), limit = 1GB 占位（由前端下发覆盖） */ }

impl AudioCache {
    pub fn set_limit(&self, bytes: u64);              // 下发后若超限立即 trim
    pub fn limit(&self) -> u64;
    /// 命中：存在 + size > 4096 + limit != 0 → touch mtime 并返回路径
    pub fn get(&self, track_id: u64, level: Option<&str>) -> Option<PathBuf>;
    /// 写盘：.part → rename；写完 trim()
    pub fn store(&self, track_id: u64, level: Option<&str>, ext: &str, bytes: &[u8]) -> Result<PathBuf, String>;
    /// 删除该 track 的所有音质变体
    pub fn remove(&self, track_id: u64);
    /// 清空目录
    pub fn clear(&self) -> Result<(), String>;
    pub fn stats(&self) -> AudioCacheStats;
    /// 超限淘汰（按 mtime 升序，跳过最近 120s 内使用过的文件）
    fn trim(&self) -> usize;
    /// 在途标记 RAII（避免 panic 泄漏标记）
    pub fn begin_inflight(&self, key: &str) -> bool; // false = 已有在途
    pub fn end_inflight(&self, key: &str);
}
```

单测：`trim` 的淘汰顺序 / 120s 豁免 / `store` 后 `get` 命中 / `remove` 清多音质变体（用 `std::env::temp_dir()` 下唯一目录，无需新依赖）。

### 2.3 `src-tauri/src/service/audio_cache.rs`（下载编排）

```rust
pub async fn download_and_store(
    cache: &AudioCache,
    track_id: u64,
    url: String,
    level: Option<String>,
) -> Result<(), String>
```

- **host 白名单**：只接受 `*.music.126.net` / `*.126.net`（解析 `reqwest::Url` 后比对 host 后缀），防止前端传入任意 URL 打别人接口
- 护栏：响应 `Content-Length > 64MB` 直接拒；实际读完再校验一次
- 请求头：带 `User-Agent`（桌面客户端 UA），不带 cookie
- 超时：沿用 `netease/client.rs` 的量级（connect 10s / total 60s）
- 失败**只 `log::warn`**，不向 UI 抛（用户无感，下次播放再试）
- ext 从 URL path 推导，识别不出时用 `bin`

### 2.4 `src-tauri/src/commands/audio_cache.rs`（薄壳）

| 命令 | 签名 | 说明 |
|---|---|---|
| `audio_cache_get` | `(track_id: u64, level: Option<String>) -> Option<String>` | 返回绝对路径；未命中 `null` |
| `audio_cache_request` | `(track_id: u64, url: String, level: Option<String>) -> ()` | **fire-and-forget**：立刻返回，`tauri::async_runtime::spawn` 后台下载；同 key 在途则跳过 |
| `audio_cache_set_limit` | `(max_bytes: u64) -> ()` | 前端启动/改设置时下发 |
| `audio_cache_stats` | `() -> AudioCacheStats` | 设置页展示 |
| `audio_cache_clear` | `() -> ()` | 设置页清空 |
| `audio_cache_remove` | `(track_id: u64) -> ()` | 音频 error 时删损坏文件 |

`lib.rs`：`.manage(storage::audio_cache::AudioCache::default())`（builder 期即可，不依赖 AppHandle）+ 6 条 `generate_handler` 注册。
`src-tauri/src/storage/mod.rs` 加 `pub mod audio_cache;`，`service/mod.rs` 加 `pub mod audio_cache;`，`commands/mod.rs` 加 `pub mod audio_cache;`。

### 2.5 `src-tauri/tauri.conf.json`

```jsonc
"app": {
  "security": {
    "csp": null,
    "assetProtocol": { "enable": true, "scope": ["$APPLOCALDATA/cache/audio/**"] }
  }
}
```

> `csp` 已是 `null`，无需额外放行。scope 只开缓存子目录（不要 `$APPLOCALDATA/**`）。

---

## 3. 前端改动

### 3.1 `src/tauri/audioCache.ts`（infra，唯一 IPC 入口）

```ts
export const audioCacheApi = {
  getPath, request, setLimit, stats, clear, remove,
};
```

### 3.2 `src/features/player/services/AudioCacheService.ts`（service 层）

```ts
/** 本地命中 → asset URL；未命中 null。 */
export async function localUrl(trackId: number): Promise<string | null>; // convertFileSrc
/** 起播成功后 fire-and-forget 落盘。 */
export function requestCache(trackId: number, remoteUrl: string): void;
/** 音质标识（当前恒 null，留接口）。 */
export function applyLimitFromSettings(): void;  // 读 playerSettingsStore → setLimit
export function invalidate(trackId: number): void;   // 音频 error 用
export async function getStats(): Promise<AudioCacheStats>;
export async function clear(): Promise<void>;
```

模块加载即 `usePlayerSettingsStore.subscribe` → 变更时 `setLimit(audioCacheLimitMB * 1024 * 1024)`
（与 `SettingsService` 的订阅互不干扰：一个写盘、一个下发 Rust）。

### 3.3 `src/features/player/services/PlayerService.ts`（核心改造点）

`resolveTrackUrl` 变成三级：

```
1) 内存 URL 缓存命中（且未过期）        → 返回
2) audioCache.localUrl(track_id) 命中   → 以 { url, at: Infinity, local: true } 写回内存 → 返回
3) resolveUrl(track_id) 网络解析        → 写内存（原有 TTL 逻辑）
                                        → 成功后 requestCache(track_id, url)
```

- `UrlEntry` 增加 `local?: boolean`：本地路径**不设 TTL**（没有签名过期问题），只有远端 URL 才有 5min TTL
- `invalidateUrl(trackId)` 追加 `audioCache.invalidate(trackId)`（删坏文件）
- `prefetchNext()` 不用改：它会自然命中 local 或预热远端 URL，落盘也随之预热（下一首切过去时直接本地命中）
- `restore()`：内存缓存继续清空（磁盘保留），额外 `applyLimitFromSettings()`（保证启动即对齐设置）

### 3.4 T1：单曲循环不重载（`src/features/player/services/PlayerService.ts`）

`stepForward()` 的 `replayCurrent` 分支不再走 `resolveAndPlay`：

```ts
async function replayCurrent(item: QueueItem): Promise<void> {
  // 无有效 src（恢复/被 reset 过）→ 回退到完整重载
  if (audioCore.getStatus() === 'idle' || !audioCore.src) {
    await resolveAndPlay(item);
    return;
  }
  playSeq += 1;                    // 使在途 resolve 失效，避免旧结果回写
  audioCore.seek(0);               // 复用现有 IAudioCore.seek，无需扩接口
  usePlayerStore.setState({ currentTime: 0, loading: false, playing: true });
  await player.play();
  prefetchNext();
}
```

- 不重新 `resolveTrackUrl`、不重新 `load()` → **零重载空隙、零请求**
- 不 `recordPlay`（循环不重复写播放历史，与「一次收听一条记录」语义一致）
- 不扩 `IAudioCore` 接口 → `player-core.test.ts` 的 `FakeAudio` 无需改动

### 3.5 设置项

| 落点 | 改动 |
|---|---|
| `src/shared/types/settings.ts` | `PlayerSettings` 加 `audioCacheLimitMB: number` |
| `src/shared/constants/player.ts` | `DEFAULTS_PLAYER` 加 `audioCacheLimitMB: 2048`（2GB ≈ 200 首 320k / 500 首 128k） |
| `src/app/bootstrap.ts` | `settingsService.load()` 之后调 `AudioCacheService.applyLimitFromSettings()` |
| `src/shared/services/SettingsService.ts` | **无需改**（`player` 整体透传，新字段自动持久化，老用户 merge 默认值） |
| `src/features/settings/settings-actions-service.ts` | 加 `getAudioCacheStats()` / `clearAudioCache()`（转调 `AudioCacheService`，同层互调合法） |
| `src/features/settings/hooks/useSettingsViewModel.ts` | 加 `audioCacheStats` 状态（进入设置页时拉一次）+ `handleClearAudioCache`（清完刷新） |
| `src/features/settings/SettingsPage.tsx` | 「播放」卡加一行「音频缓存上限」（`Select`：关闭 / 512MB / 1GB / 2GB / 4GB / 8GB）；「缓存」卡拆两段：**音频缓存**（已用 `X MB / 上限 Y MB` + 清除按钮）、**数据缓存**（保留现有 plugin-cache 项）；建议加一行小字「音频缓存位于 %LOCALAPPDATA%\\com.kongbai.yueeasy\\cache」 |

设置值语义：`0` = 关闭（不读不写、可清空）；改动后立即 `setLimit` → 缩小时 Rust 侧同步 trim。

### 3.6 类型

`src/shared/types/uiModels.ts` 加：

```ts
export interface AudioCacheStats { count: number; totalBytes: number }
```

（与 Rust `AudioCacheStats` 的 camelCase 序列化一一对应。）

---

## 4. 关键失败路径（必须覆盖）

| 场景 | 期望行为 |
|---|---|
| 本地命中但文件损坏/半截 | `audio` 报 error → 现有 `handleAudioError` → `invalidateUrl` 顺手删文件 + 重解析远端 URL（一次重试后仍失败则跳过该曲） |
| 后台下载失败 / 超时 | 只记日志；播放在网络上照常进行；下次播放重试 |
| 下载中用户已切歌 | 不中断（数据量不大），落盘完成即可 |
| 超限淘汰命中正在播的那首 | 120s mtime 豁免兜住；即使被删，`<audio>` 已把数据读进缓冲，不中断当前播放 |
| 关闭缓存（0） | `get` 直接返回 null、`store` 直接返回；已缓存文件保留，用户可手动清除 |
| 音质切换后旧文件占坑 | 文件名含 level；将来接音质设置时换 key 即可，不冲突 |
| 磁盘满 / 无写权限 | `store` 返回 Err → 只 log；不影响播放 |

---

## 5. 实施顺序（建议逐个提交）

1. **P0 Rust 底座**：`paths` + `storage/audio_cache.rs` + 单测（`cargo test`）
2. **P1 Rust 编排 + IPC**：`service/audio_cache.rs` + `commands/audio_cache.rs` + `lib.rs` 注册 + `assetProtocol` 配置 → `cargo check`
3. **P2 前端接入读取**：`tauri/audioCache.ts` + `AudioCacheService` + `PlayerService.resolveTrackUrl` 三级解析（此时只"读"，不写）→ 手工验证：手动放一个 mp3 进缓存目录能被播
4. **P3 落盘**：`requestCache` 接入 + `invalidate` 联动 + `applyLimitFromSettings`
5. **P4 设置项与 UI**：settings 类型/默认值/VM/页面 + 清空
6. **P5 T1 循环优化**：`replayCurrent`
7. **P6 验收 + 文档**：本文件状态改「已实施」，AGENTS.md 补一行音频缓存归属

---

## 6. 验收清单

**命令**

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm lint
cd src-tauri && cargo test && cargo check
```

**手工用例**

1. 首次播放 A → 观察 `%LOCALAPPDATA%\com.kongbai.yueeasy\cache\audio\` 出现 `A-default.mp3`；日志无错误
2. 切到 B 再切回 A → DevTools Network 中**无** `resolve_play_url` 相关 IPC、无 CDN 请求（走 asset 协议）
3. 断网播放已缓存 A → 正常出声；未缓存的 B → 原有失败提示链路不回归
4. 单曲循环 → 每轮**不再出现** loading 状态闪烁 / 起播空隙
5. 上限设为 512MB 后再连播若干首 → 目录总大小 ≤ 512MB，最老文件被淘汰，**当前播放文件未被删**
6. 上限设为「关闭」→ 不再新增文件；清除按钮可清空
7. 启动（含重启）后设置页「音频缓存」显示已用/上限正确
8. 登录/换音质后行为不变（level 目前恒 null）

**分层自查**（AGENTS §10）

```bash
rg "audioCache|asset" src --glob "*.tsx" -l        # 不应出现（UI 只经 viewmodel/service）
rg "invoke\(" src/features --glob "*.ts" -l        # 只应出现在 services/*
```

---

## 7. 风险与回退

| 风险 | 缓解 |
|---|---|
| `assetProtocol` 在某些环境不可用 / 路径 scope 不匹配 | Plan B：Rust 加 `audio_cache_read_bytes` → 前端 `Blob` → `URL.createObjectURL`（内存换兼容；播放结束 `revokeObjectURL`）。做成 `AudioCacheService.localUrl` 内部实现细节，上层无感 |
| 首次播放 2x 流量被用户投诉 | 设置页文案说明「首次播放会缓存该曲」；可选优化：`audioCacheLimitMB=0` 关闭 |
| LRU 扫描在超大目录下慢（数万文件） | 单次扫描上限 20k 条，超出直接拒绝新增并 log；实际 2GB 上限最多几千首 |
| Rust `reqwest` 未启 TLS feature | 依赖图里 `ncm-api-rs` 已启用（features 取并集）；若 `cargo check` 报 TLS 缺失，在 `Cargo.toml` 显式加 `features = ["rustls-tls"]` |

---

## 8. 实施记录（与计划的差异）

已落地文件：

- Rust：`storage/paths.rs`（`cache_dir` / `audio_cache_dir`）、`storage/audio_cache.rs`（+12 项单测）、`service/audio_cache.rs`（+4 项单测）、`commands/audio_cache.rs`、`lib.rs`（manage + 8 条命令）、`tauri.conf.json`（`assetProtocol`）
- 前端：`src/tauri/audioCache.ts`、`features/player/services/AudioCacheService.ts`、`PlayerService.ts`（三级解析 + `invalidate` 联动 + `replayCurrent`）、`shared/types/{uiModels,settings}.ts`、`shared/constants/player.ts`、`features/settings/{settings-actions-service.ts,hooks/useSettingsViewModel.ts,SettingsPage.tsx}`

相对计划的补充 / 调整：

1. **多了 `audio_cache_dir` 命令**：设置页把真实缓存路径作为副标题展示（`%LOCALAPPDATA%\com.kongbai.yueeasy\cache\audio`）。
2. **Rust 下载并发上限 2**（`tokio::sync::Semaphore`）：预取 + 快速切歌会同时触发多首，避免抢带宽。
3. **删除中墓碑**：`AudioCacheService.invalidate` 维护 `removing` 集合，删文件的异步 IPC 期间不让 `localUrl` 命中同一个坏文件（消除「删/读」竞态）。
4. **T1 未改 `IAudioCore`**：复用既有 `seek(0)` + `player.play()`，`player-core.test.ts` 的 `FakeAudio` 无需改动。
5. **设置页统计用 `useEffectOnActive` 刷新**：设置页是 KeepAlive 页，只在首次挂载拉一次会显示出陈旧占用。
6. `trim()` 顺带清理超期残留 `.part`；`store()` 换扩展名时删除同 key 的孤儿文件。

待人工验证（需真实网络 / 音频）：验收清单 §6 的第 1~7 条（首次落盘、断网播放、循环无空隙、淘汰不吃正在播的那首）。

