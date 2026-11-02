//! DTO → Entity 映射（数据处理层纯函数）。
//!
//! 这里是所有"脏数据归一"的落点：字段改名、双形态合并、缺省值兜底。
//! 不涉及任何网络/状态，便于单测。

use crate::model::entity as ent;
use crate::model::response;

fn map_artist(d: response::ArtistDto) -> ent::Artist {
    ent::Artist {
        id: d.id,
        name: d.name,
        pic_url: d.pic_url,
        alias: (!d.alias.is_empty()).then_some(d.alias),
        album_size: d.album_size,
        music_size: d.music_size,
        brief_desc: d.brief_desc,
    }
}

pub fn map_album(d: Option<response::AlbumDto>) -> ent::Album {
    match d {
        Some(a) => ent::Album {
            id: a.id,
            name: a.name,
            pic_url: a.pic_url,
            // 歌手专辑列表用 `artists` 数组、专辑详情用 `artist` 对象，这里归一成同一个字段。
            artist: a
                .artist
                .or_else(|| a.artists.into_iter().next())
                .map(map_artist),
            publish_time_ms: a.publish_time,
            size: a.size,
            company: a.company,
            description: a.description,
        },
        None => ent::Album {
            id: 0,
            name: String::new(),
            pic_url: None,
            artist: None,
            publish_time_ms: None,
            size: None,
            company: None,
            description: None,
        },
    }
}

pub fn map_song(d: response::SongDto) -> ent::Song {
    ent::Song {
        id: d.id,
        name: d.name,
        artists: d.artists.into_iter().map(map_artist).collect(),
        album: map_album(d.album),
        duration_ms: d.duration_ms.unwrap_or(0),
        fee: d.fee,
    }
}

pub fn map_songs(dtos: Vec<response::SongDto>) -> Vec<ent::Song> {
    dtos.into_iter().map(map_song).collect()
}

fn map_user(d: response::UserDto) -> ent::User {
    ent::User {
        id: d.user_id,
        nickname: d.nickname,
        avatar_url: d.avatar_url,
        signature: d.signature,
        gender: d.gender,
        follows: d.follows,
        followeds: d.followeds,
    }
}

fn empty_user() -> ent::User {
    ent::User {
        id: 0,
        nickname: String::new(),
        avatar_url: None,
        signature: None,
        gender: None,
        follows: None,
        followeds: None,
    }
}

/// 统一歌单：把 picUrl / coverImgUrl 归一为 coverUrl。
pub fn map_playlist(d: response::PlaylistDto) -> ent::Playlist {
    let cover_url = d
        .cover_img_url
        .clone()
        .or_else(|| d.pic_url.clone())
        .unwrap_or_default();
    ent::Playlist {
        id: d.id,
        name: d.name,
        cover_url,
        play_count: d.play_count,
        track_count: d.track_count,
        description: d.description,
        creator: d.creator.map(map_user),
        tags: d.tags,
        tracks: d.tracks.map(|ts| ts.into_iter().map(map_song).collect()),
        special_type: d.special_type,
        subscribed_count: d.subscribed_count,
        subscribed: d.subscribed,
        comment_count: d.comment_count,
        share_count: d.share_count,
        create_time_ms: d.create_time,
        update_time_ms: d.update_time,
    }
}

pub fn map_playlists(dtos: Vec<response::PlaylistDto>) -> Vec<ent::Playlist> {
    dtos.into_iter().map(map_playlist).collect()
}

fn map_be_replied(d: response::BeRepliedDto) -> ent::BeReplied {
    ent::BeReplied {
        id: d.be_replied_comment_id,
        user: d.user.map(map_user),
        content: d.content,
    }
}

fn map_comment(d: response::CommentDto) -> ent::Comment {
    ent::Comment {
        id: d.comment_id,
        user: d.user.map(map_user).unwrap_or_else(empty_user),
        content: d.content,
        time_ms: d.time.unwrap_or(0),
        liked_count: d.liked_count,
        liked: d.liked,
        be_replied: d
            .be_replied
            .map(|rs| rs.into_iter().map(map_be_replied).collect()),
    }
}

pub fn map_comment_page(d: response::CommentPageResponseDto) -> ent::CommentPage {
    ent::CommentPage {
        comments: d.comments.into_iter().map(map_comment).collect(),
        hot_comments: d
            .hot_comments
            .map(|cs| cs.into_iter().map(map_comment).collect()),
        total: d.total,
        more: d.more,
    }
}

