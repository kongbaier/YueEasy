/** biome-ignore-all lint/suspicious/noExplicitAny: 函数参数逆变 */

export class EventEmitter<
  Events extends Record<string, (...args: any[]) => any>,
> {
  private listeners: Map<keyof Events, Set<(...args: any[]) => any>>;

  constructor() {
    this.listeners = new Map();
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.offAll = this.offAll.bind(this);
  }

  on<K extends keyof Events>(eventName: K, listener: Events[K]) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)?.add(listener);
    return () => this.off(eventName, listener);
  }

  off<K extends keyof Events>(eventName: K, listener: Events[K]) {
    this.listeners.get(eventName)?.delete(listener);
  }

  emit<K extends keyof Events>(eventName: K, ...args: Parameters<Events[K]>) {
    const targetListeners = this.listeners.get(eventName);
    if (!targetListeners) return;
    for (const fn of targetListeners) {
      fn(...args);
    }
  }

  offAll(eventName: keyof Events) {
    this.listeners.delete(eventName);
  }
}
