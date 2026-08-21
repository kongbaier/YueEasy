# Tauri 2 网易云音乐播放器 Rust 架构设计

> **⚠️ 已过时（2026-08-21）**：audio + queue/navigation 已全迁前端（前端唯一权威）。
> 本文件描述的是「播放器全在 Rust」的历史设计，仅供参考。
> 现状见 [[player-frontend-migration]] 记忆；播放器实现在前端 `src/shared/lib/audio/AudioCore.ts` +
> `src/modules/player/core/*`（QueueEngine）+ `src/stores/player.ts`。Rust 只剩纯网络/platform。

> 规模前提：Rust 后端 ~3000 行，播放器引擎 ~400 行，单人维护。所有设计取舍以此为锚。
> 状态：Phase H 完成（2026-08-12）。Rust PlayerEngine + 前端 MirrorStore 全链路就绪。

---

## 1. Rust 侧最小分层

### 1.1 目录结构

```
src-tauri/src/
  lib.rs              # 组合根：Tauri setup + State 注册 + generate_handler
  state.rs            # Tauri State 类型定义与应用启动初始化

  core/
    mod.rs
    engine.rs         # PlayerEngine：播放器领域引擎（~1370 行，62 测试），纯逻辑、零 I/O
    types.rs          # 领域类型：PlayMode / FmState / AdvanceResult / QueueItem

  service/            # 服务层：ncm_service / cache_service / history_service，cmd 直接调用

  infra/
    mod.rs
    ncm.rs            # 网易云 API 客户端密封（HTTP + 加密 → 领域值对象）
    storage.rs        # 本地持久化（SQLite：队列、设置、播放历史）
    platform.rs       # 平台集成（Windows SMTC、托盘、窗口、系统强调色）

  cmd/
    mod.rs
    player.rs         # 播放控制命令（薄壳）
    query.rs          # 查询类命令（快照、URL 解析、队列查询）
```

### 1.2 层职责与依赖方向

依赖单向：`cmd → core`、`cmd → infra`、`core` 零外部依赖。

| 层        | 职责                                                                                                                     | 依赖                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **core**  | 播放器领域引擎：队列管理、播放模式决策、FM 状态机、当前曲目选择。**纯逻辑，零 I/O，零第三方类型**。                      | 无（仅 std）                              |
| **infra** | 密封第三方库与平台能力：NCM API（HTTP + 签名/加密）、SQLite 持久化、SMTC/托盘/窗口。只输出领域值对象，不泄露第三方类型。 | 外部 crate（reqwest/rusqlite/windows-rs） |
| **cmd**   | IPC 薄壳：`#[tauri::command]` 函数。接收参数，调用 core 方法 + infra 能力，推事件，返回结果。**不写业务逻辑**。          | core + infra + tauri                      |
| **state** | 组装并持有所有跨命令共享实例：`Arc<Mutex<PlayerEngine>>`、`Arc<NcmClient>` 等。                                          | core + infra                              |

### 1.3 为什么这个分层"恰好合适"

- `core` 是唯一的真分层——播放器决策逻辑需要可测试、可推理，零 I/O 保证这一点。**400 行放进一个文件即可，无需再拆**。
- `infra` 是务实的隔离——网易云 API 加密/签名逻辑不稳定，HTTP 库可能换，SMTC API 随 Windows SDK 变。密封在一个模块里，换实现只改一处。
- `cmd` 是 Tauri 的硬需求——`#[command]` 函数签名是框架约定的。薄到只做参数→调用→返回即为最优。
- `state` 不是分层，是组合根——Tauri 用 `manage()` 注入，属于框架机制，与架构无关。

### 1.4 否决的重方案

| 否决方案                           | 理由                                                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DDD（领域/应用/基础设施/接口四层） | 400 行引擎不需要聚合根、值对象、Repository trait。概念密度远低于 DDD 收益线。                                                                                                                                                          |
| `use_case` 编排层                  | Phase A 否决；Phase H 实施后验证：cmd 直连 service 无任何编排缺口，FM 取歌 4 行 match 确实够用。                                                                                                                                       |
| `service` 层                       | Phase A 否决 pass-through 死壳；Phase H 落地后验证：service 非空壳——ncm_service 含 song_to_queue_item 等归一逻辑，cmd 直接调用，抽象成立。                                                                                             |
| Repository trait + 多实现          | 只有一个存储后端（SQLite），trait 抽象今天不产生任何多态价值。如果将来换存储后端（极低概率），届时再抽 trait——YAGNI。                                                                                                                  |
| 策略模式（PlayMode trait）         | 早期否决；2026-08-13 重构后**采用**：导航逻辑收敛为 `core/strategy.rs` 的 `PlayStrategy` trait + 5 个策略实现（Sequential/LoopAll/LoopOne/Shuffle/Fm），统一 next/prev，消除了散落的 mode 匹配与 AdvanceResult/AfterEndAction 双枚举。 |

---

## 2. 播放器领域引擎设计

### 2.1 引擎状态

```rust
pub struct PlayerEngine {
    // === 对外可见状态 ===
    queue: Vec<QueueItem>,          // 完整队列
    current_index: Option<usize>,   // 指向 queue 的当前位置
    mode: PlayMode,
    fm: FmState,

    // === 内部状态（不对外暴露） ===
    shuffle_order: Vec<usize>,      // 随机模式下的索引序列
    shuffle_pos: usize,             // 当前在 shuffle_order 中的位置
    fm_saved: Option<SavedContext>, // FM 进入前保存的原队列上下文
}

struct SavedContext {
    queue: Vec<QueueItem>,
    index: Option<usize>,
    mode: PlayMode,
}
```

### 2.2 领域类型

```rust
pub struct QueueItem {
    pub track_id: u64,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover_url: String,
    pub duration_secs: f64,
}

pub enum PlayMode {
    Sequential,  // 顺序
    LoopOne,     // 单曲循环
    Shuffle,     // 随机
}

pub enum FmState {
    Idle,
    Active {
        current_track: QueueItem,
        played_ids: Vec<u64>,  // 服务端上报用
    },
}

pub enum AdvanceResult {
    PlayTrack(usize),   // 已推进，播 queue[idx]
    NeedFmTrack,        // FM 模式，需从服务端取歌
    EndOfQueue,         // 队列已尽
}
```

### 2.3 对外方法集（收敛到最简）

