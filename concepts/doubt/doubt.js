/* CONCEPT · "You've heard it before" — behaviour for the three layouts */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- A · Chat: each pair plays in when it scrolls into view ---------- */
  var chat = document.querySelector('.chat');
  if (chat && 'IntersectionObserver' in window && !reduceMotion) {
    chat.classList.add('js');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -15% 0px' });
    chat.querySelectorAll('.chat-pair').forEach(function (p) { io.observe(p); });
  }

  /* ---------- B · Flip cards: tap to turn; they also turn one by one ---------- */
  var flips = [].slice.call(document.querySelectorAll('.flip'));
  var touched = false;
  function setFlip(card, on) {
    card.classList.toggle('is-flipped', on);
    card.setAttribute('aria-pressed', String(on));
  }
  flips.forEach(function (card) {
    card.addEventListener('click', function () {
      touched = true;                       // the visitor took over: stop the tour
      setFlip(card, !card.classList.contains('is-flipped'));
    });
  });
  if (!reduceMotion && flips.length) {
    var k = 0;
    setInterval(function () {
      if (touched) return;
      flips.forEach(function (c, i) { setFlip(c, i === k); });
      k = (k + 1) % flips.length;
    }, 2200);
  }

  /* ---------- C · Pick a doubt: tabs, auto-play until someone clicks ---------- */
  var ask = document.getElementById('ask');
  if (ask) {
    var tabs = [].slice.call(ask.querySelectorAll('[role="tab"]'));
    var panels = [].slice.call(ask.querySelectorAll('[role="tabpanel"]'));
    var current = 0, timer = null;

    function show(i, focus) {
      current = i;
      tabs.forEach(function (t, j) {
        var on = j === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        // restart the progress line
        var bar = t.querySelector('.bar');
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
      });
      panels.forEach(function (p, j) { p.hidden = j !== i; });
      if (focus) tabs[i].focus();
    }

    function stop() {
      ask.classList.remove('playing');
      clearInterval(timer);
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { stop(); show(i); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!n) return;
        e.preventDefault();
        stop();
        show((current + n + tabs.length) % tabs.length, true);
      });
    });

    if (!reduceMotion) {
      ask.classList.add('playing');
      timer = setInterval(function () { show((current + 1) % tabs.length); }, 4500);
    }
  }
})();
