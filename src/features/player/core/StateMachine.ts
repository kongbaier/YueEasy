const state = [
  "idle",
  "loading",
  "ready",
  "playing",
  "paused",
  "ended",
  "error",
] as const;

type State = (typeof state)[number];

export class StateMachine {
  state: State = "idle";
  transitions: Record<State, State[]>;
  onTransition: ((state: State) => void) | null = null;

  constructor() {
    this.transitions = {
      idle: ["loading"],
      loading: ["ready", "error", "loading"],
      ready: ["playing", "loading"],
      playing: ["paused", "ended", "error", "loading"],
      paused: ["playing", "ended", "error", "loading", "idle"],
      ended: ["playing", "loading", "ended", "idle"],
      error: ["loading", "idle"],
    };
  }

  canTransition(to: State): boolean {
    return this.transitions[this.state]?.includes(to);
  }

  transition(to: State): boolean {
    if (!this.canTransition(to)) {
      return false;
    }
    this.state = to;
    this.onTransition?.(to);
    return true;
  }
}
