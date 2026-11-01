//! NCM 搜索 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{HotSearchItem, KeywordSuggest, SearchResult};

// `search_type`：1=歌曲 10=专辑 100=歌手 1002=用户
command!(ncm_cloudsearch(state, keywords: String, search_type: Option<i64>, limit: Option<i64>, offset: Option<i64>) -> SearchResult => cloudsearch);
command!(ncm_search_suggest_keyword(state, keywords: String) -> Vec<KeywordSuggest> => search_suggest_keyword);
command!(ncm_search_hot(state) -> Vec<HotSearchItem> => search_hot);