pub fn map_song_url(d: response::SongUrlResponseDto) -> ent::SongUrlResult {
    ent::SongUrlResult {
        data: d
            .data
            .into_iter()
            .map(|u| ent::SongUrl {
                id: u.id,
                url: u.url.unwrap_or_default(),
                level: u.level,
            })
            .collect(),
    }
}

fn map_lyric_version(d: Option<response::LyricVersionDto>) -> Option<ent::LyricVersion> {
    d.map(|v| ent::LyricVersion {
        text: v.lyric,
        version: v.version,
    })
}

pub fn map_lyric(d: response::LyricResponseDto) -> ent::Lyric {
    ent::Lyric {
        lrc: map_lyric_version(d.lrc),
        tlyric: map_lyric_version(d.tlyric),
        yrc: map_lyric_version(d.yrc),
        klyric: map_lyric_version(d.klyric),
        romalrc: map_lyric_version(d.romalrc),
    }
}

fn map_search_album(d: response::SearchAlbumDto) -> ent::Album {
    ent::Album {
        id: d.id,
        name: d.name,
        pic_url: Some(d.pic_url),
        artist: d.artist.map(map_artist),
        publish_time_ms: Some(d.publish_time),
        size: Some(d.size),
        company: d.company,
        description: None,
    }
}

fn map_search_artist(d: response::SearchArtistDto) -> ent::Artist {
    ent::Artist {
        id: d.id,
        name: d.name,
        pic_url: Some(d.pic_url),
        alias: Some(d.alias),
        album_size: Some(d.album_size),
        music_size: Some(d.music_size),
        brief_desc: None,
    }
}

/// `originCoverType` → 语义枚举。实测取值：1=原唱、2=翻唱、3=其它改编；
/// 缺失或 0 视为「接口未给出关系」，归一为 `None`（前端据此不展示标签）。
fn map_origin_cover_type(raw: Option<i64>) -> Option<ent::OriginCoverType> {
    match raw {
        Some(1) => Some(ent::OriginCoverType::Original),
        Some(2) => Some(ent::OriginCoverType::Cover),
        None | Some(0) => None,
        Some(_) => Some(ent::OriginCoverType::Other),
    }
}

/// 搜索歌曲：核心走共享的 `map_song`，只额外解释原唱/翻唱标记。
pub fn map_search_song(d: response::SearchSongDto) -> ent::SearchSong {
    let origin_cover_type = map_origin_cover_type(d.origin_cover_type);
    ent::SearchSong {
        song: map_song(d.core),
        origin_cover_type,
    }
}

pub fn map_search_result(d: response::SearchResultDto) -> ent::SearchResult {
    ent::SearchResult {
        songs: d.songs.into_iter().map(map_search_song).collect(),
        song_count: d.song_count,
        albums: d.albums.into_iter().map(map_search_album).collect(),
        album_count: d.album_count,
        artists: d.artists.into_iter().map(map_search_artist).collect(),
        artist_count: d.artist_count,
        users: d.userprofiles.into_iter().map(map_user).collect(),
        user_count: d.userprofile_count,
    }
}

/// 搜索建议（PC 关键词联想）：把 `highLightInfo` 这个 JSON 字符串解析成分段文本。
/// 缺失 / 解析失败时退化成「整串不高亮」，保证下拉永远有可点文本。
pub fn map_keyword_suggest(data: response::PcSuggestDataDto) -> Vec<ent::KeywordSuggest> {
    data.suggests
        .into_iter()
        .filter(|s| !s.keyword.trim().is_empty())
        .map(|s| {
            let highlights = map_suggest_highlights(s.high_light_info.as_deref(), &s.keyword);
            ent::KeywordSuggest {
                keyword: s.keyword,
                tag: s.tag,
                highlights,
            }
        })
        .collect()
}

fn map_suggest_highlights(raw: Option<&str>, keyword: &str) -> Vec<ent::SuggestHighlight> {
    let parsed = raw
        .and_then(|r| serde_json::from_str::<Vec<response::SuggestHighlightDto>>(r).ok())
        .unwrap_or_default();

    if parsed.is_empty() {
        return vec![ent::SuggestHighlight {
            text: keyword.to_string(),
            highlighted: false,
        }];
    }

    parsed
        .into_iter()
        .map(|h| ent::SuggestHighlight {
            text: h.text,
            highlighted: h.highlighted,
        })
        .collect()
}