```rust
impl PlayerEngine {
    // ── 播放控制（返回当前曲目信息供 cmd 层使用） ──

    /// 播放指定曲目，替换当前播放上下文。返回刚设置的曲目引用。
    pub fn play_track(&mut self, track: QueueItem) -> &QueueItem;

    /// 替换整个队列并从指定位置播放（对齐 TS replaceAndPlay，Phase C 评审门新增）。
    /// 退出 FM 并丢弃快照；空队列返回 None；start_index 越界钳制到末尾。
    pub fn replace_play(&mut self, tracks: Vec<QueueItem>, start_index: Option<usize>) -> Option<&QueueItem>;

    /// 从队列指定位置播放。越界返回 None。FM 激活时先退出 FM。
    pub fn play_queue_at(&mut self, index: usize) -> Option<&QueueItem>;

    /// 下一首（根据 mode 决策）。FM 模式下返回 NeedFmTrack。
    pub fn next(&mut self) -> AdvanceResult;

    /// 上一首。无历史时返回 None。FM 模式下不支持。
    pub fn prev(&mut self) -> Option<&QueueItem>;

    /// 曲目自然播放结束。语义同 next，但可能受 LoopOne 影响。
    pub fn on_track_end(&mut self) -> AdvanceResult;

    // ── 队列操作 ──

    /// 追加到队尾。FM 激活时自动退出 FM（恢复快照）后追加（Phase B 评审门决策④）。
    pub fn append(&mut self, tracks: Vec<QueueItem>);
    pub fn insert_next(&mut self, track: QueueItem);   // 插入当前曲目之后
    /// 移除指定位置。FM 激活时先退出 FM（恢复快照）再按恢复后的队列移除（Phase C 评审门）。
    pub fn remove_at(&mut self, index: usize);
    pub fn clear(&mut self);
    pub fn shuffle(&mut self);   // 重建随机序列

    // ── 模式 ──

    pub fn set_mode(&mut self, mode: PlayMode);

    // ── FM ──

    /// 进入 FM。保存当前队列上下文，设置初始曲目。
    pub fn enter_fm(&mut self, initial_track: QueueItem);

    /// 退出 FM。恢复原队列上下文。返回恢复后的当前曲目（可能为 None）。
    pub fn exit_fm(&mut self) -> Option<&QueueItem>;

    /// FM 切歌时，cmd 层从服务端获取曲目后调用此方法设置。
    pub fn set_fm_track(&mut self, track: QueueItem);

    /// 记录当前 FM 曲目已播放（加入 played_ids）。
    pub fn fm_record_played(&mut self);

    // ── 只读查询 ──

    pub fn current_track(&self) -> Option<&QueueItem>;
    pub fn current_index(&self) -> Option<usize>;
    pub fn queue_items(&self) -> &[QueueItem];
    pub fn mode(&self) -> PlayMode;
    pub fn is_fm_active(&self) -> bool;
    pub fn snapshot(&self) -> PlayerSnapshot;
}
```

**方法集收敛原则**：

- 不提供通用的 `set_current_index`、"set 任意字段" 命令——引擎封装决策逻辑，外部只发意图（play/next/append）。
- `enter_fm` / `exit_fm` 承担了上下文保存/恢复的全部责任，调用方不需要知道 SavedContext 的存在。
- `AdvanceResult::NeedFmTrack` 把 FM 的异步依赖变成引擎的声明式输出，cmd 层据此做 I/O。

### 2.4 PlayMode：策略模式（`core/strategy.rs`）

> **2026-08-14 修订（最新）**：本节（2026-08-13 策略模式）随后又经两轮重构——①正交化：FM 从策略剥离为内容来源（`docs/playmode-design.md`）；②手动/自动入口拆分：`next` 拆为 `manual_next`/`on_track_end`，`Advance` → `Step{Play,ReplayCurrent,End}`，LoopOne 手动切歌切走、自然结束重播当前；删除 `reshuffle` 与 `engine.shuffle()`。详见本文件附录 I。

> **2026-08-13 重构**：本节早期采用「枚举 + match」，后因 next/prev/on_track_end 四处 match + AdvanceResult/AfterEndAction 双枚举过于复杂，改为策略模式。
> 每个 PlayMode（Sequential/LoopAll/LoopOne/Shuffle）及 FM 各一个 `PlayStrategy` 实现，统一提供
> `next(current, len) -> Advance`（Play(idx) / End / FetchFm）与 `prev(current, len) -> Option<usize>`；
> 手动切歌与「曲目自然结束」共用同一计算（Sequential 队尾停止、LoopAll 环绕、LoopOne 保持、Shuffle 前进）。
> Shuffle 持有自身排列状态（`order`/`pos`/`rng`），队列突变后经 `on_queue_changed` 重建并锚定当前曲目。

```rust
// core/strategy.rs 内部实现（示意）
pub trait PlayStrategy: Send + Sync {
    fn next(&mut self, current: Option<usize>, len: usize) -> Advance;
    fn prev(&mut self, current: Option<usize>, len: usize) -> Option<usize>;
    fn on_queue_changed(&mut self, current: Option<usize>, len: usize) {}
    fn is_fm(&self) -> bool { false }
}
```

```rust
// engine.rs 内部实现
fn compute_next_index(&self) -> Option<usize> {
    let Some(ci) = self.current_index else { return None };
    if self.queue.is_empty() { return None; }

    match self.mode {
        PlayMode::Sequential => {
            if ci + 1 < self.queue.len() { Some(ci + 1) } else { None }
        }
        PlayMode::LoopOne => {
            Some(ci) // 保持当前位置
        }
        PlayMode::Shuffle => {
            self.shuffle_pos += 1;
            if self.shuffle_pos >= self.shuffle_order.len() {
                self.shuffle_pos = 0;
                // 可选：重新洗牌
            }
            Some(self.shuffle_order[self.shuffle_pos])
        }
    }
}
```

**内部方法 `reshuffle()`**（Phase B 评审门补充）：所有会改变队列长度或 current_index 的突变方法（play_track / remove_at / append / insert_next / clear / set_fm_track）末尾调用；仅 Shuffle 模式下重建 `shuffle_order`，并以当前 `current_index` 为锚定位 `shuffle_pos`。修复 TS QueueManager 中"队列变更后 shuffle 序列失活 → 越界 undefined / 位置不同步"的缺陷（Rust 不复刻该 bug，决策①）。core 无外部依赖，随机源用内部小型 PRNG（xorshift），构造时可注入种子保证测试确定性。

**取舍理由**：

- 3 个分支，全部逻辑在 **15 行内**。局部性极好——一眼看到所有模式的行为。
- 策略 trait 方案：3 个 struct + trait 定义 + 动态分发 = 代码量翻倍，但行为完全等价。没有"将来要加 10 种模式"的需求（网易云就这 3 种）。
- 如果真有一天要加模式：加一个枚举变体 + 一个 match 分支 = 5 行。策略 trait 方案加一个 struct = 10+ 行。后者反而更重。

### 2.5 FM 状态机：枚举 + 内联迁移

```rust
impl PlayerEngine {
    pub fn enter_fm(&mut self, initial_track: QueueItem) {
        // 保存当前上下文
        self.fm_saved = Some(SavedContext {
            queue: std::mem::take(&mut self.queue),
            index: self.current_index,
            mode: self.mode,
        });
        self.current_index = Some(0);
        self.queue = vec![initial_track.clone()];
        self.fm = FmState::Active { current_track: initial_track, played_ids: vec![] };
    }

    pub fn exit_fm(&mut self) -> Option<&QueueItem> {
        if !self.is_fm_active() {
            return self.current_track(); // 守卫（决策②）：非 FM 状态调用为 no-op，不碰队列
        }
        self.fm = FmState::Idle;
        if let Some(ctx) = self.fm_saved.take() {
            self.queue = ctx.queue;
            self.current_index = ctx.index;
            self.mode = ctx.mode;
            self.reshuffle_if_needed();
            self.current_track()  // 返回恢复后的曲目
        } else {
            // FM 激活但无快照 → 进入 FM 前队列为空 → 清空是合理行为
            self.queue.clear();
            self.current_index = None;
            None
        }
    }
}
```

