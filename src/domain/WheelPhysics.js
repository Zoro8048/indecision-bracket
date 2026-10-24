/**
 * WheelPhysics - Deceleration & Sector Mapping Physics for the Roulette Wheel.
 * Supports realistic angular deceleration, ratchet tick detection, and winner mapping.
 */
export class WheelPhysics {
  constructor(options = {}) {
    this.friction = options.friction || 0.988; // Deceleration damping factor per tick
    this.minVelocity = options.minVelocity || 0.002; // Stop threshold (rad/frame)
    this.reset();
  }

  /**
   * Reset the wheel state.
   */
  reset() {
    this.angle = 0; // Current angle in radians [0, 2pi)
    this.angularVelocity = 0; // Current rotational speed (rad/frame)
    this.isSpinning = false;
    this.items = [];
    this.lastSectorIndex = -1;
  }

  /**
   * Set the items on the wheel.
   * @param {Array<Object>} items 
   */
  setItems(items) {
    this.items = items.map((item, idx) => {
      if (typeof item === 'string') {
        return { id: `wheel_${idx}`, name: item, emoji: '✨' };
      }
      return { ...item };
    });
    this.lastSectorIndex = this.getWinningIndex();
  }

  /**
   * Trigger a spin with randomized or specified initial velocity.
   * @param {number} [force] Optional multiplier or specific velocity
   */
  spin(force = 1.0) {
    if (this.items.length === 0) return;
    
    // Base velocity ~18-28 rad/frame with slight natural randomness
    const randomBoost = Math.random() * 0.15 + 0.35;
    this.angularVelocity = (randomBoost + force * 0.25);
    this.isSpinning = true;
  }

  /**
   * Update wheel rotation by 1 frame.
   * @returns {Object} Frame result { tick: boolean, isSpinning: boolean, winner: Object|null }
   */
  update() {
    if (!this.isSpinning) {
      return { tick: false, isSpinning: false, winner: this.getWinner() };
    }

    this.angle += this.angularVelocity;
    this.angle %= (Math.PI * 2);

    // Check if sector changed (for ratchet click sound)
    const currentSector = this.getWinningIndex();
    let tick = false;
    if (currentSector !== this.lastSectorIndex) {
      tick = true;
      this.lastSectorIndex = currentSector;
    }

    // Apply friction damping
    this.angularVelocity *= this.friction;

    // Check if stopped
    if (this.angularVelocity <= this.minVelocity) {
      this.angularVelocity = 0;
      this.isSpinning = false;
      return { tick: false, isSpinning: false, winner: this.getWinner() };
    }

    return { tick, isSpinning: true, winner: null };
  }

  /**
   * Calculate which sector index is currently under the pointer.
   * Pointer is placed at the top (3*pi/2 or -pi/2).
   */
  getWinningIndex() {
    if (this.items.length === 0) return -1;

    const sectorAngle = (Math.PI * 2) / this.items.length;
    // Pointer is at top: 3*PI/2 (270 degrees)
    // Offset by current wheel rotation angle
    let pointerRelativeAngle = (Math.PI * 1.5 - this.angle) % (Math.PI * 2);
    if (pointerRelativeAngle < 0) {
      pointerRelativeAngle += Math.PI * 2;
    }

    const index = Math.floor(pointerRelativeAngle / sectorAngle) % this.items.length;
    return index;
  }

  /**
   * Get the winning item under the pointer.
   */
  getWinner() {
    const idx = this.getWinningIndex();
    return idx >= 0 ? this.items[idx] : null;
  }

  /**
   * Get current rotation angle in radians.
   */
  getAngle() {
    return this.angle;
  }
}
