import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import {
  initSmtc,
  updateSmtcMetadata,
  updateSmtcPosition,
  updateSmtcStatus,
} from "@/shared/services/smtc";
import { usePlayerStore } from "../stores/player";
import { useQueueStore } from "../stores/queue";

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

export const useMediaSession = () => {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];
    let cancelled = false;

    // 初始化 SMTC
    initSmtc().catch((e) => console.error("initSmtc() failed:", e));

    // 监听系统媒体键事件
    listen<SmtcEvent>("smtc-event", (event) => {
      const playerStore = usePlayerStore.getState();
      const queueStore = useQueueStore.getState();
      switch (event.payload.event) {
        case "play":
          playerStore.resume();
          break;
        case "pause":
          playerStore.pause();
          break;
        case "toggle":
          if (playerStore.playing) {
            playerStore.pause();
          } else {
            playerStore.resume();
          }
          break;
        case "next":
          queueStore
            .next()
            .catch((e) => console.error("store.next() threw:", e));
          break;
        case "previous":
          queueStore
            .prev()
            .catch((e) => console.error("store.prev() threw:", e));
          break;
        case "stop":
          playerStore.pause();
          break;
        case "setPosition":
        case "seekTo":
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

    // 推送元数据到 SMTC
    const pushMetadata = () => {
      const track = useQueueStore.getState().currentTrack;
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
    const unsubTrack = useQueueStore.subscribe((state, prevState) => {
      if (state.currentTrack?.id !== prevState.currentTrack?.id) {
        pushMetadata();
      }
    });

    // 播放状态变化 → 更新状态 & 位置
    const unsubPlayback = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing === prevState.playing) return;
      void updateSmtcStatus(state.playing);
      void updateSmtcPosition(state.currentTime);
    });

    // 同步初始状态
    const init = useQueueStore.getState();
    if (init.currentTrack) {
      pushMetadata();
    }

    return () => {
      cancelled = true;
      unsubTrack();
      unsubPlayback();
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, []);
};
