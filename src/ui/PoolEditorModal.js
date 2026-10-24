/**
 * PoolEditorModal - Management dialog for pools, custom items, cooldowns, and settings.
 */
export class PoolEditorModal {
  constructor({ modalContainer, storageManager, cooldownManager, audioService, eventBus }) {
    this.container = modalContainer;
    this.storage = storageManager;
    this.cooldown = cooldownManager;
    this.audio = audioService;
    this.bus = eventBus;
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
  }

  render() {
    const pools = this.storage.getPools();
    const selectedPoolId = this.storage.getSelectedPoolId();
    const selectedPool = this.storage.getPool(selectedPoolId);
    const settings = this.storage.getSettings();

    // Check cooldown status for current pool items
    const { available, coolingDown } = this.cooldown.partition(
      selectedPool.items,
      settings.cooldownDays
    );

    const poolsOptions = pools.map(p => `
      <option value="${p.id}" ${p.id === selectedPoolId ? 'selected' : ''}>
        ${p.emoji || '📁'} ${p.name} (${p.items.length} items)
      </option>
    `).join('');

    const availableItemsHtml = available.map(item => `
      <div class="item-chip">
        <span class="item-emoji">${item.emoji || '✨'}</span>
        <span class="item-name">${item.name}</span>
        ${item.tag ? `<span class="item-tag">${item.tag}</span>` : ''}
        <button class="chip-delete-btn" data-item-id="${item.id}" title="Remove item">✕</button>
      </div>
    `).join('');

    const coolingItemsHtml = coolingDown.length === 0 
      ? '<div class="empty-hint">No items currently on cooldown.</div>'
      : coolingDown.map(item => `
        <div class="item-chip chip-cooldown">
          <span class="item-emoji">${item.emoji || '✨'}</span>
          <span class="item-name">${item.name}</span>
          <span class="cooldown-badge">⏳ ${item.remaining}</span>
          <button class="chip-restore-btn" data-item-id="${item.id}" title="Reset cooldown">↺</button>
        </div>
      `).join('');

    this.container.innerHTML = `
      <div class="modal-backdrop animate-fade-in" id="settings-backdrop">
        <div class="modal-dialog settings-dialog animate-scale-up">
          <div class="modal-header">
            <h3>⚙️ Preferences & Pools</h3>
            <button class="modal-close-btn" id="btn-close-settings">✕</button>
          </div>

          <div class="settings-body">
            <!-- Pool Selector Section -->
            <div class="settings-section">
              <label class="settings-label">Active Decision Pool</label>
              <div class="pool-select-row">
                <select class="form-select" id="select-active-pool">
                  ${poolsOptions}
                </select>
                <button class="btn btn-secondary btn-sm" id="btn-new-pool">+ New Pool</button>
              </div>
            </div>

            <!-- Add Item to Pool Form -->
            <div class="settings-section">
              <label class="settings-label">Add Item to "${selectedPool.name}"</label>
              <form class="add-item-form" id="form-add-item">
                <input type="text" class="form-input input-emoji" id="input-item-emoji" placeholder="🍕" maxlength="4" style="width: 50px; text-align: center;">
                <input type="text" class="form-input" id="input-item-name" placeholder="Item name (e.g. Thai Bistro)" required style="flex: 1;">
                <input type="text" class="form-input input-tag" id="input-item-tag" placeholder="Tag (optional)" style="width: 100px;">
                <button type="submit" class="btn btn-primary btn-sm">Add</button>
              </form>
            </div>

            <!-- Active Items List -->
            <div class="settings-section">
              <label class="settings-label">Eligible Items (${available.length})</label>
              <div class="chips-container">${availableItemsHtml || '<div class="empty-hint">No eligible items.</div>'}</div>
            </div>

            <!-- Cooldown Section -->
            <div class="settings-section">
              <div class="section-header-split">
                <label class="settings-label">On Cooldown (${coolingDown.length})</label>
                ${coolingDown.length > 0 ? '<button class="btn-link" id="btn-clear-all-cooldowns">Clear All</button>' : ''}
              </div>
              <div class="chips-container">${coolingItemsHtml}</div>
            </div>

            <!-- Preferences & Rules -->
            <div class="settings-section">
              <label class="settings-label">Rules & Feedback</label>
              <div class="setting-toggle-row">
                <span>Cooldown Window</span>
                <div class="range-wrapper">
                  <input type="range" id="input-cooldown-days" min="0" max="14" value="${settings.cooldownDays}" step="1">
                  <span id="label-cooldown-days">${settings.cooldownDays === 0 ? 'Off' : settings.cooldownDays + ' days'}</span>
                </div>
              </div>
              <div class="setting-toggle-row">
                <span>Sound & Fanfare</span>
                <label class="switch">
                  <input type="checkbox" id="toggle-sound" ${settings.soundEnabled ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            </div>

            <!-- Data Sovereignty / Backup -->
            <div class="settings-section settings-backup-row">
              <button class="btn btn-secondary btn-sm" id="btn-export-backup">💾 Export JSON</button>
              <button class="btn btn-secondary btn-sm" id="btn-import-backup">📥 Import JSON</button>
              <button class="btn btn-ghost btn-sm text-danger" id="btn-factory-reset">Reset Defaults</button>
              <input type="file" id="file-import-json" accept=".json" style="display: none;">
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
    const poolSelect = this.container.querySelector('#select-active-pool');
    const btnNewPool = this.container.querySelector('#btn-new-pool');
    const formAddItem = this.container.querySelector('#form-add-item');
    const rangeCooldown = this.container.querySelector('#input-cooldown-days');
    const labelCooldown = this.container.querySelector('#label-cooldown-days');
    const toggleSound = this.container.querySelector('#toggle-sound');
    const btnClearAllCooldowns = this.container.querySelector('#btn-clear-all-cooldowns');
    const btnExport = this.container.querySelector('#btn-export-backup');
    const btnImport = this.container.querySelector('#btn-import-backup');
    const fileInput = this.container.querySelector('#file-import-json');
    const btnReset = this.container.querySelector('#btn-factory-reset');

    const close = () => {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      this.bus.emit('pool:updated');
    };

    if (btnClose) btnClose.addEventListener('click', close);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) close();
      });
    }

    if (poolSelect) {
      poolSelect.addEventListener('change', (e) => {
        this.storage.setSelectedPoolId(e.target.value);
        this.render();
      });
    }

    if (btnNewPool) {
      btnNewPool.addEventListener('click', () => {
        const name = prompt('Enter new pool name (e.g. Favorite Coffee Spots):');
        if (name && name.trim()) {
          const newPool = {
            id: `pool_${Date.now()}`,
            name: name.trim(),
            emoji: '🎯',
            items: [],
          };
          this.storage.savePool(newPool);
          this.storage.setSelectedPoolId(newPool.id);
          this.render();
        }
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
          this.render();
        }
      });
    }

    // Delete item chip
    this.container.querySelectorAll('.chip-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        selectedPool.items = selectedPool.items.filter(i => i.id !== itemId);
        this.storage.savePool(selectedPool);
        this.render();
      });
    });

    // Restore single cooldown
    this.container.querySelectorAll('.chip-restore-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemId;
        this.cooldown.clearCooldown(itemId);
        this.storage.save();
        this.render();
      });
    });

    if (btnClearAllCooldowns) {
      btnClearAllCooldowns.addEventListener('click', () => {
        this.cooldown.clearAll();
        this.storage.clearHistory();
        this.render();
      });
    }

    if (rangeCooldown) {
      rangeCooldown.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        labelCooldown.textContent = val === 0 ? 'Off' : `${val} days`;
        this.storage.updateSettings({ cooldownDays: val });
      });
    }

    if (toggleSound) {
      toggleSound.addEventListener('change', (e) => {
        this.storage.updateSettings({ soundEnabled: e.target.checked });
        this.audio.setEnabled(e.target.checked);
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
