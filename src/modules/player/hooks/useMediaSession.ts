import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import {
  updateMediaSessionMetadata,
  updateMediaSessionPosition,
  updateMediaSessionStatus,
} from '@/tauri/mediaSession';
import { usePlayerStore } from '../stores/player';
import { useQueueStore } from '../stores/queue';

type MediaSessionEvent =
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

export const useMediaSession = () => {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    let cancelled = false;

    // 监听系统媒体键事件
    listen<MediaSessionEvent>('media-session-event', (event) => {
      const playerStore = usePlayerStore.getState();
      const queueStore = useQueueStore.getState();
      switch (event.payload.event) {
        case 'play':
          playerStore.resume();
          break;
        case 'pause':
          playerStore.pause();
          break;
        case 'toggle':
          playerStore.toggle();
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
          playerStore.pause();
          break;
        case 'seekTo':
          playerStore.seek(event.payload.position);
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
      const track = useQueueStore.getState().currentTrack;
      if (!track) return;

      const artistNames = track.artists?.map((a) => a.name).join('、') ?? '';
      const albumName = track.album?.name ?? '';

      void updateMediaSessionMetadata({
        title: track.name,
        artist: artistNames,
        album: albumName,
        durationSecs: usePlayerStore.getState().duration,
        artworkUrl: track.album?.picUrl,
      });
    };

    // 曲目变化 → 更新元数据
    const unsubTrack = useQueueStore.subscribe((state, prevState) => {
      if (state.currentTrack?.id !== prevState.currentTrack?.id) {
        pushMetadata();
      }
    });

    // 播放状态变化 → 更新状态 & 位置
    const unsubPlayback = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      void updateMediaSessionStatus(state.playing);
      void updateMediaSessionPosition(state.currentTime);
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
        void updateMediaSessionPosition(state.currentTime);
      }
    }, 5000);

    // 同步初始状态
    const init = useQueueStore.getState();
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
  }, []);
};
