/**
 * BracketEngine - Head-to-Head Tournament Elimination Engine.
 * Supports power-of-two & arbitrary pool sizes (via automatic byes),
 * match progression, bracket tree generation, and decision undo.
 */
export class BracketEngine {
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
