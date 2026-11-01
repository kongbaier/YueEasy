//! 用户域：用户主页详情（用户歌单复用 playlist 域的 `user_playlist`）。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::UserDetail;
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
}
