// scripts/trainers.js — Trainers page module (ES Module)
import { initNav, initBackToTop, initThemeToggle } from './nav.js';
import { fetchData, showLoading, showError, formatUGX } from './utils.js';
import { openModal } from './modal.js';

const DATA_URL = 'data/trainers.json';

initNav();
initBackToTop();
initThemeToggle();

let allTrainers = [];
let allEvents = [];

// ── Fetch Data ─────────────────────────────────────────────────────
async function loadTrainersData() {
  const trainersGrid = document.getElementById('trainers-grid');
  const eventsGrid = document.getElementById('events-grid');

  showLoading(trainersGrid, 'Loading trainer profiles…');
  showLoading(eventsGrid, 'Loading events…');

  try {
    const data = await fetchData(DATA_URL);
    allTrainers = data.trainers;
    allEvents = data.events;

    renderTrainers(allTrainers, trainersGrid);
    renderEvents(allEvents, eventsGrid);
    initSearch();
    initEventFilters();
    updateCounter(allTrainers.length);
  } catch (err) {
    console.error('Trainers load error:', err);
    showError(trainersGrid, 'Could not load trainer profiles. Please refresh.');
    showError(eventsGrid, 'Could not load events.');
  }
}

// ── Render Trainers ─────────────────────────────────────────────────
function renderTrainers(trainers, container) {
  if (trainers.length === 0) {
    container.innerHTML = `<div class="loading-state"><p>No trainers match your search.</p></div>`;
    return;
  }

  // Using map() array method to generate cards
  container.innerHTML = trainers.map(t => `
    <article
      class="trainer-card"
      tabindex="0"
      role="button"
      aria-label="View profile of ${t.name}, ${t.specialty}"
      data-trainer-id="${t.id}"
    >
      <div class="trainer-img">
        <img
          src="${t.image}"
          alt="Photo of ${t.name}"
          loading="lazy"
          width="400"
          height="267"
        />
        <span class="trainer-availability ${t.available ? 'available' : 'unavailable'}">
          ${t.available ? 'Available' : 'Fully Booked'}
        </span>
      </div>
      <div class="trainer-info">
        <h3>${t.name}</h3>
        <div class="trainer-specialty">${t.specialty}</div>
        <div style="font-family:var(--font-card);font-size:.8rem;color:var(--text-muted);margin-bottom:.5rem">
          ${t.certification}
        </div>
        <div class="trainer-meta">
          <span class="rating">⭐ ${t.rating} <span style="font-weight:400;color:var(--text-muted)">(${t.sessions}+ sessions)</span></span>
          <span class="trainer-price">${formatUGX(t.price)}<span style="font-size:.7rem;font-weight:400;color:var(--text-muted)">/hr</span></span>
        </div>
        <span class="view-profile">View Full Profile →</span>
      </div>
    </article>
  `).join('');

  // Attach click and keyboard events to all trainer cards
  container.querySelectorAll('.trainer-card').forEach((card, index) => {
    const trainer = trainers[index];

    card.addEventListener('click', () => openModal(trainer));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(trainer);
      }
    });
  });
}

// ── Render Events ──────────────────────────────────────────────────
function renderEvents(events, container) {
  if (!container) return;

  // forEach() array method
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  container.innerHTML = '';
  events.forEach(ev => {
    const date = new Date(ev.date + 'T00:00:00');
    const pctFull = Math.round(((ev.spots - ev.spotsLeft) / ev.spots) * 100);

    const card = document.createElement('article');
    card.className = 'event-card';
    card.dataset.category = ev.category;
    card.innerHTML = `
      <div class="event-date-block">
        <div class="event-date-box">
          <span class="event-day">${date.getDate()}</span>
          <span class="event-month">${months[date.getMonth()]}</span>
        </div>
        <div>
          <div class="event-title">${ev.title}</div>
          <span class="tag">${ev.category}</span>
        </div>
      </div>
      <p style="font-size:.85rem;color:var(--text-muted);line-height:1.55">${ev.description}</p>
      <div class="event-meta">
        <span>🕐 ${ev.time}</span>
        <span>📍 ${ev.location}</span>
        <span>👥 ${ev.spotsLeft} spots left</span>
      </div>
      <div class="event-spots">
        <div style="flex:1">
          <div style="background:var(--bg-dark);border-radius:50px;height:6px;overflow:hidden">
            <div style="width:${pctFull}%;height:100%;background:var(--secondary);border-radius:50px"></div>
          </div>
          <span style="font-size:.72rem;color:var(--text-muted)">${pctFull}% full</span>
        </div>
        <span class="event-fee">${formatUGX(ev.fee)}</span>
      </div>
      <a href="index.html#contact" class="btn btn-primary" style="margin-top:.75rem;font-size:.82rem">Register</a>
    `;
    container.appendChild(card);
  });
}

// ── Search ─────────────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('trainer-search');
  const trainersGrid = document.getElementById('trainers-grid');
  if (!input) return;

  // Restore saved search preference
  const saved = localStorage.getItem('kfh-trainer-search');
  if (saved) {
    input.value = saved;
    filterTrainers(saved);
  }

  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    localStorage.setItem('kfh-trainer-search', query);
    filterTrainers(query);
  });

  function filterTrainers(query) {
    const filtered = allTrainers.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.specialty.toLowerCase().includes(query) ||
      t.certification.toLowerCase().includes(query)
    );
    renderTrainers(filtered, trainersGrid);
    updateCounter(filtered.length);
  }
}

// ── Event Filters ──────────────────────────────────────────────────
function initEventFilters() {
  const filterBtns = document.querySelectorAll('.event-filter-btn');
  const eventsGrid = document.getElementById('events-grid');
  if (!filterBtns.length || !eventsGrid) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const cat = btn.dataset.cat;
      const filtered = cat === 'All'
        ? allEvents
        : allEvents.filter(ev => ev.category === cat);

      renderEvents(filtered, eventsGrid);
    });
  });
}

// ── Counter ────────────────────────────────────────────────────────
function updateCounter(count) {
  const el = document.getElementById('trainer-count');
  if (el) el.textContent = `${count} trainer${count !== 1 ? 's' : ''} found`;
}

// ── Bootstrap ──────────────────────────────────────────────────────
loadTrainersData();