**如此简洁的理由**：

- FM 实质只有两个状态：开着 / 关着。不需要状态机框架（transition/guard/action）。
- 进入 = Idle → Active + 保存上下文。退出 = Active → Idle + 恢复上下文。切歌 = Active → Active（替换 current_track）。
- 所有逻辑在 `enter_fm` / `exit_fm` 方法中就地完成，迁移规则一目了然。

---

## 3. 状态管理

### 3.1 Tauri State 清单

```rust
// state.rs + lib.rs manage()

pub struct AppState {
    /// 播放器领域引擎 —— 所有播放命令共享同一实例
    pub engine: Arc<Mutex<PlayerEngine>>,

    /// 网易云 API 客户端 —— 无状态，仅持有 HTTP client + cookie jar
    pub ncm: Arc<NcmClient>,

    /// 本地持久化 —— 持有 SQLite 连接（连接池或单连接 + WAL）
    pub storage: Arc<Storage>,

    /// 跨模块配置 —— 多模块读写（设置页、播放器）
    pub app_config: Arc<RwLock<AppConfig>>,
}
```

**理由**：

- `engine`：所有播放命令必须操作同一个 `PlayerEngine` 实例。`Mutex` 因为所有 engine 方法都是 `&mut self` 同步方法，不跨 await。
- `ncm` / `storage`：内部无运行时可变状态（HTTP client 和 SQLite 连接自身线程安全），`Arc` 共享即可，无需锁。
- `app_config`：多个 reader（设置页、播放器音量），少数 writer（设置保存），`RwLock` 适合多读单写。

### 3.2 引擎内部保留（不直接暴露）

- `shuffle_order` / `shuffle_pos`：随机序列是纯内部实现，外部只能通过 `next()` 间接消费。暴露没有意义且增加维护负担。
- `fm_saved`：SavedContext 是 enter/exit 的私有实现细节。外部通过 `is_fm_active()` 查询、`enter_fm` / `exit_fm` 操作，不需要知道上下文如何保存。

### 3.3 锁纪律——最小化死锁风险

**核心铁律：不在持有 Mutex 锁的闭包内执行任何 `.await`。**

```rust
// ✅ 正确模式
#[tauri::command]
async fn advance_on_end(state: State<'_, AppState>) -> Result<PlayUrlInfo, String> {
    let advance = {
        let mut engine = state.engine.lock().unwrap();
        engine.on_track_end()
    }; // ← 锁在此释放

    match advance {
        AdvanceResult::NeedFmTrack => {
            let track = state.ncm.fetch_fm_track().await?;  // ← await 在锁外
            let mut engine = state.engine.lock().unwrap();
            engine.set_fm_track(track);
            // ...
        }
        AdvanceResult::PlayTrack(idx) => {
            let track = {
                let engine = state.engine.lock().unwrap();
                engine.queue_items()[idx].clone()
            }; // lock released
            let url = state.ncm.resolve_url(&track).await?;
            Ok(PlayUrlInfo { track, url })
        }
        AdvanceResult::EndOfQueue => Err("queue ended".into()),
    }
}
```

**几条纪律保证安全**：

1. Engine 方法全部是 `&mut self` 同步方法——`.await` 不可能出现在 engine 内部。
2. Lock → clone 数据 → drop lock → await。lock 生命期严格控制在同步代码块内。
3. 本项目只有一个 `Mutex<PlayerEngine>`，不存在嵌套锁（Rust 的 Mutex 不可重入也不会自行检测循环，但单锁场景零风险）。
4. `RwLock<AppConfig>` 同理：`read()` → clone → drop → await。

静态检查：`rg '\.lock\(.*\).*\.await' src-tauri/` 加入 CI，命中则阻断。

---

## 4. IPC 契约

### 4.1 命令清单

**原则：每条命令是"用户意图"的语义表述，不是"设置引擎字段"的状态镜像命令。**

#### 播放控制命令

| 命令名             | 参数                                                 | 返回          | 语义                                                              |
| ------------------ | ---------------------------------------------------- | ------------- | ----------------------------------------------------------------- |
| `play_track`       | `track: QueueItem`                                   | `PlayUrlInfo` | 播放指定单曲，替换当前上下文                                      |
| `replace_and_play` | `tracks: Vec<QueueItem>, start_index: Option<usize>` | `PlayUrlInfo` | 替换整个队列并播放（Phase C 评审门新增，对齐前端 replaceAndPlay） |
| `play_queue_at`    | `index: usize`                                       | `PlayUrlInfo` | 从队列指定位置播放                                                |
| `play_next`        | —                                                    | `PlayUrlInfo` | 下一首                                                            |
| `play_prev`        | —                                                    | `PlayUrlInfo` | 上一首                                                            |
| `advance_on_end`   | —                                                    | `PlayUrlInfo` | 当前曲目自然结束时调用                                            |
| `set_play_mode`    | `mode: "sequential" \| "loop_one" \| "shuffle"`      | `()`          | 设置播放模式（事件推送）                                          |
| `seek`             | `position_secs: f64`                                 | `()`          | 跳转到指定位置（SMTC 回传）                                       |
| `report_position`  | `position_secs: f64, playing: bool`                  | `()`          | 前端周期上报位置/播放状态（持久化）                               |
| `enter_fm`         | —                                                    | `PlayUrlInfo` | 进入 FM 模式                                                      |
| `exit_fm`          | —                                                    | `PlayUrlInfo` | 退出 FM 模式                                                      |
| `fm_trash`         | —                                                    | `PlayUrlInfo` | FM 垃圾桶上报 + 推进下一首（Phase H 实现）                        |

#### 队列操作命令

| 命令名              | 参数                     | 返回 | 语义                       |
| ------------------- | ------------------------ | ---- | -------------------------- |
| `append_to_queue`   | `tracks: Vec<QueueItem>` | `()` | 追加到队尾（事件推送）     |
| `insert_next`       | `track: QueueItem`       | `()` | 插入当前曲目之后           |
| `remove_from_queue` | `index: usize`           | `()` | 移除指定位置               |
| `clear_queue`       | —                        | `()` | 清空队列                   |
| `shuffle_queue`     | —                        | `()` | 随机重排（事件推送全队列） |

#### 查询命令

| 命令名                  | 参数                             | 返回              | 语义                                     |
| ----------------------- | -------------------------------- | ----------------- | ---------------------------------------- |
| `resolve_play_url`      | `track_id: u64, quality: String` | `PlayUrlInfo`     | 解析播放 URL（预加载用）                 |
| `get_player_snapshot`   | —                                | `PlayerSnapshot`  | 全量快照（WebView 重载恢复）             |
| `get_full_player_state` | —                                | `FullPlayerState` | 启动恢复用全量快照 + 当前曲目（Phase F） |
| `get_queue`             | —                                | `Vec<QueueItem>`  | 获取完整队列（可选，通常用事件）         |

