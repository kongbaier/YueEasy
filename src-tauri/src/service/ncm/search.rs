//! 搜索域：综合搜索 / 关键词联想 / 热搜榜。

use ncm_api_rs::Query;

use super::{call, NcmService};
use crate::model::entity::{HotSearchItem, KeywordSuggest, SearchResult};
use crate::model::error::{required, Result};
use crate::model::{mapper, response};
use crate::netease::client::QueryExt;
use crate::netease::NcmState;

impl NcmService {
    pub async fn cloudsearch(
        state: &NcmState,
        keywords: String,
        search_type: Option<i64>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<SearchResult> {
        let dto: response::CloudsearchResponseDto = call!(
            state,
            Query::new()
                .p("keywords", &keywords)
                .o("type", search_type)
                .o("limit", limit)
                .o("offset", offset),
            cloudsearch
        )
        .await?;
        Ok(mapper::map_search_result(required(dto.result, "result")?))
    }

    /// PC 关键词联想接口：返回 keywords + 高亮分段 + 角标（热搜），
    /// 与官方输入框下拉一致；实体联想（songs/albums/artists）不在此处使用。
    pub async fn search_suggest_keyword(
        state: &NcmState,
        keywords: String,
    ) -> Result<Vec<KeywordSuggest>> {
        let dto: response::PcSuggestResponseDto = call!(
            state,
            Query::new().p("keyword", &keywords),
            search_suggest_pc
        )
        .await?;
        Ok(mapper::map_keyword_suggest(required(dto.data, "data")?))
    }

    pub async fn search_hot(state: &NcmState) -> Result<Vec<HotSearchItem>> {
        let dto: response::SearchHotResponseDto = call!(state, Query::new(), search_hot).await?;
        Ok(mapper::map_hot_search(dto.result))
    }
}
