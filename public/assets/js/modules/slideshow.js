import { $, $$, pad2, prefersReducedMotion } from './dom.js';

const INTERVAL_MS = 4600;
const FIRST_SWAP_DELAY_MS = 1800;

// Hero photo rotation. Each new photo wipes in from the bottom (CSS), as if
// it were being hoisted. Pauses while the hero is off screen or the tab is hidden.
export function initSlideshow() {
  const slides = $$('[data-slides] img');
  const caption = $('[data-slide-caption]');
  const counter = $('[data-slide-index]');
  const hero = $('.hero');
  if (slides.length < 2 || prefersReducedMotion()) return;

  let current = 0;
  let timer = null;
  let heroInView = true;

  const show = (next) => {
    slides.forEach((slide) => slide.classList.remove('is-prev'));
    slides[current].classList.replace('is-on', 'is-prev');
    slides[next].classList.add('is-on');
    if (caption) caption.textContent = slides[next].dataset.caption;
    if (counter) counter.textContent = pad2(next + 1);
    current = next;
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  const start = () => {
    if (timer || !heroInView || document.hidden) return;
    timer = setInterval(() => show((current + 1) % slides.length), INTERVAL_MS);
  };

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      heroInView = entry.isIntersecting;
      heroInView ? start() : stop();
    }).observe(hero);
  }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  setTimeout(start, FIRST_SWAP_DELAY_MS);
}
