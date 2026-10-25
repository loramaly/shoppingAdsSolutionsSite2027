/* Concept page: SAS Labs options. A reveals its rows on scroll; B plays its
   three steps on its own like stories (a click jumps to a step and pauses
   for a while, hovering does nothing). */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- A: rows appear one by one when the record scrolls into view ---- */
  var rec = document.getElementById('lx-rec');
  if (rec) {
    if (reduce || !('IntersectionObserver' in window)) rec.classList.add('in');
    else {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        rec.classList.add('in');
      }, { threshold: .35 });
      io.observe(rec);
    }
  }

  /* ---- B: auto-playing steps with progress bars ---- */
  var story = document.getElementById('lx-story');
  if (!story) return;
  var bars = [].slice.call(story.querySelectorAll('.lx-bar'));
  var steps = [].slice.call(story.querySelectorAll('.lx-step'));
  var STEP = 4800, PAUSE = 12000;
  var i = 0, start = null, pausedUntil = 0, visible = false;

  function show(k) {
    i = k;
    story.setAttribute('data-s', k);
    steps.forEach(function (s, n) { s.classList.toggle('on', n === k); });
    bars.forEach(function (b, n) {
      b.classList.toggle('on', n === k);
      b.classList.toggle('done', n < k);
      b.querySelector('b').style.width = n < k ? '100%' : '0';
    });
    start = null;
  }

  bars.forEach(function (b, n) {
    b.addEventListener('click', function () {
      show(n);
      bars[n].querySelector('b').style.width = '100%';
      pausedUntil = performance.now() + PAUSE;
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: .4 }).observe(story);
  } else visible = true;

  function tick(now) {
    if (visible && !reduce && now > pausedUntil) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / STEP);
      bars[i].querySelector('b').style.width = (p * 100) + '%';
      if (p >= 1) show((i + 1) % steps.length);
    } else start = null;
    requestAnimationFrame(tick);
  }

  show(0);
  if (reduce) steps.forEach(function (s) { s.classList.add('on'); });
  requestAnimationFrame(tick);
})();
