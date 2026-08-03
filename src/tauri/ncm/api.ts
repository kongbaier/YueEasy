import { invoke } from '@tauri-apps/api/core';

/**
 * 类型化 NCM 命令包装。
 * 每个函数对应 Rust 侧一个独立命令，参数在编译期校验；
 * 响应类型由调用方通过泛型指定（对应 types/*.response.ts）。
 */

// ── auth ────────────────────────────────────────────────────────────

export function ncmLoginCellphone<T = unknown>(p: {
  phone: string;
  password?: string;
  captcha?: string;
  countrycode?: string;
}): Promise<T> {
  return invoke<T>('ncm_login_cellphone', p);
}

export function ncmCaptchaSent<T = unknown>(p: { phone: string }): Promise<T> {
  return invoke<T>('ncm_captcha_sent', p);
}

export function ncmCaptchaVerify<T = unknown>(p: {
  phone: string;
  captcha: string;
}): Promise<T> {
  return invoke<T>('ncm_captcha_verify', p);
}

export function ncmLoginQrKey<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_login_qr_key');
}

export function ncmLoginQrCreate<T = unknown>(p: {
  key: string;
  qrimg?: string;
}): Promise<T> {
  return invoke<T>('ncm_login_qr_create', p);
}

export function ncmLoginQrCheck<T = unknown>(p: { key: string }): Promise<T> {
  return invoke<T>('ncm_login_qr_check', p);
}

export function ncmLoginStatus<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_login_status');
}

// ── search ──────────────────────────────────────────────────────────

export function ncmCloudsearch<T = unknown>(p: {
  keywords: string;
  searchType?: number; // 1=歌曲 10=专辑 100=歌手 1002=用户
  limit?: number;
  offset?: number;
}): Promise<T> {
  return invoke<T>('ncm_cloudsearch', p);
}

export function ncmSearchSuggest<T = unknown>(p: {
  keywords: string;
}): Promise<T> {
  return invoke<T>('ncm_search_suggest', p);
}

export function ncmSearchHot<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_search_hot');
}

// ── song ────────────────────────────────────────────────────────────

export function ncmAlbum<T = unknown>(p: { id: number }): Promise<T> {
  return invoke<T>('ncm_album', p);
}

export function ncmSongUrlV1<T = unknown>(p: {
  id: number;
  level?: string;
}): Promise<T> {
  return invoke<T>('ncm_song_url_v1', p);
}

export function ncmSongDetail<T = unknown>(p: { ids: number[] }): Promise<T> {
  return invoke<T>('ncm_song_detail', p);
}

export function ncmLyric<T = unknown>(p: { id: number }): Promise<T> {
  return invoke<T>('ncm_lyric', p);
}

export function ncmLyricNew<T = unknown>(p: { id: number }): Promise<T> {
  return invoke<T>('ncm_lyric_new', p);
}

export function ncmLike<T = unknown>(p: { id: number; like?: boolean }): Promise<T> {
  return invoke<T>('ncm_like', p);
}

export function ncmLikelist<T = unknown>(p: { uid: number }): Promise<T> {
  return invoke<T>('ncm_likelist', p);
}

export function ncmRecordRecentSong<T = unknown>(p: {
  uid: number;
}): Promise<T> {
  return invoke<T>('ncm_record_recent_song', p);
}

// ── playlist ────────────────────────────────────────────────────────

export function ncmPlaylistDetail<T = unknown>(p: { id: number }): Promise<T> {
  return invoke<T>('ncm_playlist_detail', p);
}

export function ncmUserPlaylist<T = unknown>(p: { uid: number }): Promise<T> {
  return invoke<T>('ncm_user_playlist', p);
}

export function ncmPersonalized<T = unknown>(p?: {
  limit?: number;
}): Promise<T> {
  return invoke<T>('ncm_personalized', p);
}

export function ncmTopPlaylist<T = unknown>(p?: {
  cat?: string;
  limit?: number;
  offset?: number;
}): Promise<T> {
  return invoke<T>('ncm_top_playlist', p);
}

export function ncmPlaylistHot<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_playlist_hot');
}

export function ncmRecommendResource<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_recommend_resource');
}

// ── discover ────────────────────────────────────────────────────────

export function ncmBanner<T = unknown>(p?: { bannerType?: number }): Promise<T> {
  return invoke<T>('ncm_banner', p);
}

export function ncmRecommendSongs<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_recommend_songs');
}

export function ncmPersonalFm<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_personal_fm');
}

export function ncmFmTrash<T = unknown>(p: { id: number }): Promise<T> {
  return invoke<T>('ncm_fm_trash', p);
}

export function ncmHomepageDragonBall<T = unknown>(): Promise<T> {
  return invoke<T>('ncm_homepage_dragon_ball');
}

export function ncmPlaymodeIntelligenceList<T = unknown>(p: {
  id: number;
  pid: number;
  count?: number;
}): Promise<T> {
  return invoke<T>('ncm_playmode_intelligence_list', p);
}

// ── comment ─────────────────────────────────────────────────────────

export function ncmCommentPlaylist<T = unknown>(p: {
  id: number;
  limit?: number;
  offset?: number;
}): Promise<T> {
  return invoke<T>('ncm_comment_playlist', p);
}

export function ncmCommentMusic<T = unknown>(p: {
  id: number;
  limit?: number;
  offset?: number;
}): Promise<T> {
  return invoke<T>('ncm_comment_music', p);
}
