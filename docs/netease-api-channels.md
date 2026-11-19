# 网易云音乐的多路 API：api / weapi / eapi / linuxapi

> 面向维护者。解释**同一套业务接口的四种传输通道**（加密方式 + 身份伪装不同），各自的
> 优劣与适用场景，并重点拆解 **eapi** 的请求构造、鉴权、服务端校验与风控规则。
>
> 结论先行：**本项目统一走 eapi**（官方客户端语义、接口最全、权限最好）；代价是必须维护
> 一套自洽的客户端设备指纹，已抽成 `netease::client::EAPI_DEVICE_COOKIE`。
>
> 本文的实测数据来自 2025-11（Windows / 真实登录 cookie / `ncm-api-rs@133b65b`），
> 服务端策略随时会变，**表格结论要按日期读**。

---

## 1. 一句话对照表

| 通道 | 加密 | 实际 URL | 身份伪装 | 典型用途 | 主要风险 |
| --- | --- | --- | --- | --- | --- |
| `api` | **无**（明文表单） | `interface.music.163.com/api/<uri>` | 客户端 cookie + UA | 排障、一次性脚本、抓包复现 | 最容易被风控 / WAF 直接断连 |
| `weapi` | AES-128-CBC ×2 + RSA | `music.163.com/weapi/<uri>` | 浏览器 UA + `Referer` + `csrf_token` | 网页端全功能、扫码/验证码登录 | 客户端专属接口缺失；音质偏"网页档" |
| `eapi` | md5 签名 + AES-128-ECB | `interface.music.163.com/eapi/<uri>` | **完整客户端 header 指纹** | 官方客户端行为、app-only 接口、取流 | 指纹不自洽 → `-460` 风控 / 断连 |
| `linuxapi` | AES-128-ECB（转发） | `music.163.com/api/linux/forward` | Linux 客户端 | 单口转发所有接口，指纹要求低 | 覆盖与权限一般，UA 很旧 |

四条通道**共用同一套业务 uri**（`/api/...`）、同一套响应体（`{code, message|msg, data}`）。
通道只是"信封"：服务端按 URL 前缀（`/api`、`/weapi`、`/eapi`、`/api/linux/forward`）
决定用哪把钥匙解包。`ncm-api-rs` 里对应 `CryptoType::{Api, Weapi, Eapi, Linuxapi}`，
默认 `#[default] = Eapi`（与 Binaryify/NeteaseCloudMusicApi 的默认一致）。

---

## 2. 逐通道拆解

### 2.1 `api` —— 明文表单

- body 就是 `application/x-www-form-urlencoded` 的明文键值对（非字符串值 `to_string()`
  后塞进去），没有加密、没有签名。
- 仍然会带客户端 cookie 与客户端 UA（在 crate 里它和 eapi 共用同一个分支，见 §3.2）。
- **优点**：透明，浏览器/curl 就能复现；出问题时一眼看到发了什么。
- **缺点**：没有任何伪装，风控命中率最高；不能用于登录类接口。
- 用途：**排障首选**。想确认"接口本身有没有变"，先用它；确认参数对了再回到 eapi。

### 2.2 `weapi` —— 网页端

加密（`util/crypto.js` / crate `crypto::weapi`）：

```
secretKey    = 16 位随机 [a-zA-Z0-9]
params       = AES-128-CBC_b64( AES-128-CBC_b64(json, 固定key 0CoJUm6Qyw8W8jud, iv 0102030405060708),
                                secretKey, iv 0102030405060708 )
encSecKey    = textbookRSA( reverse(secretKey) )     ← 无 padding 的裸 RSA，用内置 1024-bit 公钥
body         = params=<b64>&encSecKey=<hex>
```

- 额外要求：body 里必须带 `csrf_token`（取自 cookie 的 `__csrf`）；请求头必须有
  `Referer: https://music.163.com` 与浏览器 UA；域名是 `music.163.com`。
- **优点**：风控最宽松（长得就像网页），登录/扫码/验证码都在这一路；接口面 = 网页端全量。
- **缺点**：
  - 客户端专属接口在那里不存在；
  - 权限/音质按"网页端"算，容易降级（同账号 `level=lossless` 常被回成 `exhigh`）；
  - 需要同时维护 RSA + 双层 CBC 两段密码学（比 eapi 更容易出兼容问题）。
