// 统一业务实体 —— 与 Rust `src-tauri/src/api/ncm/entity.rs` 一一对应，修改需同步。
// 字段名即 IPC wire 名（camelCase）；Rust 适配层已完成脏数据归一
// （ar→artists、al→album、dt→durationMs、picUrl/coverImgUrl→coverUrl 等），
// 前端禁止再做字段级映射。

export interface Artist {
  id: number;
  name: string;
  picUrl?: string;
  alias?: string[];
  albumSize?: number;
  musicSize?: number;
}

export interface Album {
  id: number;
  name: string;
  picUrl?: string;
  artist?: Artist;
  publishTimeMs?: number;
  size?: number;
  company?: string;
  description?: string;
}

export interface Song {
  id: number;
  name: string;
  artists: Artist[];
  album: Album;
  /** 毫秒 */
  durationMs: number;
  fee?: number;
}

export interface User {
  id: number;
  nickname: string;
  avatarUrl?: string;
  signature?: string;
  gender?: number;
  follows?: number;
  followeds?: number;
}

export interface Playlist {
  id: number;
  name: string;
  coverUrl: string;
  playCount: number;
  trackCount: number;
  description?: string;
  creator?: User;
  tags?: string[];
  tracks?: Song[];
  specialType?: number;
  subscribedCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTimeMs?: number;
  updateTimeMs?: number;
}

export interface PlaylistPage {
  playlists: Playlist[];
  total: number;
  more: boolean;
}

export interface PlaylistHotTag {
  id: number;
  name: string;
  category?: number;
}

export interface BeReplied {
  id: number;
  user?: User;
  content: string;
}

export interface Comment {
  id: number;
  user: User;
  content: string;
  /** 毫秒时间戳 */
  timeMs: number;
  likedCount: number;
  liked?: boolean;
  beReplied?: BeReplied[];
}

export interface CommentPage {
  comments: Comment[];
  hotComments?: Comment[];
  total: number;
  more: boolean;
}

export interface Banner {
  /** 9:5 大图 */
  bigImageUrl: string;
  /** 27:10 小图 */
  imageUrl?: string;
  targetId?: number;
  /** 1=正常 3000=广告 */
  targetType: number;
  typeTitle: string;
  url?: string;
}

export const BannerType = { NORMAL: 1, AD: 3000 } as const;

export interface SongUrl {
  id: number;
  url: string;
  level?: string;
}

export interface SongUrlResult {
  data: SongUrl[];
}

export interface LyricVersion {
  text: string;
  version?: number;
}

export interface Lyric {
  lrc?: LyricVersion;
  tlyric?: LyricVersion;
  yrc?: LyricVersion;
  klyric?: LyricVersion;
  romalrc?: LyricVersion;
}

export interface AlbumDetail {
  album: Album;
  songs: Song[];
}

export interface SearchResult {
  songs: Song[];
  songCount: number;
  albums: Album[];
  albumCount: number;
  artists: Artist[];
  artistCount: number;
  users: User[];
  userCount: number;
}

export interface SuggestSong {
  id: number;
  name: string;
  artists: string[];
}

export interface SuggestAlbum {
  id: number;
  name: string;
  artist?: string;
}

export interface SuggestArtist {
  id: number;
  name: string;
}

export interface SuggestResult {
  songs: SuggestSong[];
  albums: SuggestAlbum[];
  artists: SuggestArtist[];
}

export interface HotSearchItem {
  keyword: string;
  score?: number;
  iconType?: number;
}

export interface DragonBallItem {
  id: string;
  name?: string;
  iconUrl?: string;
  resourceId?: string;
  resourceType?: string;
}

export interface IntelligenceSong {
  song: Song;
  reason?: string;
}

export interface AuthSession {
  cookie: string;
  token?: string;
  profile?: User;
  accountId?: number;
}

export interface LoginStatus {
  profile?: User;
}

export interface QrKey {
  key: string;
}

export interface QrCreate {
  url: string;
  image: string;
}

export type QrCheckStatus =
  | 'waiting'
  | 'scanned'
  | 'confirmed'
  | 'expired'
  | 'failed';

export interface QrCheck {
  status: QrCheckStatus;
  cookie?: string;
}

export interface LikeList {
  ids: number[];
}

export interface RecentSong {
  song: Song;
  /** 毫秒时间戳 */
  playTimeMs: number;
}

export interface RecentSongs {
  list: RecentSong[];
}

/**
 * 播放器队列条目（Phase E：Rust `core::types::QueueItem` wire 镜像）。
 * 字段即 Rust wire 名（track_id/title/artist/album/cover_url/duration_secs），
 * 与 `PlayerService` 侧的 `Track`（Song 实体）通过 `shared/utils/mappers` 互转。
 */
export interface QueueItem {
  track_id: number;
  title: string;
  artist: string;
  album: string;
  cover_url: string;
  duration_secs: number;
}
