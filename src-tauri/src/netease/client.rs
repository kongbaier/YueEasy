use std::future::Future;
use std::time::Duration;

use ncm_api_rs::{ApiClient, CryptoType, Query, RequestOption};
use serde::de::DeserializeOwned;
use serde_json::{json, Number, Value};

use super::error::{from_ncm, NetError, Result};
use super::NcmState;

/// ncm-api-rs 未在 crate 根导出 `Result`，这里显式别名。
pub(crate) type ApiResult = std::result::Result<ncm_api_rs::ApiResponse, ncm_api_rs::NcmError>;

/// 请求超时。ncm-api-rs 自身不设超时，少了这层会一直挂。
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// 发一次通知请求并解码为 DTO。
///
/// 业务层不走本函数，而走 [`crate::service::NcmService::call`] ——「取数 + 业务 code 校验」
/// 的唯一入口；本函数只保留与具体接口无关的传输职责。
///
/// 调用方自己取 client 就地构造 future，所以这里不需要闭包：
/// ```ignore
/// let client = state.client();
/// let dto: response::CloudsearchResponseDto = fetch(state, client.cloudsearch(&q)).await?;
/// ```
///
/// 本函数只做四件与具体接口无关、但每次请求都躲不掉的事：
/// 1. 超时（crate 不设）
/// 2. 传输错误归一（`NcmError` → `NcmApiError`）
/// 3. 响应 cookie 合并回写（crate 不会自己写回，且无 getter 可读）
/// 4. wire 归一（整数型浮点 / 并存的 `msg`+`message`）+ 反序列化
pub async fn fetch<D>(state: &NcmState, fut: impl Future<Output = ApiResult>) -> Result<D>
where
    D: DeserializeOwned,
{
    let mut resp = tokio::time::timeout(REQUEST_TIMEOUT, fut)
        .await
        .map_err(|_| NetError::Network {
            message: "请求超时".to_string(),
            detail: Some(format!(
                "tokio::time::timeout({}s) 到点；reqwest 客户端未设自身 timeout，这是唯一时限",
                REQUEST_TIMEOUT.as_secs()
            )),
        })?
        .map_err(from_ncm)?;

    if !resp.cookie.is_empty() {
        state.merge_cookie(&resp.cookie);
    }

    let mut value = resp.body.take();
    normalize_numbers(&mut value);
    collapse_message_aliases(&mut value);
    serde_json::from_value(value).map_err(|e| NetError::Decode {
        message: e.to_string(),
        detail: Some(format!("expected DTO = {}", std::any::type_name::<D>())),
    })
}

