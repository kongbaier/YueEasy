//! NCM 歌单 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{Playlist, PlaylistHotTag, PlaylistPage};

command!(ncm_playlist_detail(state, id: i64) -> Playlist => playlist_detail);
command!(ncm_playlist_subscribe(state, id: i64, subscribe: bool) => playlist_subscribe);
command!(ncm_user_playlist(state, uid: i64) -> Vec<Playlist> => user_playlist);
command!(ncm_personalized(state, limit: Option<i64>) -> Vec<Playlist> => personalized);
command!(ncm_top_playlist(state, cat: Option<String>, limit: Option<i64>, offset: Option<i64>) -> PlaylistPage => top_playlist);
command!(ncm_playlist_hot(state) -> Vec<PlaylistHotTag> => playlist_hot);
command!(ncm_recommend_resource(state) -> Vec<Playlist> => recommend_resource);