- 本项目仅剩一处显式使用：**验证码登录**（`netease::client::login_cellphone_by_captcha`，
  上游方言要求"有 captcha 就不发 password"，绕不开 weapi 路径）。

### 2.3 `eapi` —— 客户端（本项目的统一通道，见 §3）

### 2.4 `linuxapi` —— Linux 客户端

```
eparams = AES-128-ECB_hex( {"method":"POST",
                            "url":"https://music.163.com/api/<uri>",
                            "params":{...}} , key rFgB&h#%2?^eDg:Q )
POST https://music.163.com/api/linux/forward   body: eparams=<hex>
```

- 一个入口转发所有接口，服务端再按 `url` 字段分发 → **一条通道走全部接口**。
- 指纹要求最低（UA 是"Chrome 60 on Linux"），在某些 pc 指纹被风控时是好用的备选。
- 缺点：接口覆盖与权限都比 eapi 保守，部分新接口不认。

---

## 3. eapi 全解

### 3.1 请求体构造（三步）

```
① 明文拼接
   digest = md5_hex_lower("nobody" + uri + "use" + json + "md5forencrypt")
   plain  = uri + "-36cd479b6b5-" + json + "-36cd479b6b5-" + digest
   （uri 含 /api 前缀；两个分隔符字面量就是 36cd479b6b5）

② 加密
   params = AES-128-ECB_PKCS7_hexUPPER(plain, key = "e82ckenh8dichen8")

③ 发包
   POST https://interface.music.163.com/eapi/<uri 去掉 /api 前缀>
   Content-Type: application/x-www-form-urlencoded
   body: params=<hex>            ← 只有这一个字段（没有 encSecKey）
   Cookie: <header 表的序列化，见 §3.2>
   User-Agent: 客户端 UA（默认 NeteaseMusic iPhone 9.0.90）
```

`json` 里除业务参数外，**必须**再塞两样：

| 字段 | 含义 |
| --- | --- |
| `header` | 客户端身份表（字符串键值 JSON），见 §3.2 |
| `e_r` | 是否要求**响应也加密**；`true` 时响应体是 AES-ECB 的大写 hex，客户端用同一把 key 解回来（crate 的 `ENCRYPT_RESPONSE = false`，默认明文响应） |

### 3.2 `header`：eapi 的"身份证"（也是 Cookie 头）

`header` 完全由 **cookie 里的同名键**构造，缺省时 crate 用内置默认值兜底：

| 键 | 来源 | 作用 |
| --- | --- | --- |
| `os` / `osver` / `appver` / `channel` / `versioncode` / `mobilename` / `resolution` / `buildver` | cookie，缺省取 `OsConfig`（默认 `OS_PC`） | **客户端形态**；风控主要看这几个 |
| `deviceId` | cookie，缺省 crate 生成并在进程内固定 | 设备标识（反重放/去重） |
| `requestId` | 每次请求生成（毫秒时间戳 + 3 位随机） | 单次请求追踪 |
| `__csrf` | cookie | CSRF 校验（weapi 也要，eapi 里进 header） |
| `MUSIC_U` | cookie | **登录会话票据**（鉴权核心） |
| `MUSIC_A` | 未登录时注入 | 匿名 token |

关键细节：**eapi 的 `Cookie` 请求头就是上面这张表的序列化**（urlencoded `k=v; k=v`），
不是原样转发浏览器 cookie。所以"给 cookie 加设备字段"等于"给 eapi 换一张脸"——
这也是 §5 修复的真正机制。

### 3.3 鉴权（谁证明我是谁）

三层，缺一不可地叠在同一个请求里：

1. **会话**：`MUSIC_U`（登录后服务端下发，本项目落盘在 `settings.json` 的 `auth_cookie`，
   由 `NcmState` 独占读写并逐请求回写 `Set-Cookie`）。没有它 → 大多数取数接口仍可用
   （匿名），但**取流只能是试听片段**、私有数据（我的歌单/云盘）不可见。
2. **CSRF**：`__csrf` 同时出现在 cookie 与 header/`csrf_token`，weapi 与 eapi 都校验。
3. **客户端身份**：`os`/`appver`/`deviceId`/`osver` 等组成的指纹 —— 它决定"你是不是真客户端"，
   进而决定**风控档位**与**可拿到的音质/权限**。

