import { $, $$ } from './dom.js';

// Scroll-driven motion (GSAP + ScrollTrigger, smoothed by Lenis).
// Everything here is progressive: without the libraries, or with reduced
// motion, the page is complete and static.

const DESKTOP = '(min-width: 900px)';
const MOBILE = '(max-width: 899px)';

export function initMotion() {
  const root = document.documentElement;
  const { gsap, ScrollTrigger, Lenis } = window;

  if (!root.classList.contains('js-anim') || !gsap || !ScrollTrigger) {
    root.classList.remove('js-anim');
    setChatStep(2);
    return;
  }

  root.dataset.motion = 'ready';
  gsap.registerPlugin(ScrollTrigger);

  const lenis = Lenis ? initSmoothScroll(gsap, ScrollTrigger, Lenis) : null;
  initAnchors(lenis);

  const mm = gsap.matchMedia();

  // Order matters: ScrollTrigger measures in creation order, so triggers
  // below the pinned reel must be created after it.
  animateHero(gsap);
  animateTicker(gsap);
  animateWork(gsap, mm);
  animateCapacity(gsap);
  animateChat(gsap, ScrollTrigger);
  animateYears(gsap);
  animateCta(gsap);
  animateReveals(gsap, ScrollTrigger);

  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  window.addEventListener('load', refresh);
}

function initSmoothScroll(gsap, ScrollTrigger, Lenis) {
  const lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

function initAnchors(lenis) {
  if (!lenis) return; // native smooth scrolling + scroll-padding handle it
  const header = $('[data-header]');

  $$('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href');
      const target = id.length > 1 ? document.getElementById(id.slice(1)) : null;
      if (!target) return;
      event.preventDefault();
      const toTop = id === '#topo';
      lenis.scrollTo(toTop ? 0 : target, {
        offset: toTop ? 0 : -header.offsetHeight,
        duration: 1.4
      });
    });
  });
}

function animateHero(gsap) {
  gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
    .fromTo('.hero__line > span', { yPercent: 115, autoAlpha: 1 }, { yPercent: 0, duration: 1.25, stagger: 0.09 })
    .fromTo('[data-hero-fade]', { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.35)
    .fromTo('[data-hoist-drop]', { yPercent: -45, autoAlpha: 1 }, { yPercent: 0, duration: 1.7, ease: 'power3.out' }, 0.15)
    .fromTo('[data-hoist-swing]', { rotation: 1.6 }, { rotation: 0, duration: 3.2, ease: 'elastic.out(1, 0.28)' }, 0.55)
    .fromTo('.dim', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.2);

  // As the page scrolls away, the hanging load keeps climbing.
  const leave = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('[data-hoist]', { yPercent: -16, ease: 'none', scrollTrigger: leave });
  gsap.to('[data-hero-copy]', { y: -60, ease: 'none', scrollTrigger: leave });
}

function animateTicker(gsap) {
  gsap.fromTo('[data-ticker]', { xPercent: 0 }, {
    xPercent: -18,
    ease: 'none',
    scrollTrigger: { trigger: '.ticker', start: 'top bottom', end: 'bottom top', scrub: 0.6 }
  });
}

function animateWork(gsap, mm) {
  const viewport = $('[data-work-window]');
  const track = $('[data-work-track]');
  const jobs = $$('[data-job]');

  // Desktop: vertical scroll drives the reel sideways while the section is pinned.
  mm.add(DESKTOP, () => {
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const reel = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-work-pin]',
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.7,
        invalidateOnRefresh: true
      }
    });

    jobs.forEach((job) => {
      gsap.fromTo($('img', job), { scale: 1.2 }, {
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: job, containerAnimation: reel, start: 'left right', end: 'right 70%', scrub: true }
      });
      gsap.fromTo($('.job__body', job).children, { y: 18, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        stagger: 0.06,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: job, containerAnimation: reel, start: 'left 75%', toggleActions: 'play none none reverse' }
      });
    });
  });

  // Mobile: the reel is a native swipe carousel; just bring the cards in.
  mm.add(MOBILE, () => {
    gsap.fromTo(jobs, { y: 30, autoAlpha: 0 }, {
      y: 0,
      autoAlpha: 1,
      duration: 0.9,
      stagger: 0.08,
      ease: 'power3.out',
      scrollTrigger: { trigger: viewport, start: 'top 85%', once: true }
    });
  });
}

