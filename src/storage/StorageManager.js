/**
 * StorageManager - Local-first persistence engine with schema versioning,
 * default presets, cooldown tracking, and JSON backup export/import.
 */
export const STORAGE_KEY = 'indecision_bracket_v1';

export const DEFAULT_PRESETS = [
  {
    id: 'pool_takeout',
    name: 'Quick Takeout & Casual',
    emoji: '🥡',
    items: [
      { id: 't1', name: 'Thai Curry & Pad Thai', emoji: '🍜', tag: 'Spicy' },
      { id: 't2', name: 'Street Tacos & Burritos', emoji: '🌮', tag: 'Fast' },
      { id: 't3', name: 'Gourmet Smash Burgers', emoji: '🍔', tag: 'Comfort' },
      { id: 't4', name: 'Tonkotsu Ramen', emoji: '🍲', tag: 'Warm' },
      { id: 't5', name: 'Mediterranean Shawarma', emoji: '🥙', tag: 'Fresh' },
      { id: 't6', name: 'Wood-Fired Pizza', emoji: '🍕', tag: 'Classic' },
      { id: 't7', name: 'Indian Butter Chicken & Naan', emoji: '🍛', tag: 'Rich' },
      { id: 't8', name: 'Sushi & Poke Bowl', emoji: '🍣', tag: 'Light' },
    ],
  },
  {
    id: 'pool_date_night',
    name: 'Date Night Dining',
    emoji: '🍷',
    items: [
      { id: 'd1', name: 'Handmade Pasta & Wine', emoji: '🍝', tag: 'Romantic' },
      { id: 'd2', name: 'Spanish Tapas Bar', emoji: '🥘', tag: 'Lively' },
      { id: 'd3', name: 'Korean BBQ Grill', emoji: '🥩', tag: 'Interactive' },
      { id: 'd4', name: 'Japanese Izakaya & Robata', emoji: '🍢', tag: 'Cozy' },
      { id: 'd5', name: 'French Bistro & Steak Frites', emoji: '🍷', tag: 'Intimate' },
      { id: 'd6', name: 'Rooftop Lounge & Cocktails', emoji: '🍸', tag: 'Views' },
      { id: 'd7', name: 'Authentic Dim Sum', emoji: '🥟', tag: 'Casual' },
      { id: 'd8', name: 'Seafood Oyster Bar', emoji: '🦪', tag: 'Fresh' },
    ],
  },
  {
    id: 'pool_movies',
    name: 'What to Watch',
    emoji: '🍿',
    items: [
      { id: 'm1', name: 'Sci-Fi Mindbender', emoji: '🚀', tag: 'Thoughtful' },
      { id: 'm2', name: 'Psychological Thriller', emoji: '🔪', tag: 'Tense' },
      { id: 'm3', name: 'Stand-Up Comedy Special', emoji: '🎤', tag: 'Laughs' },
      { id: 'm4', name: 'Classic Whodunit Mystery', emoji: '🕵️', tag: 'Clever' },
      { id: 'm5', name: 'High-Octane Action Flick', emoji: '💥', tag: 'Fast' },
      { id: 'm6', name: 'Feel-Good Coming-of-Age', emoji: '🌻', tag: 'Heartwarming' },
      { id: 'm7', name: 'Wild Nature / Space Doc', emoji: '🪐', tag: 'Relaxing' },
      { id: 'm8', name: 'A24 Indie Drama', emoji: '🎬', tag: 'Artistic' },
    ],
  },
  {
    id: 'pool_weekend',
    name: 'Weekend Energy',
    emoji: '🥾',
    items: [
      { id: 'w1', name: 'Morning Scenic Hike', emoji: '🌲', tag: 'Active' },
      { id: 'w2', name: 'Farmers Market & Bakery Walk', emoji: '🥐', tag: 'Chill' },
      { id: 'w3', name: 'Specialty Coffee & Long Read', emoji: '☕', tag: 'Slow' },
      { id: 'w4', name: 'Art Museum or Gallery', emoji: '🎨', tag: 'Culture' },
      { id: 'w5', name: 'Afternoon Movie Theater Matinee', emoji: '🎟️', tag: 'Cozy' },
      { id: 'w6', name: 'Park Picnic & Frisbee', emoji: '🧺', tag: 'Sun' },
      { id: 'w7', name: 'Cook an Ambitious New Recipe', emoji: '🍳', tag: 'Home' },
      { id: 'w8', name: 'Thrift & Record Store Hunt', emoji: '📻', tag: 'Explore' },
    ],
  },
];