### 3.4 服务端校验与规则（实测归纳）

**A. 传输层状态**

| 现象 | 含义 | crate 归一 |
| --- | --- | --- |
| HTTP 200 + `code:200/201` | 成功 | `Ok` |
| HTTP 301 / `code:301` | 未登录 | `NcmError::AuthRequired` → 「需要登录」 |
| HTTP 503 | 限流 | `NcmError::RateLimited` → 「请求过于频繁」 |
| HTTP 200 + `code:-460` | **风控**（网络环境风险） | ⚠️ 被折叠成 `InvalidParam` → 「请求参数不合法」 |
| HTTP 200 + `code` 为其它负值 | 业务失败（-447 等） | `NcmError::Api { code, msg }` |
| TLS/连接被掐断 | eapi 路径被 WAF 直接丢连接 | `NcmError::Http` → 「网络错误…」 |

crate 还维护一份"视为成功"的 `SPECIAL_STATUS_CODES = {201, 302, 400, 502, 800, 801, 802, 803}`
（命中即当 200），并把 **100..600 之外**的 code 强改成 400 —— 后者正是 `-460` 被伪装成
"参数错误"的原因，排障时务必记得这一层。

**B. 指纹一致性（eapi 特有）**

服务端对 `os` × `appver` 这一对组合做判断。2025-11 实测（同一 cookie、同一时刻、
`/eapi/song/enhance/player/url/v1`）：

| header 指纹 | 结果 |
| --- | --- |
| crate 默认 `OS_PC`：`os=pc` + `appver=3.1.17.204416` | ❌ `{"code":-460,"message":"检测到您的网络环境存在风险，请稍后再试"}`（4/4 稳定） |
| 只改 `os=osx`（`appver` 仍默认） | ✅ 200，正常返回 URL |
| 只改 `appver=2.10.6`（`os` 仍 `pc`） | ✅ 200 |
| 只改 `osver` / 只改 `versioncode` / 只改 `channel` | ❌ 仍然 -460 |

结论：**不是"缺字段"，而是某一对 `os`×`appver` 被标记了**。所以"客户端指纹"必须是
一个**自洽的整套形态**，而不是随便填几个键。

**C. 风控是分接口的**

同一套默认 pc 指纹下：`song/url/v1`（取流）→ -460，而 `song/detail`、`lyric`、
`artist/head/info/get`、`personal_fm`、`cloud`、`comment` 全部 200。
**取流是最敏感的接口**（涉及版权/VIP），风控专门盯它。

**D. 音质与权限（与通道/账号相关）**

- `level` 取值：`standard` < `higher` < `exhigh` < `lossless` < `hires`
  （另有 `jyeffect` / `sky` / `jymaster`）。
- 非 VIP 账号请求高音质会被**静默降级**（实测 `lossless`/`hires` 请求回 `exhigh` 320k mp3）。
- 无版权 / 仅试听：**不是错误**，`data[0].url == null`（或带 `freeTrialInfo`），
  本项目据此走"不可播 → 提示 + 跳过"的值分支。
- weapi 与 eapi 的权限口径不完全一致，客户端通道通常更宽松。

---

## 4. 选通道的决策矩阵

| 场景 | 选它 | 理由 |
| --- | --- | --- |
| 取播放地址、日常业务接口 | **eapi** | 客户端语义、接口最全、权限/音质最好 |
| app-only 接口（如某些新版详情/推荐） | **eapi** | 只有客户端路径存在 |
| 登录（验证码方言）、网页端全量接口 | **weapi** | 上游只在这一路给对参数；风控最宽松 |
| eapi 指纹被风控、只想先确认接口没坏 | **api**（明文） | 一眼看到请求体，排障最快 |
| eapi 指纹被风控、需要长期可用 | **linuxapi** | 一个入口转发全部接口，指纹要求低 |
| 抓包/复现线上问题 | 任意 → 先 `api` 再切回 | 把"加密"和"业务"两个变量分开 |

**本项目的选择**：统一 eapi（客户端语义最正、权限最好）。因此必须维护设备指纹 ——
见 §5。

---

## 5. 本项目落点（代码地图）

