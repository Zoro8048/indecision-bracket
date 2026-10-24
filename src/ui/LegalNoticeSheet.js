/**
 * LegalNoticeSheet - iOS-Style Bottom Sheet with Legal & Non-Commercial Disclaimer.
 * Provides explicit compliance status for personal hobby/educational development.
 */
export class LegalNoticeSheet {
  constructor({ container, audioService, eventBus }) {
    this.container = container;
    this.audio = audioService;
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
    this.container.innerHTML = `
      <div class="modal-backdrop" id="legal-backdrop">
        <div class="ios-sheet animate-sheet-up" id="legal-sheet">
          <div class="sheet-grabber-zone">
            <div class="sheet-grabber"></div>
          </div>

          <div class="sheet-header">
            <div class="sheet-title-group">
              <h3 class="sheet-title">Legal & Non-Commercial Notice</h3>
              <p class="sheet-subtitle">Educational hobby & personal portfolio project</p>
            </div>
            <button class="sheet-close-btn" id="btn-close-legal" aria-label="Close">✕</button>
          </div>

          <div class="sheet-scrollable-body">
            <div class="legal-notice-content">
              <div class="legal-card">
                <div class="legal-badge">Strictly Non-Commercial</div>
                <h4 class="legal-card-title">1. Unpaid Personal Hobby & Educational Exercise</h4>
                <p class="legal-card-text">
                  This software is developed and hosted solely as a personal, unpaid coding and educational hobby project. It generates <strong>zero revenue</strong> and contains no advertisements, no in-app purchases, no paywalls, no sponsorships, no subscriptions, and no donation or tip links of any kind. Operating or sharing this personal project does not constitute commercial business activity or outside employment.
                </p>
              </div>

              <div class="legal-card">
                <div class="legal-badge">Original Code</div>
                <h4 class="legal-card-title">2. Original Implementation & Independent Work</h4>
                <p class="legal-card-text">
                  100% of the source code, vector Canvas drawings, and synthesized sound effects (Web Audio API oscillators) are original and generated procedurally at runtime. <strong>IndecisionBracket</strong> is an independent personal project and is not affiliated with, endorsed by, or connected to any commercial entity or employer.
                </p>
              </div>

              <div class="legal-card">
                <div class="legal-badge">Privacy First</div>
                <h4 class="legal-card-title">3. Local-Only Data Sovereignty & Zero Telemetry</h4>
                <p class="legal-card-text">
                  All category pools, personal choices, visit timestamps, and settings are stored strictly in your local browser storage via <code>localStorage</code>. No personal data, cookies, analytics, or telemetry are collected, tracked, or transmitted to any external server.
                </p>
              </div>

              <div class="sheet-action-group" style="margin-top: 1.5rem;">
                <button class="btn btn-primary btn-block btn-lg" id="btn-ack-legal">
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const backdrop = this.container.querySelector('#legal-backdrop');
    const btnClose = this.container.querySelector('#btn-close-legal');
    const btnAck = this.container.querySelector('#btn-ack-legal');

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

    if (btnAck) {
      btnAck.addEventListener('click', () => {
        this.audio.playTap();
        this.close();
      });
    }
  }
}
