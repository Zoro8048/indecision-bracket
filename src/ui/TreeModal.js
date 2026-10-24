/**
 * TreeModal - Visual Tournament Bracket Tree.
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
