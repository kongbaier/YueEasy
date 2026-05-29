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

export interface TrackArtist {
  id: number;
  name: string;
}

export interface TrackAlbum {
  id: number;
  name: string;
  picUrl?: string;
}

export interface Track {
  id: number;
  name: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  duration: number;
  url: string;
}
