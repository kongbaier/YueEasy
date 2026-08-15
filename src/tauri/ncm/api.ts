import { invoke } from '@tauri-apps/api/core';
import type {
  AlbumDetail,
  AuthSession,
  Banner,
  CommentPage,
  DragonBallItem,
  HotSearchItem,
  IntelligenceSong,
  LikeList,
  LoginStatus,
  Lyric,
  Playlist,
  PlaylistHotTag,
  PlaylistPage,
  QrCheck,
  QrCreate,
  QrKey,
  RecentSongs,
  SearchResult,
  Song,
  SongUrlResult,
  SuggestResult,
} from '@/shared/types/entities';

/**
 * 类型化 NCM 命令包装。
 * 每个函数对应 Rust 侧一个独立命令；响应已由 Rust 适配层转换为统一 Entity，
 * 这里只声明类型，不再做任何字段映射。
 */

// ── auth ────────────────────────────────────────────────────────────

export function ncmLoginCellphone(p: {
  phone: string;
  password?: string;
  captcha?: string;
  countrycode?: string;
}): Promise<AuthSession> {
  return invoke<AuthSession>('ncm_login_cellphone', p);
}

export function ncmCaptchaSent(p: { phone: string }): Promise<void> {
  return invoke<void>('ncm_captcha_sent', p);
}

export function ncmCaptchaVerify(p: {
  phone: string;
  captcha: string;
}): Promise<void> {
  return invoke<void>('ncm_captcha_verify', p);
}

export function ncmLoginQrKey(): Promise<QrKey> {
  return invoke<QrKey>('ncm_login_qr_key');
}

export function ncmLoginQrCreate(p: {
  key: string;
  qrimg?: string;
}): Promise<QrCreate> {
  return invoke<QrCreate>('ncm_login_qr_create', p);
}

export function ncmLoginQrCheck(p: { key: string }): Promise<QrCheck> {
  return invoke<QrCheck>('ncm_login_qr_check', p);
}

export function ncmLoginStatus(): Promise<LoginStatus> {
  return invoke<LoginStatus>('ncm_login_status');
}

// ── search ──────────────────────────────────────────────────────────

export function ncmCloudsearch(p: {
  keywords: string;
  searchType?: number; // 1=歌曲 10=专辑 100=歌手 1002=用户
  limit?: number;
  offset?: number;
}): Promise<SearchResult> {
  return invoke<SearchResult>('ncm_cloudsearch', p);
}

export function ncmSearchSuggest(p: {
  keywords: string;
}): Promise<SuggestResult> {
  return invoke<SuggestResult>('ncm_search_suggest', p);
}

export function ncmSearchHot(): Promise<HotSearchItem[]> {
  return invoke<HotSearchItem[]>('ncm_search_hot');
}

// ── song ────────────────────────────────────────────────────────────

export function ncmAlbum(p: { id: number }): Promise<AlbumDetail> {
  return invoke<AlbumDetail>('ncm_album', p);
}

export function ncmSongUrlV1(p: {
  id: number;
  level?: string;
}): Promise<SongUrlResult> {
  return invoke<SongUrlResult>('ncm_song_url_v1', p);
}

export function ncmSongDetail(p: { ids: number[] }): Promise<Song[]> {
  return invoke<Song[]>('ncm_song_detail', p);
}

export function ncmLyric(p: { id: number }): Promise<Lyric> {
  return invoke<Lyric>('ncm_lyric', p);
}

export function ncmLyricNew(p: { id: number }): Promise<Lyric> {
  return invoke<Lyric>('ncm_lyric_new', p);
}

export function ncmLike(p: { id: number; like?: boolean }): Promise<void> {
  return invoke<void>('ncm_like', p);
}

export function ncmLikelist(p: { uid: number }): Promise<LikeList> {
  return invoke<LikeList>('ncm_likelist', p);
}

export function ncmRecordRecentSong(p: { uid: number }): Promise<RecentSongs> {
  return invoke<RecentSongs>('ncm_record_recent_song', p);
}

// ── playlist ────────────────────────────────────────────────────────

export function ncmPlaylistDetail(p: { id: number }): Promise<Playlist> {
  return invoke<Playlist>('ncm_playlist_detail', p);
}

export function ncmUserPlaylist(p: { uid: number }): Promise<Playlist[]> {
  return invoke<Playlist[]>('ncm_user_playlist', p);
}

export function ncmPersonalized(p?: { limit?: number }): Promise<Playlist[]> {
  return invoke<Playlist[]>('ncm_personalized', p);
}

export function ncmTopPlaylist(p?: {
  cat?: string;
  limit?: number;
  offset?: number;
}): Promise<PlaylistPage> {
  return invoke<PlaylistPage>('ncm_top_playlist', p);
}

export function ncmPlaylistHot(): Promise<PlaylistHotTag[]> {
  return invoke<PlaylistHotTag[]>('ncm_playlist_hot');
}

export function ncmRecommendResource(): Promise<Playlist[]> {
  return invoke<Playlist[]>('ncm_recommend_resource');
}

// ── discover ────────────────────────────────────────────────────────

export function ncmBanner(p?: { bannerType?: number }): Promise<Banner[]> {
  return invoke<Banner[]>('ncm_banner', p);
}

export function ncmRecommendSongs(): Promise<Song[]> {
  return invoke<Song[]>('ncm_recommend_songs');
}

export function ncmPersonalFm(): Promise<Song[]> {
  return invoke<Song[]>('ncm_personal_fm');
}

export function ncmFmTrash(p: { id: number }): Promise<void> {
  return invoke<void>('ncm_fm_trash', p);
}

export function ncmHomepageDragonBall(): Promise<DragonBallItem[]> {
  return invoke<DragonBallItem[]>('ncm_homepage_dragon_ball');
}

export function ncmPlaymodeIntelligenceList(p: {
  id: number;
  pid: number;
  count?: number;
}): Promise<IntelligenceSong[]> {
  return invoke<IntelligenceSong[]>('ncm_playmode_intelligence_list', p);
}

// ── comment ─────────────────────────────────────────────────────────

export function ncmCommentPlaylist(p: {
  id: number;
  limit?: number;
  offset?: number;
}): Promise<CommentPage> {
  return invoke<CommentPage>('ncm_comment_playlist', p);
}

export function ncmCommentMusic(p: {
  id: number;
  limit?: number;
  offset?: number;
}): Promise<CommentPage> {
  return invoke<CommentPage>('ncm_comment_music', p);
}
