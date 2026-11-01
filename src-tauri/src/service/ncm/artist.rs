//! 歌手域：详情（含热门歌曲） / 专辑分页。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{ArtistAlbumPage, ArtistDetail};
use crate::model::error::Result;
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

impl NcmService {
    /// 歌手详情：`/api/v1/artist/{id}` 一次返回歌手本体 + `hotSongs`。
    pub async fn artist_detail(state: &NcmState, id: i64) -> Result<ArtistDetail> {
        let dto: response::ArtistDetailResponseDto =
            call!(state, Query::new().p("id", id), artists).await?;
        Ok(mapper::map_artist_detail(dto))
    }

    pub async fn artist_albums(
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<ArtistAlbumPage> {
        let dto: response::ArtistAlbumResponseDto = call!(
            state,
            Query::new()
                .p("id", id)
                .o("limit", limit)
                .o("offset", offset),
            artist_album
        )
        .await?;
        Ok(mapper::map_artist_albums(dto))
    }
}
