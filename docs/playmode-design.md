# 播放模式（PlayMode）拓展设计：心动模式 + 私人漫游

> **⚠️ 已过时（2026-08-21）**：队列/导航/FM 已迁前端 `src/modules/player/core/QueueEngine.ts`
> （queue × mode 正交设计仍有效并被前端沿守：导航只算 Step，`Step::end` 后由 store 按 contentSource 续歌/停）。
> 本文件是「Rust core 引擎实现」的历史记录。Rust 侧已删引擎，仅留 NCM 网络取数。

> 状态：已实施（2026-08-14，P0 正交化 + P1 漫游多曲化 + P2 心动模式 + 事件精简全部落地，69 测试全绿）。
> 本文承接 `player-rust-design.md`（队列/策略/FM 迁 Rust）与 `player-rust-audio-design.md`（音频迁 Rust）。

---

## 1. 现状回顾：两轴「折叠」进单一 strategy 的病灶

`core/types.rs` 里声明了**两个正交轴**：

| 轴       | 类型                                                   | 语义                   |
| -------- | ------------------------------------------------------ | ---------------------- |
| 内容来源 | `ContentSource`（Queue / PersonalFm）                  | 「曲目从哪来」         |
| 导航策略 | `PlayMode`（Sequential / LoopAll / LoopOne / Shuffle） | 「在已有列表内怎么走」 |

但实现层把这个正交关系**折叠**了：`Fm` 被做成一个 `PlayStrategy`（`core/strategy.rs` 的 `Fm`），并通过 `PlayerEngine.strategy: Box<dyn PlayStrategy>` 抢占唯一的 strategy 槽位。后果：

1. **FM 单曲模型**：`enter_fm` 把 `queue` 压成 `vec![initial_track]`，`next()` 恒返回 `Advance::FetchFm`，cmd 层取歌后 `set_fm_track` 替换单曲。队列「退化」成单元素，失去了「列表」的概念。
2. **`mode` 字段被冻结**：`set_mode` 在 FM 激活时只改 `mode` 字段、不重建 `strategy`（`if !self.is_fm_active()` 守卫）。这直接与「漫游下在单曲循环 / 私人 FM 之间切换」矛盾——因为 `LoopOne`（导航）与 `Fm`（来源）本不该竞争同一个槽位。
3. **心动模式无处安放**：它本质是「内容来源 = 心动推荐队列」，但 `ContentSource` 只有 Queue/PersonalFm，没有对应的补给语义。

**一句话病灶**：`PlayStrategy` 同时承载了「导航」和「内容补给」两个职责（`Advance::FetchFm` 就是补给信号混进了导航输出），导致内容来源无法正交扩展。

---

## 2. 两种新模式的领域模型

### 2.1 心动模式（Heartbeat / Intelligence）

- **接口**：`playmode/intelligence/list?id=<song_id>&pid=<playlist_id>[&sid=<start_song_id>]`（已在 `NcmService::playmode_intelligence_list` 封装，`cmd/ncm/discover.rs::ncm_playmode_intelligence_list` 暴露）。
- **触发条件**：登录后，且**当前播放曲目是已收藏（liked）歌曲**时，切换 PlayMode 才会出现该选项。
- **语义**：以当前歌曲（或指定 sid）为种子，服务端返回一组「心动推荐」歌曲，**一次性生成一个队列**，之后按普通列表导航（Sequential/LoopAll/LoopOne/Shuffle 均适用）。
- **关键结论**：心动模式**不是一种导航策略**，而是「内容来源 = 心动推荐队列」——它与 `Queue` 的差异仅在「队列如何被填充」，导航行为与普通队列完全一致。

### 2.2 私人漫游（Personal FM，流式）

- **接口**：`personal_fm`（已封装）；「不感兴趣」= `fm_trash(id)`（已封装）。
- **语义**（区别于当前单曲 FM）：
  1. 独立队列（进入漫游时清空原队列，或持有独立 FM 队列，退出后恢复原队列）。
  2. **流式续接**：当播放 index 逼近队尾时，自动调 `personal_fm` 追加新歌，**不再有「队列尽头」**。
  3. PlayMode 切换**只在 `LoopOne`（单曲循环）与 `PersonalFm`（漫游前进）之间**切换，无 Sequential/Shuffle/LoopAll。
  4. UI 上「播放列表」按钮替换为「不感兴趣」按钮：点击 → `fm_trash(id)` + 从 FM 队列移除该曲 → 自动续到下一首。

### 2.3 领域真相：三种「内容来源」本质是三种「队列补给策略」

