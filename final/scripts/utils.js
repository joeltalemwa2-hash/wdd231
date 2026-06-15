// scripts/utils.js — Shared utility functions (ES Module)

/**
 * Format a date string into readable parts
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return {
    day: date.getDate(),
    month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
    full: date.toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  };
}

/**
 * Format UGX currency
 */
export function formatUGX(amount) {
  return `UGX ${amount.toLocaleString()}`;
}

/**
 * Render star rating
 */
export function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  return stars;
}

/**
 * Debounce helper
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Show a loading skeleton in a container
 */
export function showLoading(container, message = 'Loading...') {
  container.innerHTML = `
    <div class="loading-state" role="status" aria-live="polite">
      <div class="spinner" aria-hidden="true"></div>
      <p>${message}</p>
    </div>
  `;
}

/**
 * Show an error message in a container
 */
export function showError(container, message = 'Something went wrong. Please try again.') {
  container.innerHTML = `
    <div class="error-state" role="alert">
      <p>⚠️ ${message}</p>
    </div>
  `;
}

/**
 * Fetch JSON data with error handling
 */
export async function fetchData(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }
  return response.json();
}

/**
 * Get level icon for programs
 */
export function getLevelIcon(level) {
  const icons = {
    'Beginner': '🌱',
    'Intermediate': '🔥',
    'Advanced': '⚡',
    'All Levels': '✨'
  };
  return icons[level] || '💪';
}

/**
 * Get category icon for programs
 */
export function getCategoryIcon(category) {
  const icons = {
    'Full Body': '🏋️',
    'Cardio & Weight Loss': '🏃',
    'Strength': '💪',
    'Performance': '🎯',
    'Yoga & Wellness': '🧘',
    'Postnatal Fitness': '🤱'
  };
  return icons[category] || '🏃';
}