import { authSlice } from "./auth.slice";
import { commentSlice } from "./comment.slice";
import { discoverSlice } from "./discover.slice";
import { playlistSlice } from "./playlist.slice";
import { songSlice } from "./song.slice";

export * from "./mappers";
// Re-export all response types for convenience
export * from "./types";

export const ncm = {
  ...authSlice,
  ...commentSlice,
  ...songSlice,
  ...playlistSlice,
  ...discoverSlice,
};

export { clearNcmCookie, getNcmCookie, setNcmCookie } from "./cookie";
