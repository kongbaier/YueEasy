import { create } from 'zustand';
import { playerService } from '../services/PlayerService';

// ── Store ──

export interface PlayerStore {
  playing: boolean;
  loading: boolean;
  currentTime: number;
  currentTimeHigh: number;
  duration: number;

  seek: (time: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => {
  // ── Mirror playback state from the service (single source of truth) ──

  playerService.on('play', () => set({ playing: true }));
  playerService.on('pause', () => set({ playing: false }));
  playerService.on('ended', () => set({ playing: false }));
  playerService.on('loading', () => set({ loading: true }));
  playerService.on('ready', () => set({ loading: false }));
  playerService.on('error', () => set({ loading: false, playing: false }));
  playerService.on('timeupdate', (currentTime) => set({ currentTime }));
  playerService.on('timetick', (currentTimeHigh) =>
    set({ currentTimeHigh }),
  );
  playerService.on('durationchange', (duration) => set({ duration }));

  return {
    playing: false,
    loading: false,
    currentTime: 0,
    currentTimeHigh: 0,
    duration: 0,

    seek: (time) => {
      set({ currentTime: time });
      playerService.seek(time);
    },
  };
});
