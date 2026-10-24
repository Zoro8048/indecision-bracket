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
      '#1e293b', '#0f766e', '#1e1b4b', '#b45309',
      '#374151', '#065f46', '#4c1d95', '#9a3412',
    ];
  }

  render(items) {
    if (items) {
      this.physics.setItems(items);
    }

    this.container.innerHTML = `
      <div class="wheel-view animate-fade-in">
        <div class="wheel-stage">
          <div class="wheel-pointer">▼</div>
          <canvas id="wheel-canvas"></canvas>
          <button class="wheel-center-btn" id="btn-spin-wheel" aria-label="Spin the wheel">
            <span class="spin-label">SPIN</span>
          </button>
        </div>

        <div class="wheel-hint">Tap SPIN or press Spacebar</div>
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
    const size = Math.min(380, window.innerWidth - 48);
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.scale(dpr, dpr);
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
        // Dynamic pitch based on velocity
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
    const { ctx, size } = this;
    const center = size / 2;
    const radius = center - 8;
    const items = this.physics.items;
    if (items.length === 0) return;

    ctx.clearRect(0, 0, size, size);

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

      // Sector fill
      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();

      // Sector border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text and emoji inside wedge
      ctx.save();
      ctx.rotate(startAngle + sectorAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

      const label = `${item.emoji || ''} ${item.name}`;
      // Truncate if too long
      const displayLabel = label.length > 18 ? label.substring(0, 16) + '…' : label;
      ctx.fillText(displayLabel, radius - 20, 5);
      ctx.restore();
    });

    // Outer wheel ring
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 4;
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
