/**
 * BracketView - Head-to-Head Tournament Match UI.
 * Renders the active faceoff, progress bar, undo button, and bracket tree view.
 */
export class BracketView {
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
