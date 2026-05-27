export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";
export type PlayMode = "sequential" | "repeat" | "repeatOne" | "shuffle";

export interface TrackArtist {
  id: number;
  name: string;
}

export interface TrackAlbum {
  id: number;
  name: string;
}

export interface Track {
  id: number;
  name: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  duration: number;
  url?: string;
}
