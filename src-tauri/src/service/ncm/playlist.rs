//! 歌单域：详情 / 收藏 / 用户歌单 / 推荐 / 排行榜 / 热门标签。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{Playlist, PlaylistHotTag, PlaylistPage};
use crate::model::error::{required, Result};
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

impl NcmService {
    pub async fn playlist_detail(state: &NcmState, id: i64) -> Result<Playlist> {
        let dto: response::PlaylistDetailResponseDto =
            call!(state, Query::new().p("id", id), playlist_detail).await?;
        Ok(mapper::map_playlist(required(dto.playlist, "playlist")?))
    }

    /// 收藏 / 取消收藏歌单（`t=1` 收藏，`t=0` 取消）。
    pub async fn playlist_subscribe(state: &NcmState, id: i64, subscribe: bool) -> Result<()> {
        let _: response::PlaylistSubscribeResponseDto = call!(
            state,
            Query::new().p("id", id).p("t", subscribe as u8),
            playlist_subscribe
        )
        .await?;
        Ok(())
    }

    pub async fn user_playlist(state: &NcmState, uid: i64) -> Result<Vec<Playlist>> {
        let dto: response::UserPlaylistResponseDto =
            call!(state, Query::new().p("uid", uid), user_playlist).await?;
        Ok(mapper::map_playlists(dto.playlist))
    }

    pub async fn personalized(state: &NcmState, limit: Option<i64>) -> Result<Vec<Playlist>> {
        let dto: response::PersonalizedResponseDto =
            call!(state, Query::new().o("limit", limit), personalized).await?;
        Ok(mapper::map_playlists(dto.result))
    }

    pub async fn top_playlist(
        state: &NcmState,
        cat: Option<String>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<PlaylistPage> {
        let dto: response::TopPlaylistResponseDto = call!(
            state,
            Query::new()
                .o("cat", cat)
                .o("limit", limit)
                .o("offset", offset),
            top_playlist
        )
        .await?;
        Ok(mapper::map_playlist_page(dto))
    }

    pub async fn playlist_hot(state: &NcmState) -> Result<Vec<PlaylistHotTag>> {
        let dto: response::PlaylistHotResponseDto =
            call!(state, Query::new(), playlist_hot).await?;
        Ok(mapper::map_playlist_hot(dto))
    }

    pub async fn recommend_resource(state: &NcmState) -> Result<Vec<Playlist>> {
        let dto: response::RecommendResourceResponseDto =
            call!(state, Query::new(), recommend_resource).await?;
        Ok(mapper::map_playlists(dto.recommend))
    }
}
