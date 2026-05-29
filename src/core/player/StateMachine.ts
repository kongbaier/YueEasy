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

  constructor() {
    this.transitions = {
      idle: ["loading"],
      loading: ["ready", "error"],
      ready: ["playing", "loading"],
      playing: ["paused", "ended", "error", "loading"],
      paused: ["playing", "ended", "error", "loading"],
      ended: ["playing", "loading"],
      error: ["loading"],
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
    return true;
  }
}
