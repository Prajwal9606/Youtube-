/**
 * Interactive Step-by-Step Guide Modal:
 * "How to Get Your Google Client ID on Mobile Browser"
 */

export function renderOAuthGuideModal(container, onClose) {
  const currentOrigin = window.location.origin;

  const modalHtml = `
    <div class="modal-backdrop" id="oauth-guide-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="badge-accent">100% Free & No PC</span>
            <h3>How to Get Your Google Client ID on Mobile</h3>
          </div>
          <button class="btn-icon" id="guide-close-btn">&times;</button>
        </div>

        <div class="modal-body guide-steps-list">
          <div class="guide-step">
            <div class="step-num">1</div>
            <div class="step-content">
              <h4>Open Google Cloud Console on Phone</h4>
              <p>In Chrome/Safari on your mobile device, open <a href="https://console.cloud.google.com" target="_blank" class="link-highlight">console.cloud.google.com</a>.</p>
              <div class="tip-box">
                💡 <strong>Tip:</strong> Tap Chrome's 3 dots menu (⋮) and check <strong>"Desktop Site"</strong> for easier navigation.
              </div>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">2</div>
            <div class="step-content">
              <h4>Enable YouTube Data API v3</h4>
              <p>Create a new project (e.g., <em>"My Shorts Studio"</em>). In the search bar at the top, search for <strong>YouTube Data API v3</strong> and tap <strong>ENABLE</strong>.</p>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">3</div>
            <div class="step-content">
              <h4>Configure OAuth Consent Screen</h4>
              <p>Go to <strong>APIs & Services &rarr; OAuth consent screen</strong>:</p>
              <ul>
                <li>Select <strong>External</strong> and tap <em>Create</em>.</li>
                <li>Enter an App name (e.g. <em>YT Clipper</em>) and your email.</li>
                <li>Under <strong>Test users</strong>, tap <em>+ ADD USERS</em> and add your YouTube channel Gmail address. Tap <em>Save and Continue</em>.</li>
              </ul>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">4</div>
            <div class="step-content">
              <h4>Create OAuth 2.0 Web Client ID</h4>
              <p>Go to <strong>Credentials &rarr; + CREATE CREDENTIALS &rarr; OAuth client ID</strong>:</p>
              <ul>
                <li>Application type: <strong>Web application</strong>.</li>
                <li>Name: <em>Shorts Mobile Web Client</em>.</li>
              </ul>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">5</div>
            <div class="step-content">
              <h4>Add Authorized JavaScript Origins</h4>
              <p>Scroll down to <strong>Authorized JavaScript origins</strong> and add your live origins:</p>
              
              <div class="copy-field">
                <span class="copy-label">Current App Origin:</span>
                <div class="copy-input-row">
                  <code>${currentOrigin}</code>
                  <button class="btn-sm btn-copy" data-copy="${currentOrigin}">Copy</button>
                </div>
              </div>

              <div class="copy-field">
                <span class="copy-label">Localhost (Testing):</span>
                <div class="copy-input-row">
                  <code>http://localhost:5173</code>
                  <button class="btn-sm btn-copy" data-copy="http://localhost:5173">Copy</button>
                </div>
              </div>

              <div class="copy-field">
                <span class="copy-label">Capacitor Android Origin:</span>
                <div class="copy-input-row">
                  <code>https://localhost</code>
                  <button class="btn-sm btn-copy" data-copy="https://localhost">Copy</button>
                </div>
              </div>
            </div>
          </div>

          <div class="guide-step">
            <div class="step-num">6</div>
            <div class="step-content">
              <h4>Copy Client ID & Paste into Settings</h4>
              <p>Tap <strong>CREATE</strong>. Copy the generated <strong>Client ID</strong> (ends with <code>.apps.googleusercontent.com</code>) and paste it into the <em>Google OAuth Client ID</em> field in Settings.</p>
              <div class="tip-box success-tip">
                ✅ <strong>Zero Secrets Needed:</strong> No client_secret.json or backend servers required. Your phone uploads directly to YouTube!
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary" id="guide-done-btn">Got It! Open Settings</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = modalHtml;

  // Event handlers
  const backdrop = container.querySelector('#oauth-guide-backdrop');
  const closeBtn = container.querySelector('#guide-close-btn');
  const doneBtn = container.querySelector('#guide-done-btn');

  const close = () => {
    container.innerHTML = '';
    if (onClose) onClose();
  };

  closeBtn.addEventListener('click', close);
  doneBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  // Copy buttons
  container.querySelectorAll('.btn-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied! ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 2000);
    });
  });
}
