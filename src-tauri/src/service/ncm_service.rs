//! NCM 领域服务：浅包 `infra::ncm`（客户端取数 + 归一 + 业务 code 校验）。
//! 服务层不感知 IPC；cmd 薄壳直接调本服务。

use ncm_api_rs::Query;
use tauri::AppHandle;

use crate::core::types::QueueItem;
use crate::infra::ncm::client::{self, run_dto};
use crate::infra::ncm::cookie::{merge_cookies, persist_cookie};
use crate::infra::ncm::entity::{
    AlbumDetail, AuthSession, Banner, CommentPage, DragonBallItem, HotSearchItem, IntelligenceSong,
    LikeList, LoginStatus, Lyric, Playlist, PlaylistHotTag, PlaylistPage, QrCheck, QrCreate, QrKey,
    RecentSongs, SearchResult, Song, SongUrlResult, SuggestResult,
};
use crate::infra::ncm::error::{check_code, NcmApiError, Result};
use crate::infra::ncm::mapper;
use crate::infra::ncm::raw;
use crate::infra::ncm::NcmState;

pub struct NcmService;

impl NcmService {
    fn map_playlists(dtos: Vec<raw::PlaylistDto>) -> Vec<Playlist> {
        dtos.into_iter().map(mapper::map_playlist).collect()
    }

    /// Song → QueueItem（Phase D：FM 取歌 / 播放命令用）。
    /// mapper 只允许出现在 service 与 infra 层（AGENTS.md）；core 不感知 ncm entity。
    pub fn song_to_queue_item(song: &Song) -> QueueItem {
        QueueItem {
            track_id: song.id as u64,
            title: song.name.clone(),
            artist: song
                .artists
                .iter()
                .map(|a| a.name.clone())
                .collect::<Vec<_>>()
                .join(" / "),
            album: song.album.name.clone(),
            cover_url: song.album.pic_url.clone().unwrap_or_default(),
            duration_secs: song.duration_ms as f64 / 1000.0,
        }
    }

    // ── auth ────────────────────────────────────────────────────────

    pub async fn login_cellphone(
        app: &AppHandle,
        state: &NcmState,
        phone: String,
        password: Option<String>,
        captcha: Option<String>,
        countrycode: Option<String>,
    ) -> Result<AuthSession> {
        let mut q = Query::new().param("phone", &phone);
        q = client::opt(q, "password", password.as_deref());
        q = client::opt(q, "captcha", captcha.as_deref());
        q = client::opt(q, "countrycode", countrycode.as_deref());
        let dto: raw::LoginResponseDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.login_cellphone(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_auth_session(dto))
    }

