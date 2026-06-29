/* ============================================================
   Taljoe Bank — UI Controller  (public/js/app.js)
   Handles all DOM interactions, rendering, and PWA setup.
   ============================================================ */

'use strict';

// ── Formatting helpers ────────────────────────────────────
const fmt    = n  => Number(n || 0).toLocaleString('en-UG');
const fmtUGX = n  => 'UGX ' + fmt(n);
const txIcon = tp => tp === 'deposit' ? '💰' : tp === 'withdrawal' ? '📤' : '📈';
const fmtDate = iso => new Date(iso).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Toast ─────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'success') {
  const el  = document.getElementById('toast');
  el.textContent = (type === 'success' ? '✓ ' : '✗ ') + msg;
  el.className   = 'show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ════════════════════════════════════════════════════════════
// PIN LOGIC
// ════════════════════════════════════════════════════════════
let _pinBuffer = '';

function updateDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('dot-' + i).classList.toggle('filled', i < _pinBuffer.length);
  }
}

function submitPin() {
  if (!DB.verifyPin(_pinBuffer)) {
    document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
    _pinBuffer = '';
    updateDots();
    setTimeout(() => { document.getElementById('pin-error').textContent = ''; }, 2000);
    return;
  }
  unlockApp();
}

function unlockApp() {
  _pinBuffer = ''; updateDots();
  document.getElementById('pin-error').textContent = '';
  const pinScreen = document.getElementById('pin-screen');
  const app       = document.getElementById('app');
  pinScreen.classList.add('hidden');
  app.style.display = 'flex';
  app.style.flexDirection = 'column';
  refreshAll();
  setTimeout(() => { pinScreen.style.display = 'none'; }, 500);
}

function lockApp() {
  const pinScreen = document.getElementById('pin-screen');
  pinScreen.style.display = 'flex';
  pinScreen.classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  _pinBuffer = ''; updateDots();
}

// ════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ════════════════════════════════════════════════════════════
function switchTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  document.querySelector('[data-tab="' + id + '"]')?.classList.add('active');

  // Per-tab refresh
  const acc = DB.getAccount();
  if (id === 'deposit')  document.getElementById('dep-balance').textContent  = fmtUGX(acc.balance);
  if (id === 'withdraw') document.getElementById('with-balance').textContent = fmtUGX(acc.balance);
  if (id === 'history')  renderHistory('all');
  if (id === 'goals')    renderGoals();
  if (id === 'invest')   renderSacco();
  if (id === 'settings') loadSettings();

  document.querySelector('main').scrollTop = 0;
}

// ════════════════════════════════════════════════════════════
// FULL REFRESH (dashboard)
// ════════════════════════════════════════════════════════════
function refreshAll() {
  const acc  = DB.getAccount();
  const stat = DB.getMonthStats();
  const sett = DB.getSettings();

  // Greeting
  document.getElementById('dash-name').textContent = 'Good day, ' + sett.name + ' 👋';

  // Balance hero
  document.getElementById('dash-balance').textContent   = fmt(acc.balance);
  document.getElementById('dash-deposited').textContent = fmt(acc.totalDeposited);
  document.getElementById('dash-withdrawn').textContent = fmt(acc.totalWithdrawn);
  document.getElementById('dash-income').textContent    = fmt(acc.totalIncome);
  document.getElementById('dash-net').textContent       = fmt(stat.net);

  // Month summary
  document.getElementById('month-deps').textContent  = fmtUGX(stat.deposits);
  document.getElementById('month-withs').textContent = fmtUGX(stat.withdrawals);

  // Recent transactions on dashboard
  renderRecentTxns();
}