```
src-tauri/src/
  netease/client.rs      ★ 唯一网络入口
    fetch<D>()             超时(10s) → 错误归一 → Set-Cookie 回写 → wire 归一(整数化/msg折叠) → 反序列化
    QueryExt               Query::new().p()/.o()/.list() 语法糖
    EAPI_DEVICE_COOKIE     eapi 客户端设备字段（取流 + clientlog 共用，一处真相）
    song_url_v1()          eapi 取流：clone client → 追加设备字段 → 调 crate 原生方法
    report_recent_play()   clientlog eapi（换域名 + 设备字段）
    login_cellphone_by_captcha()  验证码登录（weapi 方言）
  netease/mod.rs         NcmState：ApiClient + cookie 内存态 + 落盘（唯一写入口）
  netease/error.rs       NetError（Network/Api/Decode）+ from_ncm 归一
  service/ncm/mod.rs     ★ NcmService::call —— 唯一请求管道（取 client → fetch → check_code）
  model/error.rs         NcmApiError（IPC wire 形状）+ check_code + required
  model/response.rs      Response DTO + Envelope（该响应是否参与 code 校验）
  model/mapper.rs        DTO → Entity 唯一字段映射落点
```

数据流：`json → Response(DTO) → Entity → Ui Model(TS)`，映射只在 Rust 的 `mapper.rs` 做。

本轮修复的调用链：

```
前端 playerService.resolveTrackUrl
  → invoke('resolve_play_url', { trackId, quality })
    → commands/query.rs::resolve_play_url
      → NcmService::song_url（service/ncm/song.rs）
        → client::song_url_v1（eapi + EAPI_DEVICE_COOKIE）   ← 通道 eapi，指纹换成能过的一份
          → crate ApiClient::song_url_v1 → /eapi/song/enhance/player/url/v1
```

---

## 6. 排障手册

| 症状（前端看到） | devtools `detail` | 真实原因 | 处置 |
| --- | --- | --- | --- |
| `请求参数不合法` | `Invalid parameter: Unknown error` | **99% 是 `-460` 风控**被 crate 折叠（`-460`→400→`InvalidParam`，且只读 `msg` 不读 `message`） | 检查 eapi 设备指纹（§3.2）；确认 cookie 里的 `os`/`appver` 是自洽的一套 |
| `网络错误：请求发送失败` | `flags[request=true]` / `received corrupt message…` | eapi 路径被 WAF 掐断（同属风控） | 同上；换 `os`×`appver` |
| `需要登录` | `Authentication required: …` | `301`，会话过期 | 重新登录 |
| `请求过于频繁，请稍后再试` | `Rate limited: …` / `code=-460` | 503 限流 / 高频风控 | 退避重试；`Query::real_ip` 只在必要时用 |
| `响应缺少 xxx 字段` | `expected non-null …` | 结构与 DTO 不符（**不是**风控） | 对照 `model/response.rs` 补 alias/兜底 |
| 歌能播但音质不对 | — | 非 VIP 被降级（§3.4 D） | 预期行为 |

---

## 7. 变更/实测记录

| 日期 | 事项 | 结论 |
| --- | --- | --- |
| 2025-11 | eapi 取流返回 `-460`，前端报「请求参数不合法」 | 根因：crate 默认 `OS_PC` 指纹（`os=pc`+`appver=3.1.17.204416`）被风控；换 macOS 桌面指纹后 200（4/4） |
| 2025-11 | 对照 weapi / api / linuxapi 同一请求体 | 三者均 200。曾短暂以 weapi 兜底，后按设计决策**统一 eapi** |
| 2025-11 | 核对其它 eapi 接口（detail/lyric/fm/cloud/comment/artist） | 默认指纹下全部 200 → 风控是**分接口**的，取流最敏感 |

---

## 8. 参考

- Binaryify/NeteaseCloudMusicApi（Node，事实标准）：`util/crypto.js`、`util/request.js`
  （`crypto` 为空 → `eapi`；"任意 uri 支持四种加密方式"）
- `ncm-api-rs`（本项目依赖）：`src/crypto.rs`、`src/request.rs`（header 构造 / 状态码折叠）、
  `src/util/config.rs`（`OS_PC` / `OS_IPHONE` / UA 表）
- YesPlayMusic：`/song/url`(legacy) + `br`，经自己的 Node API → 实际 eapi
- SPlayer：直接用 `ncm-api-rs`（eapi）
