//! NCM 歌曲/专辑 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{AlbumDetail, LikeList, Lyric, RecentSongs, Song, SongUrlResult};

command!(ncm_album(state, id: i64) -> AlbumDetail => album);
command!(ncm_song_url_v1(state, id: i64, level: Option<String>) -> SongUrlResult => song_url);
command!(ncm_song_detail(state, ids: Vec<i64>) -> Vec<Song> => song_detail);
command!(ncm_lyric(state, id: i64) -> Lyric => lyric);
command!(ncm_lyric_new(state, id: i64) -> Lyric => lyric_new);
command!(ncm_like(state, id: i64, like: Option<bool>) => like);
command!(ncm_likelist(state, uid: i64) -> LikeList => like_list);
command!(ncm_record_recent_song(state, uid: i64) -> RecentSongs => recent_song);
command!(ncm_scrobble(state, id: i64, source_id: Option<i64>) => scrobble);
