/**
 * HapticsService - Tactile feedback service for mobile devices.
 * Supports Android navigator.vibrate and micro-taptics.
 */
export class HapticsService {
  constructor() {
    this.enabled = true;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  tap() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(10);
    } catch (_) {}
  }

  tick() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate(5);
    } catch (_) {}
  }

  match() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate([25, 40, 25]);
    } catch (_) {}
  }

  victory() {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
    try {
      navigator.vibrate([35, 50, 35, 50, 75]);
    } catch (_) {}
  }
}
