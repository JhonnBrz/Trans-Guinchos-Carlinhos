// Runs in <head>, before first paint. Marks that JavaScript is available and,
// unless the visitor prefers reduced motion, lets CSS hide the elements that
// the motion layer will animate in.
(function () {
  var root = document.documentElement;
  root.classList.replace('no-js', 'js');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('js-anim');

  // If the animation libraries never arrive, show the page as it is.
  setTimeout(function () {
    if (root.dataset.motion !== 'ready') root.classList.remove('js-anim');
  }, 4000);
})();
