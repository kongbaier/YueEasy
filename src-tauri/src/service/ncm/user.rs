//! 用户域：用户主页详情（用户歌单复用 playlist 域的 `user_playlist`）+ 音乐云盘。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{CloudPage, UserDetail};
use crate::model::error::{required, Result};
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

impl NcmService {
    pub async fn user_detail(state: &NcmState, uid: i64) -> Result<UserDetail> {
        let dto: response::UserDetailResponseDto =
            call!(state, Query::new().p("uid", uid), user_detail).await?;
        required(dto.profile.as_ref(), "profile")?;
        Ok(mapper::map_user_detail(dto))
    }

    /// 音乐云盘（登录态由 cookie 决定，无需 uid 参数）：分页取文件 + 全局容量。
    pub async fn user_cloud(
        state: &NcmState,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CloudPage> {
        let dto: response::CloudResponseDto = call!(
            state,
            Query::new()
                .o("limit", limit)
                .o("offset", offset),
            user_cloud
        )
        .await?;
        Ok(mapper::map_cloud_page(dto))
    }
}
