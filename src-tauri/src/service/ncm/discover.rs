//! 发现页域：Banner / 每日推荐 / 私人 FM / 龙珠 / 心动模式。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{Banner, DragonBallItem, IntelligenceSong, Song};
use crate::model::error::Result;
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

impl NcmService {
    pub async fn banner(state: &NcmState, banner_type: Option<i64>) -> Result<Vec<Banner>> {
        let dto: response::BannerResponseDto =
            call!(state, Query::new().o("type", banner_type), banner).await?;
        Ok(mapper::map_banners(dto.banners))
    }

    pub async fn recommend_songs(state: &NcmState) -> Result<Vec<Song>> {
        let dto: response::RecommendSongsResponseDto =
            call!(state, Query::new(), recommend_songs).await?;
        Ok(dto
            .data
            .map(|d| mapper::map_songs(d.daily_songs))
            .unwrap_or_default())
    }

    pub async fn personal_fm(state: &NcmState) -> Result<Vec<Song>> {
        let dto: response::PersonalFmResponseDto = call!(state, Query::new(), personal_fm).await?;
        Ok(mapper::map_songs(dto.data))
    }

    pub async fn fm_trash(state: &NcmState, id: i64) -> Result<()> {
        let _: response::FmTrashResponseDto =
            call!(state, Query::new().p("id", id), fm_trash).await?;
        Ok(())
    }

    pub async fn dragon_ball(state: &NcmState) -> Result<Vec<DragonBallItem>> {
        let dto: response::DragonBallResponseDto =
            call!(state, Query::new(), homepage_dragon_ball).await?;
        Ok(mapper::map_dragon_ball(dto.data))
    }

    pub async fn playmode_intelligence_list(
        state: &NcmState,
        id: i64,
        pid: i64,
        count: Option<i64>,
    ) -> Result<Vec<IntelligenceSong>> {
        let dto: response::IntelligenceResponseDto = call!(
            state,
            Query::new().p("id", id).p("pid", pid).o("count", count),
            playmode_intelligence_list
        )
        .await?;
        Ok(mapper::map_intelligence(dto.data))
    }
}