> **当前实现对照（2026-08-13 音频迁移后，与上表差异）**：
>
> - 播放命令（`play_track` / `replace_and_play` / `play_queue_at` / `play_next` / `play_prev`）返回 `()`，Rust 侧内部完成 URL 解析 + 音频加载；`advance_on_end` 已删（ended 由 `start_ended_watcher` 内部处理），`report_position` 已删（位置持久化由 watcher 节流自持）
> - `set_play_mode` → `set_iteration_strategy`（四策略 sequential/loop_all/loop_one/shuffle）；`enter_fm` / `exit_fm` → `set_content_source("queue" | "personal_fm")`
> - 新增：`play` / `pause` / `set_volume` / `get_position`（返回 `(position_secs, playing)`，进度校准用）/ `restore_playback`（启动恢复音频）
> - 事件 `player:seek-to` 已删，新增 `player:status-changed { playing }`；`player:mode-changed` / `player:fm-state-changed` → `player:iteration-strategy-changed` / `player:content-source-changed`
> - 完整现状见 `player-rust-audio-design.md` 附录 A

### 4.2 事件清单

统一前缀 `player:`，serde 枚举带 tag：

```rust
#[derive(Serialize)]
#[serde(tag = "event", content = "data")]
pub enum PlayerEvent {
    #[serde(rename = "player:track-changed")]
    TrackChanged { track: QueueItem },

    #[serde(rename = "player:queue-changed")]
    QueueChanged {
        items: Vec<QueueItem>,
        current_index: Option<usize>,
    },

    #[serde(rename = "player:mode-changed")]
    ModeChanged { mode: PlayMode },

    #[serde(rename = "player:fm-state-changed")]
    FmStateChanged { active: bool },

    #[serde(rename = "player:seek-to")]
    SeekTo { position_secs: f64 },  // SMTC seek 回传

    #[serde(rename = "player:queue-ended")]
    QueueEnded,
}
```

### 4.3 全量快照 vs 增量事件

| 事件               | 策略                              | 理由                                                                                                     |
| ------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `track-changed`    | **全量** QueueItem                | 单条数据，~200 字节。全量无脑，前端不做合并。                                                            |
| `queue-changed`    | **全量** 完整队列 + current_index | 队列 ≤ 1000 条，最坏 ~50KB。全量保证前后端一致，比增量推送 + 前端合并简单太多。去抖 100ms 避免操作风暴。 |
| `mode-changed`     | **增量** mode 字符串              | 同上。                                                                                                   |
| `fm-state-changed` | **增量** active: bool             | 同上。                                                                                                   |
| `seek-to`          | **增量** position_secs            | 单值。                                                                                                   |

### 4.4 command-response vs push-event 适用场景

| 场景                           | 机制                                         | 理由                                                   |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------ |
| 用户点击播放/切歌按钮          | **invoke → response**                        | 前端需要 URL 立刻设置 audio.src                        |
| 用户操作队列（追加/删除/重排） | **invoke → 无返回 + push event**             | 队列操作不需要即时返回结果；state 由事件广播到所有组件 |
| 曲目自然结束 → 自动切歌        | **invoke(`advance_on_end`) → response**      | 前端需要 URL 立刻设置 audio.src（无间断体验优先）      |
| SMTC 媒体键（下一首/上一首）   | Rust 内部 engine 调用 → **push event**       | 按键来自 OS，没有前端 invoke 对应方                    |
| SMTC seek                      | Rust 内部 → **push `seek-to`**               | 同上                                                   |
| WebView 重载恢复               | **invoke(`get_player_snapshot`) → response** | 前端初始化时需要一次性拉全量                           |

**关键设计决策**：`play_*` / `advance_on_end` 返回 `PlayUrlInfo`（track + resolved URL），而非只返回 track 让前端再调 resolve。这是 UX 驱动的选择——切歌时最小化"静默间隙"。`resolve_play_url` 作为独立命令保留，供预加载使用。

---

## 5. 前端消费设计

### 5.1 架构简化路径

```
现状：多个 Zustand store + TS 内部引擎逻辑 → 组件直接 import store/action
         ↓
目标：React 组件 → ViewModel hook → MirrorStore（Zustand）← 事件监听器 ← Rust Event
                            ↘ invoke() → Rust Command
```

**变化**：

- 去掉了 TS 侧的所有"播放引擎逻辑"（队列决策、模式切换、FM 状态机）。
- 去掉了多个分散的 Zustand store（player/queue/settings 等各自维护子集）。
- 新增：一个 `PlayerMirrorStore`（Zustand），纯粹镜像 Rust 状态。
- 新增：启动时注册一次事件监听器，所有 `player:*` 事件 → set MirrorStore。

### 5.2 MirrorStore 定义

```typescript
// stores/playerMirror.ts
interface PlayerMirrorState {
  currentTrack: QueueItem | null;
  playing: boolean;
  queue: QueueItem[];
  currentIndex: number | null;
  mode: 'sequential' | 'loop_one' | 'shuffle';
  fmActive: boolean;
}

// 启动时注册（app.tsx 或 layout 的 useEffect 一次）
listen<PlayerEvent>('player:track-changed', (e) =>
  usePlayerMirror.setState({ currentTrack: e.payload.track }),
);
listen<PlayerEvent>('player:queue-changed', (e) =>
  usePlayerMirror.setState({
    queue: e.payload.items,
    currentIndex: e.payload.current_index,
  }),
);
// ...
```

### 5.3 留在前端的职责（不走 IPC）

| 职责                           | 实现                                                                        | 理由                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **60fps 进度时钟**             | `rAF` + `HTMLAudioElement.currentTime`                                      | 16ms 间隔，IPC 无法承受                                                                                     |
| **拖动进度条**                 | `onPointerMove` 本地 state 更新 → `onPointerUp` invoke `seek(pos)`          | 松手才提交，中间帧纯本地                                                                                    |
| **乐观 UI**（点赞）            | invoke 前先 `setState`，事件到达时校正                                      | 消除 50-200ms 锁+网络延迟感知；播放/暂停不在此列——Phase H 后为前端权威（AudioCore 事件驱动 usePlayerStore） |
| **瞬时 UI**（hover/动画/弹窗） | React 本地 `useState` / CSS                                                 | 与领域状态无关                                                                                              |
| **Audio 元素管理**             | HTML5 `<audio>` ref，`src` 设为 `resolve_play_url` 结果，`play()`/`pause()` | Rust 无法输出音频                                                                                           |
| **主题/布局/窗口尺寸**         | Zustand 本地 store                                                          | 纯视觉，无领域含义                                                                                          |

### 5.4 ViewModel 门面保留

**保留 ViewModel 模式**——它仍然是组件和 stores 之间的隔离层（符合 AGENTS.md 分层铁律），只是变薄了：

```typescript
// modules/player/hooks/usePlayer.ts
export function usePlayer() {
  // 只读：从 MirrorStore 选择字段
  const currentTrack = usePlayerMirror(useShallow((s) => s.currentTrack));
  const playing = usePlayerMirror((s) => s.playing);

  // 写：封装 invoke 调用
  const playNext = useCallback(async () => {
    // 乐观更新（可选）
    const result = await invoke<PlayUrlInfo>('play_next');
    audioRef.current!.src = result.url;
    audioRef.current!.play();
  }, []);

  return useMemo(
    () => ({ currentTrack, playing, playNext }),
    [currentTrack, playing, playNext],
  );
}
```

