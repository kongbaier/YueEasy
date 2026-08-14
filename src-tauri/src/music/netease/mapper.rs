//! DTO → Entity 映射（适配层内纯函数）。
//!
//! 这里是所有"脏数据归一"的落点：字段改名、双形态合并、缺省值兜底。
//! 不涉及任何网络/状态，便于单测。

use crate::music::netease::entity as ent;
use crate::music::netease::raw;

fn map_artist(d: raw::ArtistDto) -> ent::Artist {
    ent::Artist {
        id: d.id,
        name: d.name,
        pic_url: d.pic_url,
        alias: None,
        album_size: None,
        music_size: None,
    }
}

pub fn map_album(d: Option<raw::AlbumDto>) -> ent::Album {
    match d {
        Some(a) => ent::Album {
            id: a.id,
            name: a.name,
            pic_url: a.pic_url,
            artist: a.artist.map(map_artist),
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

pub fn map_song(d: raw::SongDto) -> ent::Song {
    ent::Song {
        id: d.id,
        name: d.name,
        artists: d.artists.into_iter().map(map_artist).collect(),
        album: map_album(d.album),
        duration_ms: d.duration_ms.unwrap_or(0),
        fee: d.fee,
    }
}

fn map_user(d: raw::UserDto) -> ent::User {
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
pub fn map_playlist(d: raw::PlaylistDto) -> ent::Playlist {
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
        comment_count: d.comment_count,
        share_count: d.share_count,
        create_time_ms: d.create_time,
        update_time_ms: d.update_time,
    }
}

fn map_be_replied(d: raw::BeRepliedDto) -> ent::BeReplied {
    ent::BeReplied {
        id: d.be_replied_comment_id,
        user: d.user.map(map_user),
        content: d.content,
    }
}

fn map_comment(d: raw::CommentDto) -> ent::Comment {
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

pub fn map_comment_page(d: raw::CommentPageDto) -> ent::CommentPage {
    ent::CommentPage {
        comments: d.comments.into_iter().map(map_comment).collect(),
        hot_comments: d
            .hot_comments
            .map(|cs| cs.into_iter().map(map_comment).collect()),
        total: d.total,
        more: d.more,
    }
}

pub fn map_song_url(d: raw::SongUrlResponseDto) -> ent::SongUrlResult {
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

fn map_lyric_version(d: Option<raw::LyricVersionDto>) -> Option<ent::LyricVersion> {
    d.map(|v| ent::LyricVersion {
        text: v.lyric,
        version: v.version,
    })
}

pub fn map_lyric(d: raw::LyricResponseDto) -> ent::Lyric {
    ent::Lyric {
        lrc: map_lyric_version(d.lrc),
        tlyric: map_lyric_version(d.tlyric),
        yrc: map_lyric_version(d.yrc),
        klyric: map_lyric_version(d.klyric),
        romalrc: map_lyric_version(d.romalrc),
    }
}

fn map_search_album(d: raw::SearchAlbumDto) -> ent::Album {
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

fn map_search_artist(d: raw::SearchArtistDto) -> ent::Artist {
    ent::Artist {
        id: d.id,
        name: d.name,
        pic_url: Some(d.pic_url),
        alias: Some(d.alias),
        album_size: Some(d.album_size),
        music_size: Some(d.music_size),
    }
}

pub fn map_search_result(d: raw::SearchResultDto) -> ent::SearchResult {
    ent::SearchResult {
        songs: d.songs.into_iter().map(map_song).collect(),
        song_count: d.song_count,
        albums: d.albums.into_iter().map(map_search_album).collect(),
        album_count: d.album_count,
        artists: d.artists.into_iter().map(map_search_artist).collect(),
        artist_count: d.artist_count,
        users: d.userprofiles.into_iter().map(map_user).collect(),
        user_count: d.userprofile_count,
    }
}

pub fn map_suggest_result(d: raw::SuggestResultDto) -> ent::SuggestResult {
    ent::SuggestResult {
        songs: d
            .songs
            .into_iter()
            .map(|s| ent::SuggestSong {
                id: s.id,
                name: s.name,
                artists: s.artists.into_iter().map(|a| a.name).collect(),
            })
            .collect(),
        albums: d
            .albums
            .into_iter()
            .map(|a| ent::SuggestAlbum {
                id: a.id,
                name: a.name,
                artist: a.artist.map(|x| x.name),
            })
            .collect(),
        artists: d
            .artists
            .into_iter()
            .map(|a| ent::SuggestArtist {
                id: a.id,
                name: a.name,
            })
            .collect(),
    }
}

pub fn map_hot_search(result: Option<raw::SearchHotResultDto>) -> Vec<ent::HotSearchItem> {
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

pub fn map_dragon_ball(data: Vec<raw::DragonBallItemDto>) -> Vec<ent::DragonBallItem> {
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

pub fn map_intelligence(data: Vec<raw::IntelligenceItemDto>) -> Vec<ent::IntelligenceSong> {
    data.into_iter()
        .filter_map(|d| {
            d.song_info.map(|s| ent::IntelligenceSong {
                song: map_song(s),
                reason: d.reason,
            })
        })
        .collect()
}

pub fn map_auth_session(d: raw::LoginResponseDto) -> ent::AuthSession {
    ent::AuthSession {
        cookie: d.cookie,
        token: (!d.token.is_empty()).then_some(d.token),
        profile: d.profile.map(map_user),
        account_id: d.account.map(|a| a.id),
    }
}

pub fn map_login_status(d: raw::LoginStatusResponseDto) -> ent::LoginStatus {
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

pub fn map_qr_key(d: raw::QrKeyResponseDto) -> ent::QrKey {
    ent::QrKey { key: d.unikey }
}

pub fn map_qr_create(d: raw::QrCreateResponseDto) -> ent::QrCreate {
    let data = d.data.unwrap_or(raw::QrCreateDataDto {
        qrurl: String::new(),
        qrimg: String::new(),
    });
    ent::QrCreate {
        url: data.qrurl,
        image: data.qrimg,
    }
}

pub fn map_qr_check(d: raw::QrCheckResponseDto) -> ent::QrCheck {
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

pub fn map_recent_songs(d: raw::RecentSongResponseDto) -> ent::RecentSongs {
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
