/**
 * TreeModal - Visual Tournament Bracket Tree Sheet (iOS Style).
 */
export class TreeModal {
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
      <div class="modal-backdrop" id="tree-backdrop">
        <div class="ios-sheet animate-sheet-up" id="tree-sheet">
          <div class="sheet-grabber-zone">
            <div class="sheet-grabber"></div>
          </div>

          <div class="sheet-header">
            <div class="sheet-title-group">
              <h3 class="sheet-title">Tournament Tree</h3>
              <p class="sheet-subtitle">Interactive bracket path to the finals</p>
            </div>
            <button class="sheet-close-btn" id="btn-close-tree">✕</button>
          </div>

          <div class="sheet-scrollable-body">
            <div class="tree-scroll-container">
              <div class="tree-grid">${roundsHtml}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.classList.remove('hidden');

    const close = () => {
      const sheet = this.container.querySelector('.ios-sheet');
      const backdrop = this.container.querySelector('.modal-backdrop');

      if (sheet) sheet.classList.add('ios-sheet-closing');
      if (backdrop) backdrop.classList.add('backdrop-closing');

      setTimeout(() => {
        this.container.classList.add('hidden');
        this.container.innerHTML = '';
      }, 220);
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