组件层面不变：`import { usePlayer } from '@/modules/player/hooks'`，不知道下面是 Rust 还是 TS。

---

## 6. 边界总表

| 职责                       | Rust 拥有                     | React 保留                                       | 备注                                                                            |
| -------------------------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| 队列（增删改查）           | ✅ **权威**                   | 镜像只读                                         | 所有队列变更必须经 Rust                                                         |
| 当前曲目选择               | ✅ **决策**                   | 镜像显示                                         | Rust 根据模式/FM 决定播哪首                                                     |
| 播放模式                   | ✅ **权威**                   | 镜像显示                                         |                                                                                 |
| FM 状态                    | ✅ **权威 + 上下文保存/恢复** | 镜像显示                                         |                                                                                 |
| 播放/暂停状态              | **Rust 拥有 = 无**            | ✅ **权威**（AudioCore 事件驱动 usePlayerStore） | 前端权威；Rust 不发 PlayStateChanged 事件。用户点击本地 audioCore.toggle() 即真 |
| 播放进度（currentTime）    | ❌                            | ✅ rAF 本地时钟                                  | 高频，物理上不能走 IPC                                                          |
| 拖拽进度条                 | ❌                            | ✅ 本地拖拽 + 松手 invoke seek                   |                                                                                 |
| 音频输出（src/play/pause） | ❌                            | ✅ HTML5 Audio                                   | Rust 无此能力                                                                   |
| 播放 URL 解析              | ✅ API 调用 + 缓存            | ❌                                               | Rust 调 NCM API                                                                 |
| SMTC 媒体键接收            | ✅ OS → Rust engine           | ❌                                               | 不经 WebView                                                                    |
| SMTC 元数据更新            | ✅ Rust → OS                  | ❌                                               |                                                                                 |
| 点赞/喜欢                  | ✅ API 调用                   | ✅ 乐观 UI                                       | 前端先红心，事件校正                                                            |
| 评论数据                   | ✅ API 调用                   | ❌                                               |                                                                                 |
| 设置持久化                 | ✅ 读写 SQLite                | 镜像显示                                         |                                                                                 |
| 系统托盘                   | ✅ 管理                       | ❌                                               |                                                                                 |
| 窗口控制                   | ✅ 管理                       | ❌                                               |                                                                                 |
| UI 渲染                    | ❌                            | ✅ 100%                                          |                                                                                 |
| 主题/布局                  | ❌                            | ✅ 本地 store                                    |                                                                                 |
| 音效/DSP                   | ❌                            | ✅ Web Audio API                                 |                                                                                 |

> **加注（Phase H）**：Rust `PlayerState.playing`（AtomicBool）与 `toggle_play_pause` 命令均已删除——无任何组件需要 Rust 端播放/暂停权威。

---

## 7. 修正版自检测试

### 测试描述（可直接执行）

> **测试 A：崩溃续播**
>
> 1. 播放队列第 3 首（非尾），模式设为 Shuffle。
> 2. 模拟 WebView 崩溃：`window.location.reload()`。
> 3. 重载后前端调用 `invoke('get_player_snapshot')`。
> 4. 断言：
>    - `snapshot.current_index === 崩溃前的当前索引`
>    - `snapshot.queue` 长度与内容与崩溃前一致
>    - `snapshot.mode === 'shuffle'`
>    - `snapshot.fm_active === false`
> 5. 调用 `invoke('resolve_play_url', { trackId: snapshot.current_track.track_id })` → 设置 audio.src → 恢复播放。

> **测试 B：媒体键离线**
>
> 1. 最小化窗口（或断掉 WebView devtools 连接）。
> 2. 通过 SMTC 按"下一首"（键盘媒体键或系统媒体控件）。
> 3. 检查 Rust 日志：`[engine] track changed to: <new_track_id>`。
> 4. 恢复窗口，调用 `get_player_snapshot()`，断言 current_track 已变为下一首。

### 约束出的设计点

| 约束              | 设计落点                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 队列权威性在 Rust | `PlayerEngine.queue` 是唯一真实队列。崩溃不丢，前端只是镜像。                                                                  |
| SMTC → Rust 直连  | `infra/platform.rs` 中 SMTC 回调 → channel → 后台任务调 engine 方法。完全不经过前端 IPC。                                      |
| 全量快照命令      | `get_player_snapshot()` 返回 `PlayerSnapshot { queue, current_index, mode, fm_active }`。前端 init 时调用一次。                |
| URL 惰性解析      | 快照不包含 URL（有时效性），前端拿到 track_id 后调 `resolve_play_url`。                                                        |
| 进程级持久化      | 每次队列/模式/位置变化 → `storage.save_player_snapshot(snapshot)`。启动时 `storage.load()` → `PlayerEngine::from_snapshot()`。 |

---

## 8. 迁移路径

> **已全部完成（Phase H）。本节作为迁移历史保留。**

### 出发点（现状）

```
Current (TS owns engine logic):
  stores/player.ts  ← 播放逻辑（next/prev/模式/FM）
  stores/queue.ts   ← 队列操作
  services/playerService.ts  ← 封装 ncm API
  hooks/usePlayer.ts ← ViewModel 门面
  组件 → usePlayer → store.action / service

Target (Rust owns engine):
  Rust PlayerEngine (core/engine.rs)
  Rust cmd/player.rs (IPC)
  TS PlayerMirrorStore + 事件监听
  TS usePlayer → MirrorStore + invoke
```

### 步骤

| 步骤                 | 产出                                                                                                                                                    | 验证                                                   | 规模   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------ |
| **1. 行为锁定**      | 为 TS 侧播放逻辑写单元测试：覆盖各模式下的 next/prev/on_end、FM enter/exit/set_fm_track、append/insert/remove/shuffle/clear、边界（空队列、单曲、越界） | `pnpm vitest` 全绿                                     | 半天   |
| **2. Rust 引擎实现** | `core/engine.rs` + `#[test]`，行为与步骤 1 的 TS 测试完全对齐                                                                                           | `cargo test` 全绿                                      | 1-2 天 |
| **3. 持久化接入**    | `storage.rs` 中 `save_player_snapshot` / `load_player_snapshot`，引擎构造时从 SQLite 恢复                                                               | 手动：播到中间 → 重启应用 → 状态恢复                   | 半天   |
| **4. IPC 层实现**    | `cmd/player.rs` + `cmd/query.rs`。每个命令=获取锁→调 engine→释放锁→（可选 I/O）→返回/推事件                                                             | `cargo test` 集成测试（每个 command + 检查事件）       | 1 天   |
| **5. 前端镜像化**    | MirrorStore + 事件监听 + 给 `usePlayer` 加一个开关（读 MirrorStore vs 读旧 store）。先双写验证                                                          | 手动：操作播放器，观察 MirrorStore 状态与旧 store 一致 | 1 天   |
| **6. 逐组件替换**    | 改 `usePlayer` 内部实现指向 MirrorStore + invoke。每改一个页面，手动验证该页面所有功能                                                                  | 逐页验证                                               | 1-2 天 |
| **7. 旧代码清理**    | 删除 TS 侧 store 的引擎逻辑。保留 ViewModel hook（已指向新后端）                                                                                        | `tsc --noEmit` + 全流程 smoke                          | 半天   |
| **8. SMTC 接入**     | `infra/platform.rs` SMTC 回调 → engine 方法 + push event                                                                                                | 手动：按媒体键，看 UI 反应                             | 半天   |