// ════════════════════════════════════════════════════════════
// TRANSACTION RENDERING
// ════════════════════════════════════════════════════════════
function renderTxnHTML(tx, allowDelete = true) {
  const isPlus  = tx.type !== 'withdrawal';
  const deleteBtn = allowDelete
    ? `<button class="txn-delete" onclick="deleteTx('${tx.id}')" aria-label="Delete transaction" title="Delete">✕</button>`
    : '';
  return `
    <div class="txn-item" id="tx-${tx.id}">
      <div class="txn-icon ${tx.type}" aria-hidden="true">${txIcon(tx.type)}</div>
      <div class="txn-info">
        <div class="txn-desc">${escapeHTML(tx.description)}</div>
        <div class="txn-cat"><span class="badge ${isPlus ? 'badge-green' : 'badge-red'}">${escapeHTML(tx.category)}</span></div>
      </div>
      <div class="txn-right">
        <div class="txn-amount ${isPlus ? 'plus' : 'minus'}">${isPlus ? '+' : '-'}UGX ${fmt(tx.amount)}</div>
        <div class="txn-date">${fmtDate(tx.date)}</div>
      </div>
      ${deleteBtn}
    </div>`;
}

function renderRecentTxns() {
  const txs = DB.getTransactions().slice(0, 8);
  const el  = document.getElementById('recent-txns');
  if (!txs.length) {
    el.innerHTML = emptyState('💳', 'No transactions yet', 'Make your first deposit to get started!');
    return;
  }
  el.innerHTML = txs.map(t => renderTxnHTML(t, false)).join('');
}

let _activeFilter = 'all';
function renderHistory(filter) {
  _activeFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(c =>
    c.classList.toggle('active', c.dataset.filter === filter)
  );
  let txs = DB.getTransactions();
  if (filter !== 'all') txs = txs.filter(t => t.type === filter);
  const el = document.getElementById('history-list');
  if (!txs.length) {
    el.innerHTML = emptyState('📋', 'No transactions', 'Nothing to show for this filter.');
    return;
  }
  el.innerHTML = txs.map(t => renderTxnHTML(t)).join('');
}

function deleteTx(id) {
  if (!confirm('Delete this transaction? Its effect on your balance will be reversed.')) return;
  DB.deleteTransaction(id);
  showToast('Transaction removed');
  refreshAll();
  renderHistory(_activeFilter);
}

function clearAll() {
  if (!confirm('Delete ALL transactions and reset balance to zero? This cannot be undone.')) return;
  DB.clearAllTransactions();
  showToast('All data cleared');
  refreshAll();
  renderHistory('all');
}

// ════════════════════════════════════════════════════════════
// DEPOSIT / WITHDRAW / INCOME
// ════════════════════════════════════════════════════════════
function doDeposit() {
  try {
    const tx = DB.deposit({
      amount:      document.getElementById('dep-amount').value,
      description: document.getElementById('dep-desc').value,
      category:    document.getElementById('dep-cat').value,
    });
    document.getElementById('dep-amount').value = '';
    document.getElementById('dep-desc').value   = '';
    showToast('Deposited UGX ' + fmt(tx.amount));
    refreshAll();
    document.getElementById('dep-balance').textContent = fmtUGX(DB.getAccount().balance);
  } catch (e) { showToast(e.message, 'error'); }
}

function doWithdraw() {
  try {
    const tx = DB.withdraw({
      amount:      document.getElementById('with-amount').value,
      description: document.getElementById('with-desc').value,
      category:    document.getElementById('with-cat').value,
    });
    document.getElementById('with-amount').value = '';
    document.getElementById('with-desc').value   = '';
    showToast('Withdrew UGX ' + fmt(tx.amount));
    refreshAll();
    document.getElementById('with-balance').textContent = fmtUGX(DB.getAccount().balance);
  } catch (e) { showToast(e.message, 'error'); }
}

