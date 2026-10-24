/**
 * SwipeView - 2-Player Pass-and-Swipe ("Tinder for Decisions") UI.
 * Features stacked card deck (showing next card preview underneath),
 * responsive pointer physics, dynamic LIKE/PASS badges, and clear player handoffs.
 */
export class SwipeView {
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
        this.container.innerHTML = `
          <div class="empty-state animate-fade-in">
            <div class="empty-icon">🎉</div>
            <h3>It's a Match!</h3>
            <p>You and your partner agreed on <strong>${state.matchedItem.name}</strong>.</p>
            <button class="btn btn-primary" id="btn-restart-swipe" style="margin-top: 1.25rem;">
              <span class="btn-icon">🔄</span> Swipe Again
            </button>
          </div>
        `;
        const btn = this.container.querySelector('#btn-restart-swipe');
        if (btn) btn.addEventListener('click', () => this.bus.emit('swipe:restart'));

        this.audio.playFanfare();
        this.haptics.victory();
        this.bus.emit('decision:winner', {
          winner: state.matchedItem,
          mode: 'swipe',
        });
      } else {
        this.container.innerHTML = `
          <div class="empty-state animate-fade-in">
            <div class="empty-icon">🤷</div>
            <h3>No Mutual Match</h3>
            <p>You and your partner didn't overlap on this round. Try picking a few more favorites!</p>
            <button class="btn btn-primary" id="btn-restart-swipe" style="margin-top: 1.25rem;">
              <span class="btn-icon">🔄</span> Try Again
            </button>
          </div>
        `;
        const btn = this.container.querySelector('#btn-restart-swipe');
        if (btn) btn.addEventListener('click', () => this.bus.emit('swipe:restart'));
      }
      return;
    }

    // Check if waiting for handoff to Player 2
    if (state.isHandoff) {
      this.container.innerHTML = `
        <div class="handoff-card animate-scale-up">
          <div class="handoff-icon">📱</div>
          <h2 class="handoff-title">Pass Phone to Player 2!</h2>
          <p class="handoff-subtitle">
            Player 1 liked <strong>${state.player1LikesCount}</strong> choices.<br>
            Now it's Player 2's turn. The first mutual match will win immediately!
          </p>
          <button class="btn btn-primary btn-lg" id="btn-start-player2">
            <span class="btn-icon">👀</span> Start Player 2
          </button>
        </div>
      `;

      const btnStart = this.container.querySelector('#btn-start-player2');
      if (btnStart) {
        btnStart.addEventListener('click', () => {
          this.audio.playTap();
          this.haptics.tap();
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

    // Next card preview in stack
    const nextCard = (state.currentIndex + 1 < state.totalCards)
      ? this.matcher.deck[state.currentIndex + 1]
      : null;

    this.container.innerHTML = `
      <div class="swipe-view animate-fade-in">
        <!-- Player Indicator Header -->
        <div class="swipe-header">
          <div class="player-badge player-${state.activePlayer}">
            <span class="player-dot"></span>
            Player ${state.activePlayer}'s Turn
          </div>
          <div class="swipe-counter">
            Card <strong>${state.currentIndex + 1}</strong> of ${state.totalCards}
          </div>
        </div>

        <!-- Stacked Card Deck Container -->
        <div class="card-deck" id="card-deck">
          ${nextCard ? `
            <div class="swipe-card swipe-card-underneath" aria-hidden="true">
              <div class="card-content">
                <div class="swipe-card-emoji">${nextCard.emoji || '✨'}</div>
                <h2 class="swipe-card-title">${nextCard.name}</h2>
                ${nextCard.tag ? `<span class="swipe-card-tag">${nextCard.tag}</span>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Active Top Card -->
          <div class="swipe-card swipe-card-active" id="active-swipe-card">
            <!-- Dynamic Badges -->
            <div class="swipe-badge badge-like" id="badge-like">LIKE 👍</div>
            <div class="swipe-badge badge-pass" id="badge-pass">PASS 👎</div>

            <div class="card-content">
              <div class="swipe-card-emoji">${currentCard.emoji || '✨'}</div>
              <h2 class="swipe-card-title">${currentCard.name}</h2>
              ${currentCard.tag ? `<span class="swipe-card-tag">${currentCard.tag}</span>` : ''}
            </div>

            <div class="swipe-hint">Drag card or use ◀ / ▶ arrow keys</div>
          </div>
        </div>

        <!-- Tactile Control Buttons -->
        <div class="swipe-controls">
          <button class="swipe-btn swipe-btn-pass" id="btn-swipe-pass" aria-label="Pass" title="Pass (Left Arrow)">
            <span>✕</span>
          </button>
          <button class="swipe-btn swipe-btn-like" id="btn-swipe-like" aria-label="Like" title="Like (Right Arrow)">
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

    const onPointerDown = (e) => {
      if (this._isAnimating) return;
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragCurrentX = e.clientX;
      card.style.transition = 'none';
      try {
        card.setPointerCapture(e.pointerId);
      } catch (_) {}
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      this.dragCurrentX = e.clientX;
      const deltaX = this.dragCurrentX - this.dragStartX;
      const rotation = deltaX * 0.07;

      card.style.transform = `translate(${deltaX}px, ${Math.abs(deltaX) * 0.08}px) rotate(${rotation}deg)`;

      const threshold = 100;
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
      const threshold = 80;

      if (deltaX > threshold) {
        this.animateSwipe(true);
      } else if (deltaX < -threshold) {
        this.animateSwipe(false);
      } else {
        card.style.transition = 'transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
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
      const rot = isLike ? 30 : -30;
      card.style.transition = 'transform 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.28s ease';
      card.style.transform = `translate(${flyX}px, 40px) rotate(${rot}deg)`;
      card.style.opacity = '0';
    }

    setTimeout(() => {
      this._isAnimating = false;
      this.matcher.swipe(isLike);
      this.render();
    }, 280);
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
