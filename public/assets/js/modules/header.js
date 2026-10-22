import { $ } from './dom.js';

// Sticky header: hairline once the page moves, plus a reading-progress bar.
export function initHeader() {
  const header = $('[data-header]');
  const progress = $('[data-progress]');
  if (!header) return;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (progress) progress.style.transform = `scaleX(${ratio})`;
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

export function initYear() {
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}
