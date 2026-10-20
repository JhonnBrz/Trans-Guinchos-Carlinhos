(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- Always-on bits ---------- */

  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const header = $('[data-header]');
  const progress = $('[data-progress]');
  const syncHeader = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  syncHeader();
  window.addEventListener('scroll', syncHeader, { passive: true });
  window.addEventListener('resize', syncHeader);

  /* ---------- Hero slideshow: each photo is hoisted in from below ---------- */

  const slides = $$('[data-slides] img');
  const slideCaption = $('[data-slide-caption]');
  const slideIndex = $('[data-slide-index]');
  let slideCur = 0;
  let slideTimer = null;
  let heroVisible = true;

  const showSlide = (n) => {
    if (n === slideCur) return;
    slides.forEach((s) => s.classList.remove('is-prev'));
    slides[slideCur].classList.remove('is-on');
    slides[slideCur].classList.add('is-prev');
    slides[n].classList.add('is-on');
    slideCaption.textContent = slides[n].dataset.caption;
    slideIndex.textContent = pad(n + 1);
    slideCur = n;
  };
  const stopSlides = () => { clearInterval(slideTimer); slideTimer = null; };
  const startSlides = () => {
    if (reduceMotion || slideTimer || !heroVisible || document.hidden || slides.length < 2) return;
    slideTimer = setInterval(() => showSlide((slideCur + 1) % slides.length), 4600);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      heroVisible = e.isIntersecting;
      heroVisible ? startSlides() : stopSlides();
    }).observe($('.hero'));
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? stopSlides() : startSlides()));
  // give the intro time to land before the first swap
  setTimeout(startSlides, 1800);

  const workWindow = $('[data-work-window]');
  const workTrack = $('[data-work-track]');

  /* ---------- Chat steps ---------- */

  const steps = $$('[data-step]');
  const setStep = (i) => steps.forEach((s, n) => s.classList.toggle('is-active', n === i));

  /* ---------- No animation path ---------- */

  const canAnimate = root.classList.contains('js-anim') && window.gsap && window.ScrollTrigger;
  if (!canAnimate) {
    root.classList.remove('js-anim');
    setStep(2);
    return;
  }

  window.__animReady = true;
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll ---------- */

  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = $(id);
      if (!target) return;
      e.preventDefault();
      const top = id === '#topo' ? 0 : target;
      const offset = id === '#topo' ? 0 : -header.offsetHeight;
      if (lenis) lenis.scrollTo(top, { offset, duration: 1.4 });
      else window.scrollTo({ top: id === '#topo' ? 0 : target.getBoundingClientRect().top + window.scrollY + offset, behavior: 'smooth' });
    });
  });

  /* ---------- Hero ---------- */

  gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
    .fromTo('.hero__line > span', { yPercent: 115, autoAlpha: 1 }, { yPercent: 0, duration: 1.25, stagger: 0.09 })
    .fromTo('[data-hero-fade]', { y: 22, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0.35)
    .fromTo('[data-hoist-drop]', { yPercent: -45, autoAlpha: 1 }, { yPercent: 0, duration: 1.7, ease: 'power3.out' }, 0.15)
    .fromTo('[data-hoist-swing]', { rotation: 1.6 }, { rotation: 0, duration: 3.2, ease: 'elastic.out(1, 0.28)' }, 0.55)
    .fromTo('.dim', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, 1.2);

  const heroScroll = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
  gsap.to('[data-hoist]', { yPercent: -16, ease: 'none', scrollTrigger: heroScroll });
  gsap.to('[data-hero-copy]', { y: -60, ease: 'none', scrollTrigger: heroScroll });

  /* ---------- Ticker ---------- */

  gsap.fromTo('[data-ticker]', { xPercent: 0 }, {
    xPercent: -18,
    ease: 'none',
    scrollTrigger: { trigger: '.ticker', start: 'top bottom', end: 'bottom top', scrub: 0.6 }
  });

  const mm = gsap.matchMedia();

  /* ---------- Work: vertical scroll drives a horizontal reel (desktop) ---------- */

  mm.add('(min-width: 900px)', () => {
    const distance = () => Math.max(0, workTrack.scrollWidth - workWindow.clientWidth);
    const reel = gsap.to(workTrack, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-work-pin]',
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: 0.7,
        invalidateOnRefresh: true
      }
    });

    $$('[data-job]').forEach((job) => {
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

  mm.add('(max-width: 899px)', () => {
    $$('[data-job]').forEach((job) => {
      gsap.fromTo(job, { y: 30, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: workWindow, start: 'top 85%', once: true }
      });
    });
  });

  /* ---------- Capacity: scroll lifts the readout from 30 to 100 t ---------- */

  const capNum = $('[data-cap-num]');
  const ticks = $$('.gauge__ticks li');
  const cap = { v: 30 };
  const renderCap = () => {
    const v = Math.round(cap.v);
    if (capNum.textContent !== String(v)) capNum.textContent = v;
    ticks.forEach((t) => t.classList.toggle('is-on', v >= Number(t.dataset.v)));
  };
  renderCap();

  gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '[data-capacity]', start: 'top top', end: 'bottom bottom', scrub: 0.7 }
  })
    .to({}, { duration: 0.08 })
    .to(cap, { v: 100, duration: 0.84, onUpdate: renderCap }, 0.08)
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

  /* ---------- Chat: the conversation types itself out ---------- */

  const bubbles = $$('[data-bubble]:not([data-reply])');
  const typing = $('[data-typing]');
  const reply = $('[data-reply]');
  const pop = { y: 14, scale: 0.94, autoAlpha: 0 };
  const popTo = { y: 0, scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(1.7)' };
  gsap.set(bubbles, { transformOrigin: '100% 100%' });
  gsap.set([typing, reply], { transformOrigin: '0% 100%' });

  ScrollTrigger.create({
    trigger: '[data-chat]',
    start: 'top 68%',
    once: true,
    onEnter: () => {
      gsap.timeline()
        .call(() => setStep(0))
        .fromTo(bubbles[0], pop, popTo)
        .call(() => setStep(1), null, '+=0.7')
        .fromTo(bubbles[1], pop, popTo, '<')
        .fromTo(bubbles[2], pop, popTo, '+=0.5')
        .fromTo(typing, pop, { ...popTo, duration: 0.35 }, '+=0.45')
        .to(typing, { autoAlpha: 0, duration: 0.2 }, '+=1.3')
        .call(() => setStep(2))
        .fromTo(reply, pop, popTo, '<');
    }
  });

  /* ---------- 20 anos ---------- */

  gsap.fromTo('[data-years-fill]', { clipPath: 'inset(100% 0% 0% 0%)' }, {
    clipPath: 'inset(0% 0% 0% 0%)',
    ease: 'none',
    scrollTrigger: { trigger: '.years', start: 'top 70%', end: 'center 45%', scrub: 0.6 }
  });

  /* ---------- CTA ---------- */

  gsap.fromTo('.cta__line > span', { yPercent: 115, autoAlpha: 1 }, {
    yPercent: 0,
    duration: 1.2,
    stagger: 0.1,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.cta', start: 'top 72%', once: true }
  });

  /* ---------- Generic reveals (created last so pin spacing is known) ---------- */

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) =>
      gsap.fromTo(els, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.95, stagger: 0.09, ease: 'power3.out', overwrite: true })
  });

  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh);
})();
