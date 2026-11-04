import { $, $$, prefersReducedMotion } from './dom.js';

const SLIDE_MS = 5200;

// Hero photo rotation: crossfade with a slow push-in, story-style progress
// dots, and a blurred copy of the photo behind the card on wide screens.
// Pauses while the hero is off screen or the tab is hidden.
export function initSlideshow() {
  const hero = $('[data-hero]');
  const slides = $$('[data-slide]');
  const backdrops = $$('[data-slide-backdrop]');
  const dots = $$('[data-slide-dot]');
  const caption = $('[data-slide-caption]');
  if (!hero || slides.length < 2) return;

  const autoplay = !prefersReducedMotion();
  let current = 0;
  let timer = null;
  let inView = true;

  hero.style.setProperty('--slide-duration', `${SLIDE_MS}ms`);

  const show = (index) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((el, n) => el.classList.toggle('is-active', n === current));
    backdrops.forEach((el, n) => el.classList.toggle('is-active', n === current));
    dots.forEach((dot, n) => {
      dot.classList.toggle('is-active', n === current);
      if (n === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (caption) caption.textContent = slides[current].dataset.caption;
  };

  const stop = () => {
    clearTimeout(timer);
    timer = null;
    hero.classList.remove('is-playing');
  };

  const schedule = () => {
    stop();
    if (!autoplay || !inView || document.hidden) return;
    hero.classList.add('is-playing');
    timer = setTimeout(() => {
      show(current + 1);
      schedule();
    }, SLIDE_MS);
  };

  dots.forEach((dot, n) =>
    dot.addEventListener('click', () => {
      show(n);
      schedule();
    })
  );

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', schedule);

  schedule();
}
