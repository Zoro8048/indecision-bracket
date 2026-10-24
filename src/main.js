/**
 * IndecisionBracket - Main Application Bootstrap & Controller.
 */
import { EventBus } from './core/EventBus.js';
import { StorageManager } from './storage/StorageManager.js';
import { CooldownManager } from './domain/CooldownManager.js';
import { BracketEngine } from './domain/BracketEngine.js';
import { SwipeMatcher } from './domain/SwipeMatcher.js';
import { WheelPhysics } from './domain/WheelPhysics.js';
import { AudioService } from './services/AudioService.js';
import { HapticsService } from './services/HapticsService.js';
import { Confetti } from './ui/Confetti.js';
import { BracketView } from './ui/BracketView.js';
import { SwipeView } from './ui/SwipeView.js';
import { WheelView } from './ui/WheelView.js';
import { WinnerModal } from './ui/WinnerModal.js';
import { TreeModal } from './ui/TreeModal.js';
import { PoolPickerSheet } from './ui/PoolPickerSheet.js';
import { SettingsSheet } from './ui/SettingsSheet.js';

class App {
  constructor() {
    this.bus = new EventBus();
    this.storage = new StorageManager();
    this.cooldown = new CooldownManager(this.storage.getHistory());
    this.audio = new AudioService();
    this.haptics = new HapticsService();

    // Domain Engines
    this.bracketEngine = new BracketEngine();
    this.swipeMatcher = new SwipeMatcher();
    this.wheelPhysics = new WheelPhysics();

    // Active mode: 'bracket' | 'swipe' | 'wheel'
    this.activeMode = 'bracket';

    // DOM Elements
    this.viewContainer = document.getElementById('view-container');
    this.modalContainer = document.getElementById('modal-container');
    this.confettiCanvas = document.getElementById('confetti-canvas');
    this.poolSelectorBtn = document.getElementById('btn-pool-selector');
    this.poolLabel = document.getElementById('header-pool-name');
    this.soundToggleBtn = document.getElementById('btn-sound-toggle');
    this.toastContainer = document.getElementById('toast-container');

    // UI Modules & Sheets
    this.confetti = new Confetti(this.confettiCanvas);

    this.winnerModal = new WinnerModal({
      modalContainer: this.modalContainer,
      confetti: this.confetti,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this.treeModal = new TreeModal({
      modalContainer: this.modalContainer,
      audioService: this.audio,
      eventBus: this.bus,
    });

    this.poolPickerSheet = new PoolPickerSheet({
      container: this.modalContainer,
      storageManager: this.storage,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this.settingsSheet = new SettingsSheet({
      container: this.modalContainer,
      storageManager: this.storage,
      cooldownManager: this.cooldown,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this.bracketView = new BracketView({
      container: this.viewContainer,
      bracketEngine: this.bracketEngine,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this.swipeView = new SwipeView({
      container: this.viewContainer,
      swipeMatcher: this.swipeMatcher,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this.wheelView = new WheelView({
      container: this.viewContainer,
      wheelPhysics: this.wheelPhysics,
      audioService: this.audio,
      hapticsService: this.haptics,
      eventBus: this.bus,
    });

    this._init();
  }

  _init() {
    const settings = this.storage.getSettings();
    this.audio.setEnabled(settings.soundEnabled);
    this.haptics.setEnabled(settings.hapticsEnabled);
    this._updateSoundIcon(settings.soundEnabled);

    this._bindEvents();
    this._bindUI();

    this.refreshPoolDisplay();
    this.startActiveMode();
  }

  _bindEvents() {
    this.bus.on('decision:winner', ({ winner, mode }) => {
      this.winnerModal.show(winner, mode);
    });

    this.bus.on('bracket:showTree', (state) => {
      this.treeModal.show(state);
    });

    this.bus.on('bracket:restart', () => {
      this.startActiveMode();
    });

    this.bus.on('swipe:restart', () => {
      this.startActiveMode();
    });

    this.bus.on('mode:restart', () => {
      this.startActiveMode();
    });

    this.bus.on('open:settings', () => {
      this.settingsSheet.show();
    });

    this.bus.on('cooldown:record', (winner) => {
      this.cooldown.recordVisit(winner);
      this.storage.recordHistory(winner);
    });

    this.bus.on('pool:updated', () => {
      this.refreshPoolDisplay();
      this.startActiveMode();
    });

    this.bus.on('toast', (msg) => {
      this.showToast(msg);
    });
  }

  _bindUI() {
    // Mode switcher tabs
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        if (mode && mode !== this.activeMode) {
          this.audio.playTap();
          this.haptics.tap();
          this.switchMode(mode);
        }
      });
    });

    // Header buttons (De-duped!)
    // 1. Top Category Pill -> Opens Quick Category Picker Sheet
    if (this.poolSelectorBtn) {
      this.poolSelectorBtn.addEventListener('click', () => {
        this.audio.playTap();
        this.haptics.tap();
        this.poolPickerSheet.show();
      });
    }

    // 2. Settings Gear -> Opens Settings & Library Sheet
    const btnSettings = document.getElementById('btn-header-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.audio.playTap();
        this.haptics.tap();
        this.settingsSheet.show();
      });
    }

    // 3. Sound Toggle
    if (this.soundToggleBtn) {
      this.soundToggleBtn.addEventListener('click', () => {
        const settings = this.storage.getSettings();
        const newVal = !settings.soundEnabled;
        this.storage.updateSettings({ soundEnabled: newVal });
        this.audio.setEnabled(newVal);
        this._updateSoundIcon(newVal);
        if (newVal) this.audio.playTap();
      });
    }

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.activeMode === 'bracket') {
        this.bracketView.handleKeyDown(e);
      } else if (this.activeMode === 'swipe') {
        this.swipeView.handleKeyDown(e);
      } else if (this.activeMode === 'wheel') {
        this.wheelView.handleKeyDown(e);
      }
    });
  }

  _updateSoundIcon(enabled) {
    if (this.soundToggleBtn) {
      this.soundToggleBtn.innerHTML = enabled ? '🔊' : '🔇';
      this.soundToggleBtn.title = enabled ? 'Sound On' : 'Sound Muted';
    }
  }

  refreshPoolDisplay() {
    const selectedPoolId = this.storage.getSelectedPoolId();
    const pool = this.storage.getPool(selectedPoolId);
    if (this.poolLabel && pool) {
      this.poolLabel.textContent = `${pool.emoji || '🎯'} ${pool.name}`;
    }
  }

  getAvailableItems() {
    const selectedPoolId = this.storage.getSelectedPoolId();
    const pool = this.storage.getPool(selectedPoolId);
    const settings = this.storage.getSettings();

    const { available } = this.cooldown.partition(pool.items, settings.cooldownDays);

    return available.length >= 2 ? available : pool.items;
  }

  switchMode(mode) {
    this.activeMode = mode;
    document.querySelectorAll('.mode-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
    this.startActiveMode();
  }

  startActiveMode() {
    const items = this.getAvailableItems();

    if (!items || items.length < 2) {
      this.viewContainer.innerHTML = `
        <div class="empty-state animate-fade-in">
          <div class="empty-icon">📝</div>
          <h3>Pool has too few choices</h3>
          <p>Please add at least 2 choices in Settings to begin.</p>
          <button class="btn btn-primary" id="btn-empty-open-settings" style="margin-top: 1rem;">
            Open Settings
          </button>
        </div>
      `;
      const btn = this.viewContainer.querySelector('#btn-empty-open-settings');
      if (btn) btn.addEventListener('click', () => this.settingsSheet.show());
      return;
    }

    if (this.activeMode === 'bracket') {
      this.bracketEngine.startTournament(items);
      this.bracketView.render();
    } else if (this.activeMode === 'swipe') {
      this.swipeMatcher.startSession(items);
      this.swipeView.render();
    } else if (this.activeMode === 'wheel') {
      this.wheelView.render(items);
    }
  }

  showToast(message) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast animate-slide-up';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 260);
    }, 2600);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.__APP__ = new App();
});
