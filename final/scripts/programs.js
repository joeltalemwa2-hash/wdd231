// scripts/programs.js — Programs page module (ES Module)
import { initNav, initBackToTop, initThemeToggle } from './nav.js';
import { fetchData, showLoading, showError, formatUGX, getCategoryIcon, getLevelIcon } from './utils.js';

const DATA_URL = 'data/trainers.json';

initNav();
initBackToTop();
initThemeToggle();

let allPrograms = [];
let allMemberships = [];

// ── Fetch Data ─────────────────────────────────────────────────────
async function loadProgramsData() {
  const programsGrid = document.getElementById('programs-grid');
  const membershipsGrid = document.getElementById('memberships-grid');

  showLoading(programsGrid, 'Loading workout programs…');

  try {
    const data = await fetchData(DATA_URL);
    allPrograms = data.programs;
    allMemberships = data.memberships;

    renderPrograms(allPrograms, programsGrid);
    renderMemberships(allMemberships, membershipsGrid);
    initFilters();
    initLevelPreference();
  } catch (err) {
    console.error('Programs load error:', err);
    showError(programsGrid, 'Could not load programs. Please refresh.');
  }
}

// ── Render Programs ────────────────────────────────────────────────
function renderPrograms(programs, container) {
  if (programs.length === 0) {
    container.innerHTML = `<p class="loading-state">No programs match your filter. Try another category.</p>`;
    return;
  }

  container.innerHTML = programs.map(p => `
    <article class="program-card" data-level="${p.level}" data-category="${p.category}">
      <div class="program-icon" aria-hidden="true">${getLevelIcon(p.level)}</div>
      <div class="meta">
        <span class="tag">${p.level}</span>
        <span class="tag tag-green">${p.duration}</span>
        <span class="tag">${p.sessions} sessions</span>
      </div>
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <ul class="program-includes" aria-label="Program includes">
        ${p.includes.map(item => `<li>${item}</li>`).join('')}
      </ul>
      <span style="font-size:.78rem;color:var(--text-muted);font-family:var(--font-card)">Category: ${p.category}</span>
      <a href="index.html#contact" class="btn btn-primary" style="margin-top:.85rem">Enrol Now</a>
    </article>
  `).join('');
}

// ── Render Memberships ─────────────────────────────────────────────
function renderMemberships(memberships, container) {
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
      <a href="index.html#contact" class="btn ${m.highlighted ? 'btn-primary' : 'btn-outline'}">Get Started</a>
    </div>
  `).join('');
}

// ── Filter Buttons ─────────────────────────────────────────────────
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const programsGrid = document.getElementById('programs-grid');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const level = btn.dataset.filter;
      const filtered = level === 'All'
        ? allPrograms
        : allPrograms.filter(p => p.level === level);

      renderPrograms(filtered, programsGrid);
      // Save filter preference
      localStorage.setItem('kfh-program-filter', level);
    });
  });

  // Restore saved filter
  const saved = localStorage.getItem('kfh-program-filter');
  if (saved) {
    const btn = document.querySelector(`.filter-btn[data-filter="${saved}"]`);
    if (btn) btn.click();
  }
}

// ── Level preference ───────────────────────────────────────────────
function initLevelPreference() {
  const saved = localStorage.getItem('kfh-level');
  const badge = document.getElementById('level-badge');
  if (badge && saved) {
    badge.textContent = `Your level: ${saved}`;
    badge.style.display = 'inline-block';
  }

  document.querySelectorAll('.level-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem('kfh-level', btn.dataset.level);
      if (badge) {
        badge.textContent = `Your level: ${btn.dataset.level}`;
        badge.style.display = 'inline-block';
      }
      document.querySelectorAll('.level-select-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────
loadProgramsData();