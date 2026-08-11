//! NCM 用例层：对外能力的编排入口。
//! 目前为 1:1 透传 `NcmService`；未来跨服务组合（如「取可播放队列」= 歌曲详情 + 播放地址 + 点赞态）
//! 在此编排多个服务。

use tauri::AppHandle;

use crate::infra::ncm::entity::{
    AlbumDetail, AuthSession, Banner, CommentPage, DragonBallItem, HotSearchItem, IntelligenceSong,
    LikeList, LoginStatus, Lyric, Playlist, PlaylistHotTag, PlaylistPage, QrCheck, QrCreate, QrKey,
    RecentSongs, SearchResult, Song, SongUrlResult, SuggestResult,
};
use crate::infra::ncm::error::Result;
use crate::infra::ncm::NcmState;
use crate::service::ncm_service::NcmService;

pub struct NcmUseCase;

impl NcmUseCase {
    // ── auth ────────────────────────────────────────────────────────

    pub async fn login_cellphone(
        app: &AppHandle,
        state: &NcmState,
        phone: String,
        password: Option<String>,
        captcha: Option<String>,
        countrycode: Option<String>,
    ) -> Result<AuthSession> {
        NcmService::login_cellphone(app, state, phone, password, captcha, countrycode).await
    }

    pub async fn captcha_sent(app: &AppHandle, state: &NcmState, phone: String) -> Result<()> {
        NcmService::captcha_sent(app, state, phone).await
    }

    pub async fn captcha_verify(
        app: &AppHandle,
        state: &NcmState,
        phone: String,
        captcha: String,
    ) -> Result<()> {
        NcmService::captcha_verify(app, state, phone, captcha).await
    }

    pub async fn login_qr_key(app: &AppHandle, state: &NcmState) -> Result<QrKey> {
        NcmService::login_qr_key(app, state).await
    }

    pub async fn login_qr_create(
        app: &AppHandle,
        state: &NcmState,
        key: String,
        qrimg: Option<String>,
    ) -> Result<QrCreate> {
        NcmService::login_qr_create(app, state, key, qrimg).await
    }

    pub async fn login_qr_check(app: &AppHandle, state: &NcmState, key: String) -> Result<QrCheck> {
        NcmService::login_qr_check(app, state, key).await
    }

    pub async fn login_status(app: &AppHandle, state: &NcmState) -> Result<LoginStatus> {
        NcmService::login_status(app, state).await
    }

    pub fn set_cookie(state: &NcmState, app: &AppHandle, cookie: String) {
        NcmService::set_cookie(state, app, cookie);
    }

    pub fn get_cookie(state: &NcmState) -> String {
        NcmService::get_cookie(state)
    }

    pub fn clear_cookie(state: &NcmState, app: &AppHandle) {
        NcmService::clear_cookie(state, app);
    }

    // ── song ────────────────────────────────────────────────────────

    pub async fn album(app: &AppHandle, state: &NcmState, id: i64) -> Result<AlbumDetail> {
        NcmService::album(app, state, id).await
    }

    pub async fn song_url(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        level: Option<String>,
    ) -> Result<SongUrlResult> {
        NcmService::song_url(app, state, id, level).await
    }

    pub async fn song_detail(
        app: &AppHandle,
        state: &NcmState,
        ids: Vec<i64>,
    ) -> Result<Vec<Song>> {
        NcmService::song_detail(app, state, ids).await
    }

    pub async fn lyric(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        NcmService::lyric(app, state, id).await
    }

    pub async fn lyric_new(app: &AppHandle, state: &NcmState, id: i64) -> Result<Lyric> {
        NcmService::lyric_new(app, state, id).await
    }

    pub async fn like(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        like: Option<bool>,
    ) -> Result<()> {
        NcmService::like(app, state, id, like).await
    }

    pub async fn like_list(app: &AppHandle, state: &NcmState, uid: i64) -> Result<LikeList> {
        NcmService::like_list(app, state, uid).await
    }

    pub async fn recent_song(app: &AppHandle, state: &NcmState, uid: i64) -> Result<RecentSongs> {
        NcmService::recent_song(app, state, uid).await
    }

    // ── playlist ────────────────────────────────────────────────────

    pub async fn playlist_detail(app: &AppHandle, state: &NcmState, id: i64) -> Result<Playlist> {
        NcmService::playlist_detail(app, state, id).await
    }

    pub async fn user_playlist(
        app: &AppHandle,
        state: &NcmState,
        uid: i64,
    ) -> Result<Vec<Playlist>> {
        NcmService::user_playlist(app, state, uid).await
    }

    pub async fn personalized(
        app: &AppHandle,
        state: &NcmState,
        limit: Option<i64>,
    ) -> Result<Vec<Playlist>> {
        NcmService::personalized(app, state, limit).await
    }

    pub async fn top_playlist(
        app: &AppHandle,
        state: &NcmState,
        cat: Option<String>,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<PlaylistPage> {
        NcmService::top_playlist(app, state, cat, limit, offset).await
    }

    pub async fn playlist_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<PlaylistHotTag>> {
        NcmService::playlist_hot(app, state).await
    }

    pub async fn recommend_resource(app: &AppHandle, state: &NcmState) -> Result<Vec<Playlist>> {
        NcmService::recommend_resource(app, state).await
    }

    // ── discover ────────────────────────────────────────────────────

    pub async fn banner(
        app: &AppHandle,
        state: &NcmState,
        banner_type: Option<i64>,
    ) -> Result<Vec<Banner>> {
        NcmService::banner(app, state, banner_type).await
    }

    pub async fn recommend_songs(app: &AppHandle, state: &NcmState) -> Result<Vec<Song>> {
        NcmService::recommend_songs(app, state).await
    }

    pub async fn personal_fm(app: &AppHandle, state: &NcmState) -> Result<Vec<Song>> {
        NcmService::personal_fm(app, state).await
    }

    pub async fn fm_trash(app: &AppHandle, state: &NcmState, id: i64) -> Result<()> {
        NcmService::fm_trash(app, state, id).await
    }

    pub async fn dragon_ball(app: &AppHandle, state: &NcmState) -> Result<Vec<DragonBallItem>> {
        NcmService::dragon_ball(app, state).await
    }

    pub async fn playmode_intelligence_list(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        pid: i64,
        count: Option<i64>,
    ) -> Result<Vec<IntelligenceSong>> {
        NcmService::playmode_intelligence_list(app, state, id, pid, count).await
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
        NcmService::cloudsearch(app, state, keywords, search_type, limit, offset).await
    }

    pub async fn search_suggest(
        app: &AppHandle,
        state: &NcmState,
        keywords: String,
    ) -> Result<SuggestResult> {
        NcmService::search_suggest(app, state, keywords).await
    }

    pub async fn search_hot(app: &AppHandle, state: &NcmState) -> Result<Vec<HotSearchItem>> {
        NcmService::search_hot(app, state).await
    }
    // ── comment ─────────────────────────────────────────────────────

    pub async fn comment_playlist(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        NcmService::comment_playlist(app, state, id, limit, offset).await
    }

    pub async fn comment_music(
        app: &AppHandle,
        state: &NcmState,
        id: i64,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<CommentPage> {
        NcmService::comment_music(app, state, id, limit, offset).await
    }
}
