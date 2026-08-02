import { EventEmitter } from "@/shared/lib/EventEmitter";

type AudioState =
  "idle" | "loading" | "ready" | "playing" | "paused" | "ended" | "error";

type AudioEvents = {
  play: [];
  pause: [];
  ended: [];
  timeupdate: [currentTime: number];
  timetick: [currentTime: number];
  durationchange: [duration: number];
  loading: [];
  ready: [];
  error: [error: Error];
};

export class AudioCore {
  #audio: HTMLAudioElement;
  #context: AudioContext;
  #source: MediaElementAudioSourceNode;
  #analyser: AnalyserNode;
  #gain: GainNode;
  #state: AudioState = "idle";
  #events: EventEmitter<AudioEvents>;
  #tickCleanup: (() => void) | null = null;

  constructor() {
    this.#events = new EventEmitter();

    this.#audio = new Audio();
    this.#audio.crossOrigin = "anonymous";

    this.#context = new AudioContext();

    this.#source = this.#context.createMediaElementSource(this.#audio);
    this.#analyser = this.#context.createAnalyser();
    this.#gain = this.#context.createGain();

    this.#source
      .connect(this.#analyser)
      .connect(this.#gain)
      .connect(this.#context.destination);

    this.#bindAudioEvents();
  }

  // ── HTMLAudioElement event wiring ──

  #bindAudioEvents() {
    this.#audio.addEventListener("loadstart", () => {
      this.#state = "loading";
      this.#events.emit("loading");
    });

    this.#audio.addEventListener("loadedmetadata", () => {
      this.#events.emit("durationchange", this.#audio.duration);
      this.#events.emit("timeupdate", 0);
      this.#events.emit("timetick", 0);
    });

    this.#audio.addEventListener("timeupdate", () => {
      this.#events.emit("timeupdate", this.#audio.currentTime);
    });

    this.#audio.addEventListener("canplay", () => {
      this.#state = "ready";
      this.#events.emit("ready");
    });

    this.#audio.addEventListener("play", () => {
      this.#state = "playing";
      this.#events.emit("play");
      this.#tickCleanup = this.#startTick();
    });

    this.#audio.addEventListener("pause", () => {
      this.#state = "paused";
      this.#events.emit("pause");
      this.#tickCleanup?.();
    });

    this.#audio.addEventListener("ended", () => {
      this.#state = "ended";
      this.#events.emit("ended");
      this.#tickCleanup?.();
    });

    this.#audio.addEventListener("waiting", () => {
      if (this.#state === "playing") {
        this.#state = "loading";
        this.#events.emit("loading");
      }
    });

    this.#audio.addEventListener("error", () => {
      this.#state = "error";
      this.#events.emit(
        "error",
        new Error(this.#audio.error?.message ?? "Unknown audio error"),
      );
    });
  }

  #startTick(): () => void {
    let rafId = 0;
    const tick = () => {
      this.#events.emit("timetick", this.#audio.currentTime);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      this.#tickCleanup = null;
    };
  }

  // ── Public API ──

  async load(src: string): Promise<void> {
    this.#state = "loading";
    this.#events.emit("loading");
    this.#audio.src = src;
    this.#audio.load();

    // Wait for the audio to be ready to play
    if (this.#audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
      return;
    }
    await new Promise<void>((resolve) => {
      const onCanPlay = () => {
        this.#audio.removeEventListener("canplay", onCanPlay);
        resolve();
      };
      this.#audio.addEventListener("canplay", onCanPlay);
    });
  }

  unload(): void {
    this.#audio.pause();
    this.#tickCleanup?.();
    this.#audio.removeAttribute("src");
    this.#state = "idle";
  }

  async play(): Promise<void> {
    if (this.#context.state === "suspended") {
      await this.#context.resume();
    }
    await this.#audio.play();
  }

  pause(): void {
    this.#audio.pause();
  }

  async toggle(): Promise<void> {
    if (this.#state === "playing") {
      this.pause();
    } else {
      await this.play();
    }
  }

  stop(): void {
    this.#audio.pause();
    this.#audio.currentTime = 0;
    this.#tickCleanup?.();
    this.#state = "idle";
  }

  seek(seconds: number): void {
    if (!isFinite(seconds)) return;
    this.#audio.currentTime = Math.max(
      0,
      Math.min(seconds, this.#audio.duration || 0),
    );
  }

  destroy(): void {
    this.#audio.pause();
    this.#tickCleanup?.();
    this.#audio.removeAttribute("src");

    this.#source.disconnect();
    this.#analyser.disconnect();

    this.#context.close();
  }

  // ── Getters / Setters ──

  get currentTime(): number {
    return this.#audio.currentTime;
  }

  get duration(): number {
    return this.#audio.duration;
  }

  get buffered(): TimeRanges {
    return this.#audio.buffered;
  }

  get state(): AudioState {
    return this.#state;
  }

  get playing(): boolean {
    return this.#state === "playing";
  }

  get volume(): number {
    return this.#audio.volume;
  }

  set volume(value: number) {
    if (value < 0 || value > 1) {
      throw new RangeError("Volume must be between 0 and 1");
    }
    this.#audio.volume = value;
  }

  get muted(): boolean {
    return this.#audio.muted;
  }

  set muted(value: boolean) {
    this.#audio.muted = value;
  }

  // ── Event system ──

  on<K extends keyof AudioEvents>(
    event: K,
    listener: (...args: AudioEvents[K]) => void,
  ): () => void {
    return this.#events.on(event, listener);
  }

  off<K extends keyof AudioEvents>(event: K): void {
    this.#events.off(event);
  }

  emit<K extends keyof AudioEvents>(event: K, ...args: AudioEvents[K]): void {
    this.#events.emit(event, ...args);
  }
}
