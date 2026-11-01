//! NCM 领域服务：编排「组装 Query → 网络层取数 → 业务 code 校验 → 数据处理层映射」。
//!
//! 结构：
//! - 本文件只声明 [`NcmService`] 并持有**唯一请求管道** [`NcmService::call`]
//! - 各域方法按 `commands::ncm` 同构拆到 `auth` / `song` / `playlist` / `discover` /
//!   `search` / `comment`；每个方法只声明「参数 + 端点 + 交给哪个 mapper」三件事
//! - 业务 code 是否参与校验由 DTO 的 [`Envelope`] 实现决定，**不在**调用点判断
//!
//! 依赖方向：`commands → service → model → netease`；本模块是唯一同时认识
//! `netease`（取数）与 `model`（校验 / 映射）的地方。

mod auth;
mod comment;
mod discover;
mod playlist;
mod search;
mod song;

use std::future::Future;

use ncm_api_rs::{ApiClient, Query};
use serde::de::DeserializeOwned;

use crate::model::error::{check_code, Result};
use crate::model::response::Envelope;
use crate::netease::client::{fetch, ApiResult};
use crate::netease::NcmState;

pub struct NcmService;

/// 端点调用语法糖：把「DTO 类型 + Query + client 方法名」写成一行。
///
/// 展开完全等同于手写：
/// ```ignore
/// Self::call(state, query, |api, q| async move { api.method(&q).await })
/// ```
/// 只省掉闭包噪音——端点名、DTO、Query 仍然逐字可见，不隐藏任何接口差异。
macro_rules! call {
    ($state:expr, $query:expr, $method:ident) => {
        Self::call(
            $state,
            $query,
            |api, q| async move { api.$method(&q).await },
        )
    };
}

pub(crate) use call;

impl NcmService {
    /// 唯一请求管道：取 client → 发请求（超时 / cookie 回写 / wire 归一）→ 反序列化 →
    /// 业务 code 校验。
    ///
    /// `client` 与 `query` 以**所有权**交给 `send`，异步块自己持有二者，
    /// 所以调用点不用写生命周期标注，也不需要 `BoxFuture`：
    ///
    /// ```ignore
    /// let dto: response::SongDetailResponseDto = Self::call(
    ///     state, Query::new().list("ids", &ids),
    ///     |client, q| async move { client.song_detail(&q).await },
    /// ).await?;
    /// ```
    pub(crate) async fn call<D, F>(
        state: &NcmState,
        query: Query,
        send: impl FnOnce(ApiClient, Query) -> F,
    ) -> Result<D>
    where
        D: Envelope + DeserializeOwned,
        F: Future<Output = ApiResult>,
    {
        let dto: D = fetch(state, send(state.client(), query)).await?;
        check_code(dto.code(), dto.message())?;
        Ok(dto)
    }
}
