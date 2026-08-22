//! 各接口原始响应 DTO（Raw）。
//!
//! 这里允许用 `#[serde(rename)]` / `#[serde(alias)]` 对齐 API 的脏字段名（ar/al/dt、
//! picUrl/coverImgUrl、artists/album/duration 等）；缺字段用 `#[serde(default)]` 兜底。
//! DTO 只存在于适配层内部，绝不直接返回前端。

use serde::Deserialize;

/// 网易云部分字符串字段会返回 null，而 `#[serde(default)]` 只兜缺失字段、不兜 null。
/// 用 `Option<String>` 中转，把 null 归一为空串，避免 decode 失败。
fn de_string_nullable<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<String>::deserialize(deserializer)?.unwrap_or_default())
}

// ── 通用子结构 ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub pic_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub pic_url: Option<String>,
    #[serde(default)]
    pub artist: Option<ArtistDto>,
    #[serde(default)]
    pub publish_time: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// 统一歌曲 DTO：song/detail 用 ar/al/dt；personal_fm 用 artists/album/duration。
/// 通过 alias 让同一结构兼容两种命名。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(rename = "ar", alias = "artists", default)]
    pub artists: Vec<ArtistDto>,
    #[serde(rename = "al", alias = "album", default)]
    pub album: Option<AlbumDto>,
    #[serde(rename = "dt", alias = "duration", default)]
    pub duration_ms: Option<i64>,
    #[serde(default)]
    pub fee: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    #[serde(default)]
    pub user_id: i64,
    #[serde(default)]
    pub nickname: String,
    #[serde(default)]
    pub avatar_url: Option<String>,
    #[serde(default)]
    pub signature: Option<String>,
    #[serde(default)]
    pub gender: Option<i64>,
    #[serde(default)]
    pub follows: Option<i64>,
    #[serde(default)]
    pub followeds: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub cover_img_url: Option<String>,
    #[serde(default)]
    pub pic_url: Option<String>,
    #[serde(default)]
    pub play_count: i64,
    #[serde(default)]
    pub track_count: i64,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub creator: Option<UserDto>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub tracks: Option<Vec<SongDto>>,
    #[serde(default)]
    pub special_type: Option<i64>,
    #[serde(default)]
    pub subscribed_count: Option<i64>,
    #[serde(default)]
    pub comment_count: Option<i64>,
    #[serde(default)]
    pub share_count: Option<i64>,
    #[serde(default)]
    pub create_time: Option<i64>,
    #[serde(default)]
    pub update_time: Option<i64>,
}

