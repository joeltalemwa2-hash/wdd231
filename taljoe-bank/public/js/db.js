/* ============================================================
   Taljoe Bank — Data Engine  (public/js/db.js)
   All business logic, validation, and localStorage persistence.
   Think of this as your "backend in the browser".
   ============================================================ */

'use strict';

const DB = (() => {

  // ── Storage keys ─────────────────────────────────────────
  const KEY = {
    account:      'tj_account',
    transactions: 'tj_transactions',
    goals:        'tj_goals',
    sacco:        'tj_sacco',
    settings:     'tj_settings',
  };

  // ── Storage helpers ───────────────────────────────────────
  const read  = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now   = () => new Date().toISOString();

  // ── Default seeds ─────────────────────────────────────────
  const defaultAccount  = () => ({ balance: 0, totalDeposited: 0, totalWithdrawn: 0, totalIncome: 0 });
  const defaultSettings = () => ({ name: 'Joel T.', pin: '1234', darkMode: true });

  // ── Validation helpers ────────────────────────────────────
  const requirePositive = (val, label = 'Amount') => {
    const n = parseFloat(val);
    if (!n || n <= 0 || isNaN(n)) throw new Error(`${label} must be greater than 0.`);
    return n;
  };

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════
  return {

    // ── ACCOUNT ────────────────────────────────────────────
    getAccount() {
      return read(KEY.account) || defaultAccount();
    },
    _saveAccount(acc) {
      write(KEY.account, acc);
    },

    // ── SETTINGS ───────────────────────────────────────────
    getSettings() {
      return read(KEY.settings) || defaultSettings();
    },
    saveSettings(patch) {
      write(KEY.settings, { ...this.getSettings(), ...patch });
    },
    verifyPin(pin) {
      return this.getSettings().pin === String(pin).trim();
    },
    changePin(currentPin, newPin) {
      if (!this.verifyPin(currentPin)) throw new Error('Current PIN is incorrect.');
      if (!/^\d{4}$/.test(newPin))    throw new Error('New PIN must be exactly 4 digits.');
      this.saveSettings({ pin: newPin });
    },

    // ── TRANSACTIONS ────────────────────────────────────────
    getTransactions() {
      return read(KEY.transactions) || [];
    },
    _saveTx(txs) {
      write(KEY.transactions, txs);
    },

    /**
     * Deposit money into the account.
     * @param {object} opts - { amount, description, category }
     * @returns {object} transaction record
     */
    deposit({ amount, description, category }) {
      const amt = requirePositive(amount);
      const acc = this.getAccount();
      acc.balance        += amt;
      acc.totalDeposited += amt;
      this._saveAccount(acc);
      const tx = { id: uid(), type: 'deposit', amount: amt, description: description || 'Deposit', category: category || 'Other', date: now() };
      this._saveTx([tx, ...this.getTransactions()]);
      return tx;
    },

    /**
     * Withdraw money from the account.
     * @param {object} opts - { amount, description, category }
     * @returns {object} transaction record
     */
    withdraw({ amount, description, category }) {
      const amt = requirePositive(amount);
      const acc = this.getAccount();
      if (amt > acc.balance) throw new Error(`Insufficient balance. You have UGX ${acc.balance.toLocaleString()}.`);
      acc.balance        -= amt;
      acc.totalWithdrawn += amt;
      this._saveAccount(acc);
      const tx = { id: uid(), type: 'withdrawal', amount: amt, description: description || 'Withdrawal', category: category || 'Other', date: now() };
      this._saveTx([tx, ...this.getTransactions()]);
      return tx;
    },

    /**
     * Record income from any source.
     * @param {object} opts - { amount, source, category, addToBalance }
     * @returns {object} transaction record
     */
    addIncome({ amount, source, category, addToBalance }) {
      const amt = requirePositive(amount);
      const acc = this.getAccount();
      acc.totalIncome += amt;
      if (addToBalance) acc.balance += amt;
      this._saveAccount(acc);
      const tx = { id: uid(), type: 'income', amount: amt, description: source || 'Income', category: category || 'Other', addedToBalance: !!addToBalance, date: now() };
      this._saveTx([tx, ...this.getTransactions()]);
      return tx;
    },

    /**
     * Delete a transaction and reverse its effect on balance.
     */
    deleteTransaction(id) {
      const txs = this.getTransactions();
      const tx  = txs.find(t => t.id === id);
      if (!tx) return;
      const acc = this.getAccount();
      if (tx.type === 'deposit')                          { acc.balance -= tx.amount; acc.totalDeposited -= tx.amount; }
      if (tx.type === 'withdrawal')                       { acc.balance += tx.amount; acc.totalWithdrawn -= tx.amount; }
      if (tx.type === 'income' && tx.addedToBalance)      { acc.balance -= tx.amount; acc.totalIncome    -= tx.amount; }
      else if (tx.type === 'income')                      { acc.totalIncome -= tx.amount; }
      acc.balance        = Math.max(0, acc.balance);
      acc.totalDeposited = Math.max(0, acc.totalDeposited);
      acc.totalWithdrawn = Math.max(0, acc.totalWithdrawn);
      acc.totalIncome    = Math.max(0, acc.totalIncome);
      this._saveAccount(acc);
      this._saveTx(txs.filter(t => t.id !== id));
    },

    clearAllTransactions() {
      write(KEY.transactions, []);
      write(KEY.account, defaultAccount());
    },

    // ── ANALYTICS ───────────────────────────────────────────
    getMonthStats() {
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const monthTxs = this.getTransactions().filter(t => new Date(t.date) >= startOfMonth);
      const sum = (type) => monthTxs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
      const deposits    = sum('deposit');
      const withdrawals = sum('withdrawal');
      const income      = sum('income');
      return { deposits, withdrawals, income, net: income - withdrawals };
    },

    getSpendingByCategory() {
      return this.getTransactions()
        .filter(t => t.type === 'withdrawal')
        .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {});
    },

    // ── GOALS ────────────────────────────────────────────────
    getGoals() {
      return read(KEY.goals) || [];
    },

    addGoal({ name, target, saved = 0 }) {
      if (!name || !name.trim()) throw new Error('Goal name is required.');
      const tgt = requirePositive(target, 'Target amount');
      const sav = parseFloat(saved) || 0;
      const goal = { id: uid(), name: name.trim(), target: tgt, saved: sav, date: now() };
      write(KEY.goals, [goal, ...this.getGoals()]);
      return goal;
    },

    updateGoalSaved(id, amount) {
      const goals = this.getGoals();
      const g     = goals.find(g => g.id === id);
      if (!g) return;
      const amt = requirePositive(amount);
      g.saved   = Math.min(g.target, g.saved + amt);
      write(KEY.goals, goals);
      return g;
    },

    deleteGoal(id) {
      write(KEY.goals, this.getGoals().filter(g => g.id !== id));
    },

    // ── SACCO / INVEST ───────────────────────────────────────
    getSacco() {
      return read(KEY.sacco) || [];
    },

    /**
     * Project SACCO value using simple interest model.
     */
    projectSacco(amount, returnRate, months) {
      return amount * months * (1 + (parseFloat(returnRate) / 100));
    },

    addSacco({ name, amount, returnRate, months, deductFromBalance }) {
      const amt  = requirePositive(amount);
      const rate = parseFloat(returnRate) || 15;
      const mos  = parseInt(months) || 12;

      if (deductFromBalance) {
        const acc = this.getAccount();
        if (amt > acc.balance) throw new Error('Insufficient balance for SACCO deduction.');
        acc.balance        -= amt;
        acc.totalWithdrawn += amt;
        this._saveAccount(acc);
      }

      const projected = this.projectSacco(amt, rate, mos);
      const rec = { id: uid(), name: name || 'SACCO', amount: amt, returnRate: rate, months: mos, projected, deductFromBalance: !!deductFromBalance, date: now() };
      write(KEY.sacco, [rec, ...this.getSacco()]);
      return rec;
    },

    // ── FULL RESET ───────────────────────────────────────────
    resetAll() {
      Object.values(KEY).forEach(k => localStorage.removeItem(k));
    },
  };
})();