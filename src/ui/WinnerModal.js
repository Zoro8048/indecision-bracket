/**
 * WinnerModal - Celebratory Champion Reveal Bottom Sheet (iOS Style).
 */
export class WinnerModal {
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
      <div class="modal-backdrop" id="winner-backdrop">
        <div class="ios-sheet winner-sheet animate-sheet-up">
          <div class="sheet-grabber-zone">
            <div class="sheet-grabber"></div>
          </div>

          <button class="sheet-close-btn" id="btn-close-winner" aria-label="Close">✕</button>

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
              <span class="btn-icon">📋</span> Copy to Share
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

  close() {
    this.confetti.stop();
    const sheet = this.container.querySelector('.ios-sheet');
    const backdrop = this.container.querySelector('.modal-backdrop');

    if (sheet) sheet.classList.add('ios-sheet-closing');
    if (backdrop) backdrop.classList.add('backdrop-closing');

    setTimeout(() => {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
    }, 220);
  }

  _bindEvents(winner) {
    const backdrop = this.container.querySelector('#winner-backdrop');
    const btnClose = this.container.querySelector('#btn-close-winner');
    const btnAccept = this.container.querySelector('#btn-accept-visit');
    const btnShare = this.container.querySelector('#btn-share-pick');
    const btnReroll = this.container.querySelector('#btn-reroll');

    if (btnClose) btnClose.addEventListener('click', () => this.close());
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });
    }

    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        this.audio.playTap();
        this.haptics.tap();
        this.bus.emit('cooldown:record', winner);
        this.close();
        this.bus.emit('toast', `Locked in! "${winner.name}" is on cooldown.`);
      });
    }

    if (btnShare) {
      btnShare.addEventListener('click', async () => {
        this.audio.playTap();
        const text = `Tonight's decision: ${winner.emoji || '✨'} ${winner.name}! (Decided with IndecisionBracket)`;
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            btnShare.innerHTML = `<span class="btn-icon">✓</span> Copied to Clipboard!`;
            setTimeout(() => {
              if (btnShare) btnShare.innerHTML = `<span class="btn-icon">📋</span> Copy to Share`;
            }, 2000);
          }
        } catch (_) {}
      });
    }

    if (btnReroll) {
      btnReroll.addEventListener('click', () => {
        this.audio.playTap();
        this.close();
        this.bus.emit('mode:restart');
      });
    }
  }
}
