import { ncmCommentMusic, ncmCommentPlaylist } from './api';

export const commentSlice = {
  commentPlaylist: (id: number, limit = 20, offset = 0) =>
    ncmCommentPlaylist({ id, limit, offset }),
  commentMusic: (id: number, limit = 20, offset = 0) =>
    ncmCommentMusic({ id, limit, offset }),
};
