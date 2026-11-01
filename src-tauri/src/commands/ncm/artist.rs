//! NCM 歌手域 IPC 命令（薄壳）：参数透传 → service。

use super::command;
use crate::model::entity::{ArtistAlbumPage, ArtistDetail};

command!(ncm_artist_detail(state, id: i64) -> ArtistDetail => artist_detail);
command!(ncm_artist_albums(state, id: i64, limit: Option<i64>, offset: Option<i64>) -> ArtistAlbumPage => artist_albums);
