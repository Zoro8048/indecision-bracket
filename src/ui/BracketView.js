/**
 * BracketView - Head-to-Head Tournament Match UI.
 * Redesigned for optimal ergonomics: side-by-side matchup arena, zero viewport overflow,
 * intuitive ◀ Left / Right ▶ keyboard hotkeys, and tactile animations.
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
      this.bus.emit('decision:winner', {
        winner: state.champion,
        mode: 'bracket',
      });
      return;
    }

    const match = state.currentMatch;
    if (!match) {
      this.container.innerHTML = `
        <div class="empty-state animate-fade-in">
          <div class="empty-icon">🏆</div>
          <h3>Tournament Complete</h3>
          <p>Click below to re-seed and start a new tournament.</p>
          <button class="btn btn-primary" id="btn-restart-empty" style="margin-top: 1rem;">
            <span class="btn-icon">🔄</span> New Tournament
          </button>
        </div>
      `;
      const btn = this.container.querySelector('#btn-restart-empty');
      if (btn) btn.addEventListener('click', () => this.bus.emit('bracket:restart'));
      return;
    }

    const progress = state.progress;
    const itemA = match.itemA;
    const itemB = match.itemB;

    this.container.innerHTML = `
      <div class="bracket-view animate-fade-in">
        <!-- Tournament Meta Bar -->
        <div class="bracket-meta">
          <div class="bracket-round-badge">
            <span class="round-indicator-dot"></span>
            <span class="round-title">${state.roundName}</span>
          </div>
          <div class="bracket-progress-label">
            Match <strong>${progress.completed + 1}</strong> of ${progress.totalPlayable}
          </div>
        </div>

        <!-- Sleek Animated Progress Bar -->
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${progress.percentage}%"></div>
        </div>

        <!-- Faceoff Arena: Side-by-Side Ergonomics -->
        <div class="faceoff-arena">
          <!-- Card A (Left) -->
          <div class="match-card match-card-a" id="card-option-a" tabindex="0" role="button" aria-label="Pick ${itemA.name}">
            <div class="card-badge card-badge-a">
              <span class="card-badge-key">◀ 1</span>
            </div>
            <div class="card-emoji-wrap">
              <span class="card-emoji">${itemA.emoji || '✨'}</span>
            </div>
            <div class="card-info">
              <h2 class="card-name">${itemA.name}</h2>
              ${itemA.tag ? `<span class="card-tag">${itemA.tag}</span>` : ''}
            </div>
            <div class="card-pick-prompt">Tap to Pick</div>
          </div>

          <!-- VS Badge -->
          <div class="vs-divider">
            <div class="vs-ring">
              <span class="vs-text">VS</span>
            </div>
          </div>

          <!-- Card B (Right) -->
          <div class="match-card match-card-b" id="card-option-b" tabindex="0" role="button" aria-label="Pick ${itemB.name}">
            <div class="card-badge card-badge-b">
              <span class="card-badge-key">2 ▶</span>
            </div>
            <div class="card-emoji-wrap">
              <span class="card-emoji">${itemB.emoji || '✨'}</span>
            </div>
            <div class="card-info">
              <h2 class="card-name">${itemB.name}</h2>
              ${itemB.tag ? `<span class="card-tag">${itemB.tag}</span>` : ''}
            </div>
            <div class="card-pick-prompt">Tap to Pick</div>
          </div>
        </div>

        <!-- Bracket Action Controls -->
        <div class="bracket-actions">
          <button class="btn btn-secondary ${progress.canUndo ? '' : 'disabled'}" id="btn-undo-pick" ${progress.canUndo ? '' : 'disabled'} title="Undo previous decision (Hotkey: Z)">
            <span class="btn-icon">↩</span> Undo
          </button>
          <button class="btn btn-ghost" id="btn-view-tree" title="Inspect full tournament tree">
            <span class="btn-icon">🌳</span> Bracket Tree
          </button>
          <button class="btn btn-ghost" id="btn-restart-bracket" title="Shuffle and restart bracket">
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
    }, 240);
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
