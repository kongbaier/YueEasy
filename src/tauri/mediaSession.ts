import { invoke } from '@tauri-apps/api/core';

export interface MediaSessionMetadata {
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  artworkUrl?: string;
}

export async function updateMediaSessionMetadata(
  meta: MediaSessionMetadata,
): Promise<void> {
  return invoke('update_media_session_metadata', { meta });
}

export async function updateMediaSessionStatus(
  playing: boolean,
): Promise<void> {
  return invoke('update_media_session_status', { playing });
}

export async function updateMediaSessionPosition(
  positionSecs: number,
): Promise<void> {
  return invoke('update_media_session_position', { positionSecs });
}
