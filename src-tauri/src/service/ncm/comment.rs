//! 评论域：歌单评论 / 歌曲评论。

use ncm_api_rs::Query;

use super::NcmService;
use crate::model::entity::CommentPage;
use crate::model::error::Result;
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

/// 评论目标：两个接口除路径外完全同形，取数 + 映射只写一份。
#[derive(Clone, Copy)]
enum CommentTarget {
    Playlist,
    Music,
}

impl NcmService {
    pub async fn comment_playlist(
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        Self::comment(state, id, limit, offset, CommentTarget::Playlist).await
    }

    pub async fn comment_music(
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        Self::comment(state, id, limit, offset, CommentTarget::Music).await
    }

    async fn comment(
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
        target: CommentTarget,
    ) -> Result<CommentPage> {
        let dto: response::CommentPageResponseDto = Self::call(
            state,
            Query::new()
                .p("id", id)
                .o("limit", limit)
                .o("offset", offset),
            |api, q| async move {
                match target {
                    CommentTarget::Playlist => api.comment_playlist(&q).await,
                    CommentTarget::Music => api.comment_music(&q).await,
                }
            },
        )
        .await?;
        Ok(mapper::map_comment_page(dto))
    }
}
