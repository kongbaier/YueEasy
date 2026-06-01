export type PlayerState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export const PlayModes = ["sequential", "shuffle", "repeatOne"] as const;
export type PlayMode = (typeof PlayModes)[number];

export type { Playlist, PlaylistUser, SongRef } from "./types/playlist";
export type { Track, TrackAlbum, TrackArtist } from "./types/track";