function animateCapacity(gsap) {
  const number = $('[data-cap-num]');
  const ticks = $$('.gauge__ticks li');
  const load = { tonnes: 30 };

  const render = () => {
    const value = Math.round(load.tonnes);
    if (number.textContent !== String(value)) number.textContent = value;
    ticks.forEach((tick) => tick.classList.toggle('is-on', value >= Number(tick.dataset.v)));
  };
  render();

  // Short holds at both ends so 30 t and 100 t each get a moment on screen.
  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '[data-capacity]', start: 'top top', end: 'bottom bottom', scrub: 0.7 }
  })
    .to({}, { duration: 0.08 })
    .to(load, { tonnes: 100, duration: 0.84, onUpdate: render }, 0.08)
    .fromTo('[data-gauge-fill]', { scaleX: 0 }, { scaleX: 1, duration: 0.84 }, 0.08)
    .fromTo('[data-gauge-runner]', { xPercent: 0 }, { xPercent: 100, duration: 0.84 }, 0.08)
    .to({}, { duration: 0.08 });

  gsap.fromTo('.capacity__readout, .capacity__copy', { y: 40, autoAlpha: 0 }, {
    y: 0,
    autoAlpha: 1,
    duration: 1,
    stagger: 0.12,
    ease: 'power3.out',
    scrollTrigger: { trigger: '[data-capacity]', start: 'top 70%', once: true }
  });
}

function setChatStep(index) {
  $$('[data-step]').forEach((step, n) => step.classList.toggle('is-active', n === index));
}

function animateChat(gsap, ScrollTrigger) {
  const sent = $$('[data-bubble]:not([data-reply])');
  const typing = $('[data-typing]');
  const reply = $('[data-reply]');
  const hidden = { y: 14, scale: 0.94, autoAlpha: 0 };
  const shown = { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.7)' };

  gsap.set(sent, { transformOrigin: '100% 100%' });
  gsap.set([typing, reply], { transformOrigin: '0% 100%' });

  ScrollTrigger.create({
    trigger: '[data-chat]',
    start: 'top 68%',
    once: true,
    onEnter: () => {
      gsap.timeline()
        .call(() => setChatStep(0))
        .fromTo(sent[0], hidden, shown)
        .call(() => setChatStep(1), null, '+=0.7')
        .fromTo(sent[1], hidden, shown, '<')
        .fromTo(sent[2], hidden, shown, '+=0.5')
        .fromTo(typing, hidden, { ...shown, duration: 0.35 }, '+=0.45')
        .to(typing, { autoAlpha: 0, duration: 0.2 }, '+=1.3')
        .call(() => setChatStep(2))
        .fromTo(reply, hidden, shown, '<');
    }
  });
}

function animateYears(gsap) {
  gsap.fromTo('[data-years-fill]', { clipPath: 'inset(100% 0% 0% 0%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)',
    ease: 'none',
    scrollTrigger: { trigger: '.years', start: 'top 70%', end: 'center 45%', scrub: 0.6 }
  });
}

function animateCta(gsap) {
  gsap.fromTo('.cta__line > span', { yPercent: 115, autoAlpha: 1 }, {
    yPercent: 0,
    duration: 1.2,
    stagger: 0.1,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.cta', start: 'top 72%', once: true }
  });
}

function animateReveals(gsap, ScrollTrigger) {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (elements) =>
      gsap.fromTo(elements, { y: 26, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.95,
        stagger: 0.09,
        ease: 'power3.out',
        overwrite: true
      })
  });
}
