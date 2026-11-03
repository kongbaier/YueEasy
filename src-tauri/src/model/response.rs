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
    /// 只有歌手详情 / 搜索歌手会给出；歌曲内嵌歌手缺省为空。
    #[serde(default)]
    pub alias: Vec<String>,
    #[serde(default)]
    pub album_size: Option<i64>,
    #[serde(default)]
    pub music_size: Option<i64>,
    #[serde(default)]
    pub brief_desc: Option<String>,
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
    /// 歌手专辑列表（`hotAlbums`）用 `artists` 数组表示作者，与 `artist` 二选一。
    #[serde(default)]
    pub artists: Vec<ArtistDto>,
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
    /// 仅用户详情接口返回（用户列表 / 歌单创建者不带）。
    #[serde(default)]
    pub playlist_count: Option<i64>,
    #[serde(default)]
    pub create_time: Option<i64>,
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

/// `/api/feedback/weblog`（听歌上报）：成功只回 `code`，无数据体。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScrobbleResponseDto {
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

// ── artist / user ──────────────────────────────────────────────────

/// `/api/v1/artist/{id}`：歌手信息 + 热门歌曲一次取回。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistDetailResponseDto {
    #[serde(default)]
    pub artist: Option<ArtistDto>,
    #[serde(default)]
    pub hot_songs: Vec<SongDto>,
    #[serde(default)]
    pub more: bool,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

/// `/api/artist/albums/{id}`：歌手的专辑分页。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtistAlbumResponseDto {
    #[serde(default)]
    pub hot_albums: Vec<AlbumDto>,
    #[serde(default)]
    pub more: bool,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

/// `/api/v1/user/detail/{uid}`：`profile` 是用户本体，level / listenSongs 在外层。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDetailResponseDto {
    #[serde(default)]
    pub profile: Option<UserDto>,
    #[serde(default)]
    pub level: Option<i64>,
    #[serde(default)]
    pub listen_songs: Option<i64>,
    #[serde(default)]
    pub code: Option<i64>,
    #[serde(default, alias = "msg")]
    pub message: Option<String>,
}

// ── cloud（音乐云盘） ──────────────────────────────────────────────

/// 云盘文件的 `artist` 字段形态不稳定：可能是 `"A/B"` 字符串、单个对象或对象数组。
/// 这里统一降级为「名字列表」（丢掉 id，mapper 侧造 id=0 的歌手），
/// 只为在 `simpleSong` 缺歌手时还能把歌手名展示出来。
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum ArtistNameRaw {
    Text(String),
    One(ArtistNameOnly),
    Many(Vec<ArtistNameOnly>),
}

#[derive(Debug, Clone, Deserialize)]
struct ArtistNameOnly {
    #[serde(default, deserialize_with = "de_string_nullable")]
    name: String,
}

fn de_artist_names<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = Option::<ArtistNameRaw>::deserialize(deserializer)?;
    let names: Vec<String> = match raw {
        None => Vec::new(),
        Some(ArtistNameRaw::Text(text)) => text
            .split('/')
            .map(|name| name.trim().to_string())
            .collect(),
        Some(ArtistNameRaw::One(one)) => vec![one.name],
        Some(ArtistNameRaw::Many(list)) => list.into_iter().map(|a| a.name).collect(),
    };
    Ok(names.into_iter().filter(|n| !n.is_empty()).collect())
}

/// 云盘文件的 `album` 字段同理：可能是字符串，也可能是 `{ name, id }` 对象。
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum AlbumNameRaw {
    Text(String),
    Detail(AlbumNameOnly),
}

#[derive(Debug, Clone, Deserialize)]
struct AlbumNameOnly {
    #[serde(default, deserialize_with = "de_string_nullable")]
    name: String,
}

fn de_album_name<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = Option::<AlbumNameRaw>::deserialize(deserializer)?;
    let name = match raw {
        None => None,
        Some(AlbumNameRaw::Text(text)) => Some(text),
        Some(AlbumNameRaw::Detail(detail)) => Some(detail.name),
    };
    Ok(name.filter(|n| !n.is_empty()))
}

/// `/api/v1/cloud/get` 的 `data[]` 每项：云盘文件 + 内嵌歌曲。
///
/// 两种形状都存在：新版把歌曲完整放在 `simpleSong` 里；老版（以及部分账号）只在
/// 文件层给扁平的 `songName` / `artist` / `album`。两种都收，mapper 侧合成为一个 Song。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudFileDto {
    #[serde(default)]
    pub song_id: i64,
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub file_name: String,
    /// 扁平回退：老版云盘文件的歌名 / 歌手名 / 专辑名
    #[serde(default)]
    pub song_name: Option<String>,
    #[serde(default, deserialize_with = "de_artist_names")]
    pub artist: Vec<String>,
    #[serde(default, deserialize_with = "de_album_name")]
    pub album: Option<String>,
    #[serde(default)]
    pub file_size: Option<i64>,
    #[serde(default)]
    pub add_time: Option<i64>,
    /// 聚合歌曲；未匹配到曲库的文件没有该字段。
    #[serde(default, alias = "song")]
    pub simple_song: Option<SongDto>,
}