// ── song ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongUrlItemDto {
    pub id: i64,
    /// 无版权/VIP 歌曲该字段为 null，必须用 Option 兜底，否则整包解码失败
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongUrlResponseDto {
    #[serde(default)]
    pub data: Vec<SongUrlItemDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SongDetailResponseDto {
    #[serde(default)]
    pub songs: Vec<SongDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricVersionDto {
    #[serde(default)]
    pub lyric: String,
    #[serde(default)]
    pub version: Option<i64>,
}

/// 兼容 /lyric 与 /lyric/new 两种响应。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricResponseDto {
    #[serde(default)]
    pub lrc: Option<LyricVersionDto>,
    #[serde(default)]
    pub tlyric: Option<LyricVersionDto>,
    #[serde(default)]
    pub yrc: Option<LyricVersionDto>,
    #[serde(default)]
    pub klyric: Option<LyricVersionDto>,
    #[serde(default)]
    pub romalrc: Option<LyricVersionDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbumDetailResponseDto {
    #[serde(default)]
    pub album: Option<AlbumDto>,
    #[serde(default)]
    pub songs: Vec<SongDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LikeResponseDto {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LikeListResponseDto {
    #[serde(default)]
    pub ids: Vec<i64>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSongItemDto {
    #[serde(default)]
    pub data: Option<SongDto>,
    #[serde(default)]
    pub play_time: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSongDataDto {
    #[serde(default)]
    pub list: Vec<RecentSongItemDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentSongResponseDto {
    #[serde(default)]
    pub data: Option<RecentSongDataDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── playlist ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistDetailResponseDto {
    #[serde(default)]
    pub playlist: Option<PlaylistDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

/// /user/playlist 的字段名是 `playlist`（数组），与详情接口同名不同形。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserPlaylistResponseDto {
    #[serde(default)]
    pub playlist: Vec<PlaylistDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalizedResponseDto {
    #[serde(default)]
    pub result: Vec<PlaylistDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopPlaylistResponseDto {
    #[serde(default)]
    pub playlists: Vec<PlaylistDto>,
    #[serde(default)]
    pub total: i64,
    #[serde(default)]
    pub more: bool,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistHotTagDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub category: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistHotResponseDto {
    #[serde(default)]
    pub tags: Vec<PlaylistHotTagDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendResourceResponseDto {
    #[serde(default)]
    pub recommend: Vec<PlaylistDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── discover ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BannerDto {
    #[serde(default)]
    pub big_image_url: String,
    #[serde(default)]
    pub image_url: Option<String>,
    #[serde(default)]
    pub target_id: Option<i64>,
    #[serde(default)]
    pub target_type: i64,
    #[serde(default)]
    pub type_title: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BannerResponseDto {
    #[serde(default)]
    pub banners: Vec<BannerDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendSongsDataDto {
    #[serde(default)]
    pub daily_songs: Vec<SongDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendSongsResponseDto {
    #[serde(default)]
    pub data: Option<RecommendSongsDataDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersonalFmResponseDto {
    #[serde(default)]
    pub data: Vec<SongDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FmTrashResponseDto {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragonBallItemDto {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub icon_url: Option<String>,
    #[serde(default)]
    pub resource_id: Option<String>,
    #[serde(default)]
    pub resource_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DragonBallResponseDto {
    #[serde(default)]
    pub data: Vec<DragonBallItemDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceItemDto {
    #[serde(default)]
    pub song_info: Option<SongDto>,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntelligenceResponseDto {
    #[serde(default)]
    pub data: Vec<IntelligenceItemDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── search ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchAlbumDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub pic_url: String,
    #[serde(default)]
    pub artist: Option<ArtistDto>,
    #[serde(default)]
    pub size: i64,
    #[serde(default)]
    pub publish_time: i64,
    #[serde(default)]
    pub company: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchArtistDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub pic_url: String,
    #[serde(default)]
    pub alias: Vec<String>,
    #[serde(default)]
    pub album_size: i64,
    #[serde(default)]
    pub music_size: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    #[serde(default)]
    pub songs: Vec<SongDto>,
    #[serde(default)]
    pub song_count: i64,
    #[serde(default)]
    pub albums: Vec<SearchAlbumDto>,
    #[serde(default)]
    pub album_count: i64,
    #[serde(default)]
    pub artists: Vec<SearchArtistDto>,
    #[serde(default)]
    pub artist_count: i64,
    #[serde(default)]
    pub userprofiles: Vec<UserDto>,
    #[serde(default)]
    pub userprofile_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudsearchResponseDto {
    #[serde(default)]
    pub result: Option<SearchResultDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestArtistRefDto {
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestSongDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub artists: Vec<SuggestArtistRefDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestAlbumDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
    #[serde(default)]
    pub artist: Option<SuggestArtistRefDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestArtistDto {
    pub id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestResultDto {
    #[serde(default)]
    pub songs: Vec<SuggestSongDto>,
    #[serde(default)]
    pub albums: Vec<SuggestAlbumDto>,
    #[serde(default)]
    pub artists: Vec<SuggestArtistDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestResponseDto {
    #[serde(default)]
    pub result: Option<SuggestResultDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotSearchItemDto {
    #[serde(default)]
    pub first: String,
    #[serde(default)]
    pub second: Option<i64>,
    #[serde(default)]
    pub icon_type: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHotResultDto {
    #[serde(default)]
    pub hots: Vec<HotSearchItemDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHotResponseDto {
    #[serde(default)]
    pub result: Option<SearchHotResultDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── comment ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeRepliedDto {
    #[serde(default)]
    pub be_replied_comment_id: i64,
    #[serde(default)]
    pub user: Option<UserDto>,
    #[serde(default)]
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentDto {
    #[serde(default)]
    pub comment_id: i64,
    #[serde(default)]
    pub user: Option<UserDto>,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub time: Option<i64>,
    #[serde(default)]
    pub liked_count: i64,
    #[serde(default)]
    pub liked: Option<bool>,
    #[serde(default)]
    pub be_replied: Option<Vec<BeRepliedDto>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentPageDto {
    #[serde(default)]
    pub comments: Vec<CommentDto>,
    #[serde(default)]
    pub hot_comments: Option<Vec<CommentDto>>,
    #[serde(default)]
    pub total: i64,
    #[serde(default)]
    pub more: bool,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── auth ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDto {
    #[serde(default)]
    pub id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponseDto {
    #[serde(default)]
    pub cookie: String,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub account: Option<AccountDto>,
    #[serde(default)]
    pub profile: Option<UserDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptchaResponseDto {
    #[serde(default)]
    pub data: Option<bool>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrKeyResponseDto {
    #[serde(default)]
    pub unikey: String,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCreateDataDto {
    #[serde(default)]
    pub qrurl: String,
    #[serde(default)]
    pub qrimg: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCreateResponseDto {
    #[serde(default)]
    pub data: Option<QrCreateDataDto>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

/// qr_check 的 code 是轮询状态（800/801/802/803），不做错误处理，由 mapper 映射为枚举。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrCheckResponseDto {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default)]
    pub cookie: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatusDataDto {
    #[serde(default)]
    pub code: i64,
    #[serde(default)]
    pub profile: Option<UserDto>,
}

/// `/api/w/nuser/account/get`（login/status）原始响应直接返回顶层 `profile`；
/// Node 版封装可能再包一层 `data`，这里两种形态都兼容。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatusResponseDto {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default)]
    pub data: Option<LoginStatusDataDto>,
    #[serde(default)]
    pub profile: Option<UserDto>,
}
