/**
 * SettingsSheet - iOS-Style Native Bottom Sheet for Managing Pool Items & App Preferences.
 */
export class SettingsSheet {
  constructor({ container, storageManager, cooldownManager, audioService, hapticsService, eventBus }) {
    this.container = container;
    this.storage = storageManager;
    this.cooldown = cooldownManager;
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
      this.bus.emit('pool:updated');
    }, 220);
  }

  render() {
    const selectedPoolId = this.storage.getSelectedPoolId();
    const selectedPool = this.storage.getPool(selectedPoolId);
    const settings = this.storage.getSettings();

    const { available, coolingDown } = this.cooldown.partition(
      selectedPool.items,
      settings.cooldownDays
    );

    const availableItemsHtml = available.map(item => `
      <div class="item-chip">
        <span class="item-emoji">${item.emoji || '✨'}</span>
        <span class="item-name">${item.name}</span>
        ${item.tag ? `<span class="item-tag">${item.tag}</span>` : ''}
        <button class="chip-delete-btn" data-item-id="${item.id}" title="Remove item" aria-label="Remove ${item.name}">✕</button>
      </div>
    `).join('');

    const coolingItemsHtml = coolingDown.length === 0
      ? '<div class="empty-hint">No choices currently on cooldown.</div>'
      : coolingDown.map(item => `
        <div class="item-chip chip-cooldown">
          <span class="item-emoji">${item.emoji || '✨'}</span>
          <span class="item-name">${item.name}</span>
          <span class="cooldown-badge">⏳ ${item.remaining}</span>
          <button class="chip-restore-btn" data-item-id="${item.id}" title="Clear cooldown" aria-label="Clear cooldown for ${item.name}">↺</button>
        </div>
      `).join('');

    this.container.innerHTML = `
      <div class="modal-backdrop" id="settings-backdrop">
        <div class="ios-sheet animate-sheet-up" id="settings-sheet">
          <!-- iOS Grabber Bar -->
          <div class="sheet-grabber-zone">
            <div class="sheet-grabber"></div>
          </div>

          <div class="sheet-header">
            <div class="sheet-title-group">
              <h3 class="sheet-title">Library & Rules</h3>
              <p class="sheet-subtitle">Managing "${selectedPool.emoji || '🎯'} ${selectedPool.name}"</p>
            </div>
            <button class="sheet-close-btn" id="btn-close-settings" aria-label="Close">✕</button>
          </div>

          <div class="sheet-scrollable-body">
            <!-- Section 1: Add New Choice -->
            <div class="sheet-section">
              <span class="sheet-section-title">Add Choice to "${selectedPool.name}"</span>
              <form class="ios-add-card" id="form-add-item">
                <div class="add-card-row">
                  <input type="text" class="ios-input input-emoji" id="input-item-emoji" placeholder="🍕" maxlength="4" aria-label="Choice Emoji">
                  <input type="text" class="ios-input input-name" id="input-item-name" placeholder="Choice name (e.g. Tonkotsu Ramen)" required aria-label="Choice Name">
                </div>
                <div class="add-card-row">
                  <input type="text" class="ios-input input-tag" id="input-item-tag" placeholder="Tag (e.g. Warm, Romantic)" aria-label="Choice Tag">
                  <button type="submit" class="btn btn-primary btn-add-choice">
                    <span class="btn-icon">+</span> Add Choice
                  </button>
                </div>
              </form>
            </div>

            <!-- Section 2: Active Pool Items -->
            <div class="sheet-section">
              <div class="section-title-row">
                <span class="sheet-section-title">Eligible Choices (${available.length})</span>
                <span class="section-subtext">Active for tournament</span>
              </div>
              <div class="chips-container">${availableItemsHtml || '<div class="empty-hint">No choices yet. Add one above!</div>'}</div>
            </div>

            <!-- Section 3: Cooldown System -->
            <div class="sheet-section">
              <div class="section-title-row">
                <span class="sheet-section-title">On Cooldown (${coolingDown.length})</span>
                ${coolingDown.length > 0 ? '<button class="btn-link" id="btn-clear-all-cooldowns">Clear All</button>' : ''}
              </div>
              <div class="chips-container">${coolingItemsHtml}</div>
            </div>

            <!-- Section 4: Rules & System Preferences -->
            <div class="sheet-section">
              <span class="sheet-section-title">Rules & Feedback</span>
              <div class="ios-settings-card">
                <div class="ios-setting-row">
                  <div class="setting-text">
                    <span class="setting-label">Cooldown Window</span>
                    <span class="setting-desc">Days a winner rests before re-entering</span>
                  </div>
                  <div class="range-wrapper">
                    <input type="range" id="input-cooldown-days" min="0" max="14" value="${settings.cooldownDays}" step="1">
                    <span class="range-badge" id="label-cooldown-days">${settings.cooldownDays === 0 ? 'Off' : settings.cooldownDays + 'd'}</span>
                  </div>
                </div>

                <div class="ios-setting-row">
                  <div class="setting-text">
                    <span class="setting-label">Sound & Fanfare</span>
                    <span class="setting-desc">Tactile Web Audio synthesizers</span>
                  </div>
                  <label class="ios-switch">
                    <input type="checkbox" id="toggle-sound" ${settings.soundEnabled ? 'checked' : ''}>
                    <span class="ios-switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <!-- Section 5: Data Sovereignty / Backup -->
            <div class="sheet-section">
              <span class="sheet-section-title">Data Backup & Export</span>
              <div class="sheet-button-grid">
                <button class="btn btn-secondary btn-sm" id="btn-export-backup">💾 Export JSON</button>
                <button class="btn btn-secondary btn-sm" id="btn-import-backup">📥 Import JSON</button>
                <button class="btn btn-ghost btn-sm text-danger" id="btn-factory-reset">Reset Presets</button>
                <input type="file" id="file-import-json" accept=".json" style="display: none;">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents(selectedPool);
  }

  _bindEvents(selectedPool) {
    const backdrop = this.container.querySelector('#settings-backdrop');
    const btnClose = this.container.querySelector('#btn-close-settings');
    const formAddItem = this.container.querySelector('#form-add-item');
    const rangeCooldown = this.container.querySelector('#input-cooldown-days');
    const labelCooldown = this.container.querySelector('#label-cooldown-days');
    const toggleSound = this.container.querySelector('#toggle-sound');
    const btnClearAllCooldowns = this.container.querySelector('#btn-clear-all-cooldowns');
    const btnExport = this.container.querySelector('#btn-export-backup');
    const btnImport = this.container.querySelector('#btn-import-backup');
    const fileInput = this.container.querySelector('#file-import-json');
    const btnReset = this.container.querySelector('#btn-factory-reset');

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        this.audio.playTap();
        this.close();
      });
    }

    if (formAddItem) {
      formAddItem.addEventListener('submit', (e) => {
        e.preventDefault();
        const emoji = this.container.querySelector('#input-item-emoji').value.trim() || '✨';
        const name = this.container.querySelector('#input-item-name').value.trim();
        const tag = this.container.querySelector('#input-item-tag').value.trim();

        if (name) {
          selectedPool.items.push({
            id: `item_${Date.now()}`,
            name,
            emoji,
            tag: tag || undefined,
          });
          this.storage.savePool(selectedPool);
          this.audio.playTap();
          this.haptics.tap();
          this.render();
        }
      });
    }

    this.container.querySelectorAll('.chip-delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        selectedPool.items = selectedPool.items.filter(i => i.id !== itemId);
        this.storage.savePool(selectedPool);
        this.audio.playTap();
        this.render();
      });
    });

    this.container.querySelectorAll('.chip-restore-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        this.cooldown.clearCooldown(itemId);
        this.storage.save();
        this.audio.playTap();
        this.render();
      });
    });

    if (btnClearAllCooldowns) {
      btnClearAllCooldowns.addEventListener('click', () => {
        this.cooldown.clearAll();
        this.storage.clearHistory();
        this.audio.playTap();
        this.render();
      });
    }

    if (rangeCooldown) {
      rangeCooldown.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        labelCooldown.textContent = val === 0 ? 'Off' : `${val}d`;
        this.storage.updateSettings({ cooldownDays: val });
      });
    }

    if (toggleSound) {
      toggleSound.addEventListener('change', (e) => {
        this.storage.updateSettings({ soundEnabled: e.target.checked });
        this.audio.setEnabled(e.target.checked);
        if (e.target.checked) this.audio.playTap();
      });
    }

    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(this.storage.exportJSON());
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `indecision_bracket_backup_${new Date().toISOString().slice(0, 10)}.json`);
        dlAnchor.click();
      });
    }

    if (btnImport) {
      btnImport.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              this.storage.importJSON(event.target.result);
              alert('Settings & pools imported successfully!');
              this.render();
            } catch (err) {
              alert('Failed to parse backup JSON file.');
            }
          };
          reader.readAsText(file);
        }
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Reset all pools and history to factory defaults?')) {
          this.storage.factoryReset();
          this.render();
        }
      });
    }
  }
}
