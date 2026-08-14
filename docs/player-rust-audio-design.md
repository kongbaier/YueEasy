# 播放器音频层迁移 Rust 设计

> 状态：Phase 1-3 完成（2026-08-13）。Spike 验证 + `infra/audio/engine.rs` + `cmd/player.rs` 编排接线已落地；
> Phase 4（前端退役）已基本完成（AudioCore/PlayerService 物理删除）。本文是 `player-rust-design.md` 的续篇，
> 聚焦「音频播放」从 WebView 迁入 Rust。
> 前置结论：队列/策略/FM 已在 Rust（`core/engine.rs` + `core/strategy.rs`，1370 行 + 62 测试），保持不变。

## 1. 目的与背景

### 1.1 现状痛点

当前播放器是「双端分裂」架构：

| 权威 | 位置 | 内容 |
|---|---|---|
| 音频播放 | 前端 WebView `lib/audio/AudioCore.ts` | HTMLAudioElement + Web Audio，播放/暂停/进度/ended 真实状态 |
| 队列/导航/策略 | Rust `PlayerEngine` | Sequential/LoopAll/LoopOne/Shuffle/Fm |
| URL 解析 / FM 取歌 / 持久化 / 媒体键 | Rust | `NcmService` / SQLite / `platform::media_session` |

分裂带来的问题：

- **状态双份**：同一「当前曲目」有 Rust 权威 + 前端 `playerMirror` 镜像，靠 `player:event` 事件流同步。
- **切歌跨 IPC**：前端点 next → invoke `play_next` → Rust 决策 + 取 URL → 返回 → 前端 load+play，链路长、逻辑散落在 `PlayerService`/`queue` store/`advance_once` 三处。
- **双套策略实现**：Rust `strategy.rs` 与前端 `lib/core/strategy.ts` 功能重复（后者为探索原型，未接线）。
- **进度 60fps**：前端 `requestAnimationFrame` 自推，与 Rust 无统一。

### 1.2 迁移目标

- **播放器状态单一权威在 Rust**：队列、策略、FM、音频、持久化、媒体键全部收拢到后端。
- **前端退化为纯 UI**：只发命令（invoke）+ 订阅事件（`player:event`）+ 本地进度插值。
- **为未来后台播放 / 锁屏控制 / 进程级音频预留能力**（音频脱离 WebView 是前置条件）。

## 2. 决策结论

三方案对比后选定 **方案 2：全迁 Rust**。

| 方案 | 结论 |
|---|---|
| 1. 播放系统全迁前端 lib | 否。FM 取歌、URL 解析、持久化、媒体键仍必须走 Rust，「状态单一」是伪优势，且放弃 Rust 62 测试。 |
| 2. **全迁 Rust（含音频）** | **采用**。满足「统一」诉求 + 未来后台播放需求。 |
| 3. 保持双端 | 否。即现状痛点。 |

## 3. 技术选型

### 3.1 采用

| 职责 | 库 | 版本 | 理由 |
|---|---|---|---|
| HTTP 流下载 + 临时缓存 + seek | `stream-download` | 0.24 | 输出 `Read+Seek` 源，分块落临时文件（内存恒定），下载未完成时 seek 自动 range 重请求 |
| 解码 mp3/flac/aac/alac | rodio 内置 symphonia backend | 0.22 `symphonia-all` | `Decoder::try_from(reader)` 直接吃 `Read+Seek` |
| 输出/队列/暂停/音量/seek | `rodio` `Sink` | 0.22 | `append/play/pause/stop/set_volume/try_seek/get_pos/len` |
| 取消/并发 | tokio（已有） | — | `StreamDownload` 的 `StreamHandle` |

### 3.2 排除 kithara

`kithara`（zvuk）是一站式流媒体引擎，但 **不采用**：

- `0.0.1-alpha4`，官方要求 "Pin exact versions for production use"，每次 release 都在架构重写。
- facade crate 仅 95 次下载 / 0 dependents，社区验证为零。
- 功能过剩（HLS/ABR/DRM/EQ/crossfade/iOS AudioToolbox），引入 Firewheel + rubato(SoXR) 等重依赖。
- 平台重心在 iOS/macOS + WASM，非 Windows 桌面。

