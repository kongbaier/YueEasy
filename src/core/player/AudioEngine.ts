export type AudioEvents = {
  timeupdate: (currentTime: number, duration: number) => void;
  precisetimeupdate: (currentTime: number, duration: number) => void;
  ended: () => void;
  play: () => void;
  pause: () => void;
  loadedmetadata: (duration: number) => void;
  canPlay: () => void;
};

export class AudioEngine {
  #audioElement: HTMLAudioElement;
  #listeners: { [K in keyof AudioEvents]: Set<AudioEvents[K]> };
  #preciseRafId: number | null;

  constructor() {
    this.#audioElement = new Audio();
    this.#listeners = {
      timeupdate: new Set(),
      precisetimeupdate: new Set(),
      ended: new Set(),
      play: new Set(),
      pause: new Set(),
      loadedmetadata: new Set(),
      canPlay: new Set(),
    };
    this.#preciseRafId = null;
    this.#bindEvents();
    this.#audioElement.preload = "metadata";
    this.#audioElement.controls = false;
  }

  async play() {
    await this.#audioElement.play()?.catch((err) => {
      if (err.name !== "AbortError") throw err;
    });
  }

  pause() {
    this.#audioElement.pause();
  }

  load(src: string) {
    this.#stopPreciseLoop();
    this.#audioElement.src = src;
    this.#audioElement.load();
  }

  on<K extends keyof AudioEvents>(event: K, handler: AudioEvents[K]) {
    this.#listeners[event].add(handler);
    return () => this.#listeners[event].delete(handler);
  }

  get loaded() {
    return this.#audioElement.src !== "";
  }

  get currentSrc() {
    return this.#audioElement.src;
  }

  get playing() {
    return !this.#audioElement.paused;
  }

  get buffered() {
    return this.#audioElement.buffered;
  }

  get muted() {
    return this.#audioElement.muted;
  }
  set muted(muted: boolean) {
    this.#audioElement.muted = muted;
  }

  get readyState() {
    return this.#audioElement.readyState;
  }

  get volume() {
    return this.#audioElement.volume;
  }
  set volume(volume: number) {
    this.#audioElement.volume = volume;
  }

  get currentTime() {
    return this.#audioElement.currentTime;
  }

  set currentTime(time: number) {
    this.#audioElement.currentTime = time;
  }

  get duration() {
    return this.#audioElement.duration;
  }

  #startPreciseLoop() {
    if (!this.playing || this.#preciseRafId !== null) return;
    const tick = () => {
      if (!this.playing) return;
      for (const fn of this.#listeners.precisetimeupdate) {
        fn(this.#audioElement.currentTime, this.#audioElement.duration);
      }
      this.#preciseRafId = requestAnimationFrame(tick);
    };
    this.#preciseRafId = requestAnimationFrame(tick);
  }

  #stopPreciseLoop() {
    if (this.#preciseRafId !== null) {
      cancelAnimationFrame(this.#preciseRafId);
      this.#preciseRafId = null;
    }
  }

  #bindEvents() {
    this.#audioElement.addEventListener("timeupdate", () => {
      for (const fn of this.#listeners.timeupdate) {
        fn(this.#audioElement.currentTime, this.#audioElement.duration);
      }
    });

    this.#audioElement.addEventListener("ended", () => {
      for (const fn of this.#listeners.ended) {
        fn();
      }
    });

    this.#audioElement.addEventListener("play", () => {
      this.#startPreciseLoop();
      for (const fn of this.#listeners.play) {
        fn();
      }
    });

    this.#audioElement.addEventListener("pause", () => {
      this.#stopPreciseLoop();
      for (const fn of this.#listeners.pause) {
        fn();
      }
    });

    this.#audioElement.addEventListener("loadedmetadata", () => {
      for (const fn of this.#listeners.loadedmetadata) {
        fn(this.#audioElement.duration);
      }
    });
    this.#audioElement.addEventListener("canplay", () => {
      for (const fn of this.#listeners.canPlay) {
        fn();
      }
    });
  }
}
