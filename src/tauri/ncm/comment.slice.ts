import { ncmCommentMusic, ncmCommentPlaylist } from './api';
import type { CommentResponse } from './types/comment.response';

export type { CommentResponse } from './types/comment.response';

export const commentSlice = {
  commentPlaylist: (id: number, limit = 20, offset = 0) =>
    ncmCommentPlaylist<CommentResponse>({ id, limit, offset }),
  commentMusic: (id: number, limit = 20, offset = 0) =>
    ncmCommentMusic<CommentResponse>({ id, limit, offset }),
};
