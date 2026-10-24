/**
 * EventBus - Decoupled Pub/Sub event emitter for IndecisionBracket.
 */
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event 
   * @param {Function} handler 
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event 
   * @param {Function} handler 
   */
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Subscribe to an event once.
   * @param {string} event 
   * @param {Function} handler 
   */
  once(event, handler) {
    const unsub = this.on(event, (...args) => {
      unsub();
      handler(...args);
    });
    return unsub;
  }

  /**
   * Emit an event with data.
   * @param {string} event 
   * @param {any} data 
   */
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Clear all registered listeners.
   */
  clear() {
    this.listeners.clear();
  }
}
