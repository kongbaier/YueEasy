/** 未解析的歌曲引用 —— 不含播放 URL */
export interface SongRef {
  id: number;
  name: string;
  artists: { id: number; name: string }[];
  album: { id: number; name: string; picUrl: string };
  duration: number;
  fee?: number;
}

/** 歌单创建者 */
export interface PlaylistUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

/** 前端歌单业务模型 —— 与后端响应结构解耦 */
export interface Playlist {
  id: number;
  name: string;
  coverUrl: string;
  trackCount: number;
  playCount: number;
  description?: string;
  creator?: PlaylistUser;
  tags?: string[];
  tracks?: SongRef[];
  /** 详情页独有字段 */
  subscribedCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTime?: number;
  updateTime?: number;
}