仅当未来需要 iOS 版 / HLS / gapless 混音时才重新评估。

### 3.3 复用 vs 自研

- **复用（现成库）**：HTTP 下载、临时缓存、seek、解码、音频输出、取消。
- **自研（薄封装，~200-300 行）**：`AudioEngine`（组合 + 状态机 + 事件 + 竞态防护 + 生命周期）+ `player_service` 编排。

## 4. 目标架构

```
Rust（播放器唯一权威）
├─ core/engine.rs + strategy.rs    # 队列/策略/FM 纯逻辑（已有，不动）
├─ infra/audio/engine.rs           # AudioEngine：stream-download + rodio 封装（新增）
├─ service/player_service.rs       # 编排：engine + audio + URL 解析 + 推荐钩子（新增）
├─ state.rs                        # 扩展：+ AudioEngine 句柄 + 播放状态/进度/ended 事件
└─ cmd/player.rs                   # 薄壳命令（改造：去掉队列决策，保留取数/seek/SMTC）

前端（纯 UI）
├─ 命令层：invoke（play/next/prev/seek/...）
├─ 事件订阅：player:event（status/position/track/queue/...）
└─ 进度插值：rAF 本地平滑 + 事件校准
```

### 4.1 TS lib/core → Rust 映射（实现思路对齐）

| 前端 `lib/core` | Rust | 动作 |
|---|---|---|
| `strategy.ts`（4 策略） | `core/strategy.rs`（5 策略含 Fm） | 已有 |
| `queue.ts` + `QueueFeeder` | `core/engine.rs` + 推荐钩子 | 已有队列；推荐取数在 `player_service` 的 End 分支 |
| `audio.ts` `AudioCore` | `infra/audio/engine.rs` | 新增 |
| `machine.ts`（xstate） | `enum AudioStatus` + 转换方法 | 新增（无第三方） |
| 预留 `#context/#analyser/#gain` | symphonia PCM 输出 + 未来 FFT/EQ | 预留，暂不接线 |

## 5. 音频引擎设计

```rust
enum AudioStatus { Idle, Loading, Playing, Paused, Ended, Error }

struct AudioEngine {
    output_handle: OutputStreamHandle,
    sink: Sink,                    // 队列播放 + 暂停/音量/seek
    status: AudioStatus,
    load_seq: u64,                 // 快速切歌竞态防护
    // 预留：volume / eq / spectrum（对应 #gain / #analyser，暂不接线）
}
```

事件（经 `player:event` 推前端）：`statuschange` / `timeupdate` / `durationchange` / `ended` / `error`。

## 6. 内存与缓存清理模型

- **内存**：`stream-download` 用 `TempStorageProvider` 落临时文件（磁盘），内存恒定（库内部分块）；解码走 `Read+Seek` 不整载入。峰值 < 10MB，与文件大小解耦。
- **清理触发点**：
  1. 切歌：drop `StreamDownload` + `Decoder` + `Sink.clear()` → 临时文件自动删；`load_seq` 防竞态；`StreamHandle` 取消下载。
  2. stop / 退出：释放 `Sink` + `OutputStream`（`AudioEngine::shutdown`）。
  3. 兜底：tempfile 进程退出清理。
- **缓存策略（会话内临时，推荐）**：切歌即清、跨会话不保留。理由：NCM `song_url` 有时效，持久缓存收益低，且最符合「保证清理」诉求。

## 7. 进度同步

Rust 周期推粗粒度 position 事件（~250ms）+ 前端 `requestAnimationFrame` 本地插值 + 事件校准（沿用现有 `useCurrentTimeHigh` 思路），避免 60fps IPC 洪泛。

## 8. 分阶段执行

