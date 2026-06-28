import { ncmApi } from "./api";
import type { CommentResponse } from "./types/comment.response";

export type { CommentResponse } from "./types/comment.response";

export const commentSlice = {
  commentPlaylist: (id: number, limit = 20, offset = 0) =>
    ncmApi<CommentResponse>("comment_playlist", {
      id: String(id),
      limit: String(limit),
      offset: String(offset),
    }),
  commentMusic: (id: number, limit = 20, offset = 0) =>
    ncmApi<CommentResponse>("comment_music", {
      id: String(id),
      limit: String(limit),
      offset: String(offset),
    }),
};
