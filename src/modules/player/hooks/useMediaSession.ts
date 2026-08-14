import { useEffect } from 'react';
import {
  onMediaSessionEvent,
  updateMetadata,
  updatePosition,
  updateStatus,
  type MediaSessionEvent,
} from '../services/MediaSessionService';
import { usePlayerStore } from '@/stores/player';
import { queueItemToSong } from '@/shared/utils/mappers';
import { useMediaControls } from './useMediaControls';

export const useMediaSession = () => {
  const { handlePlay, handlePause, handleToggle } = useMediaControls();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    let cancelled = false;

    onMediaSessionEvent((event: MediaSessionEvent) => {
      const store = usePlayerStore.getState();
      switch (event.event) {
        case 'play':
          void handlePlay();
          break;
        case 'pause':
          handlePause();
          break;
        case 'toggle':
          handleToggle();
          break;
        case 'next':
          store.next().catch((e) => console.error('store.next() threw:', e));
          break;
        case 'previous':
          store.prev().catch((e) => console.error('store.prev() threw:', e));
          break;
        case 'stop':
          handlePause();
          break;
        case 'seekTo':
          usePlayerStore.getState().seek(event.position);
          break;
      }
    }).then((unlisten) => {
      if (!cancelled) {
        unlisteners.push(unlisten);
      } else {
        unlisten();
      }
    });

    const pushMetadata = () => {
      const raw = usePlayerStore.getState().currentTrack;
      const track = raw ? queueItemToSong(raw) : null;
      if (!track) return;

      const artistNames = track.artists?.map((a) => a.name).join('、') ?? '';
      const albumName = track.album?.name ?? '';

      void updateMetadata({
        title: track.name,
        artist: artistNames,
        album: albumName,
        durationSecs: usePlayerStore.getState().duration,
        artworkUrl: track.album?.picUrl,
      });
    };

    const unsubTrack = usePlayerStore.subscribe((state, prevState) => {
      if (state.currentTrack?.track_id !== prevState.currentTrack?.track_id) {
        pushMetadata();
      }
    });

    const unsubPlayback = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      void updateStatus(state.playing);
      void updatePosition(state.currentTime);
    });

    const unsubDuration = usePlayerStore.subscribe((state, prevState) => {
      if (state.duration > 0 && prevState.duration === 0) {
        pushMetadata();
      }
    });

    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (state.playing) {
        void updatePosition(state.currentTime);
      }
    }, 5000);

    const init = usePlayerStore.getState();
    if (init.currentTrack) {
      pushMetadata();
    }

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubTrack();
      unsubPlayback();
      unsubDuration();
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [handlePlay, handlePause, handleToggle]);
};