1. **Spike（最高风险，先行）**：加 `rodio`(`symphonia-all`) + `stream-download` 依赖，最小 demo 验证——NCM URL 下载 → 解码 → 播放 → `try_seek` 精确 → drop 后内存回落 + 临时文件清理。
2. **音频引擎**：`infra/audio/engine.rs`（`AudioEngine` + `AudioStatus` + 事件 + 竞态 + shutdown）。
3. **编排 + 状态权威迁移**：`service/player_service.rs`；`playing`/`position` 权威移 Rust；扩展 `state.rs` 事件与快照；推荐钩子（End 分支取歌→append→重试）。
4. **前端退役**：删 `lib/audio/AudioCore.ts`、`PlayerService.ts`、`queue.ts`、`playerMirror.ts`、`lib/core/*`；UI 只留命令 + 事件订阅 + 进度插值。
5. **回归**：`cargo check` + 全量 `tsc`/`oxlint` + 手动验证四策略/FM/推荐/重启恢复/媒体键/SMTC/缓存清理。

## 9. 风险与验证点（Spike 必须确认）

1. **NCM 流可解码性**：symphonia 能否解 NCM 返回的 mp3/flac/aac（无 DRM 则通）——**全迁成败前提**。
2. **seek 精度**：mp3 coarse seek 帧边界体验。
3. **内存回落**：切歌后 decoder/source 及时 drop、内存稳定。
4. 平台后端：Windows WASAPI 无虞；Linux 需 ALSA。

## 10. 待确认事项

- [x] 缓存策略：会话内临时（推荐）。
- [x] 批准从 Phase 1 Spike 开始。

---

## 附录 A：Phase 1-3 落地注记（2026-08-13）

### 一句话

音频播放权威从前端 AudioCore 迁入 Rust：`infra/audio/engine.rs`（rodio + stream-download）为真实执行者，
`cmd/player.rs` 在 Rust 侧完成「URL 解析 → 下载解码 → 加载播放」全链路，前端退化为「invoke 命令 + 事件订阅 + rAF 进度插值」。

### 文件清单

- **新建 `infra/audio/{mod,engine}.rs`**：`AudioEngine`（MixerDeviceSink + Player）——play/pause/seek/set_volume/get_pos/duration/status/load_seq 竞态防护；`prepare_source`（async 下载 → spawn_blocking 解码）
- **新建 `examples/spike_audio.rs`**：Phase 1 Spike，验证下载/解码/seek/清理（`cargo run --example spike_audio -- <url>`）
- **修改 `state.rs`**：`PlayerState` + `audio: Arc<Mutex<AudioEngine>>`；`PlayerEvent` 移除 `SeekTo`、新增 `StatusChanged { playing }`
- **修改 `cmd/player.rs`**：所有播放命令（play_track/replace_and_play/play_queue_at/play_next/play_prev/advance_once/set_content_source/restore_playback）在 Rust 侧 `prepare_and_load`；新增 `play`/`pause`/`set_volume`/`get_position`/`restore_playback` 命令；新增 `start_ended_watcher`（500ms 轮询 ended 自动推进）
- **修改 `lib.rs`**：setup 期启动 `start_ended_watcher`；注册新命令 + `cmd::like::*`
- **新建 `cmd/like.rs`**：点赞权威迁移 Rust（`LikeState.liked_ids` + `like_init`/`like_toggle`/`like_get_ids` + `liked-ids-changed`/`liked-toggled` 事件）
- **前端删除**：`shared/lib/audio/AudioCore.ts`（289 行）、`modules/player/services/PlayerService.ts`（280 行）、旧 `shared/hooks/usePlayerEvents.ts`
- **前端新建**：`modules/player/hooks/usePlaybackClock.ts`（rAF 插值 + 500ms invoke `get_position` 校准）、`modules/player/hooks/usePlayerEvents.ts`（事件同步 status/queue/track 到 MirrorStore + usePlayerStore）
- **前端修改**：`usePlayer.ts`（togglePlay/seek/setVolume/setMuted 走 invoke）、`queue.ts` store（rustInvoke 命令层）、`bootstrap.ts`（restore_playback + 启动下发音量）、`stores/like.ts`（镜像 + 乐观更新 + 事件校正 + like_init self-init）

### 与设计 §4-7 的偏离