**实际完成：迁移 + Rust 引擎 + 持久化 + 前端镜像 + TS 引擎清理 + use_case 合并 + src/core 重组，共 1 次会话。**

---

## 9. 测试策略（与规模相称）

### Rust 侧

| 测试类型       | 覆盖                                                             | 工具      | 优先级   |
| -------------- | ---------------------------------------------------------------- | --------- | -------- |
| 引擎纯逻辑单测 | 所有 pub 方法 × 所有 PlayMode × 边界 → ~30 个 case               | `#[test]` | **最高** |
| 持久化读写     | 写入→读取→引擎恢复一致性                                         | `#[test]` | 中       |
| IPC 集成       | 调用 command → 检查 engine 状态 + 事件 payload（mock NcmClient） | `#[test]` | 中       |

### TS 侧

| 测试类型                    | 覆盖                            | 工具                     | 优先级   |
| --------------------------- | ------------------------------- | ------------------------ | -------- |
| 行为锁定测试（步骤 1 产物） | 旧引擎完整行为 spec             | Vitest                   | **最高** |
| 音频播放                    | Audio.play/pause/ended/src 切换 | Vitest + jsdom           | 中       |
| 乐观 UI 渲染                | 点赞/暂停按钮状态正确性         | Vitest + Testing Library | 低       |

### 不做的

- ❌ 端到端测试（需要网易云账号 + 网络，CI 不可行，投入产出比极低）
- ❌ SMTC 自动化测试（依赖 Windows OS，CI 环境无此能力）
- ❌ 性能/压力测试（几千行代码，不需要）
- ❌ 测试覆盖率门槛（肉眼 review 可行，CI 跑 `cargo test && pnpm vitest` 即可）

---

## 10. 风险与最简规避

| 风险                                    | 最小化解法                                                                     | 落点                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **Mutex + await 死锁**                  | 铁律：任何 `.await` 前必须释放 lock。engine 方法全同步。                       | `cmd/player.rs` 中 lock→clone→drop→await 模式。CI 用 `rg 'lock.*\.await'` 阻断违规。       |
| **事件风暴（快速操作反复推送大 JSON）** | queue-changed 去抖 100ms。前端 `useShallow` 做引用相等比较。                   | `cmd/player.rs` 中用简单时间戳去抖；MirrorStore 用 Zustand 默认的浅比较。                  |
| **序列化开销（队列 >1000 项）**         | QueueItem 仅含必要字段（6 个），不含任何 NCM 原始 payload。不传 cover blob。   | `core/types.rs` 的 QueueItem 定义就是 gating。                                             |
| **Rust 进程崩溃全丢状态**               | 每次状态变化后异步写入 SQLite（WAL 模式，无性能影响）。启动时自动恢复。        | `infra/storage.rs`，在 cmd 的 mutation 操作末尾调用。                                      |
| **SMTC 回调阻塞 OS 消息循环**           | SMTC 回调不直接 lock engine。通过 `tokio::sync::mpsc` channel 发送到后台任务。 | `infra/platform.rs`：`smtc_callback → tx.send(action) → background_task: engine.lock()...` |

---

## 附录：设计决策速查

| 决策                   | 结论                                    | 一句话理由                                          |
| ---------------------- | --------------------------------------- | --------------------------------------------------- |
| 分层数量               | 3（core / infra / cmd）                 | 400 行引擎不需要 5 层                               |
| 不用 use_case 层       | ✅ 否决                                 | FM 取歌 4 行 match 就完了                           |
| 不用 Repository trait  | ✅ 否决                                 | 只有一个 SQLite 后端，trait 今天没用                |
| PlayMode 实现          | 策略模式（`PlayStrategy` trait）        | 导航统一为策略的 next/prev，每模式一个实现（含 FM） |
| FM 状态机              | 枚举 + 内联迁移                         | 2 个实质状态不需要框架                              |
| 播放命令返回什么       | PlayUrlInfo（track + URL）              | 切歌无间断优先                                      |
| queue-changed 事件策略 | 全量 + 100ms 去抖                       | 全量简单且不会不一致                                |
| 进度条谁计算           | 前端 rAF                                | 60fps 不走 IPC                                      |
| 持久化触发             | 每次突变后写 SQLite                     | WAL 模式零代价                                      |
| 锁模式                 | 单 Mutex<Engine> + lock→clone→drop 纪律 | 单锁无嵌套死锁风险                                  |

---

## 附录 B：行为差异决策（Phase B 评审门，2026-08-11，@oracle 拍板）

Phase B 特性测试锁定 TS 现状后，评审门对 4 处 TS 行为与 Rust 设计的差异做出决策：

| #   | 差异点                 | TS 现状                                                                   | Rust 决策                                                        | 落点                                      |
| --- | ---------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| ①   | shuffle 队列变更后失活 | removeAt/play 后 shuffled 数组不更新 → 越界 undefined / currentTrack null | **Rust 修复**：突变后 `reshuffle()` 重建                         | §2.4 内部方法；不复刻 bug                 |
| ②   | exitFm 无守卫          | 非 FM 调用静默清空队列                                                    | **Rust 加守卫**：非 FM 为 no-op                                  | §2.5 exit_fm 首行                         |
| ③   | Sequential 队尾        | advance/advanceOnEnd 环绕回 0                                             | **Rust 按设计返回 EndOfQueue（不环绕）**                         | §2.4 compute_next_index；设计级差异，接受 |
| ④   | FM 中 append           | 直接改 FM 队列                                                            | **Rust 先退出 FM、恢复快照再追加**（单曲 FM 模型下唯一合理语义） | §2.3 append；设计级差异                   |

**单曲 FM 模型**（与 TS 多曲目 FM 队列的本质差异）：Rust `FmState::Active { current_track, played_ids }` 单曲承载；FM 中 `next()`/`on_track_end()` 返回 `NeedFmTrack`，由 cmd 层取歌后 `set_fm_track`。TS 的 FM advance/on_end 测试（QueueManager.test.ts:525-547）不对应 Rust 语义，Phase C 需从设计直接实现 + 新增 Rust 测试。

---

## 附录 C：Phase C 落地注记（2026-08-11）

- **引擎**：`core/engine.rs` — 62 条单测全绿，`replace_play` + FM 守卫已落地
- **测试差分**：Phase C 初版 50 条 → 评审门后新增 12 条（replace_play 5 + FM 守卫 2 + 补齐 5）
- **封锁恢复**：`from_snapshot` 越界 index 钳制到 None（不 panic）
- **非 FM no-op**：`set_fm_track` / `fm_record_played` 在非 FM 调用时静默跳过

