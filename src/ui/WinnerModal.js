/**
 * WinnerModal - Celebratory Champion Reveal Dialog.
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
