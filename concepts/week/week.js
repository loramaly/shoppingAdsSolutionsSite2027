/* ==========================================================================
   CONCEPT · "Your week" calendar
   5 days × 13 hour slots (9:00–19:00 working hours + 3 evening hours).
   Every scroll step assigns each slot one kind of time:
     q  a question on your desk (labelled with its source)
     b  leading the business (Product, Operations, Finance, People)
     h  business on hold, waiting for you
     d  a prepared decision from SAS (short, gold)
     e  free
   Cells are created once; steps only change their class and label, so the
   week visibly re-arranges itself with a soft staggered wave.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  var HOURS = ['9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21'];
  var WORK = 10;                         // first 10 slots are working hours

  var SOURCES = ['Campaigns', 'Creatives', 'Reports', 'Budgets', 'Retention', 'Alerts'];
  var BUSINESS = ['Product', 'Operations', 'Finance', 'People'];

  // One working day per step (10 slots) + which days run into the evening.
  var DAY_PLAN = [
    'qqbqqbqqqb',   // 0: mostly questions, a little business
    'qqhqqhqqqh',   // 1: business on hold
    'qqbqqbqqhq',   // 2: team frees some hours (Product, Operations)
    'dbbbbdbbbb',   // 3: two short decisions a day
    'dbbbbbbbbb'    // 4: one decision, the rest is yours
  ];
  var EVENINGS = [    // evening slots used per day (Mon…Fri)
    [1, 0, 1, 1, 0],
    [3, 3, 2, 3, 3],
    [1, 2, 1, 1, 2],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ];
  var WAITING = [6, 23, 14, 0, 0];       // decisions waiting on you
  var SAS_COUNT = [0, 0, 0, 41, 44];

  var cal = document.getElementById('cal');
  var lane = document.getElementById('lane');
  var steps = [].slice.call(document.querySelectorAll('.wk-step'));
  if (!cal || !lane) return;

  /* ---------- Build the grid once ---------- */
  var cells = [];
  (function build() {
    var html = ['<span class="wk-corner"></span>'];
    DAYS.forEach(function (d) { html.push('<span class="wk-day">' + d + '</span>'); });
    HOURS.forEach(function (h, slot) {
      var evening = slot >= WORK;
      if (slot === WORK) html.push('<span class="wk-after">After hours</span>');
      html.push('<span class="wk-hour' + (evening ? ' is-evening' : '') + '">' + h + ':00</span>');
      DAYS.forEach(function (d, day) {
        html.push('<span class="wk-cell c-e' + (evening ? ' is-evening' : '') +
          '" data-day="' + day + '" data-slot="' + slot + '"><em></em></span>');
      });
    });
    cal.innerHTML = html.join('');
    cells = [].slice.call(cal.querySelectorAll('.wk-cell'));
  })();

  /* ---------- What each slot holds at a given step ---------- */
  function planFor(step) {
    var counters = { q: 0, b: 0, h: 0, d: 0 };
    var srcI = 0, bizI = 0;
    return cells.map(function (cell) {
      var day = +cell.getAttribute('data-day');
      var slot = +cell.getAttribute('data-slot');
      var kind;
      if (slot < WORK) kind = DAY_PLAN[step][slot];
      else kind = (slot - WORK) < EVENINGS[step][day] ? 'q' : 'e';

      var label = '';
      if (kind === 'q') label = SOURCES[(srcI++ + day) % SOURCES.length];
      if (kind === 'b') {
        // With the team (step 2) only Product and Operations are moving
        var pool = step === 2 ? BUSINESS.slice(0, 2) : BUSINESS;
        label = pool[(bizI++ + day) % pool.length];
      }
      if (kind === 'h') label = BUSINESS[(bizI++ + day) % BUSINESS.length] + ' · on hold';
      if (kind === 'd') label = 'Decision';
      if (counters[kind] !== undefined) counters[kind]++;
      return { kind: kind, label: label, counters: counters };
    });
  }

  /* ---------- Apply a step ---------- */
  var current = -1;
  var statQ = document.querySelector('[data-stat="q"]');
  var statB = document.querySelector('[data-stat="b"]');
  var statW = document.querySelector('[data-stat="w"]');
  var sasCount = document.querySelector('[data-sas-count]');
  var teamFill = document.querySelector('[data-team-fill]');
  var teamNote = document.querySelector('[data-team-note]');

  function countUp(el, to, suffix) {
    var from = parseInt(el.textContent, 10) || 0;
    if (reduceMotion || from === to) { el.textContent = to + suffix; return; }
    var start = performance.now(), dur = 700;
    (function tick(now) {
      var p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function setStep(step) {
    if (step === current) return;
    var forward = step > current;
    current = step;

    var plan = planFor(step);
    var totals = plan[plan.length - 1].counters;

    cells.forEach(function (cell, i) {
      var slot = plan[i];
      // Wave: forward steps sweep top-left → bottom-right, backwards reverse
      var order = forward ? i : cells.length - 1 - i;
      cell.style.transitionDelay = reduceMotion ? '0s' : (order * 9) + 'ms';
      cell.className = 'wk-cell c-' + slot.kind + (+cell.getAttribute('data-slot') >= WORK ? ' is-evening' : '');
      cell.querySelector('em').textContent = slot.label;
      cell.title = slot.label;
    });

    countUp(statQ, totals.q, 'h');
    countUp(statB, totals.b, 'h');
    countUp(statW, WAITING[step], '');
    countUp(sasCount, SAS_COUNT[step], '');

    lane.setAttribute('data-who', step === 2 ? 'team' : step >= 3 ? 'sas' : 'none');
    teamFill.style.width = step === 2 ? '100%' : '0%';
    teamNote.textContent = step === 2 ? 'Full · the rest comes back to you' : 'Taking what they can';

    steps.forEach(function (s) { s.classList.toggle('is-on', +s.getAttribute('data-step') === step); });
  }

  /* ---------- Scroll ---------- */
  function pick() {
    var stacked = window.innerWidth < 1024;
    var line = window.innerHeight * (stacked ? .8 : .55);
    var step = 0;
    steps.forEach(function (s) {
      if (s.getBoundingClientRect().top < line) step = +s.getAttribute('data-step');
    });
    setStep(step);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; pick(); });
  }, { passive: true });
  window.addEventListener('resize', pick);

  setStep(0);
  pick();
})();
