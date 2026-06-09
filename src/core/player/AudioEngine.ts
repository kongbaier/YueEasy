import { Howl } from "howler";
import { EventEmitter } from "@/lib/EventEmitter";

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
  #eventEmitter: EventEmitter<AudioEvents> = new EventEmitter();
  #src = "";
  #duration = 0;
  #rate = 1;
  #muted = false;
  #volume = 1;
  #rafId = 0;

  #startTimeUpdate() {
    if (this.#rafId) return;
    const tick = () => {
      if (!this.#howl) {
        this.stopTimeUpdate();
        return;
      }
      this.#eventEmitter.emit(
        "timeupdate",
        this.#howl.seek() as number,
        this.#duration,
      );
      this.#rafId = requestAnimationFrame(tick);
    };
    this.#rafId = requestAnimationFrame(tick);
  }

  stopTimeUpdate() {
    if (this.#rafId) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = 0;
    }
  }

  on<K extends keyof AudioEvents>(event: K, handler: AudioEvents[K]) {
    return this.#eventEmitter.on(event, handler);
  }

  off<K extends keyof AudioEvents>(event: K, handler: AudioEvents[K]) {
    this.#eventEmitter.off(event, handler);
  }

  get playing() {
    return this.#howl?.playing() ?? false;
  }

  async play() {
    if (!this.#howl) {
      throw new Error("No audio source loaded");
    }
    const howl = this.#howl;
    return new Promise<void>((resolve, reject) => {
      howl.once("play", () => resolve());
      howl.once("playerror", (_soundId, err) => {
        reject(err || new Error("Play failed"));
      });
      howl.play();
    });
  }

  pause() {
    this.#howl?.pause();
  }

  load(src: string) {
    if (this.#src === src && this.#howl) {
      return;
    }
    this.#cleanup();
    this.#src = src;
    this.#howl = new Howl({
      src: [src],
      html5: true,
      preload: true,
      volume: this.#volume,
      mute: this.#muted,
    });
    this.#howl.load();

    this.#bindHowlEvents();
  }

  get currentSrc() {
    return this.#src;
  }

  get muted() {
    return this.#muted;
  }

  set muted(value: boolean) {
    this.#muted = value;
    this.#howl?.mute(value);
  }

  get volume() {
    return this.#volume;
  }

  set volume(value: number) {
    if (value < 0 || value > 1) {
      throw new RangeError("Volume must be between 0 and 1");
    }
    this.#volume = value;
    this.#howl?.volume(value);
  }

  get currentTime() {
    const howl = this.#howl;
    if (!howl) throw new Error("No audio source loaded");
    return howl.seek();
  }
  set currentTime(time: number) {
    if (!this.#howl) throw new Error("No audio source loaded");
    this.#howl.seek(time);
  }

  get duration() {
    return this.#duration;
  }

  get rate() {
    return this.#rate;
  }

  set rate(value: number) {
    if (value <= 0) {
      throw new RangeError("Playback rate must be greater than 0");
    }
    this.#rate = value;
    this.#howl?.rate(value);
  }

  #bindHowlEvents() {
    const h = this.#howl;
    if (!h) return;

    h.on("load", () => {
      this.#duration = h.duration();
      this.#eventEmitter.emit("loadedmetadata", this.#duration);
      this.#eventEmitter.emit("canPlay");
    });

    h.on("play", () => {
      this.#startTimeUpdate();
      this.#eventEmitter.emit("play");
    });

    h.on("pause", () => {
      this.stopTimeUpdate();
      this.#eventEmitter.emit("pause");
    });

    h.on("end", () => {
      this.stopTimeUpdate();
      this.#eventEmitter.emit("ended");
    });

    // h.on("stop", () => {
    //   this.#eventEmitter.emit("stop");
    // });
  }

  #cleanup() {
    this.stopTimeUpdate();
    if (this.#howl) {
      this.#howl.unload();
      this.#howl = null;
    }
  }
}
