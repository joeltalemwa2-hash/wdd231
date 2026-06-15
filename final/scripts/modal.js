// scripts/modal.js — Modal dialog module (ES Module)

import { formatUGX, renderStars } from './utils.js';

const overlay = document.createElement('div');
overlay.className = 'modal-overlay';
overlay.setAttribute('role', 'dialog');
overlay.setAttribute('aria-modal', 'true');
overlay.setAttribute('aria-labelledby', 'modal-title');
overlay.innerHTML = `
  <div class="modal" id="trainer-modal">
    <div class="modal-header">
      <h2 id="modal-title">Trainer Profile</h2>
      <button class="modal-close" aria-label="Close modal">✕</button>
    </div>
    <div class="modal-body" id="modal-content">
    </div>
  </div>
`;
document.body.appendChild(overlay);

const closeBtn = overlay.querySelector('.modal-close');
let lastFocused = null;

function trapFocus(e) {
  const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function openModal(trainer) {
  lastFocused = document.activeElement;

  const content = document.getElementById('modal-content');
  const certShort = trainer.certification.length > 45
    ? trainer.certification.substring(0, 42) + '…'
    : trainer.certification;

  content.innerHTML = `
    <img
      src="${trainer.image}"
      alt="Photo of ${trainer.name}"
      class="modal-trainer-img"
      loading="lazy"
    />
    <h3 style="text-align:center;color:var(--primary);margin-bottom:.25rem">${trainer.name}</h3>
    <p style="text-align:center;color:var(--secondary-dark);font-size:.88rem;margin-bottom:1rem">${trainer.specialty}</p>
    <div class="modal-detail-grid">
      <div class="modal-detail">
        <span class="modal-detail-label">Experience</span>
        <span class="modal-detail-value">${trainer.experience} yrs</span>
      </div>
      <div class="modal-detail">
        <span class="modal-detail-label">Rating</span>
        <span class="modal-detail-value">⭐ ${trainer.rating}</span>
      </div>
      <div class="modal-detail">
        <span class="modal-detail-label">Sessions</span>
        <span class="modal-detail-value">${trainer.sessions}+</span>
      </div>
      <div class="modal-detail">
        <span class="modal-detail-label">Rate</span>
        <span class="modal-detail-value" style="font-size:.78rem">${formatUGX(trainer.price)}</span>
      </div>
    </div>
    <p style="font-size:.88rem;color:var(--text-muted);line-height:1.65;margin-bottom:1rem">${trainer.bio}</p>
    <div style="background:var(--bg);border-radius:var(--radius-sm);padding:.75rem;font-family:var(--font-card);font-size:.82rem;color:var(--text-muted);margin-bottom:1.25rem">
      <strong style="color:var(--primary)">Certification:</strong> ${certShort}
    </div>
    <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
      ${trainer.available
        ? `<a href="index.html#contact" class="btn btn-primary" onclick="closeModalGlobal()">Book a Session</a>`
        : `<span style="color:#dc3545;font-size:.88rem;font-weight:600">Currently Unavailable</span>`
      }
      <button class="btn btn-outline" onclick="closeModalGlobal()">Close</button>
    </div>
  `;

  document.getElementById('modal-title').textContent = trainer.name;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
  document.addEventListener('keydown', trapFocus);
  document.addEventListener('keydown', handleEscape);
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', trapFocus);
  document.removeEventListener('keydown', handleEscape);
  if (lastFocused) lastFocused.focus();
}

function handleEscape(e) {
  if (e.key === 'Escape') closeModal();
}

// Expose globally for inline onclick handlers
window.closeModalGlobal = closeModal;

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});