---

## 附录 D：Phase D 落地注记（2026-08-11）

### 文件清单

- **新建**：`state.rs`（PlayerState + PlayerEvent）、`cmd/player.rs`（16 条命令）、`cmd/query.rs`（3 条查询）
- **修改**：`cmd/mod.rs`、`core/types.rs`（PlayMode serde snake_case）、`core/mod.rs`（移除 `#![allow]`）、`lib.rs`、`service/ncm_service.rs`（song_to_queue_item）

### 与设计 §4 的偏离

| #   | 偏离                                                                                  | 原因                                                                                               |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **事件单通道 `player:event`**（而非逐变体 emit）                                      | serde tag 即事件名，前端按 tag 分发；比逐事件名 emit 更简单且契约一致                              |
| 2   | **播放/暂停状态在 `PlayerState.playing`（AtomicBool）** 而非引擎                      | 引擎为纯领域模型，不承载音频播放状态（设计 §6 已分配 Rust 权威，落点在此）                         |
| 3   | **queue-changed 不做 100ms 去抖**（每次突变立即全量 emit）                            | 操作频率低（用户手势）；去抖逻辑可延后至 Phase F（前端监听时再评估）                               |
| 4   | **TrackChanged / FmStateChanged 已定义但 Phase D 不发射**                             | 这两个事件由 SMTC 媒体键等 Rust 内部路径推送（Phase E/H），Phase D 仅锁定 wire 契约                |
| 5   | **URL 解析走 `NcmUseCase::song_url`**（非设计 §3.1 的 `ncm.resolve_url`）             | 现有代码库无 `NcmClient` 类型——NcmState 封装 `ncm_api_rs::ApiClient`，URL 获取走既有 use_case 路径 |
| 6   | `engine.rs` 中 `from_snapshot` / `fm_record_played` / `mode` 加 `#[allow(dead_code)]` | Phase E 持久化/镜像接入前无人调用，移除 `#![allow]` 后集中标注                                     |

### 验证

- `cargo check`：零错误零警告
- `cargo test`：62/62 全绿
- 锁纪律：`rg '\.lock.*\.await'` 命中 0（全部 await 在锁外）

---

## 附录 E：Phase E 落地注记（2026-08-11）

### 文件清单

- **新建**：`stores/playerMirror.ts`（Zustand 镜像，6 字段）、`shared/hooks/usePlayerEvents.ts`（`player:event` 监听 + tag 分发）、`shared/types/player.ts`（PlayUrlInfo + PlayerEventPayload）、`shared/utils/mappers.ts`（songToQueueItem ↔ queueItemToSong）
- **修改**：`usePlayer.ts`（104→279 行，`VITE_USE_RUST_PLAYER` flag）、`entities.ts`（+QueueItem）、`PlayerBar.tsx`（+usePlayerEvents）、`PlayerService.ts`（+audioCore getter）

### 与设计 §5 的主要偏离

1. **`PlayerService.ts` 加 `get audioCore()` getter** —— 设计原意 usePlayer 不直接操纵音频，但 `play(track)` → invoke → PlayUrlInfo → `audioCore.load(url)` → `play()` 流程必须访问 AudioCore，加只读 getter 是代价最低的接入点。
2. **usePlayer 门面做 QueueItem→Track 还原** —— MirrorStore 存 Rust wire `QueueItem`，既有组件读 `currentTrack.name/artists/album.picUrl`，在门面边界用 `queueItemToSong` 映射以保证组件零改动。
3. **`cyclePlayMode` 序改为 sequential→loop_one→shuffle** —— 与 Rust PlayMode 枚举序对齐（旧 TS 序为 sequential→shuffle→repeatOne）。
4. **`fmTrash` 空实现** —— hook 层不能 import `@/tauri/ncm`（AGENTS.md 红线），延迟到 Phase G 在 service 层接入。
5. **开关默认 OFF** —— `VITE_USE_RUST_PLAYER` 需用户手动设环境变量启用，零风险渐进上线。

### 验证

- `pnpm exec tsc --noEmit`：零错误
- `pnpm build`：全量 Vite 构建成功（2686 模块）
- 分层 grep（`.tsx` 中 ncm/store/service 直连）：0 命中

---

## 附录 F：Phase D/E 交界事件链修复（2026-08-11）

**缺陷**：Phase D 偏离 #3 未发射 `TrackChanged`，而 Phase E 的 MirrorStore 只靠 `player:track-changed` 更新 `currentTrack` → Rust 切歌后前端 UI 不更新。

**修复**：`cmd/player.rs` 所有「改变引擎当前曲目」命令的成功路径统一发射 `TrackChanged` + `QueueChanged`（全量）：

- `play_track` / `replace_and_play` / `play_queue_at` / `play_prev` / `enter_fm` / `exit_fm`（Some 路径）
- `advance_once` 两个成功分支（PlayTrack / NeedFmTrack，覆盖 play_next / advance_on_end）
- `remove_from_queue`：删当前曲目（中部滑入 / 队尾钳制 / FM 守卫恢复）时经 current_track id 比对补发 `TrackChanged`；删后队列清空（current_track=None）不发射（枚举无法表达 None，QueueChanged 已传达清空）

**验证**：cargo check 零错零警告；62 测试全绿；`emit_player_event` 24 处覆盖。

---

## 附录 G：Phase F 落地注记（2026-08-11）

### 文件清单

- **`infra/storage/db.rs`**：migrate 追加 `player_snapshot(key PK, value TEXT)`；`save_player_snapshot`（JSON + INSERT OR REPLACE，错误静默）、`load_player_snapshot -> Option`（无记录/解析失败 → None）
- **`state.rs`**：`PlayerState::try_restore(&Database)`（setup 期一次，`from_snapshot` 覆盖引擎）；顶层 `persist_snapshot(&AppHandle, &PlayerState)`（engine 锁内取快照 → 放锁 → 写 SQLite，无嵌套锁无 await）
- **`cmd/player.rs`**：14 处 persist 调用点（13 命令 + advance_once 双分支），均在 emit 后、Ok 前
- **`lib.rs`**：setup 中 `restore_cookie` 之后、`window::setup` 之前 `player.try_restore(&db)`

### 持久化策略

- **触发**：每次引擎状态突变（队列/模式/当前曲目/FM）后同步写 SQLite（WAL，代价可忽略）
- **跳过**：toggle_play_pause / seek（不改变恢复关键状态）
- **恢复**：启动时 `load_player_snapshot` → `PlayerEngine::from_snapshot`（62 测试覆盖 roundtrip）
- **错误容忍**：持久化全链路静默失败，不影响播放主路径

### 验证

- cargo check 零错零警告；62/62 测试全绿；零 TS 改动

---

## 附录 H：Phase H 落地（2026-08-12，单次会话完成 Rust-only 化）

### 一句话

播放器从「双引擎开关」（TS + Rust 并存，VITE_USE_RUST_PLAYER 切换）收敛为「Rust-only」，TS 引擎整层删除，前端仅保留 AudioCore（Web Audio 输出）。

