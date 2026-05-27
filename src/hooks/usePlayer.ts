import { useCallback, useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores";

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const store = usePlayerStore();
  const { core, currentTrack, state } = store;

  useEffect(() => {
    if (audioRef.current) return;
    audioRef.current = new Audio();
    audioRef.current.volume = core.volume;
    audioRef.current.preload = "auto";
  }, [core.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      core.onTimeUpdate(audio.currentTime, audio.duration || 0);
    };
    const onEnded = () => core.onEnded();
    const onError = () => core.onError();
    const onCanPlay = () => {
      core.play();
      audio.play().catch(() => {});
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [core]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.url) {
      if (audio.src !== currentTrack.url) {
        audio.src = currentTrack.url;
        audio.load();
      }
    }
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state === "playing") {
      audio.play().catch(() => {});
    } else if (state === "paused") {
      audio.pause();
    }
  }, [state]);

  useEffect(() => {
    const handler = (time: number) => {
      if (audioRef.current) audioRef.current.currentTime = time;
    };
    core.on("seek", handler);
    return () => core.off("seek", handler);
  }, [core]);

  useEffect(() => {
    const handler = (vol: number) => {
      if (audioRef.current) audioRef.current.volume = vol;
    };
    core.on("volumeChange", handler);
    return () => core.off("volumeChange", handler);
  }, [core]);

  const seek = useCallback(
    (time: number) => {
      core.seek(time);
    },
    [core],
  );

  return { seek };
}