| 来源         | 队列填充                              | 队尾行为                                                            | 可用导航策略         |
| ------------ | ------------------------------------- | ------------------------------------------------------------------- | -------------------- |
| `Queue`      | 用户操作（append / replace / insert） | 停（Sequential）/ 环绕（LoopAll）/ 冻结（LoopOne）/ 随机（Shuffle） | 全部                 |
| `Heartbeat`  | 进入时一次性 `intelligence/list` 生成 | 同 Queue（列表语义）                                                | 全部                 |
| `PersonalFm` | `personal_fm` 流式逐首                | 自动续接（无限流）                                                  | 仅 LoopOne / Fm 前进 |

---

## 3. 架构评估：能否扩展 vs 需要重构

### 3.1 直接扩展（不重构）的代价

- 心动模式：加 `PlayMode::Heartbeat` + `PlayStrategy::Heartbeat`。但「心动」的队列仍要套用 Sequential/LoopAll/... 导航，要么把 Heartbeat 做成「组合策略」，要么在 strategy 里再 match 一次 mode——**退回到「散落的 mode 匹配」老问题**（这正是当初引入 strategy 想消除的）。
- 多曲漫游：把 `Fm` 从单曲改成多曲队列，`next()` 到队尾返回 `FetchFm` 追加。但「漫游 + LoopOne」仍需 `mode` 与 strategy 分离，否则 `LoopOne` 状态下 `is_fm_active()` 判断会摇摆。

结论：**在现有 `Box<dyn PlayStrategy>` 上硬扩，会让 strategy 同时承担「导航 + 补给 + 来源」，重蹈双枚举覆辙。**

### 3.2 推荐：正交化重构（导航 × 内容来源分离）

把 `PlayStrategy` 收窄为**纯导航**（在有限列表内算 next/prev），把「内容补给」抽成独立的**内容源**：

```
NavigationStrategy（导航，`current + len -> 下一个索引`）
  Sequential / LoopAll / LoopOne / Shuffle

ContentSource（内容，`队尾 -> 如何续`）
  Queue          — 不续，到队尾停（交由导航决定 End/环绕）
  Heartbeat      — 进入时 intelligence/list 生成队列，之后同 Queue 导航
  PersonalFm     — 到队尾调 personal_fm 追加（无限流），提供 fm_trash
```

对应 Rust 领域层（`core/`）：

```rust
// core/strategy.rs 收窄：只输出「队内导航」，不再有 FetchFm 这种补给信号
enum Navigate { Play(usize), End }          // 替代 Advance

// core/source.rs（新增）：内容来源的续歌决策
enum SourceEvent { More, Stop, Replace(Vec<QueueItem>) }
```

`PlayerEngine` 改为持有 `navigation: Box<dyn NavigateStrategy>` + `source: ContentSource`，两者正交组合。FM 不再抢占 navigation 槽位，`mode` 字段始终有效。

> 权衡：这是对 engine 的一次结构性改动（约 400~600 行重构 + 66 个测试的语义调整），但换来「来源可正交扩展」+「mode 不再被来源冻结」，正是用户要求的功能（心动 + 多曲漫游）所需的模型。规模与单人维护锚相符，值得在功能落地时一并做。

---

## 4. 冗余分析（队列/播放实现）

### 4.1 `on_queue_changed` 回调冗余

`PlayStrategy::on_queue_changed` 只有 `Shuffle` 实现，但 `Shuffle::next/prev` 内部已有**惰性重建**（`if self.order.len() != len { rebuild }`）。engine 里每次队列突变都调用 `reshuffle_if_needed() -> strategy.on_queue_changed()`，这条路径与惰性重建**功能重叠**。可直接删除 `on_queue_changed`，让 Shuffle 完全惰性（build on demand），engine 的 mutation 尾调用也随之简化。

### 4.2 `discard_fm` / `exit_fm` 双退出 + 处处守卫

`play_track`/`replace_play`/`clear` 用 `discard_fm`（丢弃快照），`append`/`insert_next`/`remove_at`/`play_queue_at` 用 `exit_fm`（恢复快照），且每个 mutation 方法开头都 `if self.is_fm_active()` 守卫。重构为「来源切换统一入口」后，这些分支会被 `source.transition(new_source)` 收敛，消除重复守卫。

### 4.3 事件不够「核心、贴近业务」

当前 `player:event` 单通道 6 个 tag：

| 事件                                | 现状问题                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `queue-changed`（全量队列 + index） | FM 单曲模型下只有 1 首也推全量；与 track-changed 切歌时**成对**发出，前端处理两次 |
| `track-changed`                     | 单条全量；与 queue-changed 语义重叠                                               |
| `iteration-strategy-changed`        | 单值，与 content-source-changed 同属「模式档位」变化                              |
| `content-source-changed`            | 同上                                                                              |
| `status-changed`（playing）         | 布尔，与 queue-ended 语义部分重叠                                                 |
| `queue-ended`                       | 队列尽头；FM 流式下「尽头」消失，意义弱化                                         |

