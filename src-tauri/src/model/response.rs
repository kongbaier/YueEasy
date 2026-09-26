//! 各接口原始响应 DTO（Response）。
//!
//! 这里允许用 `#[serde(rename)]` / `#[serde(alias)]` 对齐 API 的脏字段名（ar/al/dt、
//! picUrl/coverImgUrl、artists/album/duration 等）；缺字段用 `#[serde(default)]` 兜底。
//! DTO 只存在于数据处理层内部，绝不直接返回前端。

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
    /// 当前登录用户是否已收藏该歌单（仅歌单详情接口返回）。
    #[serde(default)]
    pub subscribed: Option<bool>,
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
pub struct PlaylistSubscribeResponseDto {
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

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

/// 搜索结果里的歌曲 = 共享核心 `SongDto` + 搜索场景需要的附加判定。
///
/// 用 `flatten` 复用核心，本结构只声明差异——核心 `SongDto` 因此不会随接口数量
/// 增长成「所有接口字段的并集」。
///
/// 搜索是「同一首歌多版本并存」的重灾区（一首歌能搜出十几个翻唱），所以原唱/翻唱
/// 的判定属于搜索场景。（实测 `originCoverType` 也出现在 `song_detail` /
/// `playlist_detail`，但不在 `album` 的 songs 与 `/api/search/get` 里。）
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSongDto {
    #[serde(flatten)]
    pub core: SongDto,
    /// 原唱/翻唱标记，取值见 `mapper::map_origin_cover_type`
    #[serde(default)]
    pub origin_cover_type: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultDto {
    #[serde(default)]
    pub songs: Vec<SearchSongDto>,
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
pub struct CommentPageResponseDto {
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// `SearchSongDto` 用 `flatten` 复用核心，而核心里有
    /// `deserialize_with = "de_string_nullable"`——flatten 走的是 buffered
    /// `Content` 反序列化器，这是 serde 的已知易踩点，所以这里锁住它：
    /// flatten 之后核心字段与 `originCoverType` 都要各就各位。
    ///
    /// 输入已按 `client::fetch` 的 `normalize_numbers` 之后的状态给（整数写整数），
    /// 因为 DTO 只会看到归一后的 `Value`。
    #[test]
    fn search_song_merges_flattened_core_and_origin_cover_type() {
        let value = json!({
            "id": 186016,
            "name": "晴天",
            "ar": [{ "id": 6452, "name": "周杰伦" }],
            "al": { "id": 185811, "name": "叶惠美", "picUrl": "https://x/p.jpg" },
            "dt": 269743,
            "fee": 0,
            "originCoverType": 1
        });

        let dto: SearchSongDto = serde_json::from_value(value).expect("decode search song");

        assert_eq!(dto.origin_cover_type, Some(1));
        assert_eq!(dto.core.id, 186016);
        assert_eq!(dto.core.name, "晴天");
        assert_eq!(dto.core.duration_ms, Some(269743));
        assert_eq!(dto.core.artists.len(), 1);
        assert_eq!(dto.core.artists[0].name, "周杰伦");
        assert_eq!(dto.core.album.as_ref().map(|a| a.name.as_str()), Some("叶惠美"));
    }

    /// `/api/search/get` 与 album 的 songs 不发该字段，`default` 要兜成 None 而不是 decode 失败。
    #[test]
    fn search_song_tolerates_missing_origin_cover_type() {
        let value = json!({
            "id": 1,
            "name": "无标记",
            "ar": [],
            "al": null,
            "dt": 1000
        });

        let dto: SearchSongDto = serde_json::from_value(value).expect("decode without originCoverType");

        assert_eq!(dto.origin_cover_type, None);
        assert_eq!(dto.core.name, "无标记");
    }

    /// 核心的 `alias`（`artists`/`album`/`duration`）在 flatten 之后必须照常生效，
    /// 否则 personal_fm 那一路的命名会退化。
    #[test]
    fn search_song_keeps_alias_support_through_flatten() {
        let value = json!({
            "id": 2,
            "name": "FM 曲目",
            "artists": [{ "id": 7, "name": "某歌手" }],
            "album": { "id": 8, "name": "某专辑" },
            "duration": 123456
        });

        let dto: SearchSongDto = serde_json::from_value(value).expect("decode aliased core");

        assert_eq!(dto.core.duration_ms, Some(123456));
        assert_eq!(dto.core.artists[0].name, "某歌手");
        assert_eq!(dto.core.album.as_ref().map(|a| a.id), Some(8));
    }

    /// 网易云会把字符串字段发成 null，`de_string_nullable` 要把 null 归一成空串
    /// 而不是 decode 失败——flatten 之后这条保障同样要成立。
    #[test]
    fn search_song_nullable_name_becomes_empty_string() {
        let value = json!({
            "id": 3,
            "name": null,
            "ar": [{ "id": 1, "name": null }],
            "al": null,
            "dt": 0
        });

        let dto: SearchSongDto = serde_json::from_value(value).expect("decode null name");

        assert_eq!(dto.core.name, "");
        assert_eq!(dto.core.artists[0].name, "");
    }
}
