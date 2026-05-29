import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores";

export function useMediaSession() {
  const positionTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    const pushMetadata = () => {
      const track = usePlayerStore.getState().currentTrack;
      if (!track) {
        navigator.mediaSession.metadata = null;
        return;
      }

      const artistNames = track.artists?.map((a) => a.name).join("、") ?? "";
      const albumName = track.album?.name ?? "";

      const artwork: MediaImage[] = [];
      if (track.album?.picUrl) {
        artwork.push({
          src: track.album.picUrl,
          sizes: "300x300",
          type: "image/jpeg",
        });
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: artistNames,
        album: albumName,
        artwork,
      });
    };

    const pushPlaybackState = () => {
      const { playing } = usePlayerStore.getState();
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    };

    const startPositionTimer = () => {
      if (positionTimer.current) return;
      positionTimer.current = setInterval(() => {
        const { playing, currentTime, duration } = usePlayerStore.getState();
        if (playing) {
          navigator.mediaSession.setPositionState?.({
            duration: duration || 0,
            playbackRate: 1,
            position: currentTime,
          });
        }
      }, 1000);
    };

    const stopPositionTimer = () => {
      if (positionTimer.current) {
        clearInterval(positionTimer.current);
        positionTimer.current = null;
      }
    };

    navigator.mediaSession.setActionHandler("play", () => {
      usePlayerStore.getState().resume();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      usePlayerStore.getState().pause();
    });
    navigator.mediaSession.setActionHandler("previoustrack", () => {
      usePlayerStore.getState().prev();
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => {
      usePlayerStore.getState().next();
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime != null) {
        usePlayerStore.getState().seek(details.seekTime);
      }
    });

    const unsubTrack = usePlayerStore.subscribe((state, prevState) => {
      if (state.currentTrack?.id !== prevState.currentTrack?.id) {
        pushMetadata();
      }
    });

    const unsubPlaying = usePlayerStore.subscribe((state, prevState) => {
      if (state.playing !== prevState.playing) {
        pushPlaybackState();
        if (state.playing) {
          startPositionTimer();
        } else {
          stopPositionTimer();
        }
      }
    });

    // Sync initial state
    pushMetadata();
    pushPlaybackState();
    const init = usePlayerStore.getState();
    if (init.playing) startPositionTimer();

    return () => {
      unsubTrack();
      unsubPlaying();
      stopPositionTimer();
    };
  }, []);
}
