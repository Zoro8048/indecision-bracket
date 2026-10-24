/**
 * SwipeMatcher - 2-Player Pass-and-Swipe Matchmaking Engine ("Tinder for Decisions").
 * Player 1 swipes on candidates, hands phone to Player 2.
 * Instant match triggered on first mutual like, or aggregates full agreement scores.
 */
export class SwipeMatcher {
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
