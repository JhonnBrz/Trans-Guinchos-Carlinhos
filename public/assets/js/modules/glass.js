import { $$ } from './dom.js';

const SELECTOR = '.glass, .button--glass';
const TOUCH_LINGER_MS = 450;

// Liquid glass response: a soft light follows the mouse or finger across
// each glass surface (CSS reads --glass-x / --glass-y and the .is-lit class).
export function initGlass() {
  $$(SELECTOR).forEach((surface) => {
    let frame = 0;
    let fadeTimer = 0;

    const place = (event) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
        surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
      });
    };

    const light = (event) => {
      clearTimeout(fadeTimer);
      place(event);
      surface.classList.add('is-lit');
    };

    const dim = (event) => {
      const delay = event.pointerType === 'mouse' ? 0 : TOUCH_LINGER_MS;
      fadeTimer = setTimeout(() => surface.classList.remove('is-lit'), delay);
    };

    surface.addEventListener('pointerenter', light);
    surface.addEventListener('pointerdown', light);
    surface.addEventListener('pointermove', place, { passive: true });
    surface.addEventListener('pointerleave', dim);
    surface.addEventListener('pointerup', (event) => event.pointerType !== 'mouse' && dim(event));
    surface.addEventListener('pointercancel', dim);
  });
}
