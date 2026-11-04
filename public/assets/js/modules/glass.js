import { $$, prefersReducedMotion } from './dom.js';

// Liquid glass response, modelled on Apple's controls:
// - a soft light follows the mouse or finger across every glass surface;
// - glass buttons swell a little on hover, grow when pressed, stretch toward
//   the finger while it drags, and spring back with a small overshoot.
// Movement uses the individual `translate` / `scale` properties so it never
// fights GSAP, which animates `transform` on the same elements.

const HOVER_SCALE = 1.03;
const PRESS_SCALE = 1.08;
const DRAG_FOLLOW = 0.16;
const DRAG_LIMIT = 10;
const STIFFNESS = 340;
const DAMPING = 20;
const TOUCH_LINGER_MS = 380;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function initGlass() {
  const animate = !prefersReducedMotion();
  $$('.glass').forEach((surface) => {
    const interactive = surface.matches('a, button');
    const light = createLight(surface);
    const body = interactive && animate ? createSpringBody(surface) : null;

    let pressed = false;
    let hovering = false;
    let origin = { x: 0, y: 0 };
    let dimTimer = 0;

    surface.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      hovering = true;
      light.on(event);
      body?.to({ scale: HOVER_SCALE });
    });

    surface.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      hovering = false;
      pressed = false;
      light.off();
      body?.to({ scale: 1 });
    });

    surface.addEventListener('pointerdown', (event) => {
      clearTimeout(dimTimer);
      pressed = true;
      origin = { x: event.clientX, y: event.clientY };
      light.on(event);
      surface.classList.add('is-pressed');
      body?.to({ scale: PRESS_SCALE });
    });

    surface.addEventListener('pointermove', (event) => {
      light.move(event);
      if (!pressed || !body) return;
      const dx = clamp((event.clientX - origin.x) * DRAG_FOLLOW, DRAG_LIMIT);
      const dy = clamp((event.clientY - origin.y) * DRAG_FOLLOW, DRAG_LIMIT);
      // Stretch along the drag, squeeze across it — like a drop of liquid.
      const stretchX = Math.abs(dx) / DRAG_LIMIT;
      const stretchY = Math.abs(dy) / DRAG_LIMIT;
      body.to({
        x: dx,
        y: dy,
        scaleX: PRESS_SCALE + stretchX * 0.06 - stretchY * 0.03,
        scaleY: PRESS_SCALE + stretchY * 0.06 - stretchX * 0.03
      });
    }, { passive: true });

    const release = (event) => {
      if (!pressed) return;
      pressed = false;
      surface.classList.remove('is-pressed');
      const resting = hovering ? HOVER_SCALE : 1;
      body?.to({ x: 0, y: 0, scale: resting });
      if (event.pointerType !== 'mouse') {
        dimTimer = setTimeout(() => light.off(), TOUCH_LINGER_MS);
      }
    };
    surface.addEventListener('pointerup', release);
    surface.addEventListener('pointercancel', release);
  });
}

function createLight(surface) {
  let frame = 0;
  const move = (event) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
      surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
    });
  };
  return {
    move,
    on(event) {
      move(event);
      surface.classList.add('is-lit');
    },
    off() {
      surface.classList.remove('is-lit');
    }
  };
}

// Critically-underdamped springs for x, y, scaleX, scaleY.
function createSpringBody(element) {
  const keys = ['x', 'y', 'scaleX', 'scaleY'];
  const current = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const velocity = { x: 0, y: 0, scaleX: 0, scaleY: 0 };
  const target = { ...current };
  let running = false;
  let last = 0;

  const render = () => {
    element.style.translate = `${current.x.toFixed(2)}px ${current.y.toFixed(2)}px`;
    element.style.scale = `${current.scaleX.toFixed(4)} ${current.scaleY.toFixed(4)}`;
  };

  const step = (time) => {
    const dt = Math.min(0.032, (time - last) / 1000 || 0.016);
    last = time;
    let settled = true;
    keys.forEach((key) => {
      const force = STIFFNESS * (target[key] - current[key]) - DAMPING * velocity[key];
      velocity[key] += force * dt;
      current[key] += velocity[key] * dt;
      if (Math.abs(target[key] - current[key]) > 0.0005 || Math.abs(velocity[key]) > 0.001) settled = false;
    });
    render();
    if (settled) {
      keys.forEach((key) => { current[key] = target[key]; velocity[key] = 0; });
      render();
      running = false;
      return;
    }
    requestAnimationFrame(step);
  };

  return {
    to({ x = target.x, y = target.y, scale, scaleX, scaleY }) {
      target.x = x;
      target.y = y;
      target.scaleX = scaleX ?? scale ?? target.scaleX;
      target.scaleY = scaleY ?? scale ?? target.scaleY;
      if (!running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(step);
      }
    }
  };
}