export class StorageManager {
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    this.data = this.load();
  }

  /**
   * Load data from localStorage or initialize with defaults.
   */
  load() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          return this._migrate(parsed);
        }
      }
    } catch (err) {
      console.warn('[StorageManager] Failed to read localStorage, falling back to defaults:', err);
    }

    return this._getDefaultState();
  }

  /**
   * Return clean default state.
   * @private
   */
  _getDefaultState() {
    return {
      version: 1,
      selectedPoolId: 'pool_takeout',
      customPools: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
      history: {}, // { [itemNameOrId]: timestampMs }
      settings: {
        soundEnabled: true,
        hapticsEnabled: true,
        cooldownDays: 3,
        autoAdvanceBracket: true,
      },
    };
  }

  /**
   * Schema migration safeguard.
   * @private
   */
  _migrate(state) {
    const defaultState = this._getDefaultState();
    return {
      ...defaultState,
      ...state,
      settings: {
        ...defaultState.settings,
        ...(state.settings || {}),
      },
      customPools: state.customPools && state.customPools.length > 0
        ? state.customPools
        : defaultState.customPools,
      history: state.history || {},
    };
  }

  /**
   * Save current state to localStorage.
   */
  save() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      }
    } catch (err) {
      console.error('[StorageManager] Failed to write localStorage:', err);
    }
  }

  /**
   * Get all pools (default + custom).
   */
  getPools() {
    return this.data.customPools;
  }

  /**
   * Get specific pool by ID.
   * @param {string} poolId 
   */
  getPool(poolId) {
    return this.data.customPools.find(p => p.id === poolId) || this.data.customPools[0];
  }

  /**
   * Save or update a pool.
   * @param {Object} pool 
   */
  savePool(pool) {
    const idx = this.data.customPools.findIndex(p => p.id === pool.id);
    if (idx >= 0) {
      this.data.customPools[idx] = pool;
    } else {
      this.data.customPools.push(pool);
    }
    this.save();
  }

  /**
   * Delete a pool by ID.
   * @param {string} poolId 
   */
  deletePool(poolId) {
    if (this.data.customPools.length <= 1) {
      throw new Error('Cannot delete the last remaining pool.');
    }
    this.data.customPools = this.data.customPools.filter(p => p.id !== poolId);
    if (this.data.selectedPoolId === poolId) {
      this.data.selectedPoolId = this.data.customPools[0].id;
    }
    this.save();
  }

  /**
   * Set currently selected pool.
   * @param {string} poolId 
   */
  setSelectedPoolId(poolId) {
    this.data.selectedPoolId = poolId;
    this.save();
  }

  getSelectedPoolId() {
    return this.data.selectedPoolId;
  }

  /**
   * Update settings.
   * @param {Object} partialSettings 
   */
  updateSettings(partialSettings) {
    this.data.settings = { ...this.data.settings, ...partialSettings };
    this.save();
    return this.data.settings;
  }

  getSettings() {
    return this.data.settings;
  }

  /**
   * Record visit in history.
   * @param {Object|string} item 
   * @param {number} [timestamp] 
   */
  recordHistory(item, timestamp = Date.now()) {
    const key = typeof item === 'string' ? item : (item.id || item.name);
    this.data.history[key] = timestamp;
    this.save();
  }

  getHistory() {
    return this.data.history;
  }

  clearHistory() {
    this.data.history = {};
    this.save();
  }

  /**
   * Reset all data to factory presets.
   */
  factoryReset() {
    this.data = this._getDefaultState();
    this.save();
    return this.data;
  }

  /**
   * Export all data as a downloadable JSON string.
   */
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Import data from a JSON string.
   * @param {string} jsonString 
   */
  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    this.data = this._migrate(parsed);
    this.save();
    return this.data;
  }
}
