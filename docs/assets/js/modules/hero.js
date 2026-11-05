import { $, $$, prefersReducedMotion } from './dom.js';

const INTERVAL_MS = 5000;
const RESUME_AFTER_MS = 9000;

// Hero service selector. Each service (obra, indústria, montagem) has a photo,
// a caption and a pre-filled WhatsApp message. Picking a service — or letting
// the autoplay pick it — swaps the photo (it wipes up from the bottom, like a
// load being hoisted) and points the main button at that service's quote.
export function initHero() {
  const hero = $('[data-hero]');
  const chips = $$('[data-service]');
  const slides = $$('[data-slide]');
  const bars = $$('.hero__progress i');
  const caption = $('[data-hero-caption]');
  const cta = $('[data-hero-cta]');
  const ctaLabel = $('[data-hero-cta-label]');
  if (!hero || chips.length !== slides.length) return;

  const autoplay = !prefersReducedMotion();
  let current = 0;
  let timer = 0;
  let resumeTimer = 0;
  let inView = true;

  hero.style.setProperty('--hero-interval', `${INTERVAL_MS}ms`);

  const select = (index) => {
    if (index === current) return;
    slides.forEach((slide) => slide.classList.remove('is-prev'));
    slides[current].classList.replace('is-on', 'is-prev');
    slides[index].classList.add('is-on');

    chips.forEach((chip, n) => {
      chip.classList.toggle('is-active', n === index);
      chip.setAttribute('aria-pressed', String(n === index));
    });
    bars.forEach((bar, n) => {
      bar.classList.toggle('is-done', n < index);
      bar.classList.toggle('is-current', n === index);
    });

    const chip = chips[index];
    caption.textContent = chip.dataset.caption;
    ctaLabel.textContent = chip.dataset.label;
    cta.href = chip.dataset.href;
    current = index;
  };

  const stop = () => {
    clearTimeout(timer);
    hero.classList.remove('is-playing');
  };

  const play = () => {
    stop();
    if (!autoplay || !inView || document.hidden) return;
    // restart the progress bar animation for the current slide
    void hero.offsetWidth;
    hero.classList.add('is-playing');
    timer = setTimeout(() => {
      select((current + 1) % slides.length);
      play();
    }, INTERVAL_MS);
  };

  // A visitor choosing a service takes over; autoplay resumes after a pause.
  const choose = (index) => {
    clearTimeout(resumeTimer);
    stop();
    select(index);
    resumeTimer = setTimeout(play, RESUME_AFTER_MS);
  };

  chips.forEach((chip, index) => {
    chip.addEventListener('click', () => choose(index));
    chip.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') choose(index);
    });
  });

  bars[0]?.classList.add('is-current');

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      inView ? play() : stop();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : play()));

  play();
}
