/**
 * WheelView - High-DPI 2D Canvas Roulette Wheel with physical deceleration and tactile ticks.
 */
export class WheelView {
  constructor({ container, wheelPhysics, audioService, hapticsService, eventBus }) {
    this.container = container;
    this.physics = wheelPhysics;
    this.audio = audioService;
    this.haptics = hapticsService;
    this.bus = eventBus;

    this.canvas = null;
    this.ctx = null;
    this.animId = null;
    this.colors = [
      '#1e293b', '#0f766e', '#312e81', '#9a3412',
      '#334155', '#047857', '#4338ca', '#c2410c',
    ];
  }

  render(items) {
    if (items) {
      this.physics.setItems(items);
    }

    this.container.innerHTML = `
      <div class="wheel-view animate-fade-in">
        <div class="wheel-stage">
          <!-- Crisp SVG Precision Pointer -->
          <div class="wheel-pointer-svg">
            <svg viewBox="0 0 32 36" width="32" height="36">
              <path d="M16 34 L3 6 C2 4 3 2 5 2 L27 2 C29 2 30 4 29 6 Z" fill="#f43f5e" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" filter="drop-shadow(0 2px 6px rgba(244,63,94,0.6))"/>
            </svg>
          </div>

          <canvas id="wheel-canvas"></canvas>

          <button class="wheel-center-btn" id="btn-spin-wheel" aria-label="Spin the wheel">
            <span class="spin-label">SPIN</span>
          </button>
        </div>

        <div class="wheel-hint">Tap <strong>SPIN</strong> or press <strong>Spacebar</strong></div>
      </div>
    `;

    this.canvas = this.container.querySelector('#wheel-canvas');
    this.ctx = this.canvas.getContext('2d');
    this._setupCanvas();
    this.draw();

    const btnSpin = this.container.querySelector('#btn-spin-wheel');
    if (btnSpin) {
      btnSpin.addEventListener('click', () => this.spin());
    }
  }

  _setupCanvas() {
    const parentWidth = this.container.clientWidth || window.innerWidth;
    const size = Math.max(280, Math.min(360, parentWidth - 40));
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.dpr = dpr;
    this.size = size;
  }

  spin() {
    if (this.physics.isSpinning) return;
    this.audio.playTap();
    this.physics.spin(1.0);
    this._startLoop();
  }

  _startLoop() {
    if (this.animId) cancelAnimationFrame(this.animId);

    const step = () => {
      const result = this.physics.update();

      if (result.tick) {
        const speed = this.physics.angularVelocity;
        this.audio.playRatchetTick(speed * 3.5);
        this.haptics.tick();
      }

      this.draw();

      if (result.isSpinning) {
        this.animId = requestAnimationFrame(step);
      } else {
        this.animId = null;
        if (result.winner) {
          this.audio.playFanfare();
          this.haptics.victory();
          this.bus.emit('decision:winner', {
            winner: result.winner,
            mode: 'wheel',
          });
        }
      }
    };

    this.animId = requestAnimationFrame(step);
  }

  draw() {
    const { ctx, size, dpr } = this;
    const center = size / 2;
    const radius = center - 6;
    const items = this.physics.items;
    if (items.length === 0) return;

    // Reset transform and clear entire canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply DPR scaling
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const currentAngle = this.physics.getAngle();
    const sectorAngle = (Math.PI * 2) / items.length;

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(currentAngle);

    // Draw sectors
    items.forEach((item, i) => {
      const startAngle = i * sectorAngle;
      const endAngle = startAngle + sectorAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      // Sector background
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();

      // Clean sector border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sector label
      ctx.save();
      ctx.rotate(startAngle + sectorAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const label = `${item.emoji || ''} ${item.name}`;
      const displayLabel = label.length > 17 ? label.substring(0, 15) + '…' : label;

      // Position text comfortably between outer edge and center button
      ctx.fillText(displayLabel, radius - 18, 4.5);
      ctx.restore();
    });

    // Outer wheel ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.restore();
  }

  handleKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      this.spin();
    }
  }

  destroy() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }
}
