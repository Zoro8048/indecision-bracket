/**
 * IndecisionBracket - Bundled Runtime (Generated via `npm run build`)
 * Pure client-side, zero runtime dependencies, local-first.
 */
(() => {
  "use strict";

  // --- Module: src/core/EventBus.js ---
  /**
   * EventBus - Decoupled Pub/Sub event emitter for IndecisionBracket.
   */
  class EventBus {
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

  // --- Module: src/domain/CooldownManager.js ---
  /**
   * CooldownManager - Recency decay filter to prevent picking the same spot repeatedly.
   * Stores visit timestamps and calculates active cooldown eligibility.
   */
  class CooldownManager {
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

  // --- Module: src/domain/BracketEngine.js ---
  /**
   * BracketEngine - Head-to-Head Tournament Elimination Engine.
   * Supports power-of-two & arbitrary pool sizes (via automatic byes),
   * match progression, bracket tree generation, and decision undo.
   */
  class BracketEngine {
    constructor(options = {}) {
      this.options = {
        shuffle: true,
        ...options,
      };
      this.reset();
    }
  
    /**
     * Reset the engine state.
     */
    reset() {
      this.initialItems = [];
      this.rounds = [];
      this.currentRoundIndex = 0;
      this.currentMatchIndex = 0;
      this.history = [];
      this.isComplete = false;
      this.champion = null;
    }
  
    /**
     * Initialize and start a tournament with a list of items.
     * @param {Array<Object|string>} items 
     * @param {Object} [overrideOptions]
     */
    startTournament(items, overrideOptions = {}) {
      if (!items || items.length < 2) {
        throw new Error('Tournament requires at least 2 items.');
      }
  
      this.reset();
      const opts = { ...this.options, ...overrideOptions };
      
      // Normalize items to objects if strings
      let pool = items.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `item_${idx}_${Date.now()}`, name: item, emoji: '✨' };
        }
        return { ...item };
      });
  
      if (opts.shuffle) {
        pool = this._shuffle([...pool]);
      }
  
      this.initialItems = [...pool];
      this._buildBracket(pool);
      this._advanceThroughByes();
  
      return this.getState();
    }
  
    /**
     * Build the tournament tree with byes if needed.
     * @param {Array<Object>} items 
     * @private
     */
    _buildBracket(items) {
      const count = items.length;
      // Find next power of 2
      let power = 2;
      while (power < count) {
        power *= 2;
      }
  
      const byesCount = power - count;
      // Seeding: assign byes to the first `byesCount` slots so they advance automatically
      const round1Slots = [];
      let itemIdx = 0;
  
      for (let i = 0; i < power; i++) {
        if (i < byesCount) {
          // This slot gets an item and its opponent will be null (a BYE)
          round1Slots.push(items[itemIdx++]);
        } else {
          round1Slots.push(items[itemIdx++]);
        }
      }
  
      // Generate Round 1 matches
      const round1Matches = [];
      for (let i = 0; i < power; i += 2) {
        const itemA = round1Slots[i];
        const itemB = round1Slots[i + 1] || null; // null represents a BYE
        
        const isBye = itemB === null;
        round1Matches.push({
          id: `r0_m${i / 2}`,
          itemA,
          itemB,
          winner: isBye ? itemA : null,
          isBye,
          decided: isBye,
        });
      }
  
      this.rounds = [round1Matches];
  
      // Build empty subsequent rounds
      let matchesInRound = round1Matches.length / 2;
      let r = 1;
      while (matchesInRound >= 1) {
        const nextRoundMatches = [];
        for (let m = 0; m < matchesInRound; m++) {
          nextRoundMatches.push({
            id: `r${r}_m${m}`,
            itemA: null,
            itemB: null,
            winner: null,
            isBye: false,
            decided: false,
          });
        }
        this.rounds.push(nextRoundMatches);
        matchesInRound /= 2;
        r++;
      }
  
      // Populate winners from round 1 byes into round 2
      for (let m = 0; m < round1Matches.length; m++) {
        const match = round1Matches[m];
        if (match.isBye && this.rounds[1]) {
          const nextMatchIdx = Math.floor(m / 2);
          const slot = m % 2 === 0 ? 'itemA' : 'itemB';
          this.rounds[1][nextMatchIdx][slot] = match.winner;
        }
      }
    }
  
    /**
     * Advance cursor over matches that are already decided (e.g. Byes).
     * @private
     */
    _advanceThroughByes() {
      while (this.currentRoundIndex < this.rounds.length) {
        const currentRound = this.rounds[this.currentRoundIndex];
        while (this.currentMatchIndex < currentRound.length) {
          const match = currentRound[this.currentMatchIndex];
          if (!match.decided && match.itemA && match.itemB) {
            // Found a real, playable match!
            return;
          } else if (match.decided && !match.winner) {
            // Incomplete match with missing items
            return;
          }
          this.currentMatchIndex++;
        }
        // Move to next round
        this.currentRoundIndex++;
        this.currentMatchIndex = 0;
      }
  
      // If we passed all rounds, the tournament is complete
      const finalRound = this.rounds[this.rounds.length - 1];
      if (finalRound && finalRound[0] && finalRound[0].winner) {
        this.isComplete = true;
        this.champion = finalRound[0].winner;
      }
    }
  
    /**
     * Choose winner for the current match.
     * @param {Object|string} chosenItem 
     */
    chooseWinner(chosenItem) {
      if (this.isComplete) {
        throw new Error('Tournament is already complete.');
      }
  
      const currentMatch = this.getCurrentMatch();
      if (!currentMatch) {
        throw new Error('No active match available.');
      }
  
      const winner = (currentMatch.itemA.id === chosenItem.id || currentMatch.itemA.name === chosenItem.name)
        ? currentMatch.itemA
        : currentMatch.itemB;
  
      if (!winner) {
        throw new Error('Chosen item does not belong to the current match.');
      }
  
      // Snapshot state for Undo
      this.history.push({
        roundIndex: this.currentRoundIndex,
        matchIndex: this.currentMatchIndex,
        matchSnapshot: JSON.parse(JSON.stringify(currentMatch)),
        nextRoundSnapshot: this.rounds[this.currentRoundIndex + 1] 
          ? JSON.parse(JSON.stringify(this.rounds[this.currentRoundIndex + 1]))
          : null,
        isComplete: this.isComplete,
        champion: this.champion,
      });
  
      // Mark current match decided
      currentMatch.winner = winner;
      currentMatch.decided = true;
  
      // Advance to next round if applicable
      const nextRoundIndex = this.currentRoundIndex + 1;
      if (nextRoundIndex < this.rounds.length) {
        const nextMatchIdx = Math.floor(this.currentMatchIndex / 2);
        const isSlotA = this.currentMatchIndex % 2 === 0;
        const nextMatch = this.rounds[nextRoundIndex][nextMatchIdx];
        if (isSlotA) {
          nextMatch.itemA = winner;
        } else {
          nextMatch.itemB = winner;
        }
      } else {
        // Finals just completed!
        this.isComplete = true;
        this.champion = winner;
      }
  
      // Advance cursor
      this.currentMatchIndex++;
      this._advanceThroughByes();
  
      return this.getState();
    }
  
    /**
     * Undo the last decision made.
     */
    undoLastDecision() {
      if (this.history.length === 0) {
        return false;
      }
  
      const lastState = this.history.pop();
      this.currentRoundIndex = lastState.roundIndex;
      this.currentMatchIndex = lastState.matchIndex;
      this.isComplete = lastState.isComplete;
      this.champion = lastState.champion;
  
      // Restore match
      this.rounds[this.currentRoundIndex][this.currentMatchIndex] = lastState.matchSnapshot;
  
      // Restore next round if applicable
      if (lastState.nextRoundSnapshot && this.rounds[this.currentRoundIndex + 1]) {
        this.rounds[this.currentRoundIndex + 1] = lastState.nextRoundSnapshot;
      }
  
      return true;
    }
  
    /**
     * Get the current active head-to-head match.
     */
    getCurrentMatch() {
      if (this.isComplete || this.currentRoundIndex >= this.rounds.length) {
        return null;
      }
      const match = this.rounds[this.currentRoundIndex]?.[this.currentMatchIndex];
      if (!match || match.decided) {
        return null;
      }
      return match;
    }
  
    /**
     * Get a descriptive label for the round (e.g. "Finals", "Semifinals", "Quarterfinals").
     * @param {number} roundIndex 
     */
    getRoundName(roundIndex = this.currentRoundIndex) {
      const totalRounds = this.rounds.length;
      const distanceToFinal = totalRounds - 1 - roundIndex;
  
      switch (distanceToFinal) {
        case 0:
          return 'Championship Finals 🏆';
        case 1:
          return 'Semifinals 🔥';
        case 2:
          return 'Quarterfinals ⚔️';
        case 3:
          return 'Round of 16';
        default:
          return `Round ${roundIndex + 1}`;
      }
    }
  
    /**
     * Compute tournament statistics and progress percentage.
     */
    getProgress() {
      let totalPlayable = 0;
      let completed = 0;
  
      for (const round of this.rounds) {
        for (const match of round) {
          if (!match.isBye) {
            totalPlayable++;
            if (match.decided) {
              completed++;
            }
          }
        }
      }
  
      const percentage = totalPlayable === 0 ? 0 : Math.round((completed / totalPlayable) * 100);
      return {
        totalPlayable,
        completed,
        percentage,
        canUndo: this.history.length > 0,
      };
    }
  
    /**
     * Return comprehensive state for UI consumption.
     */
    getState() {
      const currentMatch = this.getCurrentMatch();
      const progress = this.getProgress();
  
      return {
        isComplete: this.isComplete,
        champion: this.champion,
        currentMatch,
        currentRoundIndex: this.currentRoundIndex,
        currentMatchIndex: this.currentMatchIndex,
        roundName: this.getRoundName(),
        rounds: this.rounds,
        progress,
      };
    }
  
    /**
     * Fisher-Yates shuffle helper.
     * @private
     */
    _shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  }

  // --- Module: src/domain/SwipeMatcher.js ---
  /**
   * SwipeMatcher - 2-Player Pass-and-Swipe Matchmaking Engine ("Tinder for Decisions").
   * Player 1 swipes on candidates, hands phone to Player 2.
   * Instant match triggered on first mutual like, or aggregates full agreement scores.
   */
  class SwipeMatcher {
    constructor(options = {}) {
      this.options = {
        instantMatch: true, // Stop immediately when first mutual match is found
        ...options,
      };
      this.reset();
    }
  
    /**
     * Reset the session.
     */
    reset() {
      this.deck = [];
      this.player1Likes = new Set();
      this.player1Dislikes = new Set();
      this.player2Likes = new Set();
      this.player2Dislikes = new Set();
      this.activePlayer = 1; // 1 or 2
      this.currentIndex = 0;
      this.matchedItem = null;
      this.mutualMatches = [];
      this.isComplete = false;
    }
  
    /**
     * Start a new duo swipe session.
     * @param {Array<Object|string>} items 
     * @param {Object} [overrideOptions]
     */
    startSession(items, overrideOptions = {}) {
      if (!items || items.length === 0) {
        throw new Error('Swipe session requires at least 1 item.');
      }
  
      this.reset();
      this.options = { ...this.options, ...overrideOptions };
  
      this.deck = items.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `swipe_${idx}_${Date.now()}`, name: item, emoji: '✨' };
        }
        return { ...item };
      });
  
      return this.getState();
    }
  
    /**
     * Get the card currently on top of the deck for the active player.
     */
    getCurrentCard() {
      if (this.isComplete || this.currentIndex >= this.deck.length) {
        return null;
      }
      return this.deck[this.currentIndex];
    }
  
    /**
     * Record a swipe action (like or pass).
     * @param {boolean} isLike True for right swipe (like), false for left swipe (pass)
     * @returns {Object} Updated session state
     */
    swipe(isLike) {
      if (this.isComplete) {
        throw new Error('Swipe session is already complete.');
      }
  
      const currentCard = this.getCurrentCard();
      if (!currentCard) {
        throw new Error('No active card to swipe.');
      }
  
      const cardId = currentCard.id;
  
      if (this.activePlayer === 1) {
        if (isLike) {
          this.player1Likes.add(cardId);
        } else {
          this.player1Dislikes.add(cardId);
        }
  
        this.currentIndex++;
  
        // Check if Player 1 has finished the deck
        if (this.currentIndex >= this.deck.length) {
          // If Player 1 liked nothing, we can't match
          if (this.player1Likes.size === 0) {
            this.isComplete = true;
            this.matchedItem = null;
            return this.getState();
          }
  
          // Switch to Player 2
          this.activePlayer = 2;
          this.currentIndex = 0;
        }
      } else {
        // Player 2's turn
        if (isLike) {
          this.player2Likes.add(cardId);
          // Check for mutual match
          if (this.player1Likes.has(cardId)) {
            this.mutualMatches.push(currentCard);
            if (this.options.instantMatch) {
              this.matchedItem = currentCard;
              this.isComplete = true;
              return this.getState();
            }
          }
        } else {
          this.player2Dislikes.add(cardId);
        }
  
        this.currentIndex++;
  
        // Check if Player 2 has finished the deck
        if (this.currentIndex >= this.deck.length) {
          this.isComplete = true;
          this.matchedItem = this.mutualMatches.length > 0 ? this.mutualMatches[0] : null;
        }
      }
  
      return this.getState();
    }
  
    /**
     * Switch directly to Player 2 (e.g. if Player 1 wants to stop early).
     */
    handOffToPlayer2() {
      if (this.activePlayer === 1 && this.player1Likes.size > 0) {
        this.activePlayer = 2;
        this.currentIndex = 0;
      }
      return this.getState();
    }
  
    /**
     * Get complete state for UI rendering.
     */
    getState() {
      return {
        activePlayer: this.activePlayer,
        currentIndex: this.currentIndex,
        totalCards: this.deck.length,
        remainingCards: Math.max(0, this.deck.length - this.currentIndex),
        currentCard: this.getCurrentCard(),
        isHandoff: this.activePlayer === 2 && this.currentIndex === 0 && this.player2Likes.size === 0 && this.player2Dislikes.size === 0,
        isComplete: this.isComplete,
        matchedItem: this.matchedItem,
        mutualMatches: [...this.mutualMatches],
        player1LikesCount: this.player1Likes.size,
        player2LikesCount: this.player2Likes.size,
      };
    }
  }

  // --- Module: src/domain/WheelPhysics.js ---
  /**
   * WheelPhysics - Deceleration & Sector Mapping Physics for the Roulette Wheel.
   * Supports realistic angular deceleration, ratchet tick detection, and winner mapping.
   */
  class WheelPhysics {
    constructor(options = {}) {
      this.friction = options.friction || 0.988; // Deceleration damping factor per tick
      this.minVelocity = options.minVelocity || 0.002; // Stop threshold (rad/frame)
      this.reset();
    }
  
    /**
     * Reset the wheel state.
     */
    reset() {
      this.angle = 0; // Current angle in radians [0, 2pi)
      this.angularVelocity = 0; // Current rotational speed (rad/frame)
      this.isSpinning = false;
      this.items = [];
      this.lastSectorIndex = -1;
    }
  
    /**
     * Set the items on the wheel.
     * @param {Array<Object>} items 
     */
    setItems(items) {
      this.items = items.map((item, idx) => {
        if (typeof item === 'string') {
          return { id: `wheel_${idx}`, name: item, emoji: '✨' };
        }
        return { ...item };
      });
      this.lastSectorIndex = this.getWinningIndex();
    }
  
    /**
     * Trigger a spin with randomized or specified initial velocity.
     * @param {number} [force] Optional multiplier or specific velocity
     */
    spin(force = 1.0) {
      if (this.items.length === 0) return;
      
      // Base velocity ~18-28 rad/frame with slight natural randomness
      const randomBoost = Math.random() * 0.15 + 0.35;
      this.angularVelocity = (randomBoost + force * 0.25);
      this.isSpinning = true;
    }
  
    /**
     * Update wheel rotation by 1 frame.
     * @returns {Object} Frame result { tick: boolean, isSpinning: boolean, winner: Object|null }
     */
    update() {
      if (!this.isSpinning) {
        return { tick: false, isSpinning: false, winner: this.getWinner() };
      }
  
      this.angle += this.angularVelocity;
      this.angle %= (Math.PI * 2);
  
      // Check if sector changed (for ratchet click sound)
      const currentSector = this.getWinningIndex();
      let tick = false;
      if (currentSector !== this.lastSectorIndex) {
        tick = true;
        this.lastSectorIndex = currentSector;
      }
  
      // Apply friction damping
      this.angularVelocity *= this.friction;
  
      // Check if stopped
      if (this.angularVelocity <= this.minVelocity) {
        this.angularVelocity = 0;
        this.isSpinning = false;
        return { tick: false, isSpinning: false, winner: this.getWinner() };
      }
  
      return { tick, isSpinning: true, winner: null };
    }
  
    /**
     * Calculate which sector index is currently under the pointer.
     * Pointer is placed at the top (3*pi/2 or -pi/2).
     */
    getWinningIndex() {
      if (this.items.length === 0) return -1;
  
      const sectorAngle = (Math.PI * 2) / this.items.length;
      // Pointer is at top: 3*PI/2 (270 degrees)
      // Offset by current wheel rotation angle
      let pointerRelativeAngle = (Math.PI * 1.5 - this.angle) % (Math.PI * 2);
      if (pointerRelativeAngle < 0) {
        pointerRelativeAngle += Math.PI * 2;
      }
  
      const index = Math.floor(pointerRelativeAngle / sectorAngle) % this.items.length;
      return index;
    }
  
    /**
     * Get the winning item under the pointer.
     */
    getWinner() {
      const idx = this.getWinningIndex();
      return idx >= 0 ? this.items[idx] : null;
    }
  
    /**
     * Get current rotation angle in radians.
     */
    getAngle() {
      return this.angle;
    }
  }

  // --- Module: src/storage/StorageManager.js ---
  /**
   * StorageManager - Local-first persistence engine with schema versioning,
   * default presets, cooldown tracking, and JSON backup export/import.
   */
  const STORAGE_KEY = 'indecision_bracket_v1';
  const DEFAULT_PRESETS = [
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
  class StorageManager {
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

  // --- Module: src/services/AudioService.js ---
  /**
   * AudioService - Procedural Web Audio API sound engine for IndecisionBracket.
   * Zero external audio files; generates warm, acoustic & physical sounds at runtime.
   */
  class AudioService {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this._initialized = false;
    }
  
    /**
     * Initialize or resume the Web Audio context on user gesture.
     */
    init() {
      if (this._initialized && this.ctx && this.ctx.state !== 'suspended') return;
  
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          if (!this.ctx) {
            this.ctx = new AudioCtx();
          } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
          this._initialized = true;
        }
      } catch (err) {
        console.warn('[AudioService] Web Audio not supported or blocked:', err);
      }
    }
  
    setEnabled(enabled) {
      this.enabled = enabled;
    }
  
    /**
     * Subtle, warm glass/wood click for card selection and buttons.
     */
    playTap() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
  
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
  
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.045);
  
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
  
      osc.connect(gain);
      gain.connect(this.ctx.destination);
  
      osc.start(t);
      osc.stop(t + 0.05);
    }
  
    /**
     * Card swipe sound (upward shimmer for Like, low gentle thud for Pass).
     * @param {boolean} isLike 
     */
    playSwipe(isLike) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
  
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
  
      osc.type = 'sine';
      if (isLike) {
        // Pleasant rising chime
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      } else {
        // Gentle soft slide down
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.exponentialRampToValueAtTime(180, t + 0.1);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      }
  
      osc.connect(gain);
      gain.connect(this.ctx.destination);
  
      osc.start(t);
      osc.stop(t + 0.13);
    }
  
    /**
     * Crisp ratchet mechanical tick for roulette wheel rotation.
     * Pitch dynamically shifts slightly with speed.
     */
    playRatchetTick(pitchFactor = 1.0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
  
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
  
      osc.type = 'triangle';
      const baseFreq = 950 * Math.max(0.7, Math.min(1.4, pitchFactor));
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.02);
  
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  
      osc.connect(gain);
      gain.connect(this.ctx.destination);
  
      osc.start(t);
      osc.stop(t + 0.025);
    }
  
    /**
     * Elegant harmonic pentatonic fanfare when a winner is crowned.
     */
    playFanfare() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
  
      // Major 9th / Pentatonic celebratory arpeggio: C5, E5, G5, B5, C6
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
      const baseTime = this.ctx.currentTime + 0.05;
  
      notes.forEach((freq, idx) => {
        const startTime = baseTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
  
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
  
        // Warm attack & long crystalline decay
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.3 - idx * 0.03, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.8);
  
        osc.connect(gain);
        gain.connect(this.ctx.destination);
  
        osc.start(startTime);
        osc.stop(startTime + 0.85);
      });
    }
  }

  // --- Module: src/services/HapticsService.js ---
  /**
   * HapticsService - Tactile feedback service for mobile devices.
   * Supports Android navigator.vibrate and micro-taptics.
   */
  class HapticsService {
    constructor() {
      this.enabled = true;
    }
  
    setEnabled(enabled) {
      this.enabled = enabled;
    }
  
    tap() {
      if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
      try {
        navigator.vibrate(10);
      } catch (_) {}
    }
  
    tick() {
      if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
      try {
        navigator.vibrate(5);
      } catch (_) {}
    }
  
    match() {
      if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
      try {
        navigator.vibrate([25, 40, 25]);
      } catch (_) {}
    }
  
    victory() {
      if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
      try {
        navigator.vibrate([35, 50, 35, 50, 75]);
      } catch (_) {}
    }
  }

  // --- Module: src/ui/Confetti.js ---
  /**
   * Confetti - High-performance 2D Canvas celebratory particle burst.
   */
  class Confetti {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.animId = null;
      this.colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }
  
    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  
    burst(count = 90) {
      this.resize();
      this.particles = [];
      const originX = this.canvas.width / 2;
      const originY = this.canvas.height * 0.45;
  
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 12 + 6;
        this.particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4, // Upward initial boost
          size: Math.random() * 8 + 5,
          color: this.colors[Math.floor(Math.random() * this.colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 12,
          wobble: Math.random() * 10,
          opacity: 1,
          life: 1,
          decay: Math.random() * 0.008 + 0.006,
        });
      }
  
      if (!this.animId) {
        this.loop();
      }
    }
  
    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.28; // Gravity
        p.vx *= 0.985; // Air drag
        p.rotation += p.rotSpeed;
        p.wobble += 0.1;
        p.life -= p.decay;
        p.opacity = Math.max(0, p.life);
  
        if (p.life <= 0 || p.y > this.canvas.height + 50) {
          this.particles.splice(i, 1);
          continue;
        }
  
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate((p.rotation * Math.PI) / 180);
        this.ctx.scale(Math.cos(p.wobble), 1);
        this.ctx.globalAlpha = p.opacity;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        this.ctx.restore();
      }
  
      if (this.particles.length > 0) {
        this.animId = requestAnimationFrame(() => this.loop());
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.animId = null;
      }
    }
  
    stop() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this.particles = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- Module: src/ui/WinnerModal.js ---
  /**
   * WinnerModal - Celebratory Champion Reveal Dialog.
   */
  class WinnerModal {
    constructor({ modalContainer, confetti, audioService, hapticsService, eventBus }) {
      this.container = modalContainer;
      this.confetti = confetti;
      this.audio = audioService;
      this.haptics = hapticsService;
      this.bus = eventBus;
    }
  
    show(winner, mode = 'bracket') {
      this.confetti.burst(95);
  
      const modeLabels = {
        bracket: 'Tournament Champion 🏆',
        swipe: 'Mutual Match Found! 💚',
        wheel: 'The Wheel has Spoken! 🎡',
      };
  
      this.container.innerHTML = `
        <div class="modal-backdrop animate-fade-in" id="winner-backdrop">
          <div class="modal-dialog winner-dialog animate-bounce-in">
            <button class="modal-close-btn" id="btn-close-winner" aria-label="Close">✕</button>
  
            <div class="winner-crown">👑</div>
            <div class="winner-badge">${modeLabels[mode] || 'Winner Picked!'}</div>
  
            <div class="winner-hero">
              <div class="winner-emoji">${winner.emoji || '🎉'}</div>
              <h2 class="winner-name">${winner.name}</h2>
              ${winner.tag ? `<span class="winner-tag">${winner.tag}</span>` : ''}
            </div>
  
            <div class="winner-actions">
              <button class="btn btn-primary btn-lg" id="btn-accept-visit">
                <span class="btn-icon">✅</span> Lock In & Add Cooldown
              </button>
              <button class="btn btn-secondary" id="btn-share-pick">
                <span class="btn-icon">📋</span> Copy to Text
              </button>
              <button class="btn btn-ghost" id="btn-reroll">
                <span class="btn-icon">🔄</span> Play Again
              </button>
            </div>
          </div>
        </div>
      `;
  
      this.container.classList.remove('hidden');
      this._bindEvents(winner);
    }
  
    _bindEvents(winner) {
      const backdrop = this.container.querySelector('#winner-backdrop');
      const btnClose = this.container.querySelector('#btn-close-winner');
      const btnAccept = this.container.querySelector('#btn-accept-visit');
      const btnShare = this.container.querySelector('#btn-share-pick');
      const btnReroll = this.container.querySelector('#btn-reroll');
  
      const close = () => {
        this.confetti.stop();
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
      };
  
      if (btnClose) btnClose.addEventListener('click', close);
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) close();
        });
      }
  
      if (btnAccept) {
        btnAccept.addEventListener('click', () => {
          this.audio.playTap();
          this.haptics.tap();
          this.bus.emit('cooldown:record', winner);
          close();
          this.bus.emit('toast', `Recorded! "${winner.name}" is now on cooldown.`);
        });
      }
  
      if (btnShare) {
        btnShare.addEventListener('click', async () => {
          this.audio.playTap();
          const text = `Tonight's pick: ${winner.emoji || '✨'} ${winner.name}! (Decided with IndecisionBracket)`;
          try {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(text);
              btnShare.innerHTML = `<span class="btn-icon">✓</span> Copied!`;
              setTimeout(() => {
                if (btnShare) btnShare.innerHTML = `<span class="btn-icon">📋</span> Copy to Text`;
              }, 2000);
            }
          } catch (_) {}
        });
      }
  
      if (btnReroll) {
        btnReroll.addEventListener('click', () => {
          this.audio.playTap();
          close();
          this.bus.emit('mode:restart');
        });
      }
    }
  }

  // --- Module: src/ui/TreeModal.js ---
  /**
   * TreeModal - Visual Tournament Bracket Tree.
   */
  class TreeModal {
    constructor({ modalContainer, audioService, eventBus }) {
      this.container = modalContainer;
      this.audio = audioService;
      this.bus = eventBus;
    }
  
    show(bracketState) {
      const rounds = bracketState.rounds || [];
  
      const roundsHtml = rounds.map((round, rIdx) => {
        const roundTitle = this._getRoundLabel(rIdx, rounds.length);
        const matchesHtml = round.map((m) => {
          const itemAName = m.itemA ? m.itemA.name : 'TBD';
          const itemBName = m.itemB ? m.itemB.name : (m.isBye ? 'BYE' : 'TBD');
          const winnerName = m.winner ? m.winner.name : null;
  
          return `
            <div class="tree-match ${m.decided ? 'match-decided' : ''}">
              <div class="tree-slot ${winnerName === itemAName ? 'slot-winner' : ''}">
                ${m.itemA?.emoji || ''} ${itemAName}
              </div>
              <div class="tree-slot ${winnerName === itemBName ? 'slot-winner' : ''}">
                ${m.itemB?.emoji || ''} ${itemBName}
              </div>
            </div>
          `;
        }).join('');
  
        return `
          <div class="tree-round">
            <div class="tree-round-header">${roundTitle}</div>
            <div class="tree-matches">${matchesHtml}</div>
          </div>
        `;
      }).join('');
  
      this.container.innerHTML = `
        <div class="modal-backdrop animate-fade-in" id="tree-backdrop">
          <div class="modal-dialog tree-dialog animate-scale-up">
            <div class="modal-header">
              <h3>Tournament Bracket Tree</h3>
              <button class="modal-close-btn" id="btn-close-tree">✕</button>
            </div>
            <div class="tree-scroll-container">
              <div class="tree-grid">${roundsHtml}</div>
            </div>
          </div>
        </div>
      `;
  
      this.container.classList.remove('hidden');
  
      const close = () => {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
      };
  
      const btnClose = this.container.querySelector('#btn-close-tree');
      const backdrop = this.container.querySelector('#tree-backdrop');
      if (btnClose) btnClose.addEventListener('click', close);
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) close();
        });
      }
    }
  
    _getRoundLabel(idx, total) {
      const dist = total - 1 - idx;
      if (dist === 0) return 'Finals 🏆';
      if (dist === 1) return 'Semifinals';
      if (dist === 2) return 'Quarterfinals';
      return `Round ${idx + 1}`;
    }
  }

  // --- Module: src/ui/PoolEditorModal.js ---
  /**
   * PoolEditorModal - Management dialog for pools, custom items, cooldowns, and settings.
   */
  class PoolEditorModal {
    constructor({ modalContainer, storageManager, cooldownManager, audioService, eventBus }) {
      this.container = modalContainer;
      this.storage = storageManager;
      this.cooldown = cooldownManager;
      this.audio = audioService;
      this.bus = eventBus;
    }
  
    show() {
      this.render();
      this.container.classList.remove('hidden');
    }
  
    render() {
      const pools = this.storage.getPools();
      const selectedPoolId = this.storage.getSelectedPoolId();
      const selectedPool = this.storage.getPool(selectedPoolId);
      const settings = this.storage.getSettings();
  
      // Check cooldown status for current pool items
      const { available, coolingDown } = this.cooldown.partition(
        selectedPool.items,
        settings.cooldownDays
      );
  
      const poolsOptions = pools.map(p => `
        <option value="${p.id}" ${p.id === selectedPoolId ? 'selected' : ''}>
          ${p.emoji || '📁'} ${p.name} (${p.items.length} items)
        </option>
      `).join('');
  
      const availableItemsHtml = available.map(item => `
        <div class="item-chip">
          <span class="item-emoji">${item.emoji || '✨'}</span>
          <span class="item-name">${item.name}</span>
          ${item.tag ? `<span class="item-tag">${item.tag}</span>` : ''}
          <button class="chip-delete-btn" data-item-id="${item.id}" title="Remove item">✕</button>
        </div>
      `).join('');
  
      const coolingItemsHtml = coolingDown.length === 0 
        ? '<div class="empty-hint">No items currently on cooldown.</div>'
        : coolingDown.map(item => `
          <div class="item-chip chip-cooldown">
            <span class="item-emoji">${item.emoji || '✨'}</span>
            <span class="item-name">${item.name}</span>
            <span class="cooldown-badge">⏳ ${item.remaining}</span>
            <button class="chip-restore-btn" data-item-id="${item.id}" title="Reset cooldown">↺</button>
          </div>
        `).join('');
  
      this.container.innerHTML = `
        <div class="modal-backdrop animate-fade-in" id="settings-backdrop">
          <div class="modal-dialog settings-dialog animate-scale-up">
            <div class="modal-header">
              <h3>⚙️ Preferences & Pools</h3>
              <button class="modal-close-btn" id="btn-close-settings">✕</button>
            </div>
  
            <div class="settings-body">
              <!-- Pool Selector Section -->
              <div class="settings-section">
                <label class="settings-label">Active Decision Pool</label>
                <div class="pool-select-row">
                  <select class="form-select" id="select-active-pool">
                    ${poolsOptions}
                  </select>
                  <button class="btn btn-secondary btn-sm" id="btn-new-pool">+ New Pool</button>
                </div>
              </div>
  
              <!-- Add Item to Pool Form -->
              <div class="settings-section">
                <label class="settings-label">Add Item to "${selectedPool.name}"</label>
                <form class="add-item-form" id="form-add-item">
                  <input type="text" class="form-input input-emoji" id="input-item-emoji" placeholder="🍕" maxlength="4" style="width: 50px; text-align: center;">
                  <input type="text" class="form-input" id="input-item-name" placeholder="Item name (e.g. Thai Bistro)" required style="flex: 1;">
                  <input type="text" class="form-input input-tag" id="input-item-tag" placeholder="Tag (optional)" style="width: 100px;">
                  <button type="submit" class="btn btn-primary btn-sm">Add</button>
                </form>
              </div>
  
              <!-- Active Items List -->
              <div class="settings-section">
                <label class="settings-label">Eligible Items (${available.length})</label>
                <div class="chips-container">${availableItemsHtml || '<div class="empty-hint">No eligible items.</div>'}</div>
              </div>
  
              <!-- Cooldown Section -->
              <div class="settings-section">
                <div class="section-header-split">
                  <label class="settings-label">On Cooldown (${coolingDown.length})</label>
                  ${coolingDown.length > 0 ? '<button class="btn-link" id="btn-clear-all-cooldowns">Clear All</button>' : ''}
                </div>
                <div class="chips-container">${coolingItemsHtml}</div>
              </div>
  
              <!-- Preferences & Rules -->
              <div class="settings-section">
                <label class="settings-label">Rules & Feedback</label>
                <div class="setting-toggle-row">
                  <span>Cooldown Window</span>
                  <div class="range-wrapper">
                    <input type="range" id="input-cooldown-days" min="0" max="14" value="${settings.cooldownDays}" step="1">
                    <span id="label-cooldown-days">${settings.cooldownDays === 0 ? 'Off' : settings.cooldownDays + ' days'}</span>
                  </div>
                </div>
                <div class="setting-toggle-row">
                  <span>Sound & Fanfare</span>
                  <label class="switch">
                    <input type="checkbox" id="toggle-sound" ${settings.soundEnabled ? 'checked' : ''}>
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
  
              <!-- Data Sovereignty / Backup -->
              <div class="settings-section settings-backup-row">
                <button class="btn btn-secondary btn-sm" id="btn-export-backup">💾 Export JSON</button>
                <button class="btn btn-secondary btn-sm" id="btn-import-backup">📥 Import JSON</button>
                <button class="btn btn-ghost btn-sm text-danger" id="btn-factory-reset">Reset Defaults</button>
                <input type="file" id="file-import-json" accept=".json" style="display: none;">
              </div>
            </div>
          </div>
        </div>
      `;
  
      this._bindEvents(selectedPool);
    }
  
    _bindEvents(selectedPool) {
      const backdrop = this.container.querySelector('#settings-backdrop');
      const btnClose = this.container.querySelector('#btn-close-settings');
      const poolSelect = this.container.querySelector('#select-active-pool');
      const btnNewPool = this.container.querySelector('#btn-new-pool');
      const formAddItem = this.container.querySelector('#form-add-item');
      const rangeCooldown = this.container.querySelector('#input-cooldown-days');
      const labelCooldown = this.container.querySelector('#label-cooldown-days');
      const toggleSound = this.container.querySelector('#toggle-sound');
      const btnClearAllCooldowns = this.container.querySelector('#btn-clear-all-cooldowns');
      const btnExport = this.container.querySelector('#btn-export-backup');
      const btnImport = this.container.querySelector('#btn-import-backup');
      const fileInput = this.container.querySelector('#file-import-json');
      const btnReset = this.container.querySelector('#btn-factory-reset');
  
      const close = () => {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
        this.bus.emit('pool:updated');
      };
  
      if (btnClose) btnClose.addEventListener('click', close);
      if (backdrop) {
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) close();
        });
      }
  
      if (poolSelect) {
        poolSelect.addEventListener('change', (e) => {
          this.storage.setSelectedPoolId(e.target.value);
          this.render();
        });
      }
  
      if (btnNewPool) {
        btnNewPool.addEventListener('click', () => {
          const name = prompt('Enter new pool name (e.g. Favorite Coffee Spots):');
          if (name && name.trim()) {
            const newPool = {
              id: `pool_${Date.now()}`,
              name: name.trim(),
              emoji: '🎯',
              items: [],
            };
            this.storage.savePool(newPool);
            this.storage.setSelectedPoolId(newPool.id);
            this.render();
          }
        });
      }
  
      if (formAddItem) {
        formAddItem.addEventListener('submit', (e) => {
          e.preventDefault();
          const emoji = this.container.querySelector('#input-item-emoji').value.trim() || '✨';
          const name = this.container.querySelector('#input-item-name').value.trim();
          const tag = this.container.querySelector('#input-item-tag').value.trim();
  
          if (name) {
            selectedPool.items.push({
              id: `item_${Date.now()}`,
              name,
              emoji,
              tag: tag || undefined,
            });
            this.storage.savePool(selectedPool);
            this.render();
          }
        });
      }
  
      // Delete item chip
      this.container.querySelectorAll('.chip-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.itemId;
          selectedPool.items = selectedPool.items.filter(i => i.id !== itemId);
          this.storage.savePool(selectedPool);
          this.render();
        });
      });
  
      // Restore single cooldown
      this.container.querySelectorAll('.chip-restore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.itemId;
          this.cooldown.clearCooldown(itemId);
          this.storage.save();
          this.render();
        });
      });
  
      if (btnClearAllCooldowns) {
        btnClearAllCooldowns.addEventListener('click', () => {
          this.cooldown.clearAll();
          this.storage.clearHistory();
          this.render();
        });
      }
  
      if (rangeCooldown) {
        rangeCooldown.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          labelCooldown.textContent = val === 0 ? 'Off' : `${val} days`;
          this.storage.updateSettings({ cooldownDays: val });
        });
      }
  
      if (toggleSound) {
        toggleSound.addEventListener('change', (e) => {
          this.storage.updateSettings({ soundEnabled: e.target.checked });
          this.audio.setEnabled(e.target.checked);
        });
      }
  
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(this.storage.exportJSON());
          const dlAnchor = document.createElement('a');
          dlAnchor.setAttribute('href', dataStr);
          dlAnchor.setAttribute('download', `indecision_bracket_backup_${new Date().toISOString().slice(0, 10)}.json`);
          dlAnchor.click();
        });
      }
  
      if (btnImport) {
        btnImport.addEventListener('click', () => fileInput.click());
      }
  
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                this.storage.importJSON(event.target.result);
                alert('Settings & pools imported successfully!');
                this.render();
              } catch (err) {
                alert('Failed to parse backup JSON file.');
              }
            };
            reader.readAsText(file);
          }
        });
      }
  
      if (btnReset) {
        btnReset.addEventListener('click', () => {
          if (confirm('Reset all pools and history to factory defaults?')) {
            this.storage.factoryReset();
            this.render();
          }
        });
      }
    }
  }

  // --- Module: src/ui/BracketView.js ---
  /**
   * BracketView - Head-to-Head Tournament Match UI.
   * Renders the active faceoff, progress bar, undo button, and bracket tree view.
   */
  class BracketView {
    constructor({ container, bracketEngine, audioService, hapticsService, eventBus }) {
      this.container = container;
      this.engine = bracketEngine;
      this.audio = audioService;
      this.haptics = hapticsService;
      this.bus = eventBus;
      this._isTransitioning = false;
    }
  
    render() {
      const state = this.engine.getState();
  
      if (state.isComplete && state.champion) {
        this.bus.emit('tournament:winner', state.champion);
        return;
      }
  
      const match = state.currentMatch;
      if (!match) {
        this.container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🏆</div>
            <h3>No tournament active</h3>
            <p>Choose a category or click Start Tournament to begin.</p>
          </div>
        `;
        return;
      }
  
      const progress = state.progress;
      const itemA = match.itemA;
      const itemB = match.itemB;
  
      this.container.innerHTML = `
        <div class="bracket-view animate-fade-in">
          <!-- Tournament Header & Progress -->
          <div class="bracket-meta">
            <div class="bracket-round-badge">
              <span class="round-indicator-dot"></span>
              <span class="round-title">${state.roundName}</span>
            </div>
            <div class="bracket-progress-label">
              Match ${progress.completed + 1} of ${progress.totalPlayable}
            </div>
          </div>
  
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
          </div>
  
          <!-- Faceoff Arena -->
          <div class="faceoff-arena">
            <!-- Card A -->
            <div class="match-card match-card-a" id="card-option-a" tabindex="0" role="button" aria-label="Choose ${itemA.name}">
              <div class="card-glow"></div>
              <div class="card-emoji">${itemA.emoji || '✨'}</div>
              <div class="card-name">${itemA.name}</div>
              ${itemA.tag ? `<span class="card-tag">${itemA.tag}</span>` : ''}
              <div class="card-hotkey-hint">Press 1 or ◀</div>
            </div>
  
            <!-- VS Badge -->
            <div class="vs-divider">
              <div class="vs-circle">
                <span class="vs-text">VS</span>
              </div>
            </div>
  
            <!-- Card B -->
            <div class="match-card match-card-b" id="card-option-b" tabindex="0" role="button" aria-label="Choose ${itemB.name}">
              <div class="card-glow"></div>
              <div class="card-emoji">${itemB.emoji || '✨'}</div>
              <div class="card-name">${itemB.name}</div>
              ${itemB.tag ? `<span class="card-tag">${itemB.tag}</span>` : ''}
              <div class="card-hotkey-hint">Press 2 or ▶</div>
            </div>
          </div>
  
          <!-- Action Bar -->
          <div class="bracket-actions">
            <button class="btn btn-secondary ${progress.canUndo ? '' : 'disabled'}" id="btn-undo-pick" ${progress.canUndo ? '' : 'disabled'}>
              <span class="btn-icon">↩</span> Undo Pick
            </button>
            <button class="btn btn-ghost" id="btn-view-tree">
              <span class="btn-icon">🌳</span> Bracket Tree
            </button>
            <button class="btn btn-ghost" id="btn-restart-bracket">
              <span class="btn-icon">🔄</span> Re-seed
            </button>
          </div>
        </div>
      `;
  
      this._bindEvents(itemA, itemB);
    }
  
    _bindEvents(itemA, itemB) {
      const cardA = this.container.querySelector('#card-option-a');
      const cardB = this.container.querySelector('#card-option-b');
      const btnUndo = this.container.querySelector('#btn-undo-pick');
      const btnTree = this.container.querySelector('#btn-view-tree');
      const btnRestart = this.container.querySelector('#btn-restart-bracket');
  
      if (cardA) {
        cardA.addEventListener('click', () => this._handleSelect(itemA, cardA, cardB));
      }
      if (cardB) {
        cardB.addEventListener('click', () => this._handleSelect(itemB, cardB, cardA));
      }
  
      if (btnUndo) {
        btnUndo.addEventListener('click', () => {
          this.audio.playTap();
          this.haptics.tap();
          if (this.engine.undoLastDecision()) {
            this.render();
          }
        });
      }
  
      if (btnTree) {
        btnTree.addEventListener('click', () => {
          this.audio.playTap();
          this.bus.emit('bracket:showTree', this.engine.getState());
        });
      }
  
      if (btnRestart) {
        btnRestart.addEventListener('click', () => {
          this.audio.playTap();
          this.bus.emit('bracket:restart');
        });
      }
    }
  
    _handleSelect(chosenItem, winningCard, losingCard) {
      if (this._isTransitioning) return;
      this._isTransitioning = true;
  
      this.audio.playTap();
      this.haptics.tap();
  
      // Tactile CSS transition
      winningCard.classList.add('selected-winner');
      losingCard.classList.add('selected-loser');
  
      setTimeout(() => {
        this._isTransitioning = false;
        const nextState = this.engine.chooseWinner(chosenItem);
        if (nextState.isComplete) {
          this.audio.playFanfare();
          this.haptics.victory();
          this.bus.emit('decision:winner', {
            winner: nextState.champion,
            mode: 'bracket',
          });
        } else {
          this.render();
        }
      }, 280);
    }
  
    handleKeyDown(e) {
      const state = this.engine.getState();
      if (state.isComplete || !state.currentMatch || this._isTransitioning) return;
  
      const match = state.currentMatch;
      if (e.key === '1' || e.key === 'ArrowLeft') {
        const cardA = this.container.querySelector('#card-option-a');
        const cardB = this.container.querySelector('#card-option-b');
        if (cardA && cardB) this._handleSelect(match.itemA, cardA, cardB);
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        const cardA = this.container.querySelector('#card-option-a');
        const cardB = this.container.querySelector('#card-option-b');
        if (cardA && cardB) this._handleSelect(match.itemB, cardB, cardA);
      } else if ((e.key === 'z' || e.key === 'Z' || e.key === 'u' || e.key === 'U') && state.progress.canUndo) {
        this.audio.playTap();
        this.haptics.tap();
        if (this.engine.undoLastDecision()) {
          this.render();
        }
      }
    }
  }

  // --- Module: src/ui/SwipeView.js ---
  /**
   * SwipeView - 2-Player Pass-and-Swipe ("Tinder for Decisions") UI.
   * Features realistic drag physics, rotation, LIKE/PASS badges, and seamless player handoff.
   */
  class SwipeView {
    constructor({ container, swipeMatcher, audioService, hapticsService, eventBus }) {
      this.container = container;
      this.matcher = swipeMatcher;
      this.audio = audioService;
      this.haptics = hapticsService;
      this.bus = eventBus;
  
      this.dragStartX = 0;
      this.dragCurrentX = 0;
      this.isDragging = false;
      this._isAnimating = false;
    }
  
    render() {
      const state = this.matcher.getState();
  
      // Check if match found or session finished
      if (state.isComplete) {
        if (state.matchedItem) {
          this.audio.playFanfare();
          this.haptics.victory();
          this.bus.emit('decision:winner', {
            winner: state.matchedItem,
            mode: 'swipe',
          });
        } else {
          this.container.innerHTML = `
            <div class="empty-state animate-fade-in">
              <div class="empty-icon">🤷‍♂️</div>
              <h3>No Mutual Match</h3>
              <p>You and your partner didn't agree on any items in this round.</p>
              <button class="btn btn-primary" id="btn-restart-swipe" style="margin-top: 1.5rem;">
                <span class="btn-icon">🔄</span> Try Again
              </button>
            </div>
          `;
          const btn = this.container.querySelector('#btn-restart-swipe');
          if (btn) {
            btn.addEventListener('click', () => {
              this.audio.playTap();
              this.bus.emit('swipe:restart');
            });
          }
        }
        return;
      }
  
      // Check if waiting for handoff to Player 2
      if (state.isHandoff) {
        this.container.innerHTML = `
          <div class="handoff-card animate-scale-up">
            <div class="handoff-icon">📱</div>
            <h2 class="handoff-title">Pass the Phone to Player 2!</h2>
            <p class="handoff-subtitle">
              Player 1 liked <strong>${state.player1LikesCount}</strong> choices. Now it's Player 2's turn. 
              The first mutual match will win immediately!
            </p>
            <button class="btn btn-primary btn-lg" id="btn-start-player2">
              <span class="btn-icon">👀</span> I'm Ready to Swipe
            </button>
          </div>
        `;
  
        const btnStart = this.container.querySelector('#btn-start-player2');
        if (btnStart) {
          btnStart.addEventListener('click', () => {
            this.audio.playTap();
            this.haptics.tap();
            // Advance past handoff state by starting player 2
            this.renderDeck();
          });
        }
        return;
      }
  
      this.renderDeck();
    }
  
    renderDeck() {
      const state = this.matcher.getState();
      const currentCard = state.currentCard;
      if (!currentCard) return;
  
      this.container.innerHTML = `
        <div class="swipe-view animate-fade-in">
          <!-- Player Indicator Header -->
          <div class="swipe-header">
            <div class="player-badge player-${state.activePlayer}">
              <span class="player-dot"></span>
              Player ${state.activePlayer}'s Turn
            </div>
            <div class="swipe-counter">
              ${state.currentIndex + 1} of ${state.totalCards}
            </div>
          </div>
  
          <!-- Card Deck Container -->
          <div class="card-deck" id="card-deck">
            <div class="swipe-card" id="active-swipe-card">
              <!-- Dynamic Badges -->
              <div class="swipe-badge badge-like" id="badge-like">LIKE 👍</div>
              <div class="swipe-badge badge-pass" id="badge-pass">PASS 👎</div>
  
              <div class="card-content">
                <div class="swipe-card-emoji">${currentCard.emoji || '✨'}</div>
                <h2 class="swipe-card-title">${currentCard.name}</h2>
                ${currentCard.tag ? `<span class="swipe-card-tag">${currentCard.tag}</span>` : ''}
              </div>
  
              <div class="swipe-hint">Drag or use arrow keys</div>
            </div>
          </div>
  
          <!-- Tactile Control Buttons -->
          <div class="swipe-controls">
            <button class="swipe-btn swipe-btn-pass" id="btn-swipe-pass" aria-label="Pass">
              <span>✕</span>
            </button>
            <button class="swipe-btn swipe-btn-like" id="btn-swipe-like" aria-label="Like">
              <span>♥</span>
            </button>
          </div>
        </div>
      `;
  
      this._bindCardGestures();
    }
  
    _bindCardGestures() {
      const card = this.container.querySelector('#active-swipe-card');
      const btnPass = this.container.querySelector('#btn-swipe-pass');
      const btnLike = this.container.querySelector('#btn-swipe-like');
      const badgeLike = this.container.querySelector('#badge-like');
      const badgePass = this.container.querySelector('#badge-pass');
  
      if (!card) return;
  
      if (btnPass) {
        btnPass.addEventListener('click', () => this.animateSwipe(false));
      }
      if (btnLike) {
        btnLike.addEventListener('click', () => this.animateSwipe(true));
      }
  
      // Pointer events (handles Mouse and Touch simultaneously)
      const onPointerDown = (e) => {
        if (this._isAnimating) return;
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragCurrentX = e.clientX;
        card.style.transition = 'none';
        card.setPointerCapture(e.pointerId);
      };
  
      const onPointerMove = (e) => {
        if (!this.isDragging) return;
        this.dragCurrentX = e.clientX;
        const deltaX = this.dragCurrentX - this.dragStartX;
        const rotation = deltaX * 0.08; // Degree of tilt
  
        card.style.transform = `translate(${deltaX}px, ${Math.abs(deltaX) * 0.1}px) rotate(${rotation}deg)`;
  
        // Dynamic opacity for LIKE / PASS stamps
        const threshold = 120;
        if (deltaX > 0) {
          badgeLike.style.opacity = Math.min(1, deltaX / threshold);
          badgePass.style.opacity = 0;
        } else {
          badgePass.style.opacity = Math.min(1, Math.abs(deltaX) / threshold);
          badgeLike.style.opacity = 0;
        }
      };
  
      const onPointerUp = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        try {
          card.releasePointerCapture(e.pointerId);
        } catch (_) {}
  
        const deltaX = this.dragCurrentX - this.dragStartX;
        const threshold = 90;
  
        if (deltaX > threshold) {
          this.animateSwipe(true);
        } else if (deltaX < -threshold) {
          this.animateSwipe(false);
        } else {
          // Snap back with spring
          card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          card.style.transform = 'translate(0px, 0px) rotate(0deg)';
          badgeLike.style.opacity = 0;
          badgePass.style.opacity = 0;
        }
      };
  
      card.addEventListener('pointerdown', onPointerDown);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointercancel', onPointerUp);
    }
  
    animateSwipe(isLike) {
      if (this._isAnimating) return;
      this._isAnimating = true;
  
      const card = this.container.querySelector('#active-swipe-card');
      const badge = this.container.querySelector(isLike ? '#badge-like' : '#badge-pass');
  
      this.audio.playSwipe(isLike);
      if (isLike) {
        this.haptics.match();
      } else {
        this.haptics.tap();
      }
  
      if (badge) badge.style.opacity = '1';
  
      if (card) {
        const flyX = isLike ? window.innerWidth + 200 : -window.innerWidth - 200;
        const rot = isLike ? 35 : -35;
        card.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
        card.style.transform = `translate(${flyX}px, 60px) rotate(${rot}deg)`;
        card.style.opacity = '0';
      }
  
      setTimeout(() => {
        this._isAnimating = false;
        this.matcher.swipe(isLike);
        this.render();
      }, 320);
    }
  
    handleKeyDown(e) {
      if (this._isAnimating) return;
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        this.animateSwipe(true);
      } else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') {
        this.animateSwipe(false);
      }
    }
  }

  // --- Module: src/ui/WheelView.js ---
  /**
   * WheelView - High-DPI 2D Canvas Roulette Wheel with physical deceleration and tactile ticks.
   */
  class WheelView {
    constructor({ container, wheelPhysics, audioService, hapticsService, eventBus }) {
      this.container = container;
      this.physics = wheelPhysics;
      this.audio = audioService;
      this.haptics = hapticsService;
      this.bus = eventBus;
  
      this.canvas = null;
      this.ctx = null;
      this.animId = null;
      this.colors = [
        '#1e293b', '#0f766e', '#1e1b4b', '#b45309',
        '#374151', '#065f46', '#4c1d95', '#9a3412',
      ];
    }
  
    render(items) {
      if (items) {
        this.physics.setItems(items);
      }
  
      this.container.innerHTML = `
        <div class="wheel-view animate-fade-in">
          <div class="wheel-stage">
            <div class="wheel-pointer">▼</div>
            <canvas id="wheel-canvas"></canvas>
            <button class="wheel-center-btn" id="btn-spin-wheel" aria-label="Spin the wheel">
              <span class="spin-label">SPIN</span>
            </button>
          </div>
  
          <div class="wheel-hint">Tap SPIN or press Spacebar</div>
        </div>
      `;
  
      this.canvas = this.container.querySelector('#wheel-canvas');
      this.ctx = this.canvas.getContext('2d');
      this._setupCanvas();
      this.draw();
  
      const btnSpin = this.container.querySelector('#btn-spin-wheel');
      if (btnSpin) {
        btnSpin.addEventListener('click', () => this.spin());
      }
    }
  
    _setupCanvas() {
      const size = Math.min(380, window.innerWidth - 48);
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.canvas.style.width = `${size}px`;
      this.canvas.style.height = `${size}px`;
      this.ctx.scale(dpr, dpr);
      this.size = size;
    }
  
    spin() {
      if (this.physics.isSpinning) return;
      this.audio.playTap();
      this.physics.spin(1.0);
      this._startLoop();
    }
  
    _startLoop() {
      if (this.animId) cancelAnimationFrame(this.animId);
  
      const step = () => {
        const result = this.physics.update();
  
        if (result.tick) {
          // Dynamic pitch based on velocity
          const speed = this.physics.angularVelocity;
          this.audio.playRatchetTick(speed * 3.5);
          this.haptics.tick();
        }
  
        this.draw();
  
        if (result.isSpinning) {
          this.animId = requestAnimationFrame(step);
        } else {
          this.animId = null;
          if (result.winner) {
            this.audio.playFanfare();
            this.haptics.victory();
            this.bus.emit('decision:winner', {
              winner: result.winner,
              mode: 'wheel',
            });
          }
        }
      };
  
      this.animId = requestAnimationFrame(step);
    }
  
    draw() {
      const { ctx, size } = this;
      const center = size / 2;
      const radius = center - 8;
      const items = this.physics.items;
      if (items.length === 0) return;
  
      ctx.clearRect(0, 0, size, size);
  
      const currentAngle = this.physics.getAngle();
      const sectorAngle = (Math.PI * 2) / items.length;
  
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentAngle);
  
      // Draw sectors
      items.forEach((item, i) => {
        const startAngle = i * sectorAngle;
        const endAngle = startAngle + sectorAngle;
  
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, startAngle, endAngle);
        ctx.closePath();
  
        // Sector fill
        ctx.fillStyle = this.colors[i % this.colors.length];
        ctx.fill();
  
        // Sector border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
  
        // Text and emoji inside wedge
        ctx.save();
        ctx.rotate(startAngle + sectorAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  
        const label = `${item.emoji || ''} ${item.name}`;
        // Truncate if too long
        const displayLabel = label.length > 18 ? label.substring(0, 16) + '…' : label;
        ctx.fillText(displayLabel, radius - 20, 5);
        ctx.restore();
      });
  
      // Outer wheel ring
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.stroke();
  
      ctx.restore();
    }
  
    handleKeyDown(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        this.spin();
      }
    }
  
    destroy() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }
  }

  // --- Module: src/main.js ---
  /**
   * IndecisionBracket - Main Application Bootstrap & Controller.
   */
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  class App {
    constructor() {
      this.bus = new EventBus();
      this.storage = new StorageManager();
      this.cooldown = new CooldownManager(this.storage.getHistory());
      this.audio = new AudioService();
      this.haptics = new HapticsService();
  
      // Domain Engines
      this.bracketEngine = new BracketEngine();
      this.swipeMatcher = new SwipeMatcher();
      this.wheelPhysics = new WheelPhysics();
  
      // Active mode: 'bracket' | 'swipe' | 'wheel'
      this.activeMode = 'bracket';
  
      // DOM Elements
      this.viewContainer = document.getElementById('view-container');
      this.modalContainer = document.getElementById('modal-container');
      this.confettiCanvas = document.getElementById('confetti-canvas');
      this.poolSelectorBtn = document.getElementById('btn-pool-selector');
      this.poolLabel = document.getElementById('header-pool-name');
      this.soundToggleBtn = document.getElementById('btn-sound-toggle');
      this.toastContainer = document.getElementById('toast-container');
  
      // UI Modules
      this.confetti = new Confetti(this.confettiCanvas);
      this.winnerModal = new WinnerModal({
        modalContainer: this.modalContainer,
        confetti: this.confetti,
        audioService: this.audio,
        hapticsService: this.haptics,
        eventBus: this.bus,
      });
      this.treeModal = new TreeModal({
        modalContainer: this.modalContainer,
        audioService: this.audio,
        eventBus: this.bus,
      });
      this.poolEditorModal = new PoolEditorModal({
        modalContainer: this.modalContainer,
        storageManager: this.storage,
        cooldownManager: this.cooldown,
        audioService: this.audio,
        eventBus: this.bus,
      });
  
      this.bracketView = new BracketView({
        container: this.viewContainer,
        bracketEngine: this.bracketEngine,
        audioService: this.audio,
        hapticsService: this.haptics,
        eventBus: this.bus,
      });
  
      this.swipeView = new SwipeView({
        container: this.viewContainer,
        swipeMatcher: this.swipeMatcher,
        audioService: this.audio,
        hapticsService: this.haptics,
        eventBus: this.bus,
      });
  
      this.wheelView = new WheelView({
        container: this.viewContainer,
        wheelPhysics: this.wheelPhysics,
        audioService: this.audio,
        hapticsService: this.haptics,
        eventBus: this.bus,
      });
  
      this._init();
    }
  
    _init() {
      // Sync settings
      const settings = this.storage.getSettings();
      this.audio.setEnabled(settings.soundEnabled);
      this.haptics.setEnabled(settings.hapticsEnabled);
      this._updateSoundIcon(settings.soundEnabled);
  
      // Event Bus Bindings
      this._bindEvents();
  
      // Setup global listeners
      this._bindUI();
  
      // Start with current pool
      this.refreshPoolDisplay();
      this.startActiveMode();
    }
  
    _bindEvents() {
      this.bus.on('decision:winner', ({ winner, mode }) => {
        this.winnerModal.show(winner, mode);
      });
  
      this.bus.on('bracket:showTree', (state) => {
        this.treeModal.show(state);
      });
  
      this.bus.on('bracket:restart', () => {
        this.startActiveMode();
      });
  
      this.bus.on('swipe:restart', () => {
        this.startActiveMode();
      });
  
      this.bus.on('mode:restart', () => {
        this.startActiveMode();
      });
  
      this.bus.on('cooldown:record', (winner) => {
        this.cooldown.recordVisit(winner);
        this.storage.recordHistory(winner);
      });
  
      this.bus.on('pool:updated', () => {
        this.refreshPoolDisplay();
        this.startActiveMode();
      });
  
      this.bus.on('toast', (msg) => {
        this.showToast(msg);
      });
    }
  
    _bindUI() {
      // Mode switcher tabs
      const modeTabs = document.querySelectorAll('.mode-tab');
      modeTabs.forEach((tab) => {
        tab.addEventListener('click', () => {
          const mode = tab.dataset.mode;
          if (mode && mode !== this.activeMode) {
            this.audio.playTap();
            this.haptics.tap();
            this.switchMode(mode);
          }
        });
      });
  
      // Header buttons
      if (this.poolSelectorBtn) {
        this.poolSelectorBtn.addEventListener('click', () => {
          this.audio.playTap();
          this.poolEditorModal.show();
        });
      }
  
      const btnSettings = document.getElementById('btn-header-settings');
      if (btnSettings) {
        btnSettings.addEventListener('click', () => {
          this.audio.playTap();
          this.poolEditorModal.show();
        });
      }
  
      if (this.soundToggleBtn) {
        this.soundToggleBtn.addEventListener('click', () => {
          const settings = this.storage.getSettings();
          const newVal = !settings.soundEnabled;
          this.storage.updateSettings({ soundEnabled: newVal });
          this.audio.setEnabled(newVal);
          this._updateSoundIcon(newVal);
          if (newVal) this.audio.playTap();
        });
      }
  
      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        if (this.activeMode === 'bracket') {
          this.bracketView.handleKeyDown(e);
        } else if (this.activeMode === 'swipe') {
          this.swipeView.handleKeyDown(e);
        } else if (this.activeMode === 'wheel') {
          this.wheelView.handleKeyDown(e);
        }
      });
    }
  
    _updateSoundIcon(enabled) {
      if (this.soundToggleBtn) {
        this.soundToggleBtn.innerHTML = enabled ? '🔊' : '🔇';
        this.soundToggleBtn.title = enabled ? 'Sound On' : 'Sound Muted';
      }
    }
  
    refreshPoolDisplay() {
      const selectedPoolId = this.storage.getSelectedPoolId();
      const pool = this.storage.getPool(selectedPoolId);
      if (this.poolLabel && pool) {
        this.poolLabel.textContent = `${pool.emoji || '🎯'} ${pool.name}`;
      }
    }
  
    getAvailableItems() {
      const selectedPoolId = this.storage.getSelectedPoolId();
      const pool = this.storage.getPool(selectedPoolId);
      const settings = this.storage.getSettings();
  
      const { available } = this.cooldown.partition(pool.items, settings.cooldownDays);
  
      // If cooldown filtered out everything, fall back to entire pool so user is never blocked
      return available.length >= 2 ? available : pool.items;
    }
  
    switchMode(mode) {
      this.activeMode = mode;
      document.querySelectorAll('.mode-tab').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
      });
      this.startActiveMode();
    }
  
    startActiveMode() {
      const items = this.getAvailableItems();
  
      if (!items || items.length < 2) {
        this.viewContainer.innerHTML = `
          <div class="empty-state animate-fade-in">
            <div class="empty-icon">📝</div>
            <h3>Pool has too few items</h3>
            <p>Please add at least 2 items to this category in Settings.</p>
            <button class="btn btn-primary" id="btn-empty-open-settings" style="margin-top: 1rem;">
              Open Settings
            </button>
          </div>
        `;
        const btn = this.viewContainer.querySelector('#btn-empty-open-settings');
        if (btn) btn.addEventListener('click', () => this.poolEditorModal.show());
        return;
      }
  
      if (this.activeMode === 'bracket') {
        this.bracketEngine.startTournament(items);
        this.bracketView.render();
      } else if (this.activeMode === 'swipe') {
        this.swipeMatcher.startSession(items);
        this.swipeView.render();
      } else if (this.activeMode === 'wheel') {
        this.wheelView.render(items);
      }
    }
  
    showToast(message) {
      if (!this.toastContainer) return;
      const toast = document.createElement('div');
      toast.className = 'toast animate-slide-up';
      toast.textContent = message;
      this.toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
      }, 2800);
    }
  }
  
  // Bootstrap on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    window.__APP__ = new App();
  });
})();
