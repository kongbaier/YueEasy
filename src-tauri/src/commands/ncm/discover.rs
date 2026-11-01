//! NCM 发现页 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{Banner, DragonBallItem, IntelligenceSong, Song};

command!(ncm_banner(state, banner_type: Option<i64>) -> Vec<Banner> => banner);
command!(ncm_recommend_songs(state) -> Vec<Song> => recommend_songs);
command!(ncm_personal_fm(state) -> Vec<Song> => personal_fm);
command!(ncm_fm_trash(state, id: i64) => fm_trash);
command!(ncm_homepage_dragon_ball(state) -> Vec<DragonBallItem> => dragon_ball);
command!(ncm_playmode_intelligence_list(state, id: i64, pid: i64, count: Option<i64>) -> Vec<IntelligenceSong> => playmode_intelligence_list);