/// 递归把「整数型浮点」转换为整数；真分数（如 4.5）保持原样。
fn normalize_numbers(value: &mut Value) {
    match value {
        Value::Number(n) => {
            if let Some(f) = n.as_f64() {
                if f.fract() == 0.0 && f >= i64::MIN as f64 && f <= i64::MAX as f64 {
                    *value = Value::Number(Number::from(f as i64));
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(normalize_numbers),
        Value::Object(map) => map.values_mut().for_each(normalize_numbers),
        _ => {}
    }
}

/// 折叠并存的 `msg` / `message` 两个键。
///
/// 网易云部分接口的失败态会**同时**返回两者，例如 `/api/w/login/cellphone`：
/// `{"code":502,"message":"账号或密码错误","msg":"账号或密码错误"}`。
/// 而 DTO 用 `#[serde(alias = "msg")]` 兼容两种拼写 —— serde 的 alias 在同一对象里
/// 看到两个键映射到同一字段时会直接判 `duplicate field`，于是解码失败（Decode 错误）
/// 顶掉了真实的业务错误（这里的 code 502 + 文案）。
///
/// 所以在反序列化前把并存的两键折叠为一个（统一留在 `message`，优先保留非空值）；
/// 只有 `msg` 时不动，交给 DTO 的 alias。
fn collapse_message_aliases(value: &mut Value) {
    match value {
        Value::Object(map) => {
            if map.contains_key("msg") && map.contains_key("message") {
                let fallback = map.remove("msg");
                let message_is_usable = match map.get("message") {
                    None | Some(Value::Null) => false,
                    Some(Value::String(s)) => !s.trim().is_empty(),
                    Some(_) => true,
                };
                if !message_is_usable {
                    if let Some(msg) = fallback {
                        map.insert("message".to_string(), msg);
                    }
                }
            }
            map.values_mut().for_each(collapse_message_aliases);
        }
        Value::Array(items) => items.iter_mut().for_each(collapse_message_aliases),
        _ => {}
    }
}

/// 组装 [`Query`] 的语法糖：消掉 `&id.to_string()` 与
/// `opt(q, key, v.map(|v| v.to_string()).as_deref())` 这类与接口无关的噪音。
///
/// ```ignore
/// Query::new().p("id", id).o("limit", limit).list("ids", &ids)
/// ```
pub trait QueryExt {
    /// 必填参数（任何 `ToString`：`i64` / `String` / `&str` …）。
    fn p(self, key: &str, value: impl ToString) -> Query;
    /// 可选参数：`None` 时整条参数不出现。
    fn o(self, key: &str, value: Option<impl ToString>) -> Query;
    /// 逗号分隔的 id 列表（`song/detail` 的 `ids=1,2,3`）。
    fn list(self, key: &str, values: &[i64]) -> Query;
}

impl QueryExt for Query {
    fn p(self, key: &str, value: impl ToString) -> Query {
        self.param(key, &value.to_string())
    }

    fn o(self, key: &str, value: Option<impl ToString>) -> Query {
        match value {
            Some(value) => self.param(key, &value.to_string()),
            None => self,
        }
    }

    fn list(self, key: &str, values: &[i64]) -> Query {
        let joined = values
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",");
        self.param(key, &joined)
    }
}

/// 「最近播放」上报的日志域名。
///
/// 桌面端只往 `clientlog.music.163.com` 发这日志；`music.163.com/weapi/...` 上的老 weblog
/// 已被服务端**静默丢弃**：照样回 `{"code":200,"data":"success"}`，但条目不会进「最近听过」。
const CLIENTLOG_DOMAIN: &str = "https://clientlog.music.163.com";

/// 桌面端 (macOS) 设备字段。
///
/// eapi 的 `header` **完全由 cookie 里的这些键构造**（见 ncm-api-rs `request.rs`），
/// 缺省时 crate 会退回 `os=pc` 的形态——clientlog 只认客户端形态的日志，
/// 设备字段不对同样是「回 success 但不落库」。
const CLIENTLOG_DEVICE_COOKIE: &str = "os=osx; appver=3.1.10.5100; osver=15.5; channel=netease; \
     versioncode=140; mobilename=; resolution=1920x1080";

/// 上报「开始播放」（`action: "startplay"`）→ 写入云端「最近听过」。
///
/// 不走 `NcmService::call` 的原因：这条日志的**接口方言**有两处硬性差异（不是普通端点）——
///
/// 1. 域名是 [`CLIENTLOG_DOMAIN`]（用 `CryptoType::Eapi` + `domain` 覆盖）；
/// 2. cookie 需追加桌面端设备字段 [`CLIENTLOG_DEVICE_COOKIE`]。
///
/// `source_id` 是来源歌单 / 专辑 id，写进日志的 `content`（`id=<source_id>`）。
///
/// 注意：crate 自带的 `scrobble` / `weblog`（weapi + `music.163.com` + `action: "play"`）
/// 只影响听歌量统计、**不写「最近听过」**，所以不能用它们。
pub async fn report_recent_play(
    api: &ApiClient,
    session_cookie: &str,
    id: i64,
    source_id: i64,
) -> ApiResult {
    // 克隆只复制 Arc 句柄，连接池与会话 cookie 都复用；追加的设备字段只作用于这次请求
    let mut client = api.clone();
    client.set_cookie(format!("{session_cookie}; {CLIENTLOG_DEVICE_COOKIE}"));

    let logs = json!([{
        "action": "startplay",
        "json": {
            "id": id.to_string(),
            "type": "song",
            "mainsite": "1",
            "mainsiteWeb": "1",
            "content": format!("id={source_id}"),
        }
    }]);
    // `logs` 是「JSON 字符串化的数组」而不是嵌套数组，与服务端约定一致
    let data = json!({ "logs": logs.to_string() });

    client
        .request(
            "/api/feedback/weblog",
            data,
            RequestOption {
                crypto: CryptoType::Eapi,
                domain: Some(CLIENTLOG_DOMAIN.to_string()),
                ..Default::default()
            },
        )
        .await
}

/// 验证码（短信）登录 `/api/w/login/cellphone`。
///
/// 不用 `ApiClient::login_cellphone` 走这条路的原因：ncm-api-rs 在读 Query 里的 `captcha` 时
/// 会把 **captcha 同时写进 `password`**（注释里写着“Node.js 在有 captcha 时 password 字段也设为
/// captcha 的值”）。但上游 Node 那行是计算属性：
///
/// ```js
/// captcha: query.captcha,
/// [query.captcha ? 'captcha' : 'password']: query.captcha ? query.captcha : md5(query.password),
/// ```
///
/// captcha 存在时计算出的键是 `captcha`（重复赋值同一键），**根本不会产生 `password` 字段**。
/// 多发的 `password` 会让服务端走密码校验分支，于是永远返回 `502 账号或密码错误`：
///
/// ```text
/// 现状 (captcha + password) -> {"code":502,"message":"账号或密码错误"}
/// 上游 (只有 captcha)        -> 验证码错误 / 正常登录
/// ```
///
/// 所以这里按上游语义自己构造请求体：有 captcha 就不发 `password`。
pub async fn login_cellphone_by_captcha(
    client: &ApiClient,
    phone: &str,
    captcha: &str,
    countrycode: Option<&str>,
) -> ApiResult {
    let data = json!({
        "type": "1",
        "https": "true",
        "phone": phone,
        "countrycode": countrycode.unwrap_or("86"),
        "captcha": captcha,
        "remember": "true",
    });
    client
        .request(
            "/api/w/login/cellphone",
            data,
            RequestOption {
                crypto: CryptoType::Weapi,
                ..Default::default()
            },
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn query_ext_omits_absent_options_and_joins_ids() {
        let q = Query::new()
            .p("id", 7)
            .o("limit", None::<i64>)
            .o("level", Some("exhigh"))
            .list("ids", &[1, 2, 3]);

        assert_eq!(q.get("id"), Some("7"));
        assert_eq!(q.get("limit"), None);
        assert_eq!(q.get("level"), Some("exhigh"));
        assert_eq!(q.get("ids"), Some("1,2,3"));
    }

    #[test]
    fn collapse_message_aliases_dedupes_login_failure_body() {
        let mut value = json!({
            "code": 502,
            "message": "账号或密码错误",
            "msg": "账号或密码错误"
        });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "code": 502, "message": "账号或密码错误" }));
    }

    #[test]
    fn collapse_message_aliases_prefers_non_empty() {
        let mut value = json!({ "message": "", "msg": "验证码错误" });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "message": "验证码错误" }));
    }

    #[test]
    fn collapse_message_aliases_keeps_lone_msg_for_alias() {
        let mut value = json!({ "code": 400, "msg": "验证码错误" });
        collapse_message_aliases(&mut value);
        assert_eq!(value, json!({ "code": 400, "msg": "验证码错误" }));
    }

    #[test]
    fn collapse_message_aliases_walks_nested_structures() {
        let mut value = json!({
            "data": [{ "message": "", "msg": "a" }],
            "nested": { "message": "b", "msg": "c" }
        });
        collapse_message_aliases(&mut value);
        assert_eq!(
            value,
            json!({ "data": [{ "message": "a" }], "nested": { "message": "b" } })
        );
    }
}
