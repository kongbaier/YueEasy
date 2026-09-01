import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface MediaSessionMetadata {
  title: string;
  artist: string;
  album: string;
  durationSecs: number;
  artworkUrl?: string;
}

export type MediaSessionEvent =
  | { event: 'play' }
  | { event: 'pause' }
  | { event: 'toggle' }
  | { event: 'next' }
  | { event: 'previous' }
  | { event: 'stop' }
  | { event: 'fastForward' }
  | { event: 'rewind' }
  | { event: 'seekTo'; position: number }
  | { event: 'setPlaybackRate'; rate: number };

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

/** 订阅 OS 媒体键事件（Rust `media-session-event` 推送）。返回取消订阅函数。 */
export function onMediaSessionEvent(
  cb: (event: MediaSessionEvent) => void,
): Promise<UnlistenFn> {
  return listen<MediaSessionEvent>('media-session-event', (event) => {
    cb(event.payload);
  });
}
