//! 统一业务实体（Entity）。
//!
//! 铁律：本模块是 Tauri 命令唯一对外暴露的数据形状；
//! 字段名即最终 wire 名（camelCase），**禁止**用 rename 保留 API 脏字段名；
//! 脏字段的归一（ar→artists、picUrl/coverImgUrl→coverUrl 等）一律在 `mapper` 完成。

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pic_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub music_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pic_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<Artist>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub publish_time_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Song {
    pub id: i64,
    pub name: String,
    pub artists: Vec<Artist>,
    pub album: Album,
    /// 毫秒
    pub duration_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i64,
    pub nickname: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub follows: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub followeds: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub cover_url: String,
    pub play_count: i64,
    pub track_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tracks: Option<Vec<Song>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub special_type: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscribed_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub share_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub create_time_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update_time_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistPage {
    pub playlists: Vec<Playlist>,
    pub total: i64,
    pub more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistHotTag {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BeReplied {
    pub id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<User>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: i64,
    pub user: User,
    pub content: String,
    /// 毫秒时间戳
    pub time_ms: i64,
    pub liked_count: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub liked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub be_replied: Option<Vec<BeReplied>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentPage {
    pub comments: Vec<Comment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hot_comments: Option<Vec<Comment>>,
    pub total: i64,
    pub more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Banner {
    /// 9:5 大图
    pub big_image_url: String,
    /// 27:10 小图
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_id: Option<i64>,
    /// 1=正常 3000=广告
    pub target_type: i64,
    pub type_title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongUrl {
    pub id: i64,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SongUrlResult {
    pub data: Vec<SongUrl>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricVersion {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Lyric {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lrc: Option<LyricVersion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tlyric: Option<LyricVersion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub yrc: Option<LyricVersion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub klyric: Option<LyricVersion>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub romalrc: Option<LyricVersion>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetail {
    pub album: Album,
    pub songs: Vec<Song>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub songs: Vec<Song>,
    pub song_count: i64,
    pub albums: Vec<Album>,
    pub album_count: i64,
    pub artists: Vec<Artist>,
    pub artist_count: i64,
    pub users: Vec<User>,
    pub user_count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestSong {
    pub id: i64,
    pub name: String,
    pub artists: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestAlbum {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestArtist {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestResult {
    pub songs: Vec<SuggestSong>,
    pub albums: Vec<SuggestAlbum>,
    pub artists: Vec<SuggestArtist>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HotSearchItem {
    pub keyword: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_type: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DragonBallItem {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceSong {
    pub song: Song,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthSession {
    pub cookie: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<User>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatus {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<User>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrKey {
    pub key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCreate {
    pub url: String,
    pub image: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum QrCheckStatus {
    /// 等待扫码（801）
    Waiting,
    /// 已扫码待确认（802）
    Scanned,
    /// 确认登录成功（803）
    Confirmed,
    /// 二维码过期（800）
    Expired,
    /// 未知/失败
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCheck {
    pub status: QrCheckStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cookie: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LikeList {
    pub ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSong {
    pub song: Song,
    /// 毫秒时间戳
    pub play_time_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSongs {
    pub list: Vec<RecentSong>,
}
