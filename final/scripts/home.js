// scripts/home.js — Home page module (ES Module)
import { initNav, initBackToTop, initThemeToggle } from './nav.js';
import { fetchData, showLoading, showError, formatDate, formatUGX, getCategoryIcon } from './utils.js';
import { openModal } from './modal.js';

const DATA_URL = 'data/trainers.json';

// ── Init ──────────────────────────────────────────────────────────
initNav();
initBackToTop();
initThemeToggle();

// ── Fetch & render ────────────────────────────────────────────────
async function loadHomeData() {
  const programsContainer = document.getElementById('featured-programs');
  const eventsContainer = document.getElementById('upcoming-events');
  const trainerContainer = document.getElementById('trainer-spotlight');
  const nutritionContainer = document.getElementById('nutrition-tips');

  showLoading(programsContainer, 'Loading programmes…');
  showLoading(eventsContainer, 'Loading events…');
  showLoading(trainerContainer, 'Loading trainer…');

  try {
    const data = await fetchData(DATA_URL);

    renderFeaturedPrograms(data.programs.slice(0, 3), programsContainer);
    renderUpcomingEvents(data.events.slice(0, 3), eventsContainer);
    renderTrainerSpotlight(data.trainers[0], trainerContainer);
    renderNutritionTips(data.nutrition, nutritionContainer);
    renderMemberships(data.memberships);
  } catch (err) {
    console.error('Home data load error:', err);
    showError(programsContainer, 'Could not load programs. Please refresh the page.');
    showError(eventsContainer, 'Could not load events.');
    showError(trainerContainer, 'Could not load trainer spotlight.');
  }
}

// ── Programs ───────────────────────────────────────────────────────
function renderFeaturedPrograms(programs, container) {
  const icons = ['🌱', '🔥', '💪'];
  container.innerHTML = programs.map((p, i) => `
    <article class="program-card">
      <div class="program-icon" aria-hidden="true">${icons[i] || getCategoryIcon(p.category)}</div>
      <div class="meta">
        <span class="tag">${p.level}</span>
        <span class="tag tag-green">${p.duration}</span>
      </div>
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <ul class="program-includes" aria-label="Program includes">
        ${p.includes.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <a href="programs.html" class="btn btn-outline">View Program</a>
    </article>
  `).join('');
}

// ── Events ─────────────────────────────────────────────────────────
function renderUpcomingEvents(events, container) {
  container.innerHTML = events.map(ev => {
    const d = formatDate(ev.date);
    const pct = Math.round(((ev.spots - ev.spotsLeft) / ev.spots) * 100);
    return `
      <article class="event-card">
        <div class="event-date-block">
          <div class="event-date-box" aria-label="${d.full}">
            <span class="event-day">${d.day}</span>
            <span class="event-month">${d.month}</span>
          </div>
          <div>
            <div class="event-title">${ev.title}</div>
            <span class="tag">${ev.category}</span>
          </div>
        </div>
        <div class="event-meta">
          <span>🕐 ${ev.time}</span>
          <span>📍 ${ev.location}</span>
        </div>
        <div class="event-spots">
          <span>${ev.spotsLeft} spots left of ${ev.spots}</span>
          <span class="event-fee">${formatUGX(ev.fee)}</span>
        </div>
      </article>
    `;
  }).join('');
}

// ── Trainer Spotlight ──────────────────────────────────────────────
function renderTrainerSpotlight(trainer, container) {
  container.innerHTML = `
    <div class="spotlight-block">
      <img
        src="${trainer.image}"
        alt="Photo of ${trainer.name}"
        class="spotlight-img"
        loading="lazy"
        width="90"
        height="90"
      />
      <div class="spotlight-info">
        <span class="section-eyebrow">Trainer Spotlight</span>
        <h4>${trainer.name}</h4>
        <p>${trainer.specialty} · ${trainer.experience} years experience</p>
        <p>⭐ ${trainer.rating} · ${trainer.sessions}+ sessions</p>
        <button
          class="btn btn-primary mt-1"
          style="font-size:.8rem;padding:.45rem 1.1rem"
          aria-label="View profile of ${trainer.name}"
        >View Profile</button>
      </div>
    </div>
  `;

  container.querySelector('button').addEventListener('click', () => openModal(trainer));
}

// ── Nutrition Tips ─────────────────────────────────────────────────
function renderNutritionTips(tips, container) {
  container.innerHTML = tips.map(t => `
    <div class="tip-card">
      <div class="tip-icon" aria-hidden="true">${t.icon}</div>
      <span class="tip-category">${t.category}</span>
      <h3>${t.tip}</h3>
      <p>${t.detail}</p>
    </div>
  `).join('');
}

// ── Memberships ────────────────────────────────────────────────────
function renderMemberships(memberships) {
  const container = document.getElementById('memberships-grid');
  if (!container) return;

  container.innerHTML = memberships.map(m => `
    <div class="membership-card ${m.highlighted ? 'highlighted' : ''}">
      ${m.highlighted ? '<span class="popular-badge">Most Popular</span>' : ''}
      <div class="membership-name">${m.name}</div>
      <div class="membership-price">
        <sup>UGX</sup>${m.price.toLocaleString()}
      </div>
      <div class="membership-period">per ${m.period}</div>
      <ul class="membership-features">
        ${m.features.map(f => `<li>${f}</li>`).join('')}
      </ul>
      <a href="#contact" class="btn ${m.highlighted ? 'btn-primary' : 'btn-outline'}">Get Started</a>
    </div>
  `).join('');
}

// ── User preference: interest area ────────────────────────────────
function initPreferenceBar() {
  const select = document.getElementById('interest-select');
  if (!select) return;

  const saved = localStorage.getItem('kfh-interest');
  if (saved) select.value = saved;

  select.addEventListener('change', () => {
    localStorage.setItem('kfh-interest', select.value);
    const msg = document.getElementById('pref-msg');
    if (msg) {
      msg.textContent = `Showing content for: ${select.options[select.selectedIndex].text}`;
      msg.style.color = 'var(--secondary-dark)';
    }
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────
loadHomeData();
initPreferenceBar();