    pub async fn captcha_sent(app: &AppHandle, state: &NcmState, phone: String) -> Result<()> {
        let dto: raw::CaptchaResponseDto = run_dto(
            state,
            app,
            Query::new().param("phone", &phone),
            |c, q| async move { c.captcha_sent(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        if dto.data == Some(false) {
            let message = dto
                .message
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| "验证码发送失败".to_string());
            return Err(NcmApiError::Api { message });
        }
        Ok(())
    }

    pub async fn captcha_verify(
        app: &AppHandle,
        state: &NcmState,
        phone: String,
        captcha: String,
    ) -> Result<()> {
        let dto: raw::CaptchaResponseDto = run_dto(
            state,
            app,
            Query::new()
                .param("phone", &phone)
                .param("captcha", &captcha),
            |c, q| async move { c.captcha_verify(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        if dto.data == Some(false) {
            let message = dto
                .message
                .filter(|m| !m.trim().is_empty())
                .unwrap_or_else(|| "验证码校验失败".to_string());
            return Err(NcmApiError::Api { message });
        }
        Ok(())
    }

    pub async fn login_qr_key(app: &AppHandle, state: &NcmState) -> Result<QrKey> {
        let dto: raw::QrKeyResponseDto = run_dto(state, app, Query::new(), |c, q| async move {
            c.login_qr_key(&q).await
        })
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_qr_key(dto))
    }

    pub async fn login_qr_create(
        app: &AppHandle,
        state: &NcmState,
        key: String,
        qrimg: Option<String>,
    ) -> Result<QrCreate> {
        let mut q = Query::new().param("key", &key);
        q = client::opt(q, "qrimg", qrimg.as_deref());
        let dto: raw::QrCreateResponseDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.login_qr_create(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_qr_create(dto))
    }

    /// qr_check 的 800/801/802/803 是轮询状态而非错误，映射为枚举。
    pub async fn login_qr_check(app: &AppHandle, state: &NcmState, key: String) -> Result<QrCheck> {
        let dto: raw::QrCheckResponseDto = run_dto(
            state,
            app,
            Query::new().param("key", &key),
            |c, q| async move { c.login_qr_check(&q).await },
        )
        .await?;
        let qr = mapper::map_qr_check(dto);
        // 803 确认后若响应体携带 cookie（Set-Cookie 响应头缺失时是唯一来源），
        // 把它合并进内存态并持久化，避免重启后丢失登录。
        if let Some(cookie) = qr.cookie.as_deref().filter(|c| !c.is_empty()) {
            let merged = {
                let mut inner = state.inner.lock().unwrap();
                let merged = merge_cookies(&inner.cookie, std::slice::from_ref(&cookie.to_string()));
                inner.cookie = merged.clone();
                merged
            };
            persist_cookie(app, &merged);
        }
        Ok(qr)
    }

    pub async fn login_status(app: &AppHandle, state: &NcmState) -> Result<LoginStatus> {
        let dto: raw::LoginStatusResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.login_status(&q).await
            })
            .await?;
        Ok(mapper::map_login_status(dto))
    }

    pub fn set_cookie(state: &NcmState, app: &AppHandle, cookie: String) {
        state.inner.lock().unwrap().cookie = cookie.clone();
        persist_cookie(app, &cookie);
    }

    pub fn get_cookie(state: &NcmState) -> String {
        state.inner.lock().unwrap().cookie.clone()
    }

    pub fn clear_cookie(state: &NcmState, app: &AppHandle) {
        log::info!("[ncm_clear_cookie] clearing cookie from memory and store");
        state.inner.lock().unwrap().cookie.clear();
        persist_cookie(app, "");
    }

    // ── song ────────────────────────────────────────────────────────

    pub async fn album(app: &AppHandle, state: &NcmState, id: i64) -> Result<AlbumDetail> {
        let dto: raw::AlbumDetailResponseDto = run_dto(
            state,
            app,
            Query::new().param("id", &id.to_string()),
            |c, q| async move { c.album(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(AlbumDetail {
            album: mapper::map_album(dto.album),
            songs: dto.songs.into_iter().map(mapper::map_song).collect(),
        })
    }

    pub async fn song_url(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        level: Option<String>,
    ) -> Result<SongUrlResult> {
        let mut q = Query::new().param("id", &id.to_string());
        q = client::opt(q, "level", level.as_deref());
        let dto: raw::SongUrlResponseDto =
            run_dto(state, app, q, |c, q| async move { c.song_url_v1(&q).await }).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_song_url(dto))
    }

    pub async fn song_detail(
        app: &AppHandle,
        state: &NcmState,
        ids: Vec<i64>,
    ) -> Result<Vec<Song>> {
        let joined = ids
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",");
        let dto: raw::SongDetailResponseDto = run_dto(
            state,
            app,
            Query::new().param("ids", &joined),
            |c, q| async move { c.song_detail(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto.songs.into_iter().map(mapper::map_song).collect())
    }

    pub async fn lyric(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        let dto: raw::LyricResponseDto = run_dto(
            state,
            app,
            Query::new().param("id", &id.to_string()),
            |c, q| async move { c.lyric(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_lyric(dto))
    }

    pub async fn lyric_new(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        let dto: raw::LyricResponseDto = run_dto(
            state,
            app,
            Query::new().param("id", &id.to_string()),
            |c, q| async move { c.lyric_new(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_lyric(dto))
    }

    pub async fn like(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        like: Option<bool>,
    ) -> Result<()> {
        let mut q = Query::new().param("id", &id.to_string());
        q = client::opt(q, "like", like.map(|v| v.to_string()).as_deref());
        let dto: raw::LikeResponseDto =
            run_dto(state, app, q, |c, q| async move { c.like(&q).await }).await?;
        check_code(dto.code, dto.message.as_deref())
    }

    pub async fn like_list(app: &AppHandle, state: &NcmState, uid: i64) -> Result<LikeList> {
        let dto: raw::LikeListResponseDto = run_dto(
            state,
            app,
            Query::new().param("uid", &uid.to_string()),
            |c, q| async move { c.likelist(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(LikeList { ids: dto.ids })
    }

    pub async fn recent_song(app: &AppHandle, state: &NcmState, uid: i64) -> Result<RecentSongs> {
        let dto: raw::RecentSongResponseDto = run_dto(
            state,
            app,
            Query::new().param("uid", &uid.to_string()),
            |c, q| async move { c.record_recent_song(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_recent_songs(dto))
    }

    // ── playlist ────────────────────────────────────────────────────

    pub async fn playlist_detail(app: &AppHandle, state: &NcmState, id: i64) -> Result<Playlist> {
        let dto: raw::PlaylistDetailResponseDto = run_dto(
            state,
            app,
            Query::new().param("id", &id.to_string()),
            |c, q| async move { c.playlist_detail(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        let playlist = dto.playlist.ok_or_else(|| NcmApiError::Decode {
            message: "响应缺少 playlist 字段".to_string(),
        })?;
        Ok(mapper::map_playlist(playlist))
    }

    pub async fn user_playlist(
        app: &AppHandle,
        state: &NcmState,
        uid: i64,
    ) -> Result<Vec<Playlist>> {
        let dto: raw::UserPlaylistResponseDto = run_dto(
            state,
            app,
            Query::new().param("uid", &uid.to_string()),
            |c, q| async move { c.user_playlist(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(Self::map_playlists(dto.playlist))
    }

    pub async fn personalized(
        app: &AppHandle,
        state: &NcmState,
        limit: Option<i64>,
    ) -> Result<Vec<Playlist>> {
        let mut q = Query::new();
        q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        let dto: raw::PersonalizedResponseDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.personalized(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(Self::map_playlists(dto.result))
    }

    pub async fn top_playlist(
        app: &AppHandle,
        state: &NcmState,
        cat: Option<String>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<PlaylistPage> {
        let mut q = Query::new();
        q = client::opt(q, "cat", cat.as_deref());
        q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let dto: raw::TopPlaylistResponseDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.top_playlist(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(PlaylistPage {
            playlists: Self::map_playlists(dto.playlists),
            total: dto.total,
            more: dto.more,
        })
    }

    pub async fn playlist_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<PlaylistHotTag>> {
        let dto: raw::PlaylistHotResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.playlist_hot(&q).await
            })
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto
            .tags
            .into_iter()
            .map(|t| PlaylistHotTag {
                id: t.id,
                name: t.name,
                category: t.category,
            })
            .collect())
    }

    pub async fn recommend_resource(app: &AppHandle, state: &NcmState) -> Result<Vec<Playlist>> {
        let dto: raw::RecommendResourceResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.recommend_resource(&q).await
            })
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(Self::map_playlists(dto.recommend))
    }

    // ── discover ────────────────────────────────────────────────────

    pub async fn banner(
        app: &AppHandle,
        state: &NcmState,
        banner_type: Option<i64>,
    ) -> Result<Vec<Banner>> {
        let mut q = Query::new();
        q = client::opt(q, "type", banner_type.map(|v| v.to_string()).as_deref());
        let dto: raw::BannerResponseDto =
            run_dto(state, app, q, |c, q| async move { c.banner(&q).await }).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto
            .banners
            .into_iter()
            .map(|b| Banner {
                big_image_url: b.big_image_url,
                image_url: b.image_url,
                target_id: b.target_id,
                target_type: b.target_type,
                type_title: b.type_title,
                url: b.url,
            })
            .collect())
    }

    pub async fn recommend_songs(app: &AppHandle, state: &NcmState) -> Result<Vec<Song>> {
        let dto: raw::RecommendSongsResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.recommend_songs(&q).await
            })
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto
            .data
            .map(|d| d.daily_songs.into_iter().map(mapper::map_song).collect())
            .unwrap_or_default())
    }

    pub async fn personal_fm(app: &AppHandle, state: &NcmState) -> Result<Vec<Song>> {
        let dto: raw::PersonalFmResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.personal_fm(&q).await
            })
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto.data.into_iter().map(mapper::map_song).collect())
    }

    pub async fn fm_trash(app: &AppHandle, state: &NcmState, id: i64) -> Result<()> {
        let dto: raw::FmTrashResponseDto = run_dto(
            state,
            app,
            Query::new().param("id", &id.to_string()),
            |c, q| async move { c.fm_trash(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())
    }

    pub async fn dragon_ball(app: &AppHandle, state: &NcmState) -> Result<Vec<DragonBallItem>> {
        let dto: raw::DragonBallResponseDto =
            run_dto(state, app, Query::new(), |c, q| async move {
                c.homepage_dragon_ball(&q).await
            })
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_dragon_ball(dto.data))
    }

    pub async fn playmode_intelligence_list(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        pid: i64,
        count: Option<i64>,
    ) -> Result<Vec<IntelligenceSong>> {
        let mut q = Query::new()
            .param("id", &id.to_string())
            .param("pid", &pid.to_string());
        q = client::opt(q, "count", count.map(|v| v.to_string()).as_deref());
        let dto: raw::IntelligenceResponseDto = run_dto(state, app, q, |c, q| async move {
            c.playmode_intelligence_list(&q).await
        })
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_intelligence(dto.data))
    }

    // ── search ─────────────────────────────────────────────────────

    pub async fn cloudsearch(
        app: &AppHandle,
        state: &NcmState,
        keywords: String,
        search_type: Option<i64>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<SearchResult> {
        let mut q = Query::new().param("keywords", &keywords);
        q = client::opt(q, "type", search_type.map(|v| v.to_string()).as_deref());
        q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let dto: raw::CloudsearchResponseDto =
            run_dto(state, app, q, |c, q| async move { c.cloudsearch(&q).await }).await?;
        check_code(dto.code, dto.message.as_deref())?;
        let result = dto.result.ok_or_else(|| NcmApiError::Decode {
            message: "搜索响应缺少 result 字段".to_string(),
        })?;
        Ok(mapper::map_search_result(result))
    }

    pub async fn search_suggest(
        app: &AppHandle,
        state: &NcmState,
        keywords: String,
    ) -> Result<SuggestResult> {
        let dto: raw::SuggestResponseDto = run_dto(
            state,
            app,
            Query::new().param("keywords", &keywords),
            |c, q| async move { c.search_suggest(&q).await },
        )
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        let result = dto.result.ok_or_else(|| NcmApiError::Decode {
            message: "搜索建议响应缺少 result 字段".to_string(),
        })?;
        Ok(mapper::map_suggest_result(result))
    }

    pub async fn search_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<HotSearchItem>> {
        let dto: raw::SearchHotResponseDto = run_dto(state, app, Query::new(), |c, q| async move {
            c.search_hot(&q).await
        })
        .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_hot_search(dto.result))
    }
    // ── comment ─────────────────────────────────────────────────────

    pub async fn comment_playlist(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        let mut q = Query::new().param("id", &id.to_string());
        q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let dto: raw::CommentPageDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.comment_playlist(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_comment_page(dto))
    }

    pub async fn comment_music(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        let mut q = Query::new().param("id", &id.to_string());
        q = client::opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = client::opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let dto: raw::CommentPageDto =
            run_dto(
                state,
                app,
                q,
                |c, q| async move { c.comment_music(&q).await },
            )
            .await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_comment_page(dto))
    }
}
