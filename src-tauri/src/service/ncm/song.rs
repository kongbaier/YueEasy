//! 歌曲域：专辑 / 播放地址 / 歌曲详情 / 歌词 / 点赞 / 最近播放。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{AlbumDetail, LikeList, Lyric, RecentSongs, Song, SongUrlResult};
use crate::model::error::Result;
use crate::model::{mapper, response};
use crate::netease::client::{self, QueryExt};
use crate::netease::NcmState;

/// 歌词来源：`/lyric`（旧）与 `/lyric/new`（新，带逐字 yrc）响应同形。
#[derive(Clone, Copy)]
enum LyricSource {
    Legacy,
    New,
}

impl NcmService {
    pub async fn album(state: &NcmState, id: i64) -> Result<AlbumDetail> {
        let dto: response::AlbumDetailResponseDto =
            call!(state, Query::new().p("id", id), album).await?;
        Ok(mapper::map_album_detail(dto))
    }

    pub async fn song_url(
        state: &NcmState,
        id: i64,
        level: Option<String>,
    ) -> Result<SongUrlResult> {
        let dto: response::SongUrlResponseDto = call!(
            state,
            Query::new().p("id", id).o("level", level),
            song_url_v1
        )
        .await?;
        Ok(mapper::map_song_url(dto))
    }

    pub async fn song_detail(state: &NcmState, ids: Vec<i64>) -> Result<Vec<Song>> {
        let dto: response::SongDetailResponseDto =
            call!(state, Query::new().list("ids", &ids), song_detail).await?;
        Ok(mapper::map_songs(dto.songs))
    }

    pub async fn lyric(state: &NcmState, id: i64) -> Result<Lyric> {
        Self::lyric_from(state, id, LyricSource::Legacy).await
    }

    pub async fn lyric_new(state: &NcmState, id: i64) -> Result<Lyric> {
        Self::lyric_from(state, id, LyricSource::New).await
    }

    /// 两个歌词接口除端点外完全同形，取数 + 映射只写一份。
    async fn lyric_from(state: &NcmState, id: i64, source: LyricSource) -> Result<Lyric> {
        let dto: response::LyricResponseDto =
            Self::call(state, Query::new().p("id", id), |api, q| async move {
                match source {
                    LyricSource::Legacy => api.lyric(&q).await,
                    LyricSource::New => api.lyric_new(&q).await,
                }
            })
            .await?;
        Ok(mapper::map_lyric(dto))
    }

    pub async fn like(state: &NcmState, id: i64, like: Option<bool>) -> Result<()> {
        let _: response::LikeResponseDto =
            call!(state, Query::new().p("id", id).o("like", like), like).await?;
        Ok(())
    }

    pub async fn like_list(state: &NcmState, uid: i64) -> Result<LikeList> {
        let dto: response::LikeListResponseDto =
            call!(state, Query::new().p("uid", uid), likelist).await?;
        Ok(mapper::map_like_list(dto))
    }

    pub async fn recent_song(state: &NcmState, uid: i64) -> Result<RecentSongs> {
        let dto: response::RecentSongResponseDto =
            call!(state, Query::new().p("uid", uid), record_recent_song).await?;
        Ok(mapper::map_recent_songs(dto))
    }

    /// 听歌上报：写入云端「最近听过」（桌面端 `startplay` 日志，clientlog eapi）。
    ///
    /// `source_id` 是来源歌单 / 专辑 id（不知道就传 `None` → 上报为 `0`）。
    /// 请求方言（clientlog 域名 + eapi + 桌面端 cookie）全部封装在
    /// [`client::report_recent_play`]，所以这里只用 `call` 拿「取数 + 业务 code 校验」。
    pub async fn scrobble(state: &NcmState, id: i64, source_id: Option<i64>) -> Result<()> {
        let source_id = source_id.unwrap_or(0);
        let _: response::ScrobbleResponseDto =
            Self::call(state, Query::new(), |api, _q| async move {
                client::report_recent_play(&api, &state.cookie(), id, source_id).await
            })
            .await?;
        Ok(())
    }
}
