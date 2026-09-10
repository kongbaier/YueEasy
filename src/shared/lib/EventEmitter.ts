type Fn<T extends any[] = any[]> = (...args: T) => void;

export class EventEmitter<EventName extends string> {
  private listeners: Map<EventName, Set<Fn>>;

  constructor() {
    this.listeners = new Map();
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
    this.emit = this.emit.bind(this);
    this.offAll = this.offAll.bind(this);
  }

  //注册事件
  on(eventName: EventName, listener: Fn) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)?.add(listener);
  }

  //取消注册事件
  off(eventName: EventName, listeners: Fn) {
    this.listeners.get(eventName)?.delete(listeners);
  }

  //触发事件
  emit(eventName: EventName, ...args: unknown[]) {
    const targetListeners = this.listeners.get(eventName);
    if (!targetListeners) return;
    for (const fn of targetListeners) {
      fn(...args);
    }
  }

  //取消注册所有事件
  offAll(eventName: EventName) {
    const targetListeners = this.listeners.get(eventName);
    if (!targetListeners) return;
    this.listeners.delete(eventName);
  }
}