pub fn map_hot_search(result: Option<response::SearchHotResultDto>) -> Vec<ent::HotSearchItem> {
    result
        .map(|r| {
            r.hots
                .into_iter()
                .map(|h| ent::HotSearchItem {
                    keyword: h.first,
                    score: h.second,
                    icon_type: h.icon_type,
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn map_dragon_ball(data: Vec<response::DragonBallItemDto>) -> Vec<ent::DragonBallItem> {
    data.into_iter()
        .map(|d| ent::DragonBallItem {
            id: d.id,
            name: d.name.or(d.title),
            icon_url: d.icon_url,
            resource_id: d.resource_id,
            resource_type: d.resource_type,
        })
        .collect()
}

pub fn map_intelligence(data: Vec<response::IntelligenceItemDto>) -> Vec<ent::IntelligenceSong> {
    data.into_iter()
        .filter_map(|d| {
            d.song_info.map(|s| ent::IntelligenceSong {
                song: map_song(s),
                reason: d.reason,
            })
        })
        .collect()
}

pub fn map_auth_session(d: response::LoginResponseDto) -> ent::AuthSession {
    ent::AuthSession {
        cookie: d.cookie,
        token: (!d.token.is_empty()).then_some(d.token),
        profile: d.profile.map(map_user),
        account_id: d.account.map(|a| a.id),
    }
}

pub fn map_login_status(d: response::LoginStatusResponseDto) -> ent::LoginStatus {
    let profile = d
        .data
        .filter(|data| data.code == 200)
        .and_then(|data| data.profile)
        .or_else(|| {
            if d.code == Some(200) {
                d.profile
            } else {
                None
            }
        });
    ent::LoginStatus {
        profile: profile.map(map_user),
    }
}

pub fn map_qr_key(d: response::QrKeyResponseDto) -> ent::QrKey {
    ent::QrKey { key: d.unikey }
}

pub fn map_qr_create(d: response::QrCreateResponseDto) -> ent::QrCreate {
    let data = d.data.unwrap_or(response::QrCreateDataDto {
        qrurl: String::new(),
        qrimg: String::new(),
    });
    ent::QrCreate {
        url: data.qrurl,
        image: data.qrimg,
    }
}

pub fn map_qr_check(d: response::QrCheckResponseDto) -> ent::QrCheck {
    let status = match d.code {
        Some(800) => ent::QrCheckStatus::Expired,
        Some(801) => ent::QrCheckStatus::Waiting,
        Some(802) => ent::QrCheckStatus::Scanned,
        Some(803) => ent::QrCheckStatus::Confirmed,
        _ => ent::QrCheckStatus::Failed,
    };
    ent::QrCheck {
        status,
        cookie: d.cookie,
    }
}

pub fn map_recent_songs(d: response::RecentSongResponseDto) -> ent::RecentSongs {
    let list = d
        .data
        .map(|data| {
            data.list
                .into_iter()
                .filter_map(|item| {
                    item.data.map(|song| ent::RecentSong {
                        song: map_song(song),
                        play_time_ms: item.play_time,
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    ent::RecentSongs { list }
}

// ── 整包响应的组合映射 ─────────────────────────────────────────────
//
// 接口直接返回 `{ 字段1, 字段2, code, message }` 时，「选取哪几个字段组成 Entity」
// 的决定放在这里，service 只负责「取包 + 交给 mapper」；否则这段构造逻辑会
// 散落在 service 里、绕开本模块的可单测性。

pub fn map_album_detail(d: response::AlbumDetailResponseDto) -> ent::AlbumDetail {
    ent::AlbumDetail {
        album: map_album(d.album),
        songs: map_songs(d.songs),
    }
}

pub fn map_artist_detail(d: response::ArtistDetailResponseDto) -> ent::ArtistDetail {
    ent::ArtistDetail {
        artist: d.artist.map(map_artist).unwrap_or_else(|| ent::Artist {
            id: 0,
            name: String::new(),
            pic_url: None,
            alias: None,
            album_size: None,
            music_size: None,
            brief_desc: None,
        }),
        hot_songs: map_songs(d.hot_songs),
        more: d.more,
    }
}

pub fn map_artist_albums(d: response::ArtistAlbumResponseDto) -> ent::ArtistAlbumPage {
    ent::ArtistAlbumPage {
        albums: d
            .hot_albums
            .into_iter()
            .map(|a| map_album(Some(a)))
            .collect(),
        more: d.more,
    }
}

pub fn map_user_detail(d: response::UserDetailResponseDto) -> ent::UserDetail {
    let playlist_count = d.profile.as_ref().and_then(|p| p.playlist_count);
    let create_time_ms = d.profile.as_ref().and_then(|p| p.create_time);
    let user = d.profile.map(map_user).unwrap_or_else(empty_user);
    ent::UserDetail {
        user,
        level: d.level,
        listen_songs: d.listen_songs,
        playlist_count,
        create_time_ms,
    }
}

pub fn map_cloud_page(d: response::CloudResponseDto) -> ent::CloudPage {
    ent::CloudPage {
        items: d.data.into_iter().map(map_cloud_file).collect(),
        count: d.count.unwrap_or(0),
        used_bytes: d.size,
        max_bytes: d.max_size,
    }
}

/// 云盘文件 → Entity。
///
/// 歌名 / 歌手 / 专辑可能来自两个地方，优先级：`simpleSong` → 文件层扁平字段。
/// 云盘歌曲的 `simpleSong` 经常只给歌名（`ar` / `al` 为空），此时用扁平字段补齐，
/// 否则前端只能显示「未知歌手」——而网易云客户端里是能看到歌手名的。
fn map_cloud_file(f: response::CloudFileDto) -> ent::CloudFile {
    let mut song = f.simple_song.map(map_song);

    if let Some(song) = song.as_mut() {
        // 实测：云盘歌曲的 `ar[]` 里可能出现只有 id、名字为空的对象，
        // 此时列表会渲染成空白；先剔掉无名条目，再用扁平字段补齐。
        song.artists.retain(|artist| !artist.name.is_empty());
        if song.artists.is_empty() && !f.artist.is_empty() {
            song.artists = flat_artists(&f.artist);
        }
        if song.album.name.is_empty() {
            if let Some(album) = f.album.clone() {
                song.album.name = album;
            }
        }
    } else if let Some(name) = f.song_name.clone() {
        // 没有 `simpleSong` 但有扁平歌名：造一个最小 Song（无封面 / 无时长，专辑 id=0）。
        song = Some(ent::Song {
            id: f.song_id,
            name,
            artists: flat_artists(&f.artist),
            album: ent::Album {
                id: 0,
                name: f.album.clone().unwrap_or_default(),
                pic_url: None,
                artist: None,
                publish_time_ms: None,
                size: None,
                company: None,
                description: None,
            },
            duration_ms: 0,
            fee: None,
        });
    }

    ent::CloudFile {
        song_id: f.song_id,
        format: file_format(&f.file_name),
        file_name: f.file_name,
        file_size_bytes: f.file_size,
        add_time_ms: f.add_time,
        song,
    }
}

/// 扁平歌手名 → Entity（接口只给了名字，没有 id，统一造 id=0）。
/// 前端凭 id=0 判断「不可跳转歌手页」，只展示名字。
fn flat_artists(names: &[String]) -> Vec<ent::Artist> {
    names
        .iter()
        .map(|name| ent::Artist {
            id: 0,
            name: name.clone(),
            pic_url: None,
            alias: None,
            album_size: None,
            music_size: None,
            brief_desc: None,
        })
        .collect()
}

/// 从文件名后缀取格式：`a.flac` → `flac`。
/// 只接受短小写化后全是 ASCII 字母数字的后缀，避免把 `xxx.2024` 这类尾巴当格式。
fn file_format(file_name: &str) -> Option<String> {
    let ext = file_name.rsplit_once('.')?.1.trim().to_ascii_lowercase();
    let ok = !ext.is_empty() && ext.len() <= 5 && ext.chars().all(|c| c.is_ascii_alphanumeric());
    ok.then_some(ext)
}

pub fn map_playlist_page(d: response::TopPlaylistResponseDto) -> ent::PlaylistPage {
    ent::PlaylistPage {
        playlists: map_playlists(d.playlists),
        total: d.total,
        more: d.more,
    }
}

pub fn map_playlist_hot(d: response::PlaylistHotResponseDto) -> Vec<ent::PlaylistHotTag> {
    d.tags
        .into_iter()
        .map(|t| ent::PlaylistHotTag {
            id: t.id,
            name: t.name,
            category: t.category,
        })
        .collect()
}

pub fn map_banners(dtos: Vec<response::BannerDto>) -> Vec<ent::Banner> {
    dtos.into_iter()
        .map(|b| ent::Banner {
            big_image_url: b.big_image_url,
            image_url: b.image_url,
            target_id: b.target_id,
            target_type: b.target_type,
            type_title: b.type_title,
            url: b.url,
        })
        .collect()
}

pub fn map_like_list(d: response::LikeListResponseDto) -> ent::LikeList {
    ent::LikeList { ids: d.ids }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::entity::OriginCoverType;
    use serde_json::json;

    fn search_song(origin_cover_type: Option<i64>) -> ent::SearchSong {
        let mut value = json!({
            "id": 287398,
            "name": "我不难过",
            "ar": [{ "id": 9272, "name": "孙燕姿" }],
            "al": { "id": 28539, "name": "未完成" },
            "dt": 320400,
            "fee": 1
        });
        if let Some(t) = origin_cover_type {
            value["originCoverType"] = json!(t);
        }
        let dto: response::SearchSongDto = serde_json::from_value(value).expect("decode");
        map_search_song(dto)
    }

    /// 实测取值：1=原唱、2=翻唱、3=其它改编。
    #[test]
    fn origin_cover_type_known_values() {
        assert_eq!(
            search_song(Some(1)).origin_cover_type,
            Some(OriginCoverType::Original)
        );
        assert_eq!(
            search_song(Some(2)).origin_cover_type,
            Some(OriginCoverType::Cover)
        );
        assert_eq!(
            search_song(Some(3)).origin_cover_type,
            Some(OriginCoverType::Other)
        );
    }

    /// 0 与缺失都表示「接口没给出关系」，不是 `Other`——否则前端会给正常歌曲挂标签。
    #[test]
    fn origin_cover_type_absent_or_zero_is_none() {
        assert_eq!(search_song(None).origin_cover_type, None);
        assert_eq!(search_song(Some(0)).origin_cover_type, None);
    }

    /// 核心仍走共享的 `map_song`，flatten 之后不许漏字段。
    #[test]
    fn search_song_keeps_core_intact() {
        let item = search_song(Some(1));
        assert_eq!(item.song.id, 287398);
        assert_eq!(item.song.name, "我不难过");
        assert_eq!(item.song.duration_ms, 320400);
        assert_eq!(item.song.fee, Some(1));
        assert_eq!(item.song.artists[0].name, "孙燕姿");
        assert_eq!(item.song.album.name, "未完成");
    }

    /// `flatten` 必须真的把核心摊平到同一层，前端才能继续用 `item.name`。
    #[test]
    fn search_song_serializes_flat() {
        let value = serde_json::to_value(search_song(Some(1))).expect("serialize");
        let obj = value.as_object().expect("object");
        assert_eq!(obj.get("name"), Some(&json!("我不难过")));
        assert_eq!(obj.get("id"), Some(&json!(287398)));
        assert_eq!(obj.get("originCoverType"), Some(&json!("original")));
        // 不许出现嵌套的 song 字段
        assert!(obj.get("song").is_none());
    }

    /// 未给出关系时该字段应整体省略，前端类型是可选。
    #[test]
    fn search_song_omits_absent_origin_cover_type() {
        let value = serde_json::to_value(search_song(None)).expect("serialize");
        assert!(value.as_object().expect("object").get("originCoverType").is_none());
    }

    /// `highLightInfo` 是 JSON 字符串，解析后必须还原分段与高亮标记（实测键名 `highLighted`）。
    #[test]
    fn keyword_suggest_parses_highlight_segments() {
        let dto: response::PcSuggestDataDto = serde_json::from_value(json!({
            "suggests": [{
                "keyword": "天龙八部之宿敌DJ",
                "tag": "热搜",
                "highLightInfo": "[{\"text\":\"天龙八部之宿敌\",\"highLighted\":true},{\"text\":\"DJ\",\"highLighted\":false}]"
            }]
        }))
        .expect("decode");

        let items = map_keyword_suggest(dto);
        assert_eq!(items.len(), 1);
        let item = &items[0];
        assert_eq!(item.keyword, "天龙八部之宿敌DJ");
        assert_eq!(item.tag.as_deref(), Some("热搜"));
        assert_eq!(item.highlights.len(), 2);
        assert_eq!(item.highlights[0].text, "天龙八部之宿敌");
        assert!(item.highlights[0].highlighted);
        assert_eq!(item.highlights[1].text, "DJ");
        assert!(!item.highlights[1].highlighted);
    }

    /// 高亮信息缺失 / 坏 JSON 时退化为整串不高亮，且丢掉空关键词。
    #[test]
    fn keyword_suggest_falls_back_when_highlight_missing() {
        let dto: response::PcSuggestDataDto = serde_json::from_value(json!({
            "suggests": [
                { "keyword": "晴天", "tag": null, "highLightInfo": null },
                { "keyword": "  " }
            ]
        }))
        .expect("decode");

        let items = map_keyword_suggest(dto);
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].keyword, "晴天");
        assert_eq!(items[0].tag, None);
        assert_eq!(items[0].highlights.len(), 1);
        assert_eq!(items[0].highlights[0].text, "晴天");
        assert!(!items[0].highlights[0].highlighted);
    }

    fn cloud_page(file: serde_json::Value) -> ent::CloudPage {
        let dto: response::CloudResponseDto = serde_json::from_value(json!({
            "code": 200,
            "count": 1,
            "size": 1024,
            "maxSize": 2048,
            "data": [file]
        }))
        .expect("decode");
        map_cloud_page(dto)
    }

    /// 云盘歌曲的 `simpleSong` 只给歌名时，歌手 / 专辑用文件层扁平字段补齐（实测：
    /// 官方客户端能显示歌手名，而 `simpleSong.ar` 为空会让列表只剩歌名）。
    #[test]
    fn cloud_file_falls_back_to_flat_artist_and_album() {
        let page = cloud_page(json!({
            "songId": 123,
            "fileName": "云间独觉 - 某曲.flac",
            "fileSize": 1024,
            "addTime": 1700000000000_i64,
            "songName": "某曲",
            "artist": "云间独觉",
            "album": "某专辑",
            "simpleSong": { "id": 123, "name": "某曲", "ar": [], "al": null, "dt": 0 }
        }));

        let song = page.items[0].song.as_ref().expect("song");
        assert_eq!(song.artists.len(), 1);
        assert_eq!(song.artists[0].name, "云间独觉");
        // 扁平字段没有歌手 id，造 id=0 → 前端不跳歌手页
        assert_eq!(song.artists[0].id, 0);
        assert_eq!(song.album.name, "某专辑");
        assert_eq!(page.items[0].format.as_deref(), Some("flac"));
    }

    /// `ar[]` 里只有 id、名字为空对象时属于「无名歌手」，同样走扁平回退，
    /// 且扁平字段支持 `A/B` 多歌手写法与对象数组写法。
    #[test]
    fn cloud_file_ignores_nameless_artists_and_splits_flat_names() {
        let page = cloud_page(json!({
            "songId": 7,
            "fileName": "a.mp3",
            "artist": "歌手甲/歌手乙",
            "simpleSong": {
                "id": 7,
                "name": "歌",
                "ar": [{ "id": 99, "name": "" }],
                "al": { "id": 0, "name": "" }
            }
        }));

        let song = page.items[0].song.as_ref().expect("song");
        let names: Vec<&str> = song.artists.iter().map(|a| a.name.as_str()).collect();
        assert_eq!(names, vec!["歌手甲", "歌手乙"]);
        // 专辑名缺失时保留空串，由前端展示「未知专辑」
        assert_eq!(song.album.name, "");

        let page = cloud_page(json!({
            "songId": 8,
            "fileName": "b.flac",
            "artist": [{ "name": "歌手丙" }],
            "simpleSong": { "id": 8, "name": "歌", "ar": [], "al": null }
        }));
        let song = page.items[0].song.as_ref().expect("song");
        assert_eq!(song.artists.len(), 1);
        assert_eq!(song.artists[0].name, "歌手丙");
    }

    /// 未匹配到曲库（没有 `simpleSong`、没有扁平歌名）的文件保留在列表里但 `song` 为空。
    #[test]
    fn cloud_file_without_song_is_kept_unplayable() {
        let page = cloud_page(json!({
            "songId": 0,
            "fileName": "未知文件",
            "fileSize": 10,
            "addTime": 1700000000000_i64
        }));

        assert_eq!(page.items.len(), 1);
        assert!(page.items[0].song.is_none());
        // 没有后缀 → 不给格式
        assert!(page.items[0].format.is_none());
        assert_eq!(page.count, 1);
        assert_eq!(page.used_bytes, Some(1024));
        assert_eq!(page.max_bytes, Some(2048));
    }
}
