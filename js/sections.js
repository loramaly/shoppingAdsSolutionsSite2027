/* ==========================================================================
   SECTIONS · interactive pieces, in page order
   --------------------------------------------------------------------------
    2. Niches + markets   world map dots, hover a market, live clocks
    3. Other weeks        "Now / With SAS" switch
    4. The pain           symptom → cause links
    5. What you want      red line slider
    6. The doubt          strike-through on scroll
    7. The method         tabs, growth chart, creative loop
    8. SAS Labs           Intended / Observed / Measured layers
   10. The fit            checklist meter
   11. First step         timeline reveal
   13. Close              audit form
   Auto-playing parts stop as soon as the visitor interacts with them, and
   never run with prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return [].slice.call((root || document).querySelectorAll(selector)); }

  // Calls back with true/false as the element enters / leaves the viewport
  function watchVisibility(el, threshold, callback) {
    if (!hasIO || !el) return;
    new IntersectionObserver(function (entries) {
      callback(entries[0].isIntersecting);
    }, { threshold: threshold }).observe(el);
  }

  // Stops an auto-play once the visitor hovers, focuses or touches the block
  function stopOnInteraction(el, stop) {
    ['pointerdown', 'focusin', 'mouseenter'].forEach(function (type) {
      el.addEventListener(type, stop, { once: true });
    });
  }


  /* ==========================================================================
     2. NICHES + MARKETS
     ========================================================================== */

  // Dotted world map, run-length encoded: letter = dot type, number = count.
  // o = ocean (no dot) · l = land · u = United States · c = Canada · i = Israel
  var WMAP_RLE = 'o38c1o2c4o2c1o3c4o3c1o16c1o3c6l21o55l3o18l2o1l11o16l1o1l1o69c2o15c1o3c1o16c3l22o50l2o17l1o1l15o84c7o4c1o4c1o1c4o1c2o1c3o1c2o14c2l18o1l1o51l2o11l1o4l26o2l4o34l1o37c2o1c1o1c7o4c1o1c2o2c3o1c8o11c1o1l17o1l2o50l2o8l3o1l1o1l4o1l30o2l1o1l10o32u11o1u1o8c2o7c11o3c3o6c1o1c6o1c1o9c1o1l19o31l4o19l1o5l3o1l58o7l1o5l1o8u17c18o4c1o6c1o2c3o2c2o2c1o3c4o10l17o28l15o4l1o5l1o1l2o1l5o1l3o1l73o1l1o7u14c40o5c8o5c1l12o32l19o4l16o1l71o1l4o3u18c34o1c1o9c4o2c1o7l8o11l7o17l7o2l6o3l94o13u13c35o1c2o8c5o9l7o12l4o19l6o2l8o1l94o11u16c32o6c1o3c1o5c2o10l6o32l8o2l95o1l8o1l1o10u9o1u6c31o11c5o15l4o31l8o3l90o5l6o17u6o1u1o7c30o11c6o2c2o46l8o5l1o1l80o1l3o4l2o26u2o14c27o11c9o38l1o11l3o5l78o11l3o25u2o17c29o8c10o37l2o7l2o2l2o3l78o12l5o22u1o21c32o3c13o33l2o1l2o15l76o14l4o45c32o2c16o30l3o2l2o6l88o10l3o48c31o2c15o30l2o2l4o2l92o9l2o49c45o37l1o3l93o1l1o60c1o1c36o1c2o4c3o35l95o63u28c12o6c2o33l95o64u28c12o42l21o2l1o2l67o65u28c4u6o1c2o41l9o2l9o3l1o2l66o66u28c4u4o41l8o5l2o2l8o8l62o5l2o61u36o41l8o6l3o2l6o2l3o4l58o7l1o63u34o43l6o10l1o2l2o3l62o1l5o7l2o63u32o44l6o14l2o2l60o5l3o7l1o65u30o47l3o7l1o7l1o3l64o3l1o6l2o65u30o47l1o2l8o17l56o4l2o3l5o67u27o47l12o17l56o7l1o1l2o71u24o48l16o4l1o8i1l57o6l1o74l1o2l4u17o47l19o1l6o1l3i1l57o82l1o1l4u8o2u1o4u2o47l30i1l8o2l47o83l1o1l7u2o10u1o43l1o2l30o1l10o1l47o84l1o1l6u2o10u2l2o42l32o1l9o5l42o85l1o2l7o55l33o2l9o3l1o6l35o87l1o2l6o54l35o2l13o7l32o2l1o52l1o36l5o11l2o41l36o1l14o6l14o1l15o4l1o89l5o5l2o7l1o39l36o1l13o10l9o4l9o2l1o96l6o3l3o9l3o35l36o2l12o10l7o6l8o2l2o98l9o48l37o2l9o12l6o8l8o9l1o94l1o1l4o48l37o3l6o14l5o9l1o1l7o8l1o98l6o44l39o1l4o17l3o12l8o109l2o45l39o1l1o20l4o12l7o9l1o100l1o7l1o1l1o36l39o4l1o16l3o12l1o3l4o8l1o1l1o99l2o5l2o1l5o33l43o17l2o12l1o4l1o12l1o101l2o2l11o31l43o17l1o1l1o11l2o15l2o104l13o31l41o20l2o7l1o3l1o16l1o5l1o98l16o30l6o3l29o31l1o3l2o8l2o1l1o108l17o40l26o32l2o1l2o7l2o6l1o103l18o41l24o34l2o1l1o5l5o108l20o39l23o37l4o3l6o1l2o3l1o100l22o38l22o39l3o3l5o10l1o97l24o36l21o40l4o2l5o1l2o7l1o2l2o93l28o33l20o41l3o5l2o3l1o2l2o3l7o5l1o84l29o33l19o42l2o20l6o89l31o31l18o45l1o17l1o2l7o4l1o83l30o32l17o47l3o10l1o5l4o1l2o89l28o33l17o53l1o18l1o1l1o5l2o80l27o34l18o162l26o34l18o60l4o3l2o29l1o63l25o34l19o5l1o51l1o1l5o3l2o94l24o34l19o4l3o49l8o3l3o95l22o34l18o3l4o50l10o1l3o96l21o34l16o5l4o48l16o96l20o36l14o7l3o46l20o94l20o36l14o6l3o45l23o10l1o82l18o39l14o5l3o44l25o92l16o41l13o6l3o44l25o92l15o42l12o54l26o91l15o42l12o54l26o90l15o44l10o55l26o90l14o46l8o57l25o90l13o47l7o58l9o3l13o90l13o47l6o59l6o7l11o91l10o116l1o12l9o15l1o75l11o131l7o91l11o132l2o1l1o19l2o72l8o157l2o73l7o138l1o1l1o93l6o139l2o15l2o74l6o156l3o76l4o156l3o77l4o235l6o234l5o236l3o236l4o238l1o1l2o404';

  (function drawWorldMap() {
    var group = document.getElementById('mapdots');
    if (!group) return;
    var COLS = 240, CELL = 5;
    var re = /([a-z])(\d+)/g, match, index = 0, out = [];

    while ((match = re.exec(WMAP_RLE))) {
      var type = match[1], count = +match[2];
      if (type !== 'o') {
        for (var k = 0; k < count; k++) {
          var j = index + k;
          var y = ((j / COLS) | 0) * CELL + 2.5;
          if (y > 405) break;
          var x = (j % COLS) * CELL + 2.5;
          out.push('<circle class="d ' + type + '" cx="' + x + '" cy="' + y + '" r="' + (type === 'l' ? 1.3 : 1.75) + '"/>');
        }
      }
      index += count;
    }
    group.innerHTML = out.join('');
  })();

  (function marketCards() {
    var map = document.getElementById('wmap');
    if (!map) return;
    $$('.mc').forEach(function (card) {
      var on = function () { map.setAttribute('data-m', card.getAttribute('data-m')); };
      var off = function () { map.setAttribute('data-m', ''); };
      card.addEventListener('mouseenter', on);
      card.addEventListener('focus', on);
      card.addEventListener('mouseleave', off);
      card.addEventListener('blur', off);
    });
  })();

  (function clocks() {
    var els = $$('[data-tz]');
    function tick() {
      els.forEach(function (el) {
        try {
          el.textContent = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: el.getAttribute('data-tz')
          }).format(new Date());
        } catch (e) { /* unknown time zone: keep placeholder */ }
      });
    }
    tick();
    setInterval(tick, 20000);
  })();


  /* ==========================================================================
     3. OTHER WEEKS · one switch flips all four boards
     ========================================================================== */
  (function weekSwitch() {
    var week = document.getElementById('week');
    var btnNow = document.getElementById('w-now');
    var btnSas = document.getElementById('w-sas');
    if (!week) return;
    var touched = false;

    function set(view) {
      week.setAttribute('data-v', view);
      btnNow.setAttribute('aria-pressed', String(view === 'now'));
      btnSas.setAttribute('aria-pressed', String(view === 'sas'));
      // Restart the line-drawing animation of the visible state
      $$('.v-' + view + ' .draw', week).forEach(function (path) {
        path.style.animation = 'none';
        path.getBoundingClientRect();
        path.style.animation = '';
      });
    }

    btnNow.addEventListener('click', function () { touched = true; set('now'); });
    btnSas.addEventListener('click', function () { touched = true; set('sas'); });

    // First time in view: show "Now", then flip to "With SAS" once
    if (!reduceMotion && hasIO) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        set('now');
        setTimeout(function () { if (!touched) set('sas'); }, 1800);
      }, { threshold: .3 });
      io.observe(week);
    }
  })();


  /* ==========================================================================
     4. THE PAIN · symptoms linked to their causes
     ========================================================================== */
  (function symptomTree() {
    var tree = document.getElementById('tree');
    var svg = document.getElementById('links');
    if (!tree) return;

    var CAUSES_OF = {
      s1: ['c1', 'c3'],
      s2: ['c2'],
      s3: ['c1', 'c3', 'c4'],
      s4: ['c1'],
      s5: ['c5']
    };
    var NS = 'http://www.w3.org/2000/svg';
    var symptoms = $$('.sym', tree);
    var causes = $$('.cause', tree);
    var active = 's1';
    var auto = !reduceMotion;

    function wide() { return window.innerWidth >= 768; }

    // Curved connector lines (only when symptoms and causes sit side by side)
    function drawLinks() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (!wide()) { paint(); return; }

      var box = tree.getBoundingClientRect();
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);

      symptoms.forEach(function (sym) {
        var s = sym.getBoundingClientRect();
        var id = sym.getAttribute('data-s');
        CAUSES_OF[id].forEach(function (causeId) {
          var c = $('[data-c="' + causeId + '"]', tree).getBoundingClientRect();
          var x1 = s.right - box.left, y1 = s.top + s.height / 2 - box.top;
          var x2 = c.left - box.left, y2 = c.top + c.height / 2 - box.top;
          var mx = (x1 + x2) / 2;
          var path = document.createElementNS(NS, 'path');
          path.setAttribute('d', 'M' + x1 + ' ' + y1 + ' C ' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2);
          path.setAttribute('data-s', id);
          svg.appendChild(path);
        });
      });
      paint();
    }

    function paint() {
      symptoms.forEach(function (s) {
        s.setAttribute('aria-pressed', String(s.getAttribute('data-s') === active));
      });
      causes.forEach(function (c) {
        c.classList.toggle('on', CAUSES_OF[active].indexOf(c.getAttribute('data-c')) > -1);
      });
      $$('path', svg).forEach(function (p) {
        p.classList.toggle('on', p.getAttribute('data-s') === active);
      });
    }

    function select(sym) {
      auto = false;
      active = sym.getAttribute('data-s');
      paint();
    }

    symptoms.forEach(function (sym) {
      sym.addEventListener('click', function () { select(sym); });
      sym.addEventListener('mouseenter', function () { if (wide()) select(sym); });
    });
    stopOnInteraction(tree, function () { auto = false; });

    drawLinks();
    window.addEventListener('resize', drawLinks);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLinks);

    // Cycle through the symptoms until the visitor takes over
    var order = ['s1', 's2', 's3', 's4', 's5'], i = 0;
    setInterval(function () {
      if (!auto) return;
      i = (i + 1) % order.length;
      active = order[i];
      paint();
    }, 3200);
  })();


  /* ==========================================================================
     5. WHAT YOU WANT · red line slider
     Return per dollar falls as spend rises; past the red line growth costs margin.
     ========================================================================== */
  (function redLine() {
    var slider = document.getElementById('rl-slider');
    if (!slider) return;
    var msg = document.getElementById('rl-msg');
    var dot = document.getElementById('rl-dot');
    var guide = document.getElementById('rl-v');
    var clip = document.getElementById('rl-clip');

    var X0 = 40, X1 = 880, Y0 = 290, Y1 = 40, RED = 2.5;

    function efficiency(t) { return 1.6 + 4.2 * Math.exp(-t / 40); }
    function toY(v) { return Y0 - (v - 1) / (6 - 1) * (Y0 - Y1); }
    function toX(t) { return X0 + t / 100 * (X1 - X0); }

    // Build the curve and the area under it once
    var line = '', area = 'M' + X0 + ' ' + Y0;
    for (var t = 0; t <= 100; t++) {
      var px = toX(t).toFixed(1), py = toY(efficiency(t)).toFixed(1);
      line += (t ? ' L' : 'M') + px + ' ' + py;
      area += ' L' + px + ' ' + py;
    }
    area += ' L' + X1 + ' ' + Y0 + ' Z';
    document.getElementById('rl-curve').setAttribute('d', line);
    document.getElementById('rl-area').setAttribute('d', area);

    var redY = toY(RED);
    var red = document.getElementById('rl-red');
    red.setAttribute('y1', redY);
    red.setAttribute('y2', redY);
    document.getElementById('rl-redlabel').setAttribute('y', redY - 12);

    function update() {
      var t = +slider.value, x = toX(t), y = toY(efficiency(t));
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      guide.setAttribute('y1', y);
      guide.setAttribute('y2', Y0);
      clip.setAttribute('width', Math.max(0, x - X0));

      var over = efficiency(t) < RED;
      dot.setAttribute('fill', over ? '#FF5C6A' : '#F2893A');
      msg.textContent = over
        ? 'Past your red line. Growth now costs margin.'
        : (efficiency(t) - RED < .35 ? 'Close to your red line. Scale carefully.' : 'Room to scale profitably.');
      msg.classList.toggle('bad', over);
      slider.setAttribute('aria-valuetext', msg.textContent);
    }

    slider.addEventListener('input', update);
    update();
  })();


  /* ==========================================================================
     6. THE DOUBT · strike through each objection as it scrolls into view
     ========================================================================== */
  (function objections() {
    var rows = $$('.o');
    if (reduceMotion || !hasIO) {
      rows.forEach(function (r) { r.classList.add('seen'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('seen');
        io.unobserve(e.target);
      });
    }, { threshold: .6 });
    rows.forEach(function (r) { io.observe(r); });
  })();


  /* ==========================================================================
     7. THE METHOD
     ========================================================================== */

  /* ---- 7a. Tabs: The growth / The loop (arrow keys move between tabs) ---- */
  (function methodTabs() {
    var tabs = $$('.cr-tabs [role="tab"]');
    if (!tabs.length) return;

    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') next = tabs[(i + tabs.length - 1) % tabs.length];
        if (e.key === 'Home') next = tabs[0];
        if (e.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next);
        next.focus();
      });
    });
  })();

  /* ---- 7b. Growth chart: 30 tests, the running total ---- */
  (function growthChart() {
    var gw = document.getElementById('gw');
    if (!gw) return;

    // Pre-computed chart data (x, y of the running-total line; per-test values)
    var PTS = [[48, 190], [61.9, 200.6], [89.6, 209.4], [117.3, 222.6], [145.1, 232.2], [172.8, 243.7], [200.5, 252.5], [228.3, 264.8], [256.0, 275.4], [283.7, 222.6], [311.5, 224.3], [339.2, 229.6], [366.9, 230.5], [394.7, 234.0], [422.4, 236.6], [450.1, 241.0], [477.9, 241.9], [505.6, 243.7], [533.3, 247.2], [561.1, 186.5], [588.8, 181.2], [616.5, 174.2], [644.3, 171.5], [672.0, 165.4], [699.7, 161.0], [727.5, 155.7], [755.2, 87.0], [782.9, 75.6], [810.7, 60.6], [838.4, 47.4], [866.1, 33.4]];
    var CUM = [-1.2, -2.2, -3.7, -4.8, -6.1, -7.1, -8.5, -9.7, -3.7, -3.9, -4.5, -4.6, -5.0, -5.3, -5.8, -5.9, -6.1, -6.5, 0.4, 1.0, 1.8, 2.1, 2.8, 3.3, 3.9, 11.7, 13.0, 14.7, 16.2, 17.8];
    var VALS = [-1.2, -1.0, -1.5, -1.1, -1.3, -1.0, -1.4, -1.2, 6, -1.1, -1.5, -1.0, -1.3, -1.2, -1.4, -1.0, -1.1, -1.3, 6, -1.2, -1.0, -1.5, -1.1, -1.3, -1.2, 6, -1.4, -1.0, -1.2, -1.1];
    var N = 30;

    var bars = $$('.gw-b', gw);
    var line = document.getElementById('gw-line');
    var dot = document.getElementById('gw-dot');
    var tag = document.getElementById('gw-tag');
    var range = document.getElementById('gw-r');
    var out = {
      n: document.getElementById('gw-n'),
      lost: document.getElementById('gw-l'),
      won: document.getElementById('gw-w'),
      total: document.getElementById('gw-t'),
      msg: document.getElementById('gw-msg')
    };

    function show(n) {
      bars.forEach(function (b, i) { b.classList.toggle('off', i >= n); });

      var d = '';
      for (var i = 0; i <= n; i++) d += (i ? ' L' : 'M') + PTS[i][0] + ' ' + PTS[i][1];
      line.setAttribute('d', d);

      var p = PTS[n];
      dot.setAttribute('cx', p[0]);
      dot.setAttribute('cy', p[1]);
      tag.setAttribute('transform', 'translate(' + Math.min(Math.max(p[0], 70), 830) + ' ' + p[1] + ')');

      var wins = 0;
      for (var k = 0; k < n; k++) if (VALS[k] > 0) wins++;
      var total = CUM[n - 1];

      out.n.textContent = n;
      out.lost.textContent = n - wins;
      out.won.textContent = wins;
      out.total.textContent = total >= 0 ? 'above break-even' : 'below break-even';

      var text, tone;
      if (wins === 0) { text = 'Judge it now and the loop looks like pure cost.'; tone = 'neg'; }
      else if (total < 0) { text = 'A winner arrived. It keeps earning while the tests go on.'; tone = 'neg'; }
      else if (n < N) { text = 'The winners are now paying for every loss.'; tone = 'pos'; }
      else { text = wins + ' winners out of ' + N + ' paid for every loss. Now they drive the growth.'; tone = 'pos'; }
      out.msg.textContent = text;
      out.msg.className = 'gw-msg ' + tone;
    }

    // Phones: stretch the chart and move labels below it
    var svg = $('.gw-board svg', gw);
    function fit() {
      var compact = window.innerWidth < 768;
      svg.classList.toggle('compact', compact);
      svg.setAttribute('preserveAspectRatio', compact ? 'none' : 'xMidYMid meet');
    }
    fit();
    window.addEventListener('resize', fit);

    // Plays 1 → 30 the first time the chart is seen
    var playing = false, timer = 0, touched = false, wasVisible = false;
    function play() {
      clearInterval(timer);
      playing = true;
      var n = 1;
      range.value = n;
      show(n);
      timer = setInterval(function () {
        if (!playing) { clearInterval(timer); return; }
        n++;
        range.value = n;
        show(n);
        if (n >= N) { playing = false; clearInterval(timer); }
      }, 170);
    }

    range.addEventListener('input', function () {
      touched = true;
      playing = false;
      clearInterval(timer);
      show(+range.value);
    });

    show(N);

    if (!reduceMotion) {
      watchVisibility($('.gw-board', gw), .45, function (visible) {
        if (visible && !wasVisible && !touched) play();
        wasVisible = visible;
      });
    }
  })();

  /* ---- 7c. Creative loop: 7 steps, a comet travels between nodes ---- */
  (function creativeLoop() {
    var root = document.getElementById('cl');
    if (!root) return;

    var nodes = $$('.cl-node', root);
    var labels = $$('.cl-lab', root);
    var panels = $$('.cl-step', root);
    var comet = document.getElementById('cl-comet');
    var counter = document.getElementById('cl-cn');
    var title = document.getElementById('cl-ct');

    var names = labels.map(function (l) { return l.textContent; });
    var positions = nodes.map(function (n) {
      var m = /translate\(([\d.]+) ([\d.]+)\)/.exec(n.getAttribute('transform'));
      return [+m[1], +m[2]];
    });

    var current = 0, auto = !reduceMotion, inView = false, raf = 0, visited = [];

    function placeComet(x, y) {
      comet.setAttribute('cx', x.toFixed(1));
      comet.setAttribute('cy', y.toFixed(1));
    }

    // Step 7 (Next brief) loops back to step 3 (Create)
    function nextOf(i) { return i === 6 ? 2 : i + 1; }

    function go(i) {
      var from = current;
      current = i;
      if (visited.indexOf(i) < 0) visited.push(i);

      nodes.forEach(function (n, k) {
        n.classList.toggle('on', k === i);
        n.classList.toggle('done', k !== i && visited.indexOf(k) > -1);
        n.setAttribute('aria-pressed', String(k === i));
      });
      labels.forEach(function (l, k) { l.classList.toggle('on', k === i); });
      panels.forEach(function (p, k) { p.classList.toggle('on', k === i); });
      counter.textContent = ('0' + (i + 1)).slice(-2) + ' / 07';
      title.textContent = names[i];

      // Animate the comet along the connecting path
      cancelAnimationFrame(raf);
      var seg = document.getElementById('cls-' + from + '-' + i), reverse = false;
      if (!seg) {
        seg = document.getElementById('cls-' + i + '-' + from);
        reverse = !!seg;
      }
      if (reduceMotion || !seg || from === i) {
        placeComet(positions[i][0], positions[i][1]);
        return;
      }

      var length = seg.getTotalLength(), start = performance.now(), duration = Math.max(450, length * 3.2);
      (function tick(now) {
        var p = Math.min(1, (now - start) / duration);
        p = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // ease in-out
        var pt = seg.getPointAtLength((reverse ? 1 - p : p) * length);
        placeComet(pt.x, pt.y);
        if (p < 1) raf = requestAnimationFrame(tick);
      })(start);
    }

    function stopAuto() { auto = false; }

    nodes.forEach(function (node, k) {
      node.addEventListener('click', function () { stopAuto(); go(k); });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          stopAuto();
          go(k);
        }
      });
    });

    document.getElementById('cl-prev').addEventListener('click', function () {
      stopAuto();
      go(current === 2 && visited.indexOf(6) > -1 ? 6 : Math.max(0, current - 1));
    });
    document.getElementById('cl-next').addEventListener('click', function () {
      stopAuto();
      go(nextOf(current));
    });
    stopOnInteraction(root, stopAuto);

    go(0);
    watchVisibility(root, .35, function (visible) { inView = visible; });
    setInterval(function () { if (auto && inView) go(nextOf(current)); }, 4600);
  })();


  /* ==========================================================================
     8. SAS LABS · Intended / Observed / Measured
     ========================================================================== */
  (function labsLayers() {
    var lb = document.getElementById('lb');
    if (!lb) return;
    var buttons = $$('.lb-tog button', lb);
    var ORDER = ['int', 'obs', 'mea'];
    var auto = !reduceMotion, inView = false;

    function set(layer) {
      lb.setAttribute('data-l', layer);
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-l') === layer));
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        auto = false;
        set(b.getAttribute('data-l'));
      });
    });
    stopOnInteraction(lb, function () { auto = false; });

    watchVisibility(lb, .4, function (visible) { inView = visible; });
    setInterval(function () {
      if (!auto || !inView) return;
      var i = ORDER.indexOf(lb.getAttribute('data-l'));
      set(ORDER[(i + 1) % ORDER.length]);
    }, 5200);
  })();


  /* ==========================================================================
     10. THE FIT · checklist fills the meter
     ========================================================================== */
  (function fitMeter() {
    var boxes = $$('#checks input');
    if (!boxes.length) return;
    var arc = document.getElementById('arc');
    var score = document.getElementById('score');
    var verdict = document.getElementById('verdict');
    var why = document.getElementById('why');
    var ARC_LENGTH = 314.2;

    function update() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      arc.setAttribute('stroke-dashoffset', (ARC_LENGTH * (1 - n / 6)).toFixed(1));
      score.textContent = n + '/6';

      if (n === 0) {
        verdict.textContent = "Tick what's true.";
        why.textContent = 'There are no wrong answers. Some just mean "not yet".';
      } else if (n <= 3) {
        verdict.textContent = 'Maybe not yet.';
        why.textContent = "That's fine. The cases above are free to read, and we'll be here.";
      } else if (n <= 5) {
        verdict.textContent = "Close. Let's talk.";
        why.textContent = 'The scoping call is where we find out together.';
      } else {
        verdict.textContent = 'Sounds like a fit.';
        why.textContent = 'Book the scoping call below.';
      }
    }

    boxes.forEach(function (b) { b.addEventListener('change', update); });
    update();
  })();


  /* ==========================================================================
     11. FIRST STEP · timeline fills in when seen
     ========================================================================== */
  (function timeline() {
    var tl = document.getElementById('tl');
    if (!tl) return;

    $$('.tl-i', tl).forEach(function (item, i) {
      item.style.setProperty('--d', (0.15 + i * 0.42).toFixed(2) + 's');
    });

    if (reduceMotion || !hasIO) return;
    tl.classList.add('arm');
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      tl.classList.add('go');
      io.disconnect();
    }, { threshold: .35 });
    io.observe(tl);
  })();


  /* ==========================================================================
     13. CLOSE · audit form (front-end only; the live page opens a calendar)
     ========================================================================== */
  (function auditForm() {
    var form = document.getElementById('form');
    if (!form) return;
    var name = document.getElementById('f-n');
    var email = document.getElementById('f-e');
    var privacy = document.getElementById('f-p');
    var message = document.getElementById('f-msg');
    var thanks = document.getElementById('thanks');

    function mark(field, invalid) {
      if (invalid) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
      return invalid;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var nameValue = name.value.trim();
      var badName = mark(name, !nameValue);
      var badEmail = mark(email, email.value.trim().indexOf('@') < 1);
      var badPrivacy = mark(privacy, !privacy.checked);

      if (badName || badEmail || badPrivacy) {
        message.textContent = 'Add your name, a work email and agree to the privacy policy.';
        message.classList.add('is-error');
        (badName ? name : badEmail ? email : privacy).focus();
        return;
      }

      form.hidden = true;
      thanks.hidden = false;
      $('h3', thanks).textContent = 'Thanks, ' + nameValue.split(' ')[0] + '. Pick a time.';
      thanks.focus();
    });
  })();
})();
