import { useEffect } from 'react';
import {
  onMediaSessionEvent,
  updateMetadata,
  updatePosition,
  updateStatus,
  type MediaSessionEvent,
} from '../services/MediaSessionService';
import { usePlayerMirrorStore } from '@/stores/playerMirror';
import { queueItemToSong } from '@/shared/utils/mappers';
import { useMediaControls } from './useMediaControls';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';

export const useMediaSession = () => {
  const { handlePlay, handlePause, handleToggle } = useMediaControls();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    let cancelled = false;

    // 监听系统媒体键事件（事件封装在 MediaSessionService）
    onMediaSessionEvent((event: MediaSessionEvent) => {
      const queueStore = useQueueStore.getState();
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
          queueStore
            .next()
            .catch((e) => console.error('store.next() threw:', e));
          break;
        case 'previous':
          queueStore
            .prev()
            .catch((e) => console.error('store.prev() threw:', e));
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
        unlisten(); // immediately unsubscribe leaked listener
      }
    });

    // 推送元数据到系统媒体会话
    const pushMetadata = () => {
      const raw = usePlayerMirrorStore.getState().currentTrack;
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

    // 曲目变化 → 更新元数据
    const unsubTrack = usePlayerMirrorStore.subscribe((state, prevState) => {
      if (state.currentTrack?.track_id !== prevState.currentTrack?.track_id) {
        pushMetadata();
      }
    });

    // 播放状态变化 → 更新状态 & 位置
    const unsubPlayback = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      void updateStatus(state.playing);
      void updatePosition(state.currentTime);
    });

    // 时长从 0 变为已知 → 补推元数据（让系统端时间轴准确）
    const unsubDuration = usePlayerStore.subscribe((state, prevState) => {
      if (state.duration > 0 && prevState.duration === 0) {
        pushMetadata();
      }
    });

    // 播放中周期性同步进度
    const timer = window.setInterval(() => {
      const state = usePlayerStore.getState();
      if (state.playing) {
        void updatePosition(state.currentTime);
      }
    }, 5000);

    // 同步初始状态
    const init = usePlayerMirrorStore.getState();
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
    // handlePlay/handlePause/handleToggle 为 useCallback([]) 稳定引用，effect 仍只挂一次
  }, [handlePlay, handlePause, handleToggle]);
};
