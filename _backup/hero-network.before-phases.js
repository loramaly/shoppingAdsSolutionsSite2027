/* ==========================================================================
   HERO NETWORK · "Your week" scroll story
   --------------------------------------------------------------------------
   A canvas diagram on the sticky stage, read top → bottom:
       ON YOUR DESK   Campaigns · Creatives · Reports · Budgets · Retention · Alerts
                                  ↓
                     (Your team / SAS appear here)
                                  ↓
                                 You
                                  ↓
       YOUR BUSINESS  Product · Operations · Finance · People

   Captions never change. Each text step changes ONE visible thing:
     0  Lots of questions in, only a trickle passes down to the business
     1  Every link to the business pauses (‖); decisions queue up before it
     2  A team of three takes some work: Product and Operations reopen,
        Finance and People still wait. The team fills up, overflow → you
     3  SAS takes all questions, sends you a few gold decisions; every
        pause lifts and green work flows to the business straight away
     4  The business runs: solid lines, a ✓ on every part of it
   With prefers-reduced-motion the diagram is drawn once per step, no loop.
   Previous horizontal version: _backup/hero-horizontal/hero-network.js
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas = document.getElementById('net');
  var stage = document.getElementById('stage');
  var scrolly = document.getElementById('scrolly');
  if (!canvas || !stage || !scrolly) return;
  var ctx = canvas.getContext('2d');

  /* ---------- Content ---------- */
  var SOURCES = ['Campaigns', 'Creatives', 'Reports', 'Budgets', 'Retention', 'Alerts'];
  var DEPARTMENTS = ['Product', 'Operations', 'Finance', 'People'];

  // Target look for each step: team node, SAS node, "lit" = the business
  // runs (solid lines + ✓), "tall" = diagram height (compact while the middle
  // is empty), "waitDep" = which business links are paused (‖)
  var TARGETS = [
    { team: 0, sas: 0, lit: 0, tall: 0, waitDep: [0, 0, 0, 0] },
    { team: 0, sas: 0, lit: 0, tall: 0, waitDep: [1, 1, 1, 1] },
    { team: 1, sas: 0, lit: 0, tall: 1, waitDep: [0, 0, 1, 1] },
    { team: 0, sas: 1, lit: 0, tall: 1, waitDep: [0, 0, 0, 0] },
    { team: 0, sas: 1, lit: 1, tall: 1, waitDep: [0, 0, 0, 0] }
  ];


  var STATES = [
    'Now · questions flow to you',
    'Now · everything waits for you',
    'Now · your team at capacity',
    'With SAS · routed and handled',
    'With SAS · you lead the business'
  ];

  var ARIA = [
    'Questions from campaigns, creatives, reports, budgets, retention and alerts flow to you.',
    'Questions pile up on you, and product, operations, finance and people wait.',
    'Your team sits in between and fills to capacity; the overflow still reaches you.',
    'SAS takes the questions. Only prepared decisions reach you, and the pile clears.',
    'SAS handles the work, and you lead product, operations, finance and people.'
  ];

  var SPAWN_RATE = [5, 9, 8, 8, 8];       // questions per second, per step
  var PILE_DECAY = [.6, .15, .15, 6, 6];  // how fast the pile on "You" clears

  var COLORS = {
    orange: '#F2893A',
    violet: '#8B5CF6',
    violetLight: '#B8A6F5',
    gold: '#F7B84B',
    green: '#4ADE9B',
    red: '#FF5C6A',
    redLight: '#FF8C96',
    muted: '#9A9EB4',
    ink: '#15162A',
    paper: '#F3F2F8',
    bg: '#111320'
  };

  /* ---------- State ---------- */
  var W = 0, H = 0, compact = false;
  var L = {};            // layout: node positions and sizes
  var particles = [];
  var pile = 0;          // questions waiting on "You"
  var spawnAcc = 0, deptAcc = 0, glow = 0, sasCount = 0, sasPulse = 0;
  var step = -1, time = 0, lastFrame = performance.now(), running = true;
  var tween = { team: 0, sas: 0, lit: 0, tall: 0, ring: 0, waitDep: [0, 0, 0, 0] };
  var queue = [0, 0, 0, 0];            // decisions queued before each pause
  var queueAcc = [0, 0, 0, 0];
  var QUEUE_MAX = 7, PAUSE_T = .55;    // queue length, pause position on the wire
  var intro = reduceMotion ? 99 : 0;   // seconds since the diagram first came into view
  var LINE = 1.3;                      // one stroke width for every wire and outline
  var MIN_LINE = 1;                    // nothing is ever drawn thinner than 1px
  var SHORT = .68;                     // compact diagram height, share of the canvas
  var target = TARGETS[0];

  /* ---------- Helpers ---------- */
  function font(weight, size) {
    return weight + ' ' + size + 'px "Maven Pro", system-ui, sans-serif';
  }

  function monoFont(size, weight) {
    return (weight || 500) + ' ' + size + 'px "JetBrains Mono", ui-monospace, monospace';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // A wire is a cubic bezier stored as [x0,y0, c1x,c1y, c2x,c2y, x1,y1].
  // Dots travel along exactly the same curve that is drawn.
  function bezier(x0, y0, c1x, c1y, c2x, c2y, x1, y1) {
    return [x0, y0, c1x, c1y, c2x, c2y, x1, y1];
  }

  // Fan of wires that lands on one small target (the top of the person's
  // head, or the top of the team / SAS node). Each wire comes in vertically
  // and lands at an offset that mirrors where it started, so the fan is
  // symmetric around the centre line.
  function wireConverge(x0, y0, tx, ty, spread, row) {
    var ex = tx + ((x0 - row.mid) / row.half) * spread;   // -1 … 1 across the row
    var reach = Math.abs(ty - y0) * .5;
    return bezier(x0, y0, x0, y0 + reach, ex, ty - reach * .9, ex, ty);
  }

  // The same fan leaving a point downwards (from under "You" to the business)
  function wireDiverge(sx, sy, x1, y1, spread, row) {
    var ox = sx + ((x1 - row.mid) / row.half) * spread;
    var reach = Math.abs(y1 - sy) * .5;
    return bezier(ox, sy, ox, sy + reach * .9, x1, y1 - reach, x1, y1);
  }

  // Straight vertical link between two nodes
  function wireVertical(x, y0, y1) {
    var my = (y0 + y1) / 2;
    return bezier(x, y0, x, my, x, my, x, y1);
  }

  // Wire stroke: starts white and turns into `endColor` near its end.
  // `taper` thins the line towards the person: 'end' (wire arrives at "You")
  // or 'start' (wire leaves "You"). Drawn in short segments so the width can
  // change along the curve; dash patterns continue across segments.
  function strokeWire(w, endColor, alpha, width, dash, taper) {
    if (alpha <= .004) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    var g = ctx.createLinearGradient(w[0], w[1], w[6], w[7]);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(.55, '#FFFFFF');
    g.addColorStop(1, endColor || '#FFFFFF');
    ctx.strokeStyle = g;
    ctx.lineCap = dash ? 'butt' : 'round';
    if (dash) ctx.setLineDash(dash);

    var SEGMENTS = taper ? 24 : 1, travelled = 0, prev = pointOnWire(w, 0);
    for (var k = 1; k <= SEGMENTS; k++) {
      var t = k / SEGMENTS;
      var pt = taper ? pointOnWire(w, t) : null;
      var thin = taper === 'end' ? t : taper === 'start' ? 1 - t : 0;
      // full width for most of the way, thinner at the person (never < 1px)
      ctx.lineWidth = Math.max(MIN_LINE, width * (1 - .65 * Math.pow(Math.max(0, (thin - .55) / .45), 1.4)));
      ctx.lineDashOffset = travelled;
      ctx.beginPath();
      if (taper) {
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(pt[0], pt[1]);
        travelled += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
        prev = pt;
      } else {
        ctx.moveTo(w[0], w[1]);
        ctx.bezierCurveTo(w[2], w[3], w[4], w[5], w[6], w[7]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointOnWire(w, t) {
    var u = 1 - t;
    var a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [
      a * w[0] + b * w[2] + c * w[4] + d * w[6],
      a * w[1] + b * w[3] + c * w[5] + d * w[7]
    ];
  }

  function wireLength(w) {
    var len = 0, prev = pointOnWire(w, 0);
    for (var i = 1; i <= 16; i++) {
      var pt = pointOnWire(w, i / 16);
      len += Math.hypot(pt[0] - prev[0], pt[1] - prev[1]);
      prev = pt;
    }
    return len;
  }

  // Colour = pressure. Orange while the pile on "You" is manageable,
  // red once it overflows (same rule as the pile dots).
  function loadColor() {
    return pile > 16 ? COLORS.red : COLORS.orange;
  }

  // Mix two hex colours (t = 0 → a, t = 1 → b)
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * t);
    var g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    var bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bl) + ')';
  }

  /* ---------- Intro choreography ----------
     0.0s captions · 0.2s+ the six sources light up one by one ·
     1.0s "You" · 1.3s+ the business · 1.6s questions start: slow, then faster */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // 0 → 1 progress of an element that appears at `delay` over `dur` seconds
  function appear(delay, dur) {
    var p = clamp01((intro - delay) / dur);
    return 1 - Math.pow(1 - p, 3);            // ease-out
  }

  // Question flow ramps up with an ease-in: a trickle first, then a rush
  function flowRamp() {
    var p = clamp01((intro - 1.6) / 3.5);
    return intro < 1.6 ? 0 : .1 + .9 * p * p;
  }

  /* ---------- Layout ---------- */
  function layout() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = rect.width;
    H = rect.height;
    if (!W || !H) return;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    compact = W < 480;
    layoutContent();

    // Where each waiting question settles: scattered around "You" with no
    // shield in between. Later questions land a little further out.
    L.pileMax = compact ? 20 : 48;
    pile = Math.min(pile, L.pileMax);
    L.slots = [];
    for (var k = 0; k < L.pileMax; k++) {
      var reach = L.you.r * (1.05 + Math.random() * (.35 + .9 * k / L.pileMax));
      var ang = Math.random() * Math.PI * 2;
      L.slots.push([Math.cos(ang) * reach, Math.sin(ang) * reach]);
    }
    particles = [];
  }

  // Positions of everything inside the canvas. Runs on resize and every
  // frame while the diagram grows / shrinks (tween.tall).
  function layoutContent() {
    var Hc = H * (SHORT + (1 - SHORT) * tween.tall);   // height in use
    var oy = (H - Hc) / 2;                             // centred vertically
    var fs = compact ? 12 : 14;          // items and row captions share this size
    var pad = compact ? 14 : 24;
    L.fs = fs;
    L.ch = compact ? 24 : 32;            // pill height
    ctx.font = font(600, fs);

    // Captions sit at the start of each row ("ON YOUR DESK:  Campaigns …").
    // On narrow canvases they move onto their own line.
    var labelSize = fs;
    ctx.font = monoFont(labelSize, 700);
    var labelW = Math.max(ctx.measureText('ON YOUR DESK:').width, ctx.measureText('YOUR BUSINESS:').width) + 13;
    ctx.font = font(600, fs);
    L.labelSize = labelSize;
    L.inline = !compact && W - labelW - 24 > 300;   // items zig-zag if they need to
    var xStart = L.inline ? labelW + 18 : 0;

    // A row of items after the caption. If they don't fit in one line they
    // zig-zag over two lines, each in its own column, so every wire still
    // drops straight down without crossing another item.
    function placeRow(names, y, itemPad, maxGap, direction) {
      var widths = names.map(function (n) { return ctx.measureText(n).width + itemPad; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0);
      var room = W - xStart - 2;
      var minGap = compact ? 8 : 10;
      var items = [];
      if (total + minGap * (names.length - 1) <= room) {
        var gap = Math.min(maxGap, (room - total) / (names.length - 1));
        var x = xStart + (room - (total + gap * (names.length - 1))) / 2;
        names.forEach(function (n, i) {
          items.push({ n: n, x: x, y: y, w: widths[i] });
          x += widths[i] + gap;
        });
      } else {
        var col = room / names.length;
        names.forEach(function (n, i) {
          var cx = xStart + col * (i + .5);
          var row = i % 2 ? direction * (L.ch + 10) : 0;
          items.push({ n: n, x: Math.max(2, Math.min(W - 2 - widths[i], cx - widths[i] / 2)), y: y + row, w: widths[i] });
        });
      }
      items.forEach(function (it) { it.cx = it.x + it.w / 2; });
      return items;
    }

    // ON YOUR DESK: plain white words, each with a dot the wires start from
    L.dotGap = compact ? 13 : 17;                       // text centre → its dot
    var srcY = oy + (L.inline ? 22 : 40);
    L.labelTopY = L.inline ? srcY : oy + 12;
    L.src = placeRow(SOURCES, srcY, 0, 9999, 1);
    L.src.forEach(function (s) { s.dotY = s.y + L.dotGap; });
    var srcBottom = Math.max.apply(null, L.src.map(function (s) { return s.dotY; }));

    // YOUR BUSINESS: dashed pills, caption on the same line (or under them)
    var depY = oy + Hc - (L.inline ? 10 : 34) - L.ch / 2;
    L.labelBottomY = L.inline ? depY : oy + Hc - 10;
    L.dep = placeRow(DEPARTMENTS, depY, pad, compact ? 18 : 40, -1);
    var depTop = Math.min.apply(null, L.dep.map(function (d) { return d.y; })) - L.ch / 2;

    // Centre line of the flow = middle of the item rows (the captions on the
    // left push the rows right, so this is not the canvas centre)
    function span(items) {
      var a = Math.min.apply(null, items.map(function (it) { return it.x; }));
      var b = Math.max.apply(null, items.map(function (it) { return it.x + it.w; }));
      return { mid: (a + b) / 2, half: Math.max(1, (b - a) / 2) };
    }
    L.srcSpan = span(L.src);
    L.depSpan = span(L.dep);
    var rowCentre = (L.srcSpan.mid + L.depSpan.mid) / 2;

    // "You" in the middle; the team / SAS node between the desk and you
    var m = Math.min(W, H);
    L.you = {
      r: compact ? Math.max(22, Math.min(28, m * .075)) : Math.max(28, Math.min(48, m * .075)),
      x: rowCentre,
      y: srcBottom + (depTop - srcBottom) * .5
    };
    L.mid = {
      r: compact ? Math.max(18, Math.min(24, m * .06)) : Math.max(22, Math.min(38, m * .06)),
      x: rowCentre
    };
    // Top of the person's head (see drawPerson) and the point under "You"
    L.headTop = L.you.y - L.you.r * .9;
    L.feet = L.you.y + L.you.r * 1.05;
    L.mid.y = srcBottom + (L.headTop - srcBottom) * (.4 + .16 * (tween.sas || 0));   // SAS a bit lower: more air

    // Every route is computed once; drawing and dots share it
    var spreadYou = L.you.r * .32, spreadMid = L.mid.r * .5;
    L.wSrcYou = L.src.map(function (s) { return wireConverge(s.cx, s.dotY, L.you.x, L.headTop - 4, spreadYou, L.srcSpan); });
    L.wSrcMid = L.src.map(function (s) { return wireConverge(s.cx, s.dotY, L.mid.x, L.mid.y - L.mid.r * 1.05, spreadMid, L.srcSpan); });
    // Starts below the team's name so it never crosses it
    L.wMidYou = wireVertical(rowCentre, L.mid.y + L.mid.r * 1.35, L.headTop - 4);
    L.wYouDep = L.dep.map(function (d) { return wireDiverge(L.you.x, L.feet, d.cx, d.y - L.ch / 2, spreadYou, L.depSpan); });

  }

  /* ---------- Simulation ---------- */
  // kind: 'q' question · 'd' prepared decision · 'g' your attention, to the business
  // route: 'wSrcYou' | 'wSrcMid' | 'wYouDep' (with index) or 'wMidYou'.
  // Dots store the route, not the curve, so they stay on their wire while
  // the diagram changes height.
  function routeOf(p) {
    return p.i === undefined ? L[p.route] : L[p.route][p.i];
  }

  function spawn(route, i, kind, to) {
    var p = { route: route, i: i, t: 0, k: kind, to: to };
    p.speed = (compact ? 170 : 260) / (wireLength(routeOf(p)) + 1);
    particles.push(p);
  }

  function isOpen(j) { return target.waitDep[j] < .5; }

  function openDeps() {
    return [0, 1, 2, 3].filter(isOpen);
  }

  // Pass something from "You" down to the business. Open links: it flows
  // through. Paused links: it travels to the pause and joins the queue.
  function passDown(kind) {
    var open = openDeps();
    if (kind === 'g' && open.length) {
      spawn('wYouDep', open[Math.floor(Math.random() * open.length)], 'g', 'dep');
      return;
    }
    var paused = [0, 1, 2, 3].filter(function (j) { return !isOpen(j); });
    if (paused.length) {
      var j = paused[Math.floor(Math.random() * paused.length)];
      if (queue[j] < QUEUE_MAX) spawn('wYouDep', j, 'w', 'queue');
    }
  }

  function arrive(p) {
    if (p.to === 'you') {
      if (p.k === 'q') {
        pile = Math.min(L.pileMax, pile + 1);
        // You manage to hand on a little: a trickle when the way is open,
        // a growing queue where it is paused
        if (step === 0 && Math.random() < .2) passDown('g');
        if ((step === 1 || step === 2) && Math.random() < .35) passDown('w');
      } else if (p.k === 'd') {
        glow = 1;
      }
    } else if (p.to === 'team') {
      // The team handles what it can (that work reaches the open parts of
      // the business); once full, questions bounce on to you
      if (Math.random() < tween.ring) spawn('wMidYou', undefined, 'q', 'you');
      else if (Math.random() < .5) passDown('g');
    } else if (p.to === 'sas') {
      // SAS sends you one prepared decision for every six questions
      sasCount++;
      sasPulse = Math.min(1, sasPulse + .35);
      if (sasCount % 6 === 0) spawn('wMidYou', undefined, 'd', 'you');
    } else if (p.to === 'queue') {
      queue[p.i] = Math.min(QUEUE_MAX, queue[p.i] + 1);
    }
  }

  function simulate(dt) {
    if (!L.src) return;   // canvas had no size yet (hidden / not laid out)
    intro += dt;
    ['team', 'sas', 'lit'].forEach(function (k) {
      tween[k] += (target[k] - tween[k]) * Math.min(1, dt * 3);
    });
    tween.waitDep = tween.waitDep.map(function (v, j) {
      return v + (target.waitDep[j] - v) * Math.min(1, dt * 3);
    });
    // Height (and SAS's lower spot) ease a little slower; re-layout while moving
    var tallBefore = tween.tall, sasBefore = L.sasAt;
    tween.tall += (target.tall - tween.tall) * Math.min(1, dt * 2.2);
    L.sasAt = tween.sas;
    if (Math.abs(tween.tall - tallBefore) > .0005 || Math.abs(L.sasAt - (sasBefore || 0)) > .0005) layoutContent();
    tween.ring = step === 2 ? Math.min(1, tween.ring + dt * .22) : Math.max(0, tween.ring - dt * 1.5);   // team fills up

    spawnAcc += SPAWN_RATE[step] * flowRamp() * dt;
    while (spawnAcc >= 1) {
      spawnAcc--;
      var i = Math.floor(Math.random() * L.src.length);
      if (step <= 1) spawn('wSrcYou', i, 'q', 'you');
      else spawn('wSrcMid', i, 'q', step === 2 ? 'team' : 'sas');
    }

    // With SAS the business gets your attention straight away (green)
    if (step >= 3) {
      deptAcc += (step === 4 ? 3 : 2.4) * dt;
      while (deptAcc >= 1) {
        deptAcc--;
        spawn('wYouDep', Math.floor(Math.random() * L.dep.length), 'g', 'dep');
      }
    }

    // Queues drain once their link reopens: each waiting dot moves on
    queue.forEach(function (n, j) {
      if (n > 0 && isOpen(j)) {
        queueAcc[j] += 4 * dt;
        while (queueAcc[j] >= 1 && queue[j] > 0) {
          queueAcc[j]--;
          queue[j]--;
          var released = { route: 'wYouDep', i: j, t: PAUSE_T, k: 'g', to: 'dep' };
          released.speed = (compact ? 170 : 260) / (wireLength(L.wYouDep[j]) + 1);
          particles.push(released);
        }
      }
    });

    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k];
      p.t += p.speed * dt;
      var end = p.to === 'queue' ? PAUSE_T - .04 * (queue[p.i] + 1) : 1;
      if (p.t >= end) {
        particles.splice(k, 1);
        arrive(p);
      }
    }

    pile = Math.max(0, pile - PILE_DECAY[step] * dt);
    glow = Math.max(0, glow - dt * 1.6);
    sasPulse = Math.max(0, sasPulse - dt * 2.5);
  }

  /* ---------- Drawing ---------- */
  var LABEL_COLOR = 'rgba(255,255,255,.85)';   // all captions white for now

  // Captions are fixed: they name the two ends of the flow, nothing more
  function drawLabels() {
    ctx.save();
    ctx.globalAlpha = appear(0, .5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = monoFont(L.labelSize, 700);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText('ON YOUR DESK:', 0, L.labelTopY);
    ctx.fillText('YOUR BUSINESS:', 0, L.labelBottomY);
    ctx.restore();
  }

  // Where does a route end, and what colour does it turn into there?
  function endColorFor(to) {
    if (to === 'sas') return COLORS.violetLight;
    if (to === 'team') return '#FFFFFF';
    return loadColor();
  }

  function drawWires() {
    var via = Math.max(tween.team, tween.sas);
    var midEnd = tween.sas > tween.team ? COLORS.violetLight : '#FFFFFF';   // into the team: white

    L.src.forEach(function (s, i) {
      var on = appear(.35 + i * .14, .6);
      strokeWire(L.wSrcYou[i], loadColor(), .45 * (1 - via) * on, LINE, null, 'end');
      strokeWire(L.wSrcMid[i], midEnd, .45 * via * on, LINE, null, 'end');
    });

    strokeWire(L.wMidYou, tween.sas > .5 ? COLORS.gold : loadColor(), .55 * via, LINE);

    // To the business: dashed white curves (solid once the business runs);
    // a pause sign (‖) with a queue of waiting decisions where it is on hold
    L.wYouDep.forEach(function (w, j) {
      var on = appear(1.4 + j * .12, .6);
      strokeWire(w, '#FFFFFF', .8 * on, LINE, tween.lit > .6 ? null : [4, 6], 'start');
      for (var k = 0; k < Math.round(queue[j]); k++) {
        var q = pointOnWire(w, PAUSE_T - .04 * (k + 1));
        ctx.fillStyle = COLORS.orange;
        ctx.beginPath();
        ctx.arc(q[0], q[1], compact ? 2.4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tween.waitDep[j] > .02) drawPause(pointOnWire(w, PAUSE_T), tween.waitDep[j] * on);
    });
  }

  function drawPause(pt, alpha) {
    var s = compact ? 9 : 11;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS.bg;
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.redLight;
    ctx.lineWidth = LINE;
    ctx.stroke();
    ctx.fillStyle = COLORS.redLight;
    ctx.fillRect(pt[0] - s * .38, pt[1] - s * .42, s * .26, s * .84);
    ctx.fillRect(pt[0] + s * .12, pt[1] - s * .42, s * .26, s * .84);
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(function (p) {
      var pt = pointOnWire(routeOf(p), p.t);
      var alpha = Math.min(1, p.t * 6, (1 - p.t) * 6);
      var color, size = compact ? 2.2 : 2.8;

      if (p.k === 'd') {
        color = COLORS.gold;
        size = compact ? 3.4 : 4.4;
      } else if (p.k === 'g') {
        color = step >= 3 ? COLORS.green : '#FFFFFF';   // a trickle of your time, then real flow
      } else if (p.k === 'w') {
        color = COLORS.orange;                          // a decision heading for the queue
      } else {
        // Questions leave white and take on the colour of where they land
        var heat = Math.max(0, (p.t - .45) / .55);
        color = mix('#FFFFFF', p.to === 'you' ? loadColor() : endColorFor(p.to), heat);
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], size, 0, Math.PI * 2);
      ctx.fill();

      if (p.k === 'd') {
        ctx.globalAlpha = alpha * .25;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], compact ? 8 : 11, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  // Plain white words; the dot under each word is where its questions leave
  function drawSources() {
    ctx.font = font(600, L.fs);
    L.src.forEach(function (s, i) {
      var p = appear(.2 + i * .14, .45);
      if (p <= 0) return;
      var flash = p < 1 ? Math.sin(p * Math.PI) : 0;   // brief glow while lighting up

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(0, (1 - p) * -8);                   // drops in from above
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      centeredText(s.n, s.cx, s.y);

      ctx.shadowColor = 'rgba(255,255,255,' + (.9 * flash).toFixed(3) + ')';
      ctx.shadowBlur = 14 * flash;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.cx, s.dotY, compact ? 2.6 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // "Your team": three people who fill up (dim → white, bottom to top) as
  // the work lands on them. Full = "FULL", and questions bounce on to you.
  function drawFilledPerson(x, y, r, level) {
    drawPerson(x, y, r, 'rgba(255,255,255,.28)');
    if (level <= 0) return;
    var top = y - r * .78, bottom = y + r * .5;          // person's height span
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - r, bottom - (bottom - top) * level, r * 2, (bottom - top) * level + 1);
    ctx.clip();
    drawPerson(x, y, r, '#FFFFFF');
    ctx.restore();
  }

  function drawTeamNode() {
    if (tween.team <= .01) return;
    var mid = L.mid, r = mid.r;

    ctx.save();
    ctx.globalAlpha = tween.team;

    // They fill one after another
    var fill = tween.ring * 3;
    drawFilledPerson(mid.x - r * .75, mid.y, r * .85, Math.min(1, fill));
    drawFilledPerson(mid.x, mid.y, r * .85, Math.min(1, Math.max(0, fill - 1)));
    drawFilledPerson(mid.x + r * .75, mid.y, r * .85, Math.min(1, Math.max(0, fill - 2)));

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, compact ? 13 : 15);
    var label = tween.ring > .97 ? 'Your team · full' : 'Your team';
    ctx.fillText(label, mid.x, mid.y + r * .95);
    ctx.restore();
  }

  /* ---------- SAS badge ----------
     The "Ads" plate from the official logo (assets/logos/logoShopping.svg),
     redrawn on canvas with the same outline and the same three gradients,
     carrying "SAS". Coordinates below are the logo file's own units. */
  var BADGE = {
    path: new Path2D('M158.614 72.2608L148.898 87.2413C147.443 89.4838 147.154 92.2894 148.12 94.7847L162.192 131.138C163.723 135.092 167.975 137.272 172.075 136.205L214.331 125.201C216.363 124.672 218.119 123.395 219.248 121.626L230.111 104.606C231.637 102.216 231.841 99.212 230.653 96.6338L215.342 63.4114C213.682 59.8085 209.715 57.8707 205.856 58.7777L163.691 68.6888C161.601 69.1802 159.782 70.4598 158.614 72.2608Z'),
    cx: 190, cy: 98,          // centre of the plate in logo units
    w: 84,                    // plate width in logo units
    base: '#55128A',
    layers: [
      // [gradient matrix a,b,c,d,e,f], [[offset, colour], …], opacity
      [[-14.8172, -70.6185, -52.8233, 28.9887, 191.158, 143.777], [[0, '#FF00E1'], [.81, '#FF9100']], 1],
      [[57.8592, 62.2372, 12.1768, -121.464, 142.047, 76.8899], [[.197, '#FF33BA'], [1, 'rgba(237,66,179,0)']], 1],
      [[47.8764, 35.2472, -7.03536, 285.351, 168.266, 89.0766], [[0, '#FFFFFF'], [1, 'rgba(255,255,255,0)']], .3]
    ]
  };

  // Fill the plate (already clipped) with one radial gradient layer.
  // The logo's gradients are unit circles stretched by a matrix, so we
  // apply that matrix and paint a large square in gradient space.
  function paintBadgeLayer(layer) {
    var m = layer[0];
    ctx.save();
    ctx.globalAlpha *= layer[2];
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    layer[1].forEach(function (stop) { g.addColorStop(stop[0], stop[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, 40, 40);
    ctx.restore();
  }

  function drawSasNode() {
    if (tween.sas <= .01) return;
    var mid = L.mid;
    var still = reduceMotion;

    // Size: the plate is a bit wider than the old circle; it breathes when
    // a question lands (sasPulse) and sways a few degrees while idle.
    var scale = (mid.r * 2.3) / BADGE.w * (1 + sasPulse * .07);
    var tilt = still ? 0 : Math.sin(time * .9) * .05;

    ctx.save();
    ctx.globalAlpha = tween.sas;

    // Purple / magenta glow, as in the logo
    var halo = ctx.createRadialGradient(mid.x, mid.y, mid.r * .4, mid.x, mid.y, mid.r * 2.8);
    halo.addColorStop(0, 'rgba(125,20,208,.55)');
    halo.addColorStop(.55, 'rgba(218,37,156,.16)');
    halo.addColorStop(1, 'rgba(125,20,208,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, mid.r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Move into logo units, centred on the node
    ctx.translate(mid.x, mid.y);
    ctx.rotate(tilt);

    // Dashed orbit: the same outline, larger, marching around the plate
    ctx.save();
    var orbit = scale * 1.34;
    ctx.scale(orbit, orbit);
    ctx.translate(-BADGE.cx, -BADGE.cy);
    ctx.setLineDash([4 / orbit, 7 / orbit]);
    ctx.lineDashOffset = still ? 0 : -time * 20 / orbit;
    ctx.lineWidth = Math.max(MIN_LINE, 1.5) / orbit;
    ctx.strokeStyle = 'rgba(184,166,245,.65)';
    ctx.stroke(BADGE.path);
    ctx.restore();

    ctx.scale(scale, scale);
    ctx.translate(-BADGE.cx, -BADGE.cy);

    // Base colour with a soft drop glow
    ctx.save();
    ctx.shadowColor = 'rgba(125,20,208,.85)';
    ctx.shadowBlur = compact ? 14 : 26;
    ctx.shadowOffsetY = compact ? 3 : 6;
    ctx.fillStyle = BADGE.base;
    ctx.fill(BADGE.path);
    ctx.restore();

    // Gradient layers, clipped to the plate (solid fill, no inner rim line)
    ctx.save();
    ctx.clip(BADGE.path);
    BADGE.layers.forEach(paintBadgeLayer);
    ctx.restore();

    // "SAS" in place of "Ads"
    ctx.fillStyle = '#fff';
    ctx.font = font(700, 25);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(85,18,138,.55)';
    ctx.shadowBlur = 6;
    ctx.fillText('SAS', BADGE.cx, BADGE.cy + 1);

    ctx.restore();
  }

  // Text centred in a pill both ways, using the real glyph box rather than
  // the font's "middle" baseline (which sits high for Maven Pro)
  function centeredText(text, cx, cy) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Centre on the cap height, so descenders (p, g) don't push words up
    var capHeight = ctx.measureText('H').actualBoundingBoxAscent;
    ctx.fillText(text, cx, cy + capHeight / 2);
    ctx.restore();
  }

  // Simple person: round head + rounded shoulders, centred on (x, y)
  function drawPerson(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - r * .5, r * .25, 0, Math.PI * 2);   // head, with a clear neck gap
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * .56, y + r * .42);
    ctx.bezierCurveTo(x - r * .56, y - r * .02, x - r * .3, y - r * .08, x, y - r * .08);
    ctx.bezierCurveTo(x + r * .3, y - r * .08, x + r * .56, y - r * .02, x + r * .56, y + r * .42);
    ctx.quadraticCurveTo(x + r * .56, y + r * .5, x + r * .48, y + r * .5);
    ctx.lineTo(x - r * .48, y + r * .5);
    ctx.quadraticCurveTo(x - r * .56, y + r * .5, x - r * .56, y + r * .42);
    ctx.fill();
  }

  function drawYou() {
    var you = L.you;
    var on = appear(1, .5);
    if (on <= 0) return;

    // Waiting questions, scattered around "You": orange, red once it overflows
    var whole = Math.floor(pile), part = pile - whole, dotSize = compact ? 2.3 : 3;
    for (var i = 0; i <= whole && i < L.pileMax; i++) {
      var a = i < whole ? 1 : part;
      if (a <= 0) continue;
      var slot = L.slots[i];
      ctx.globalAlpha = a;
      ctx.fillStyle = i < 16 ? COLORS.orange : COLORS.red;
      ctx.beginPath();
      ctx.arc(you.x + slot[0], you.y + slot[1], dotSize * (.4 + .6 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var overloaded = pile > 16;
    var strain = overloaded && !reduceMotion ? Math.sin(time * 6) * Math.min(.06, pile / 400) : 0;

    // Gold glow when a prepared decision arrives from SAS
    if (glow > 0) {
      ctx.globalAlpha = glow * .7;
      var g = ctx.createRadialGradient(you.x, you.y, you.r * .3, you.x, you.y, you.r * 2);
      g.addColorStop(0, 'rgba(247,184,75,.6)');
      g.addColorStop(1, 'rgba(247,184,75,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(you.x, you.y, you.r * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // The person, then "You" under it. No circle around: nothing shields you.
    ctx.save();
    ctx.globalAlpha = on;
    ctx.translate(you.x, you.y);
    ctx.scale((.85 + .15 * on) * (1 + strain), (.85 + .15 * on) * (1 + strain));
    // Icon and label share one colour: white, turning red as the pile overflows
    var tone = overloaded ? mix('#FFFFFF', COLORS.redLight, Math.min(1, (pile - 16) / 16)) : '#FFFFFF';
    drawPerson(0, -you.r * .08, you.r, tone);
    ctx.fillStyle = tone;
    ctx.font = font(700, compact ? 16 : 20);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('You', 0, you.r * .74);
    ctx.restore();
  }

  function drawDepartments() {
    ctx.font = font(600, L.fs);
    ctx.textAlign = 'left';
    // Words and dashed outlines are always clearly white
    var a = .85;

    L.dep.forEach(function (d, j) {
      var p = appear(1.3 + j * .12, .45);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(0, (1 - p) * 10);                   // rises in from below
      roundRect(d.x, d.y - L.ch / 2, d.w, L.ch, compact ? 7 : 9);
      ctx.fillStyle = 'rgba(255,255,255,' + (.04 + .06 * tween.lit).toFixed(3) + ')';
      ctx.fill();
      ctx.lineWidth = LINE;
      if (tween.lit < .6) ctx.setLineDash([4, 4]);       // solid once the business runs
      ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - .3 * tween.waitDep[j]).toFixed(3) + ')';
      centeredText(d.n, d.x + d.w / 2, d.y);

      // ✓ badge on the corner when this part of the business runs
      if (tween.lit > .02) {
        var cx = d.x + d.w - 2, cy = d.y - L.ch / 2 + 2, br = compact ? 7 : 8;
        ctx.globalAlpha = p * tween.lit;
        ctx.fillStyle = COLORS.green;
        ctx.beginPath();
        ctx.arc(cx, cy, br, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS.bg;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - br * .45, cy + br * .02);
        ctx.lineTo(cx - br * .1, cy + br * .38);
        ctx.lineTo(cx + br * .48, cy - br * .35);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  function draw() {
    if (!W || !L.src) return;
    ctx.clearRect(0, 0, W, H);
    drawLabels();
    drawWires();
    drawParticles();
    drawSources();
    drawTeamNode();
    drawSasNode();
    drawYou();
    drawDepartments();
  }

  // Reduced motion: jump straight to the end state of the step
  function drawStatic() {
    tween.team = target.team;
    tween.sas = target.sas;
    tween.lit = target.lit;
    tween.waitDep = target.waitDep.slice();
    queue = target.waitDep.map(function (w) { return w * 4; });
    tween.tall = target.tall;
    layoutContent();
    tween.ring = step === 2 ? 1 : 0;
    pile = Math.min(L.pileMax || 30, [4, 40, 40, 0, 0][step]);
    particles = [];
    glow = step >= 3 ? .6 : 0;
    draw();
  }

  /* ---------- Scroll steps ---------- */
  var steps = [].slice.call(scrolly.querySelectorAll('.step'));
  var stateLabel = document.getElementById('stage-state');
  var dots = [].slice.call(document.querySelectorAll('.sdots i'));

  function setStep(i) {
    if (i === step) return;
    step = i;
    target = TARGETS[i];

    // Screen-reader caption for the step (visually hidden)
    stateLabel.textContent = STATES[i];
    canvas.setAttribute('aria-label', ARIA[i]);

    if ((i === 1 || i === 2) && !reduceMotion) pile = Math.max(pile, L.pileMax * .35);

    steps.forEach(function (s) { s.classList.toggle('on', +s.getAttribute('data-i') === i); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });

    if (reduceMotion) drawStatic();
  }

  // The step whose top passes a line in the viewport becomes active.
  // Stacked layout (< 1024px): the stage covers the top, so the line is lower.
  function pickStep() {
    var stacked = window.innerWidth < 1024;
    var line = window.innerHeight * (stacked ? .8 : .55);
    var index = 0;
    steps.forEach(function (s) {
      if (s.getBoundingClientRect().top < line) index = +s.getAttribute('data-i');
    });
    setStep(index);
  }

  /* ---------- Start ---------- */
  scrolly.classList.add('js');
  layout();
  setStep(0);

  if (reduceMotion) {
    drawStatic();
  } else {
    // No pre-warm: the diagram builds itself up (see "Intro choreography")
    draw();

    requestAnimationFrame(function loop(now) {
      var dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      time = now / 1000;
      if (running && W) {
        simulate(dt);
        draw();
      }
      requestAnimationFrame(loop);
    });
  }

  function redraw() {
    layout();
    if (reduceMotion) drawStatic();
    else draw();
  }

  window.addEventListener('resize', redraw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);

  // Pause the animation while the stage is off screen
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { running = e.isIntersecting; });
    }).observe(stage);
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      pickStep();
    });
  }, { passive: true });

  pickStep();
})();
