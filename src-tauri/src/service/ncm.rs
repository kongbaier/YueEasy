//! NCM 领域服务：编排「组装 Query → 网络层取数 → 业务 code 校验 → 数据处理层映射」。
//! 服务层不感知 IPC；cmd 薄壳直接调本服务。

use ncm_api_rs::Query;
use tauri::AppHandle;

use crate::model::entity::{
    AlbumDetail, AuthSession, Banner, CommentPage, DragonBallItem, HotSearchItem, IntelligenceSong,
    LikeList, LoginStatus, Lyric, Playlist, PlaylistHotTag, PlaylistPage, QrCheck, QrCreate, QrKey,
    RecentSongs, SearchResult, Song, SongUrlResult, SuggestResult,
};
use crate::model::error::{check_code, NcmApiError, Result};
use crate::model::{mapper, response};
use crate::netease::client::{self, fetch, opt};
use crate::netease::NcmState;

pub struct NcmService;

impl NcmService {
    fn map_playlists(dtos: Vec<response::PlaylistDto>) -> Vec<Playlist> {
        dtos.into_iter().map(mapper::map_playlist).collect()
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
        let client = state.client();
        // 验证码与密码是两条互斥路径（上游 Node 同此语义）：给了验证码就走验证码登录，
        // 不能再把 captcha 当 password 发给服务端（见 `client::login_cellphone_by_captcha`）。
        let captcha = captcha.filter(|c| !c.trim().is_empty());
        let dto: response::LoginResponseDto = match captcha {
            Some(code) => {
                fetch(
                    state,
                    app,
                    client::login_cellphone_by_captcha(
                        &client,
                        &phone,
                        &code,
                        countrycode.as_deref(),
                    ),
                )
                .await?
            }
            None => {
                let mut q = Query::new().param("phone", &phone);
                q = opt(q, "password", password.as_deref());
                q = opt(q, "countrycode", countrycode.as_deref());
                fetch(state, app, client.login_cellphone(&q)).await?
            }
        };
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_auth_session(dto))
    }

    pub async fn captcha_sent(app: &AppHandle, state: &NcmState, phone: String) -> Result<()> {
        let q = Query::new().param("phone", &phone);
        let client = state.client();
        let dto: response::CaptchaResponseDto = fetch(state, app, client.captcha_sent(&q)).await?;
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
        let q = Query::new().param("phone", &phone).param("captcha", &captcha);
        let client = state.client();
        let dto: response::CaptchaResponseDto = fetch(state, app, client.captcha_verify(&q)).await?;
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
        let q = Query::new();
        let client = state.client();
        let dto: response::QrKeyResponseDto = fetch(state, app, client.login_qr_key(&q)).await?;
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
        q = opt(q, "qrimg", qrimg.as_deref());
        let client = state.client();
        let dto: response::QrCreateResponseDto = fetch(state, app, client.login_qr_create(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_qr_create(dto))
    }

    /// qr_check 的 800/801/802/803 是轮询状态而非错误，映射为枚举。
    pub async fn login_qr_check(app: &AppHandle, state: &NcmState, key: String) -> Result<QrCheck> {
        let q = Query::new().param("key", &key);
        let client = state.client();
        let dto: response::QrCheckResponseDto = fetch(state, app, client.login_qr_check(&q)).await?;
        let qr = mapper::map_qr_check(dto);
        // 803 确认后若响应体携带 cookie（Set-Cookie 响应头缺失时是唯一来源），
        // 把它合并进内存态并持久化，避免重启后丢失登录。
        if let Some(cookie) = qr.cookie.as_deref().filter(|c| !c.is_empty()) {
            state.merge_cookie(app, std::slice::from_ref(&cookie.to_string()));
        }
        Ok(qr)
    }

    pub async fn login_status(app: &AppHandle, state: &NcmState) -> Result<LoginStatus> {
        let q = Query::new();
        let client = state.client();
        let dto: response::LoginStatusResponseDto = fetch(state, app, client.login_status(&q)).await?;
        Ok(mapper::map_login_status(dto))
    }

    pub fn set_cookie(state: &NcmState, app: &AppHandle, cookie: String) {
        state.set_cookie(app, cookie);
    }

    pub fn get_cookie(state: &NcmState) -> String {
        state.cookie()
    }

    pub fn clear_cookie(state: &NcmState, app: &AppHandle) {
        log::info!("[ncm_clear_cookie] clearing cookie from memory and store");
        state.set_cookie(app, String::new());
    }

    // ── song ────────────────────────────────────────────────────────

    pub async fn album(app: &AppHandle, state: &NcmState, id: i64) -> Result<AlbumDetail> {
        let q = Query::new().param("id", &id.to_string());
        let client = state.client();
        let dto: response::AlbumDetailResponseDto = fetch(state, app, client.album(&q)).await?;
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
        q = opt(q, "level", level.as_deref());
        let client = state.client();
        let dto: response::SongUrlResponseDto = fetch(state, app, client.song_url_v1(&q)).await?;
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
        let q = Query::new().param("ids", &joined);
        let client = state.client();
        let dto: response::SongDetailResponseDto = fetch(state, app, client.song_detail(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto.songs.into_iter().map(mapper::map_song).collect())
    }

    pub async fn lyric(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        let q = Query::new().param("id", &id.to_string());
        let client = state.client();
        let dto: response::LyricResponseDto = fetch(state, app, client.lyric(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_lyric(dto))
    }

    pub async fn lyric_new(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        let q = Query::new().param("id", &id.to_string());
        let client = state.client();
        let dto: response::LyricResponseDto = fetch(state, app, client.lyric_new(&q)).await?;
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
        q = opt(q, "like", like.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::LikeResponseDto = fetch(state, app, client.like(&q)).await?;
        check_code(dto.code, dto.message.as_deref())
    }

    pub async fn like_list(app: &AppHandle, state: &NcmState, uid: i64) -> Result<LikeList> {
        let q = Query::new().param("uid", &uid.to_string());
        let client = state.client();
        let dto: response::LikeListResponseDto = fetch(state, app, client.likelist(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(LikeList { ids: dto.ids })
    }

    pub async fn recent_song(app: &AppHandle, state: &NcmState, uid: i64) -> Result<RecentSongs> {
        let q = Query::new().param("uid", &uid.to_string());
        let client = state.client();
        let dto: response::RecentSongResponseDto = fetch(state, app, client.record_recent_song(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_recent_songs(dto))
    }

    // ── playlist ────────────────────────────────────────────────────

    pub async fn playlist_detail(app: &AppHandle, state: &NcmState, id: i64) -> Result<Playlist> {
        let q = Query::new().param("id", &id.to_string());
        let client = state.client();
        let dto: response::PlaylistDetailResponseDto = fetch(state, app, client.playlist_detail(&q)).await?;
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
        let q = Query::new().param("uid", &uid.to_string());
        let client = state.client();
        let dto: response::UserPlaylistResponseDto = fetch(state, app, client.user_playlist(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(Self::map_playlists(dto.playlist))
    }

    pub async fn personalized(
        app: &AppHandle,
        state: &NcmState,
        limit: Option<i64>,
    ) -> Result<Vec<Playlist>> {
        let mut q = Query::new();
        q = opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::PersonalizedResponseDto = fetch(state, app, client.personalized(&q)).await?;
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
        q = opt(q, "cat", cat.as_deref());
        q = opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::TopPlaylistResponseDto = fetch(state, app, client.top_playlist(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(PlaylistPage {
            playlists: Self::map_playlists(dto.playlists),
            total: dto.total,
            more: dto.more,
        })
    }

    pub async fn playlist_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<PlaylistHotTag>> {
        let q = Query::new();
        let client = state.client();
        let dto: response::PlaylistHotResponseDto = fetch(state, app, client.playlist_hot(&q)).await?;
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
        let q = Query::new();
        let client = state.client();
        let dto: response::RecommendResourceResponseDto = fetch(state, app, client.recommend_resource(&q)).await?;
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
        q = opt(q, "type", banner_type.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::BannerResponseDto = fetch(state, app, client.banner(&q)).await?;
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
        let q = Query::new();
        let client = state.client();
        let dto: response::RecommendSongsResponseDto = fetch(state, app, client.recommend_songs(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto
            .data
            .map(|d| d.daily_songs.into_iter().map(mapper::map_song).collect())
            .unwrap_or_default())
    }

    pub async fn personal_fm(app: &AppHandle, state: &NcmState) -> Result<Vec<Song>> {
        let q = Query::new();
        let client = state.client();
        let dto: response::PersonalFmResponseDto = fetch(state, app, client.personal_fm(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(dto.data.into_iter().map(mapper::map_song).collect())
    }

    pub async fn fm_trash(app: &AppHandle, state: &NcmState, id: i64) -> Result<()> {
        let q = Query::new().param("id", &id.to_string());
        let client = state.client();
        let dto: response::FmTrashResponseDto = fetch(state, app, client.fm_trash(&q)).await?;
        check_code(dto.code, dto.message.as_deref())
    }

    pub async fn dragon_ball(app: &AppHandle, state: &NcmState) -> Result<Vec<DragonBallItem>> {
        let q = Query::new();
        let client = state.client();
        let dto: response::DragonBallResponseDto = fetch(state, app, client.homepage_dragon_ball(&q)).await?;
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
        q = opt(q, "count", count.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::IntelligenceResponseDto = fetch(state, app, client.playmode_intelligence_list(&q)).await?;
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
        q = opt(q, "type", search_type.map(|v| v.to_string()).as_deref());
        q = opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::CloudsearchResponseDto = fetch(state, app, client.cloudsearch(&q)).await?;
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
        let q = Query::new().param("keywords", &keywords);
        let client = state.client();
        let dto: response::SuggestResponseDto = fetch(state, app, client.search_suggest(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        let result = dto.result.ok_or_else(|| NcmApiError::Decode {
            message: "搜索建议响应缺少 result 字段".to_string(),
        })?;
        Ok(mapper::map_suggest_result(result))
    }

    pub async fn search_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<HotSearchItem>> {
        let q = Query::new();
        let client = state.client();
        let dto: response::SearchHotResponseDto = fetch(state, app, client.search_hot(&q)).await?;
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
        q = opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::CommentPageResponseDto = fetch(state, app, client.comment_playlist(&q)).await?;
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
        q = opt(q, "limit", limit.map(|v| v.to_string()).as_deref());
        q = opt(q, "offset", offset.map(|v| v.to_string()).as_deref());
        let client = state.client();
        let dto: response::CommentPageResponseDto = fetch(state, app, client.comment_music(&q)).await?;
        check_code(dto.code, dto.message.as_deref())?;
        Ok(mapper::map_comment_page(dto))
    }
}
