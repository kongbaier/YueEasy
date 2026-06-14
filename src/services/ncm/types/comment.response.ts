export interface NcmCommentUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
  userType?: number;
  vipType?: number;
}

export interface NcmBeReplied {
  user: NcmCommentUser;
  beRepliedCommentId: number;
  content: string;
}

export interface NcmComment {
  commentId: number;
  user: NcmCommentUser;
  content: string;
  time: number;
  likedCount: number;
  liked?: boolean;
  beReplied?: NcmBeReplied[];
}

/** NCM /comment/playlist 响应 —— 字段在顶层，无 data 包裹 */
export interface CommentResponse {
  comments: NcmComment[];
  hotComments?: NcmComment[];
  total: number;
  more: boolean;
}