**精简方向**（贴合业务 = 「当前播什么 + 队列是什么 + 档位是什么」）：

```
player:current     当前曲目 + index + source + mode（切歌/切档位时推，单条）
player:queue       队列全量（仅队列结构变化时推，去抖 100ms）
player:playing     布尔（音频状态）
player:ended       流尽头（仅非流式来源，或统一为 playing=false 承载）
```

把 `track-changed`/`queue-changed`/`*strategy-changed`/`*source-changed` 合并为 `current` 与 `queue` 两条，语义更聚焦；`ended`/`status` 合并为 `playing`。前端 MirrorStore 相应只订阅 3~4 条。

---

## 5. 实施计划（分阶段）

> 建议按「先重构模型，再落功能」的顺序，避免在旧模型上堆叠两种新模式。

- **P0 · 模型重构（前置）**：`core/` 正交化——`NavigateStrategy`（纯导航，去 on_queue_changed、去 Advance::FetchFm）+ `ContentSource`（Queue/Heartbeat/PersonalFm + 补给行为）。引擎方法收敛（来源切换统一入口，消除 discard/exit 双路径与处处守卫）。同步调整 66 个测试。前端 event 契约精简（current/queue/playing 三条）。
- **P1 · 私人漫游多曲化**：`PersonalFm` 源改为**流式多曲队列**（进入持有独立队列；到队尾 `personal_fm` 追加；`fm_trash` 移除 + 续接；退出恢复原队列）。Rust 新增 `fm_more`（或由 ended watcher 触发追加）命令；前端 `SourceSwitcher` 退出 + 播放列表按钮 → 「不感兴趣」按钮。PlayMode 循环在漫游下收敛为 LoopOne ↔ Fm。
- **P2 · 心动模式**：`Heartbeat` 源 + `intelligence/list` 接入（复用已封装的 `NcmService::playmode_intelligence_list(id, pid, count)` 与 `ncm_playmode_intelligence_list` 命令）。新增 `enter_heartbeat(song_id, pid, sid?)` 命令（Rust 取推荐列表 → 「Replace 队列 + 播 sid/首曲」）。前端：PlayMode 循环在「当前曲目被喜欢」时动态插入 Heartbeat 档位（需后端/前端判定当前曲是否 liked——前端已有 `likedIds` 镜像，判当前曲 `isLiked` 即可）。
- **P3 · 文档与回归**：更新本设计文档为「已实施」+ 落地注记；`cargo test` + `tsc --noEmit` + `pnpm build` + 手动冒烟（四导航 × 三来源组合、心动出现/消失、漫游续接 + 不感兴趣、重启恢复）。

> **工作量粗估**：P0（重构）约 1~~1.5 天，P1 / P2 各约 0.5~~1 天，P3 半天。总计 3~4 天，可与当前未提交的「音频迁移 + 架构分层重构」一并推进。

---

## 附录：落地注记（2026-08-14）

### P0 正交化（已完成）

- **`core/strategy.rs` 纯化**：删除 `Fm` 策略、`Advance::FetchFm`、`on_queue_changed` 回调、`is_fm`；`Advance` 收窄为 `Play(idx) / End`；新增 `reshuffle`（仅用户主动「随机」）。
- **`core/types.rs`**：`ContentSource` 加 `Heartbeat`。
- **`core/engine.rs` 正交化**：新增 `source: ContentSource` 字段；`strategy` 始终是 mode 对应的导航策略；`is_fm_active()` 改为 `source == PersonalFm`；`enter_fm/exit_fm/discard_fm` 改切 `source`；`set_mode` 不再被 FM 冻结。
- **`cmd/player.rs`**：`advance_once` 的 `End` 按 source 分派（PersonalFm 续歌 / Queue·Heartbeat 停止）。
- 测试 62 → 69（新增 fm_loop_one / heartbeat 等），`cargo test` 全绿。

### P1 私人漫游多曲化（已完成）

- engine：新增 `append_fm`（流式续歌追加）、`remove_fm_current`（不感兴趣移除）；删除 dead `set_fm_track`。
- cmd：`advance_once` 改**流式循环**（End→PersonalFm 取歌追加→重新 next，带防死循环保护）；`fm_trash` 改「上报 + 移除 + 播下一首」；新增 `play_current_track` 辅助。
- 前端「不感兴趣」按钮（PlayerBar/PlayerPageControls 的 `isFm ? handleFmTrash`）早已接线，命令自动走新语义。

### P2 心动模式（已完成）