/// `/api/v1/cloud/get`：`data` 是分页后的文件列表，`count` / `size` / `maxSize`
/// 是**全局**口径（文件总数 / 已用容量 / 总容量，单位字节），不随 limit 变化。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudResponseDto {
    #[serde(default)]
    pub data: Vec<CloudFileDto>,
    #[serde(default)]
    pub count: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub max_size: Option<i64>,
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

/// 搜索建议里的高亮分段（PC 关键词接口把高亮信息塞进一个 JSON 字符串里）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuggestHighlightDto {
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub text: String,
    /// 实测字段名是大写的 `highLighted`，与 camelCase 规则不一致。
    #[serde(default, alias = "highLighted")]
    pub highlighted: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcSuggestItemDto {
    #[serde(default, deserialize_with = "de_string_nullable")]
    pub keyword: String,
    /// 角标，如「热搜」；多数条目为 null。
    #[serde(default)]
    pub tag: Option<String>,
    /// JSON 编码的字符串：`[{"text":"…","highLighted":true}]`，由 mapper 解析。
    #[serde(default)]
    pub high_light_info: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcSuggestDataDto {
    #[serde(default)]
    pub suggests: Vec<PcSuggestItemDto>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PcSuggestResponseDto {
    #[serde(default)]
    pub data: Option<PcSuggestDataDto>,
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

// ── 顶层信封 ───────────────────────────────────────────────────────

/// 顶层响应信封：告诉请求管道（`service::ncm::NcmService::call`）「这个响应带业务 code」。
///
/// 「哪些 code 算成功」是**响应形状**的知识，所以声明在类型上、而不是散落在每个调用点：
/// - 绝大多数接口：`code()` 返回 `self.code`，非 200/201 即业务失败
/// - 少数接口的 code 不是成败信号（见下方两个显式实现），`code()` 返回 `None`，管道跳过校验
pub trait Envelope {
    /// 业务 code；`None` 表示该响应不参与「成功码白名单」校验。
    fn code(&self) -> Option<i64>;
    /// 面向用户的失败文案（与 code 配对出现）。
    fn message(&self) -> Option<&str>;
}

/// 标准信封：`{ code, message }`。
macro_rules! impl_envelope {
    ($($dto:ty),* $(,)?) => {$(
        impl Envelope for $dto {
            fn code(&self) -> Option<i64> {
                self.code
            }

            fn message(&self) -> Option<&str> {
                self.message.as_deref()
            }
        }
    )*};
}

impl_envelope!(
    SongUrlResponseDto,
    SongDetailResponseDto,
    LyricResponseDto,
    AlbumDetailResponseDto,
    LikeResponseDto,
    ScrobbleResponseDto,
    LikeListResponseDto,
    RecentSongResponseDto,
    ArtistDetailResponseDto,
    ArtistAlbumResponseDto,
    UserDetailResponseDto,
    CloudResponseDto,
    PlaylistSubscribeResponseDto,
    PlaylistDetailResponseDto,
    UserPlaylistResponseDto,
    PersonalizedResponseDto,
    TopPlaylistResponseDto,
    PlaylistHotResponseDto,
    RecommendResourceResponseDto,
    BannerResponseDto,
    RecommendSongsResponseDto,
    PersonalFmResponseDto,
    FmTrashResponseDto,
    DragonBallResponseDto,
    IntelligenceResponseDto,
    CloudsearchResponseDto,
    PcSuggestResponseDto,
    SearchHotResponseDto,
    CommentPageResponseDto,
    LoginResponseDto,
    CaptchaResponseDto,
    QrKeyResponseDto,
    QrCreateResponseDto,
);

/// `qr_check` 的 code 是轮询状态（800/801/802/803），不是成败，由 mapper 映射为枚举。
impl Envelope for QrCheckResponseDto {
    fn code(&self) -> Option<i64> {
        None
    }

    fn message(&self) -> Option<&str> {
        None
    }
}

/// `login/status` 未登录时返回非 200（如 301），那是「没登录」而不是「请求失败」，不报错。
impl Envelope for LoginStatusResponseDto {
    fn code(&self) -> Option<i64> {
        None
    }

    fn message(&self) -> Option<&str> {
        None
    }
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

    /// 信封校验只认标准 `{ code, message }`；`login/status` 与 `qr_check` 的 code 必须
    /// 被声明为「不校验」，否则未登录（301）与轮询态（801）会被误判成请求失败。
    #[test]
    fn envelope_declares_which_codes_are_not_failures() {
        let detail: PlaylistDetailResponseDto =
            serde_json::from_value(json!({ "code": 502, "message": "无权限" })).expect("decode");
        assert_eq!(detail.code(), Some(502));
        assert_eq!(detail.message(), Some("无权限"));

        let status: LoginStatusResponseDto =
            serde_json::from_value(json!({ "code": 301 })).expect("decode");
        assert_eq!(status.code(), None);

        let qr: QrCheckResponseDto =
            serde_json::from_value(json!({ "code": 801 })).expect("decode");
        assert_eq!(qr.code(), None);
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
