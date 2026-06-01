import { Howl } from "howler";

export type AudioEvents = {
  timeupdate: (currentTime: number, duration: number) => void;
  ended: () => void;
  play: () => void;
  pause: () => void;
  loadedmetadata: (duration: number) => void;
  canPlay: () => void;
};

export class AudioEngine {
  #howl: Howl | null = null;
  #listeners: { [K in keyof AudioEvents]: Set<AudioEvents[K]> };
  #rafId: number | null = null;
  #src = "";
  #playing = false;
  #duration = 0;
  #muted = false;
  #volume = 1;

  constructor() {
    this.#listeners = {
      timeupdate: new Set(),
      ended: new Set(),
      play: new Set(),
      pause: new Set(),
      loadedmetadata: new Set(),
      canPlay: new Set(),
    };
  }

  async play() {
    return new Promise<void>((resolve, reject) => {
      this.#howl?.once("play", () => resolve());
      this.#howl?.once("playerror", (_soundId, err) => {
        reject(err || new Error("Play failed"));
      });
      this.#howl?.play();
    });
  }

  pause() {
    this.#howl?.pause();
  }

  load(src: string) {
    this.#cleanup();
    this.#src = src;
    this.#howl = new Howl({
      src: [src],
      html5: true,
      preload: true,
      volume: this.#volume,
      mute: this.#muted,
    });
    this.#bindHowlEvents();
  }

  on<K extends keyof AudioEvents>(event: K, handler: AudioEvents[K]) {
    this.#listeners[event].add(handler);
    return () => {
      this.#listeners[event].delete(handler);
    };
  }

  get loaded() {
    return this.#src !== "";
  }

  get currentSrc() {
    return this.#src;
  }

  get playing() {
    return this.#playing;
  }

  get buffered() {
    return null;
  }

  get muted() {
    return this.#muted;
  }
  set muted(value: boolean) {
    this.#muted = value;
    this.#howl?.mute(value);
  }

  get readyState() {
    if (!this.#howl) return 0;
    return this.#howl.state() === "loaded" ? 4 : 2;
  }

  get volume() {
    return this.#volume;
  }
  set volume(value: number) {
    this.#volume = value;
    this.#howl?.volume(value);
  }

  get currentTime() {
    return (this.#howl?.seek() as number) ?? 0;
  }
  set currentTime(time: number) {
    this.#howl?.seek(time);
  }

  get duration() {
    return this.#duration;
  }

  #bindHowlEvents() {
    const h = this.#howl;
    if (!h) return;

    h.on("load", () => {
      this.#duration = h.duration();
      for (const fn of this.#listeners.loadedmetadata) {
        fn(this.#duration);
      }
      for (const fn of this.#listeners.canPlay) {
        fn();
      }
    });

    h.on("play", () => {
      this.#playing = true;
      this.#startLoop();
      for (const fn of this.#listeners.play) fn();
    });

    h.on("pause", () => {
      this.#playing = false;
      this.#stopLoop();
      for (const fn of this.#listeners.pause) fn();
    });

    h.on("end", () => {
      this.#playing = false;
      this.#stopLoop();
      for (const fn of this.#listeners.ended) fn();
    });

    h.on("stop", () => {
      this.#playing = false;
      this.#stopLoop();
    });
  }

  #cleanup() {
    this.#stopLoop();
    if (this.#howl) {
      this.#howl.unload();
      this.#howl = null;
    }
  }

  #startLoop() {
    if (this.#rafId !== null) return;
    const tick = () => {
      if (!this.#playing || !this.#howl) return;
      const ct = this.#howl.seek() as number;
      for (const fn of this.#listeners.timeupdate) {
        fn(ct, this.#duration);
      }
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  #stopLoop() {
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
  }
}