- Rust：`engine.enter_heartbeat(tracks, start_index)`；`exit_fm` 扩展处理 Heartbeat（归 Queue 队列保持）；`cmd enter_heartbeat(song_id, pid, sid?)` 调 `playmode_intelligence_list`（service 早已封装）→ 替换队列 → 播。
- 前端：`tauri/player.ts` 加 `enterHeartbeat`；`like` 域 `LikeService.getLikedPlaylistId`（`user_playlist` 里 `specialType === 5` 的「我喜欢」歌单 id）+ `like store.likedPlaylistId` + 登录 self-init 记录。
- `player store.cycleStrategy` 重构为三源档位状态机：queue 策略循环（shuffle 后若当前曲被喜欢且有 pid 插「心动」）/ personal_fm（LoopOne ↔ 退出漫游）/ heartbeat（切回 Queue）。

### P0-3/P0-4 事件精简（已完成）

- `PlayerEvent` 收敛为 3 条核心：`player:current`（track+index+source+strategy）、`player:queue`（全量）、`player:playing`（布尔，合并 ended/status）。
- cmd 辅助 `emit_current/emit_queue/emit_playing` 取代散落的 track/queue/status 三连发射；前端 `usePlayerEvents` 3 个 case；`MirrorStore` 删除死字段 `queueEnded`。

### 与设计的偏离

| #   | 设计                       | 落地                                                                                     | 原因                                            |
| --- | -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | `NavigateStrategy` 改名    | 保留原名 `PlayStrategy`                                                                  | 减少 churn；语义已纯化                          |
| 2   | 心动模式需「来源歌单 pid」 | pid = 「我喜欢」歌单 id（specialType===5），登录拉 user_playlist 时同步记录到 like store | 用户明确「喜欢 = 普通 Playlist，pid 即它的 id」 |
| 3   | 事件「去抖 100ms」         | 保持立即全量推送                                                                         | 操作频率低；去抖留待需要时评估                  |
| 4   | `fm_played_ids` 删除       | 保留（`#[allow(dead_code)]` + 快照契约）                                                 | 删除需动 snapshot/前端/恢复，独立清理项         |
| 5   | 事件 `player:ended`        | 并入 `player:playing(false)`                                                             | playing 布尔已表达结束                          |

### 验证

- `cargo test`：**69/69 全绿**（新增 fm_loop_one_keeps_current_track、heartbeat_enter_and_exit、heartbeat_empty_tracks_clears 等）
- `cargo check`：零错误零警告
- `tsc --noEmit` / `pnpm lint`：零错误

### 未做（明确取舍）

- **`pnpm build` / `pnpm vitest` / GUI 冒烟**：受限沙箱环境限制（同音频迁移轮），需在真实环境补跑四导航 × 三来源组合、心动出现/消失、漫游续接 + 不感兴趣、重启恢复。
- **`fm_played_ids` 彻底删除**：单曲 FM 遗留，多曲下无服务端消费点，独立清理项。

### 后续修订（2026-08-14，手动/自动入口拆分 + 随机模式内置）

承接 P0 正交化（导航 × 来源分离），进一步把「模式」升级为一等行为单元，消除三处残留的「混」：

| 病灶               | P0 后现状                                                                              | 修订                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 手动/自动入口混淆  | `PlayStrategy.next()` 同时承载手动切歌与自然结束，LoopOne 下手动「下一首」也重播当前曲 | 拆 `next` 为 `manual_next`/`on_track_end`（+ `manual_prev`），`Advance{Play,End}` → `Step{Play,ReplayCurrent,End}`                    |
| LoopOne 语义错误   | 手动切歌 = 冻结当前曲                                                                  | **手动切歌 = 列表循环（切走）；自然结束 = `ReplayCurrent`（重播当前）**——`on_track_end` 默认 = manual_next，仅 LoopOne 覆盖           |
| `shuffle` 污染队列 | `engine.shuffle()` 是引擎通用队列操作，泄漏 Shuffle 模式能力                           | 删除 `engine.shuffle()` + trait `reshuffle` + `reshuffle_if_needed()` 空壳；「重新随机」统一走 `set_mode(Shuffle)`（构造时推进 seed） |

**cmd 层**：`advance_once` 增加 `AdvanceEntry{ManualNext, TrackEnd}` 参数——`play_next` 走 `ManualNext`、ended watcher 走 `TrackEnd`；新增 `Step::ReplayCurrent` 分支（重播当前曲，命中 `last_url` 缓存免请求）。删除无调用者的 `shuffle_queue` 命令 + 前端 `shuffleQueue` 导出。

**加新模式侵入性**：加导航模式 = `strategy.rs` 一个 struct（~10 行）+ `strategy_for` 注册一行，零侵入引擎/队列；加内容来源 = `ContentSource` 一个变体 + `advance_once` 的 `End` 分支一行 match。

**验证**：`cargo test` **71/71 全绿**（新增 LoopOne 手动/自动 2 测试 + 重写 3 个）；`cargo check` 零警告；`tsc --noEmit` 零错误。详见 `player-rust-design.md` 附录 I。
