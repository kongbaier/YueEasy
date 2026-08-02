// ── Play mode ──

export const PlayModes = ['sequential', 'shuffle', 'repeatOne'] as const;
export type PlayMode = (typeof PlayModes)[number];

/** Cycle sequential → shuffle → repeatOne → sequential (pure). */
export function cyclePlayMode(mode: PlayMode): PlayMode {
  return mode === 'sequential'
    ? 'shuffle'
    : mode === 'shuffle'
      ? 'repeatOne'
      : 'sequential';
}

// ── Track model ──

export interface Track {
  id: number;
  name: string;
  artists: TrackArtist[];
  album: TrackAlbum;
  duration: number;
}

export interface TrackArtist {
  id: number;
  name: string;
}

export interface TrackAlbum {
  id: number;
  name: string;
  picUrl?: string;
}
