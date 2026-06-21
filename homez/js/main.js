// ============================================================
// HOMEZ COMMUNITY DEVELOPMENT INITIATIVE — shared site script
// ============================================================

/* ---------- CONFIG: edit these by hand ---------- */
const SITE_CONFIG = {
  whatsappGroupLink: "https://chat.whatsapp.com/REPLACE-WITH-YOUR-GROUP-INVITE-LINK",
  whatsappContactNumber: "256700000000" // replace with your number, no + or spaces
};

/* ---------- Theme (dark / light) ---------- */
(function initTheme() {
  const root = document.documentElement;
  const stored = null; // localStorage not used per artifact/site portability; falls back to system preference
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = window.__homezTheme || (prefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);

  document.addEventListener('DOMContentLoaded', () => {
    const toggleBtns = document.querySelectorAll('[data-theme-toggle]');
    updateToggleLabel(theme, toggleBtns);

    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', theme);
        window.__homezTheme = theme;
        updateToggleLabel(theme, toggleBtns);
      });
    });
  });

  function updateToggleLabel(theme, btns) {
    btns.forEach(btn => {
      const sunIcon = btn.querySelector('.icon-sun');
      const moonIcon = btn.querySelector('.icon-moon');
      const label = btn.querySelector('.toggle-label');
      if (theme === 'dark') {
        if (sunIcon) sunIcon.style.display = 'inline-block';
        if (moonIcon) moonIcon.style.display = 'none';
        if (label) label.textContent = 'Light';
      } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'inline-block';
        if (label) label.textContent = 'Dark';
      }
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    });
  }
})();

/* ---------- Mobile nav ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  const scrim = document.querySelector('.nav-scrim');

  function closeNav() {
    mainNav?.classList.remove('open');
    scrim?.classList.remove('open');
    navToggle?.setAttribute('aria-expanded', 'false');
  }
  function openNav() {
    mainNav?.classList.add('open');
    scrim?.classList.add('open');
    navToggle?.setAttribute('aria-expanded', 'true');
  }

  navToggle?.addEventListener('click', () => {
    const isOpen = mainNav?.classList.contains('open');
    isOpen ? closeNav() : openNav();
  });
  scrim?.addEventListener('click', closeNav);
  mainNav?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeNav));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
});

/* ---------- Back to top ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.back-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 480);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
});

/* ---------- WhatsApp links wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-whatsapp-link]').forEach(el => {
    el.setAttribute('href', SITE_CONFIG.whatsappGroupLink);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  });
  document.querySelectorAll('[data-whatsapp-contact]').forEach(el => {
    el.setAttribute('href', `https://wa.me/${SITE_CONFIG.whatsappContactNumber}`);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer');
  });
});

/* ---------- Generic form handling (no backend — demo confirmation) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const msg = form.querySelector('.form-msg');
      const submitBtn = form.querySelector('button[type="submit"]');
      if (msg) {
        msg.className = 'form-msg success';
        msg.textContent = form.dataset.successMessage || "Thank you — your submission has been received. Our team will be in touch soon.";
        msg.setAttribute('role', 'status');
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        setTimeout(() => { submitBtn.disabled = false; }, 4000);
      }
      form.reset();
    });
  });
});

/* ---------- Programs filter (programs.html) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const filterBar = document.querySelector('.filter-bar');
  if (!filterBar) return;
  const buttons = filterBar.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('[data-category]');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.category === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
});

/* ---------- Footer year ---------- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-current-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
});