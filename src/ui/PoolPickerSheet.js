/**
 * PoolPickerSheet - iOS-Style Native Bottom Sheet for Quick Category Switching.
 * De-dupes category picking from settings: lets users switch pools in 1 tap,
 * or quickly create a new category.
 */
export class PoolPickerSheet {
  constructor({ container, storageManager, audioService, hapticsService, eventBus }) {
    this.container = container;
    this.storage = storageManager;
    this.audio = audioService;
    this.haptics = hapticsService;
    this.bus = eventBus;
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
  }

  close() {
    const sheet = this.container.querySelector('.ios-sheet');
    const backdrop = this.container.querySelector('.modal-backdrop');

    if (sheet) sheet.classList.add('ios-sheet-closing');
    if (backdrop) backdrop.classList.add('backdrop-closing');

    setTimeout(() => {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
    }, 220);
  }

  render() {
    const pools = this.storage.getPools();
    const selectedPoolId = this.storage.getSelectedPoolId();

    const poolRowsHtml = pools.map((p) => {
      const isSelected = p.id === selectedPoolId;
      return `
        <div class="ios-list-row ${isSelected ? 'row-selected' : ''}" data-pool-id="${p.id}" role="button" tabindex="0">
          <div class="row-left">
            <span class="row-emoji">${p.emoji || '🎯'}</span>
            <div class="row-text">
              <span class="row-title">${p.name}</span>
              <span class="row-subtitle">${p.items.length} choices available</span>
            </div>
          </div>
          <div class="row-right">
            ${isSelected ? '<span class="ios-check">✓</span>' : '<span class="row-chevron">›</span>'}
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="modal-backdrop" id="pool-picker-backdrop">
        <div class="ios-sheet animate-sheet-up" id="pool-picker-sheet">
          <!-- iOS Sheet Grabber Bar -->
          <div class="sheet-grabber-zone" id="grabber-zone">
            <div class="sheet-grabber"></div>
          </div>

          <div class="sheet-header">
            <div class="sheet-title-group">
              <h3 class="sheet-title">Select Category</h3>
              <p class="sheet-subtitle">Choose what you are deciding today</p>
            </div>
            <button class="sheet-close-btn" id="btn-close-picker" aria-label="Close">✕</button>
          </div>

          <div class="sheet-scrollable-body">
            <div class="ios-list-group">
              ${poolRowsHtml}
            </div>

            <div class="sheet-action-group">
              <button class="btn btn-secondary btn-block" id="btn-create-category">
                <span class="btn-icon">+</span> Create New Category
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const backdrop = this.container.querySelector('#pool-picker-backdrop');
    const btnClose = this.container.querySelector('#btn-close-picker');
    const btnCreate = this.container.querySelector('#btn-create-category');
    const rows = this.container.querySelectorAll('.ios-list-row');

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.close();
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.audio.playTap();
        this.close();
      });
    }

    // Quick select pool on row tap
    rows.forEach((row) => {
      row.addEventListener('click', () => {
        const poolId = row.dataset.poolId;
        if (poolId) {
          this.audio.playTap();
          this.haptics.tap();
          this.storage.setSelectedPoolId(poolId);
          this.bus.emit('pool:updated');
          this.close();
        }
      });
    });

    if (btnCreate) {
      btnCreate.addEventListener('click', () => {
        this.audio.playTap();
        const name = prompt('Enter name for the new category (e.g. Lunch Spots, Board Games):');
        if (name && name.trim()) {
          const newPool = {
            id: `pool_${Date.now()}`,
            name: name.trim(),
            emoji: '🎯',
            items: [],
          };
          this.storage.savePool(newPool);
          this.storage.setSelectedPoolId(newPool.id);
          this.bus.emit('pool:updated');
          this.close();
          this.bus.emit('open:settings');
        }
      });
    }
  }
}
