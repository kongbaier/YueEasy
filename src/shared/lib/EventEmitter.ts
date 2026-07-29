/* oxlint-disable typescript/no-explicit-any */

export class EventEmitter<Events extends Record<string, unknown[]>> {
  private listeners: Map<keyof Events, Set<(...args: any[]) => void>>;

  constructor() {
    this.listeners = new Map();
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
  }

  on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);

    return () => this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]) {
    const targetListeners = this.listeners.get(event);
    if (!targetListeners) return;
    for (const fn of targetListeners) {
      fn(...args);
    }
  }

  off(event: keyof Events) {
    this.listeners.delete(event);
  }
}
