/**
 * CooldownManager - Recency decay filter to prevent picking the same spot repeatedly.
 * Stores visit timestamps and calculates active cooldown eligibility.
 */
export class CooldownManager {
  constructor(initialHistory = {}) {
    this.history = { ...initialHistory }; // { [itemNameOrId]: timestampMs }
  }

  /**
   * Record that an item was chosen/visited.
   * @param {Object|string} item 
   * @param {number} [timestamp] 
   */
  recordVisit(item, timestamp = Date.now()) {
    const key = typeof item === 'string' ? item : (item.id || item.name);
    this.history[key] = timestamp;
  }

  /**
   * Check if an item is currently on cooldown.
   * @param {Object|string} item 
   * @param {number} cooldownDays Default 3 days
   * @param {number} [currentTime]
   */
  isOnCooldown(item, cooldownDays = 3, currentTime = Date.now()) {
    if (cooldownDays <= 0) return false;
    const key = typeof item === 'string' ? item : (item.id || item.name);
    const lastVisit = this.history[key];
    if (!lastVisit) return false;

    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    return (currentTime - lastVisit) < cooldownMs;
  }

  /**
   * Get human-readable remaining cooldown time.
   * @param {Object|string} item 
   * @param {number} cooldownDays 
   * @param {number} [currentTime]
   */
  getRemainingCooldown(item, cooldownDays = 3, currentTime = Date.now()) {
    const key = typeof item === 'string' ? item : (item.id || item.name);
    const lastVisit = this.history[key];
    if (!lastVisit) return null;

    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const diff = cooldownMs - (currentTime - lastVisit);
    if (diff <= 0) return null;

    const hours = Math.ceil(diff / (60 * 60 * 1000));
    if (hours < 24) {
      return `${hours}h left`;
    }
    const days = Math.ceil(hours / 24);
    return `${days}d left`;
  }

  /**
   * Partition an item list into available vs cooling-down items.
   * @param {Array<Object>} items 
   * @param {number} cooldownDays 
   */
  partition(items, cooldownDays = 3) {
    const available = [];
    const coolingDown = [];

    for (const item of items) {
      if (this.isOnCooldown(item, cooldownDays)) {
        coolingDown.push({
          ...item,
          remaining: this.getRemainingCooldown(item, cooldownDays),
        });
      } else {
        available.push(item);
      }
    }

    return { available, coolingDown };
  }

  /**
   * Clear cooldown for a specific item.
   * @param {Object|string} item 
   */
  clearCooldown(item) {
    const key = typeof item === 'string' ? item : (item.id || item.name);
    delete this.history[key];
  }

  /**
   * Clear all history.
   */
  clearAll() {
    this.history = {};
  }

  /**
   * Export history state.
   */
  exportHistory() {
    return { ...this.history };
  }
}