| # | 设计 | 落地 | 原因 |
|---|---|---|---|
| 1 | 播放命令返回 `PlayUrlInfo`（前端 load URL） | 播放命令返回 `()`，Rust 内部完成下载+加载 | 音频权威在 Rust 后，URL 不再需要出 Rust；`resolve_play_url` 保留供预加载 |
| 2 | 进度：Rust 周期推 position 事件（~250ms） | 前端 `usePlaybackClock` rAF 插值 + 500ms `get_position` 校准 | 校准式拉取比推送更简单，避免事件洪泛；沿用 `useCurrentTimeHigh` 思路 |
| 3 | ended 由 rodio 事件驱动 | `start_ended_watcher` 500ms 轮询 `pos >= duration` 判定 | rodio 无可靠 ended 回调；500ms 轮询延迟可接受且实现最简 |
| 4 | `duration` 从解码 source 读 | 从 `QueueItem.duration_secs`（NCM 元数据）读 | 避免同步解码阻塞；元数据本就准确 |
| 5 | `player:seek-to` 事件 | 删除（seek 命令同步 SMTC 位置即可，前端无需响应） | 前端 seek 是唯一入口，无 SMTC 回传路径需要事件 |
| 6 | 点赞迁移与音频迁移同批实施 | `cmd/like.rs` + `LikeState` | 同属「前端退役、Rust 权威」批量迁移，事件协议独立（`liked-*` 前缀，不走 `player:event`） |
| 7 | 播放/暂停状态 | `player:status-changed` 事件（playing: bool）驱动 usePlayerStore | 取代前端 audio 事件权威；Rust `AudioStatus` 为唯一真源 |

### 验证

- `cargo check`：零错误零警告
- `cargo test`：65/65 全绿（引擎测试 62 + 新增 3）
- `pnpm exec tsc --noEmit`：零错误
- `pnpm lint`（oxlint）：通过
- 全库 grep AudioCore/PlayerService（运行时引用）：仅 entities.ts 注释残留，已修正

### 后续修订（2026-08-13，Phase 5 回归阶段）

- **修复崩溃续播回归**：前端退役 `report_position` 上报后，`last_position/last_playing` 恒 0/恒 false，`restore_playback` 重启恢复失效。改为 `start_ended_watcher` 自持位置持久化（500ms 轮询内节流：每 10 tick ≈5s 或位移 ≥1s 写一次引擎快照 + SQLite）；`advance_once` End 分支补 `persist_snapshot`（队列耗尽落盘 playing=false）
- **删除死代码命令**：`report_position`（前端零调用，位置持久化已由 watcher 取代）、`decide_after_end`（ended 检测已由 watcher 内部调用 `advance_once`，前端不再触发）
- 查询类命令 `resolve_play_url` / `get_player_snapshot` / `get_queue` 前端当前零调用，作为设计契约（预加载 / 重载恢复）保留，未删

### 未做（明确取舍）

- **Phase 4 残留清理**：~~`report_position` 命令保留（兼容旧调用）~~ → **已删除**（2026-08-13 后续修订）：前端零调用即为死代码。位置持久化改由 `start_ended_watcher` 自持（每 10 tick ≈5s 或位移 ≥1s 节流写入引擎快照 + SQLite），修复了「前端退役上报后崩溃续播失效」的回归（原 `last_position/last_playing` 只由前端上报更新，恒 0/恒 false）。
- **`pnpm build` 全量构建**：受限沙箱下 Vite spawn 子进程被 EPERM 阻断（环境限制，非代码问题）；`tsc --noEmit` + `cargo check/test` 已覆盖类型与编译门禁。`pnpm vitest` 同样受此环境限制，未跑。
- **Rust 侧周期 position 推送**（设计 §7 的 250ms 推送）：以 `get_position` 拉取校准 + watcher 节流持久化替代，待 Phase 5 回归评估是否保留。

### 后续修订（2026-08-14，播放模式手动/自动入口拆分）

本文背景引用「`core/strategy.rs`（5 策略含 Fm，62 测试）」已过时：Fm 已剥离为内容来源（`docs/playmode-design.md`），导航策略拆分为 `manual_next`/`manual_prev`/`on_track_end` 三入口、`Advance` → `Step`（含 `ReplayCurrent`），测试 71 个。详见 `player-rust-design.md` 附录 I。
