import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import {
  initSmtc,
  updateSmtcMetadata,
  updateSmtcPosition,
  updateSmtcStatus,
} from "@/api/smtc-api";
import { usePlayerStore } from "@/stores";

type SmtcEvent =
  | { event: "play" }
  | { event: "pause" }
  | { event: "toggle" }
  | { event: "next" }
  | { event: "previous" }
  | { event: "stop" }
  | { event: "fastForward" }
  | { event: "rewind" }
  | { event: "setPosition"; position: number }
  | { event: "seekTo"; position: number }
  | { event: "setPlaybackRate"; rate: number };

export function useMediaSession() {
  const positionTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    // 初始化 SMTC
    initSmtc().catch(console.error);

    // 监听系统媒体键事件
    listen<SmtcEvent>("smtc-event", (event) => {
      const store = usePlayerStore.getState();
      switch (event.payload.event) {
        case "play":
          store.resume();
          break;
        case "pause":
          store.pause();
          break;
        case "toggle":
          if (store.playing) {
            store.pause();
          } else {
            store.resume();
          }
          break;
        case "next":
          store.next();
          break;
        case "previous":
          store.prev();
          break;
        case "stop":
          store.pause();
          break;
        case "setPosition":
        case "seekTo":
          store.seek(event.payload.position);
          break;
      }
    }).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    // 推送元数据到 SMTC
    const pushMetadata = () => {
      const track = usePlayerStore.getState().currentTrack;
      if (!track) return;

      const artistNames = track.artists?.map((a) => a.name).join("、") ?? "";
      const albumName = track.album?.name ?? "";

      void updateSmtcMetadata({
        title: track.name,
        artist: artistNames,
        album: albumName,
        durationSecs: usePlayerStore.getState().duration,
        artworkUrl: track.album?.picUrl,
      });
    };

    // 曲目变化 → 更新元数据
    const unsubTrack = usePlayerStore.subscribe((state, prevState) => {
      if (state.currentTrack?.id !== prevState.currentTrack?.id) {
        pushMetadata();
      }
    });

    // 播放状态变化 → 更新状态
    const unsubPlayback = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      void updateSmtcStatus(state.playing);
    });

    // 每秒更新位置
    const startPositionTimer = () => {
      if (positionTimer.current) return;
      positionTimer.current = setInterval(() => {
        const { playing, currentTime } = usePlayerStore.getState();
        if (playing) {
          void updateSmtcPosition(currentTime);
        }
      }, 1000);
    };

    const stopPositionTimer = () => {
      if (positionTimer.current) {
        clearInterval(positionTimer.current);
        positionTimer.current = null;
      }
    };

    const unsubPlaying = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      if (state.playing) {
        startPositionTimer();
      } else {
        stopPositionTimer();
      }
    });

    // 同步初始状态
    const init = usePlayerStore.getState();
    if (init.currentTrack) {
      pushMetadata();
    }
    if (init.playing) {
      startPositionTimer();
    }

    return () => {
      unsubTrack();
      unsubPlayback();
      unsubPlaying();
      stopPositionTimer();
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);
}