function doIncome() {
  try {
    const addToBalance = document.querySelector('[name=inc-add]:checked')?.value === 'yes';
    const tx = DB.addIncome({
      amount:       document.getElementById('inc-amount').value,
      source:       document.getElementById('inc-source').value,
      category:     document.getElementById('inc-cat').value,
      addToBalance,
    });
    document.getElementById('inc-amount').value = '';
    document.getElementById('inc-source').value = '';
    showToast('Income of UGX ' + fmt(tx.amount) + ' recorded');
    refreshAll();
  } catch (e) { showToast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════════
// GOALS
// ════════════════════════════════════════════════════════════
function addGoal() {
  try {
    DB.addGoal({
      name:   document.getElementById('goal-name').value,
      target: document.getElementById('goal-target').value,
      saved:  document.getElementById('goal-saved').value,
    });
    document.getElementById('goal-name').value   = '';
    document.getElementById('goal-target').value = '';
    document.getElementById('goal-saved').value  = '';
    showToast('Goal added!');
    renderGoals();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderGoals() {
  const goals = DB.getGoals();
  const el    = document.getElementById('goals-list');
  if (!goals.length) {
    el.innerHTML = emptyState('🎯', 'No goals yet', 'Set a savings target to stay motivated!');
    return;
  }
  el.innerHTML = goals.map(g => {
    const pct  = Math.min(100, Math.round((g.saved / g.target) * 100));
    const done = pct >= 100;
    const topUp = done ? '' : `
      <input type="number" id="top-${g.id}" placeholder="Add amount"
        style="flex:2;padding:8px;background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;font-family:var(--font-mono)"/>
      <button class="btn btn-primary" style="flex:1;padding:8px;font-size:13px" onclick="topUpGoal('${g.id}')">+ Add</button>`;
    return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${escapeHTML(g.name)} ${done ? '🎉' : ''}</div>
          <div class="goal-pct">${pct}%</div>
        </div>
        <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-vals">
          <span>Saved: UGX ${fmt(g.saved)}</span>
          <span>Target: UGX ${fmt(g.target)}</span>
        </div>
        <div class="goal-actions">
          ${topUp}
          <button class="btn btn-danger" style="flex:0 0 36px;padding:8px;font-size:13px" onclick="delGoal('${g.id}')">✕</button>
        </div>
        ${done ? '<div style="text-align:center;margin-top:10px;color:var(--accent);font-weight:700">Goal reached! 🎉</div>' : ''}
      </div>`;
  }).join('');
}

function topUpGoal(id) {
  const inp = document.getElementById('top-' + id);
  const amt = parseFloat(inp.value);
  if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
  DB.updateGoalSaved(id, amt);
  showToast('Goal updated!');
  renderGoals();
}

function delGoal(id) {
  if (!confirm('Remove this goal?')) return;
  DB.deleteGoal(id);
  renderGoals();
}

// ════════════════════════════════════════════════════════════
// SACCO / INVEST
// ════════════════════════════════════════════════════════════
function updateSaccoProjection() {
  const amt    = parseFloat(document.getElementById('sacco-amount').value) || 0;
  const rate   = parseFloat(document.getElementById('sacco-return').value) || 0;
  const months = parseInt(document.getElementById('sacco-months').value)   || 0;
  document.getElementById('sacco-proj').textContent = fmt(DB.projectSacco(amt, rate, months));
}

function addSacco() {
  try {
    const deductFromBalance = document.querySelector('[name=sacco-deduct]:checked')?.value === 'yes';
    DB.addSacco({
      name:             document.getElementById('sacco-name').value,
      amount:           document.getElementById('sacco-amount').value,
      returnRate:       document.getElementById('sacco-return').value,
      months:           document.getElementById('sacco-months').value,
      deductFromBalance,
    });
    showToast('SACCO contribution saved!');
    renderSacco();
    refreshAll();
  } catch (e) { showToast(e.message, 'error'); }
}

function renderSacco() {
  const recs = DB.getSacco();
  const el   = document.getElementById('sacco-list');
  if (!recs.length) {
    el.innerHTML = emptyState('🏦', 'No contributions yet', 'Add your first SACCO contribution above.');
    return;
  }
  el.innerHTML = recs.map(r => `
    <div class="goal-card">
      <div class="goal-header">
        <div class="goal-name">${escapeHTML(r.name)}</div>
        <span class="badge badge-green">${r.returnRate}% p.a.</span>
      </div>
      <div class="goal-vals">
        <span>Monthly: UGX ${fmt(r.amount)}</span>
        <span>${r.months} months</span>
      </div>
      <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:13px;color:var(--muted)">
        <span>Projected: <strong class="text-accent font-mono">UGX ${fmt(r.projected)}</strong></span>
        <span>${fmtDate(r.date)}</span>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════
function loadSettings() {
  const s = DB.getSettings();
  document.getElementById('set-name-display').textContent = s.name;
  document.getElementById('set-name').value = s.name;
}

function saveName() {
  const name = document.getElementById('set-name').value.trim();
  if (!name) { showToast('Enter a name', 'error'); return; }
  DB.saveSettings({ name });
  showToast('Name updated!');
  refreshAll();
}

function changePin() {
  try {
    const cur = document.getElementById('pin-current').value;
    const nw  = document.getElementById('pin-new').value;
    const cf  = document.getElementById('pin-confirm').value;
    if (nw !== cf) throw new Error('New PINs do not match.');
    DB.changePin(cur, nw);
    ['pin-current', 'pin-new', 'pin-confirm'].forEach(id => { document.getElementById(id).value = ''; });
    showToast('PIN updated successfully!');
  } catch (e) { showToast(e.message, 'error'); }
}

function resetAll() {
  if (!confirm('This will erase ALL your data permanently. Are you absolutely sure?')) return;
  DB.resetAll();
  showToast('Account reset. Starting fresh.');
  refreshAll();
}

// ── Theme ─────────────────────────────────────────────────
function applyTheme(dark) {
  if (dark) {
    document.documentElement.removeAttribute('data-light');
    document.getElementById('theme-toggle').textContent = '🌙';
    document.getElementById('theme-toggle-setting').classList.add('on');
    document.getElementById('theme-label').textContent = 'Dark';
  } else {
    document.documentElement.setAttribute('data-light', '');
    document.getElementById('theme-toggle').textContent = '☀️';
    document.getElementById('theme-toggle-setting').classList.remove('on');
    document.getElementById('theme-label').textContent = 'Light';
  }
}

function toggleTheme() {
  const isDark = !document.documentElement.hasAttribute('data-light');
  DB.saveSettings({ darkMode: !isDark });
  applyTheme(!isDark);
}

// ── Utility ───────────────────────────────────────────────
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emptyState(icon, title, sub) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-sub">${sub}</div></div>`;
}

// ════════════════════════════════════════════════════════════
// PWA: SERVICE WORKER + INSTALL PROMPT
// ════════════════════════════════════════════════════════════
let _deferredInstall;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('[TJ Bank] Service Worker registered'))
    .catch(e => console.warn('[TJ Bank] SW registration failed:', e));
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstall = e;
  document.getElementById('install-banner').classList.add('visible');
});

// ════════════════════════════════════════════════════════════
// BOOT / EVENT WIRING
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Apply saved theme on boot
  applyTheme(DB.getSettings().darkMode !== false);

  // PIN keypad
  document.querySelectorAll('.pin-key').forEach(k => {
    k.addEventListener('click', () => {
      const v = k.dataset.k;
      if (v === 'del')      { _pinBuffer = _pinBuffer.slice(0, -1); }
      else if (v === 'ok')  { submitPin(); return; }
      else if (_pinBuffer.length < 4) { _pinBuffer += v; }
      updateDots();
      if (_pinBuffer.length === 4) setTimeout(submitPin, 120);
    });
  });

  // Tab nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.addEventListener('click', () => switchTab(n.dataset.tab));
  });

  // History filter chips
  document.querySelectorAll('.filter-chip').forEach(c => {
    c.addEventListener('click', () => renderHistory(c.dataset.filter));
  });

  // Lock / theme buttons
  document.getElementById('lock-btn').addEventListener('click', lockApp);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Install banner
  document.getElementById('install-btn').addEventListener('click', async () => {
    if (!_deferredInstall) return;
    _deferredInstall.prompt();
    const { outcome } = await _deferredInstall.userChoice;
    _deferredInstall = null;
    document.getElementById('install-banner').classList.remove('visible');
    if (outcome === 'accepted') showToast('App installed! 🎉');
  });
  document.getElementById('install-dismiss').addEventListener('click', () => {
    document.getElementById('install-banner').classList.remove('visible');
  });

  // Theme toggle in settings
  document.getElementById('theme-toggle-setting')?.addEventListener('click', toggleTheme);

  // Handle URL deep-link ?tab=deposit etc.
  const urlTab = new URLSearchParams(location.search).get('tab');
  if (urlTab) switchTab(urlTab);
});