### 变更面（按层）

**Rust 层（cmd/service/infra）**

- 新增 `cmd/player.rs::fm_trash` —— FM 垃圾桶上报 + 推进下一首（复用 advance_once 的 NeedFmTrack 路径）
- 删除 `use_case/` 整个目录（NcmUseCase 是 1:1 透传 NcmService 的死壳，cmd 直连 service 无编排缺口）
- 删除 `cmd/player.rs::toggle_play_pause` + `PlayerState.playing: AtomicBool`（无人调用——前端 audioCore.toggle() 直驱）
- 删除 `PlayerEvent::PlayStateChanged` 变体（Rust 不再发 play-state-changed 事件）
- `cargo test` 62/62 全过；`cargo check` 零错零警告

**前端层（ui/hooks/stores）**

- 删除 `src/core/` 整个目录（迁移遗留）
  - `core/audio/AudioCore.ts` → `src/shared/lib/audio/AudioCore.ts`（AGENTS.md infra 平台基元）
  - `core/types.ts` 内容（PlayMode/PlayModes/Track）→ `src/shared/types/player.ts`
- 删除 `src/core/queue/QueueManager.ts` + `QueueManager.test.ts`（物理删除）
- 删除 PlayerService.ts 的全部 TS 引擎方法（play/next/prev/FM/restoreQueue/playCurrent/resume/playCurrentOrSkip 等），576 → 221 行
- 删除 queue store 的 persist 配置、syncQueueDerived 函数、12 个 action 的 TS else 分支
- 删除 player store 的 pause/toggle/resume actions（Rust 模式下无调用者）
- 删除 settings store 的 cyclePlayMode action + core/types.ts cyclePlayMode 纯函数
- 移除所有 `VITE_USE_RUST_PLAYER` 开关与双分支结构
- 新增 `rustPlayModeToUi(rust: RustPlayMode): PlayMode` 集中映射（替代 usePlayer 内联三元）
- 新增 useFmCardViewModel + useMediaSession SMTC 元数据改读 MirrorStore（补缺）
- `pnpm exec tsc --noEmit` 零错误；`pnpm build` 通过

### 状态所有权最终划分

| 域                                                       | 权威                                          | 同步方向                                      |
| -------------------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| queue/currentTrack/index/mode/FM                         | **Rust**                                      | Rust → player:event → MirrorStore → usePlayer |
| playing/currentTime/duration/loading                     | **前端**（AudioCore 事件驱动 usePlayerStore） | AudioCore → usePlayerStore → usePlayer        |
| queue store 的 TS 状态字段（queue/currentTrack/isFm 等） | **空**（不再写入，组件改读 MirrorStore）      | —                                             |

### Tauri v2 IPC 约定（踩坑总结）

- Rust 命令参数 snake_case → JS 侧 invoke 必须 camelCase
- 修复 5 处：`track_id` → `trackId`（resolve_play_url ×2）、`start_index` → `startIndex`（replace_and_play）、`position_secs` → `positionSecs`（seek + report_position）
- `nested struct fields`（如 QueueItem 的 track_id）保持 snake_case 与 Rust 字段名一致（serde 默认按字段名，不被 Tauri camelCase 转换影响）
- 仅顶层命令参数被 camelCase 转换

### 类型边界

- `Song`/`QueueItem`（`@/shared/types/entities`）—— wire，前后端共用
- `RustPlayMode`（`@/shared/types/player`，`sequential`/`loop_one`/`shuffle`）—— wire 字符串（与 Rust serde 一致）
- `PlayMode`（`@/shared/types/player`，`sequential`/`shuffle`/`repeatOne`）—— UI 概念
- `rustPlayModeToUi(rust: RustPlayMode): PlayMode` —— 集中映射（loop_one → repeatOne；sequential/shuffle 直通）
- `Track = Song` 别名 —— 兼容旧 import

### 验证

- tsc --noEmit：零错误
- cargo test：62/62 全过
- pnpm build：通过
- 全库 grep `@/core`、`VITE_USE_RUST_PLAYER`、QueueManager、`syncQueueDerived`、TS playerService.*：零残留

### 未做（明确取舍）

- **Rust 音频输出**（rodio/symphonia 方案）—— Oracle 评估为「5-8 天净增代码、无功能缺口」，用户接受「保留 AudioCore + 删 src/core」折中
- **QueueManager.test.ts 已删除**—— Rust engine.rs 的 62 个测试已对齐 TS 行为 spec（7 处 intentional divergence 已在引擎实现注释中标注）

---

## 附录 I：手动/自动入口拆分 + 随机模式内置（2026-08-14）

承接 `docs/playmode-design.md` 的正交化（导航 × 来源分离），将「模式」升级为一等行为单元，消除三处残留的「混」。

### 背景：三个「混」点

1. **手动/自动入口混淆**：`PlayStrategy.next()` 同时服务「用户按下一首」与「曲目自然结束」，导致 LoopOne 下手动切歌也重播当前曲（错误）。
2. **`shuffle` 泄漏**：`engine.shuffle()` 是引擎通用队列操作，本质是 Shuffle 模式的内置能力，不应干扰队列纯净。
3. **FM/心动散落**：`enter_fm/exit_fm/enter_heartbeat` 等专用方法平铺在 engine（此点在 playmode-design.md 的 P0 已部分收敛为 source 正交）。

### 落点

- **`core/strategy.rs`**：`Advance{Play,End}` → `Step{Play, ReplayCurrent, End}`；trait 拆为 `manual_next` / `manual_prev` / `on_track_end`（`on_track_end` 默认 = `manual_next`，仅 LoopOne 覆盖）；删除 `reshuffle` 方法。
- **LoopOne 语义修正**：手动切歌 = 列表循环（切走）；自然结束 = `ReplayCurrent`（重播当前曲）。
- **`core/engine.rs`**：`next()` → `manual_next()` + `on_track_end()`；删除 `shuffle()` 与 `reshuffle_if_needed()` 空壳及其全部调用。
- **`cmd/player.rs`**：`advance_once` 增加 `AdvanceEntry{ManualNext, TrackEnd}` 参数（`play_next` 走 ManualNext、ended watcher 走 TrackEnd）；新增 `Step::ReplayCurrent` 分支（重播当前曲，命中 `last_url` 缓存免请求）；删除 `shuffle_queue` 命令。
- **「重新随机」= 再次 `set_mode(Shuffle)`**：`make_strategy` 每次构造推进 seed → 新排列；Shuffle 排列状态仍内聚于 strategy，惰性重建（无需 `on_queue_changed`）。
- **前端**：删除 `tauri/player.ts` 的 `shuffleQueue` 导出（无调用者）。

### 加新模式的侵入性

- 加导航模式 = `strategy.rs` 一个 struct（~10 行）+ `strategy_for` 注册一行，零侵入引擎/队列。
- 加内容来源 = `ContentSource` 一个变体 + `advance_once` 的 `End` 分支一行 match。

### 验证

- `cargo test`：**71/71 全绿**（新增 LoopOne 手动/自动 2 测试 + 重写 3 个）
- `cargo check`：零警告
- `tsc --noEmit`：零错误
