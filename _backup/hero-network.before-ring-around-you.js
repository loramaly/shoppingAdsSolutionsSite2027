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

   Captions never change. The five text steps share three states (PHASE):
     A  steps 0–1  You alone. Questions keep landing on you and pile up;
                   only now and then does a decision go down to the business.
     B  step 2     Your people: three, each in their own small circle on a
                   shared ring, no links between them. You stay below and
                   ping-pong with each of them; the pile on you still grows.
     C  steps 3–4  SAS in the middle. Everything flows one way and green:
                   SAS → you → the business.
   Parts of the business show a red pause (‖) until SAS arrives, then a ✓.
   Big counts under the diagram (#stage-stats): stuck on you (left, grows
   fast) · tasks done (right, barely moves until SAS).
   (Nothing ever gets stuck on a line: a line down means work was done.)
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

  // Each text step maps to one of three states (see the header comment)
  var PHASE = [0, 0, 1, 2, 2];

  // Target look per state: team node, SAS node, "lit" = business runs
  // (green, solid, ✓ everywhere), "tall" = diagram height
  var LOOK = [
    { team: 0, sas: 0, lit: 0, tall: 0 },
    { team: 1, sas: 0, lit: 0, tall: 1 },
    { team: 0, sas: 1, lit: 1, tall: 1 }
  ];

  // Tasks waiting per business part grow this fast (per second) in each
  // state, and clear this fast once SAS is in
  var WAIT_GROWTH = [.55, .45, 0];
  var WAIT_CLEAR = 2.2;
  var WAIT_WEIGHT = [1, .8, 1.2, .7];   // parts don't fill up at the same pace

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

  var SPAWN_RATE = [7, 8, 8];   // questions per second, per state
  var PILE_DECAY = [.12, .12, 6]; // how fast the pile on "You" clears, per state (barely, until SAS)

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
  var phase = 0;
  var tween = { team: 0, sas: 0, lit: 0, tall: 0 };
  var done = [0, 0, 0, 0];             // tasks done, per business part (green count)
  var waiting = [3, 2, 4, 2];          // tasks waiting for you, per part (red count)
  var passed = 0;                      // decisions that got through (hidden counter ✓)
  var intro = reduceMotion ? 99 : 0;   // seconds since the diagram first came into view
  var LINE = 1.3;                      // one stroke width for every wire and outline
  var MIN_LINE = 1;                    // nothing is ever drawn thinner than 1px
  var SHORT = .84;                     // compact diagram height, share of the canvas
  var RED_AT = 8;                      // pile size after which everything on you turns red
  var SPREAD = 1.25;                   // >1 = outer items of a row spread wider
  var target = LOOK[0];

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
    // Butt caps: tapered wires are drawn in short pieces, and round caps on
    // semi-transparent pieces would overlap into visible dots at each joint
    ctx.lineCap = (dash || taper) ? 'butt' : 'round';
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
    return pile > RED_AT ? COLORS.red : COLORS.orange;
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
    L.pileMax = compact ? 34 : 80;
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

    // Captions sit on their own line: ON YOUR DESK above the desk row,
    // YOUR BUSINESS below the business row, both aligned to the row's start
    L.labelSize = fs;

    // Items are always laid out as a "staircase": two levels, zig-zag, each
    // item in its own column so every wire drops straight down between the
    // others. The rows stay compact and centred instead of spanning the full
    // width on large screens. direction: 1 = second level below, -1 = above.
    function placeRow(names, y, itemPad, maxWidth, direction) {
      var widths = names.map(function (n) { return ctx.measureText(n).width + itemPad; });
      var room = Math.min(W - 4, maxWidth);
      var mid = W / 2, half = room / 2 - room / names.length / 2;
      var step = (compact ? L.ch + 8 : L.ch + 14) * direction;
      return names.map(function (n, i) {
        // -1 … 1 across the row, pushed outwards (power > 1) so the outer
        // items get more room and their wires don't run into their neighbours'
        var t = names.length > 1 ? i / (names.length - 1) * 2 - 1 : 0;
        var cx = mid + Math.sign(t) * Math.pow(Math.abs(t), SPREAD) * half;
        var x = Math.max(2, Math.min(W - 2 - widths[i], cx - widths[i] / 2));
        return { n: n, x: x, y: y + (i % 2 ? step : 0), w: widths[i], cx: x + widths[i] / 2 };
      });
    }

    // ON YOUR DESK: plain white words, each with a dot the wires start from
    L.dotGap = compact ? 13 : 17;                       // text centre → its dot
    var srcY = oy + 44;
    L.labelTopY = oy + 12;
    L.src = placeRow(SOURCES, srcY, 0, compact ? 9999 : 700, 1);
    L.src.forEach(function (s) { s.dotY = s.y + L.dotGap; });
    var srcBottom = Math.max.apply(null, L.src.map(function (s) { return s.dotY; }));

    // YOUR BUSINESS: dashed pills, caption on the same line (or under them)
    var depY = oy + Hc - 6 - L.ch / 2;
    L.dep = placeRow(DEPARTMENTS, depY, pad, compact ? 9999 : 560, -1);
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

    // "You" alone sits in the middle. With a team / SAS, the pair (node above,
    // you below) is centred instead, with equal air above and below it.
    var m = Math.min(W, H);
    var via = Math.max(tween.team, tween.sas);
    L.you = { r: compact ? Math.max(22, Math.min(28, m * .075)) : Math.max(28, Math.min(48, m * .075)), x: rowCentre };
    L.mid = { r: compact ? Math.max(18, Math.min(24, m * .06)) : Math.max(22, Math.min(38, m * .06)), x: rowCentre };
    var centre = (srcBottom + depTop) / 2;
    // The team ring is taller than a single node, so the pair stretches with it
    var ringR = L.mid.r * (compact ? 2.1 : 1.85), nodeR = L.mid.r * .72;
    var pair = L.mid.r * 1.6 + L.you.r * 1.9 + (compact ? 26 : 48) + tween.team * (ringR * .5 + nodeR);
    L.mid.y = centre - pair / 2;
    L.you.y = centre + (pair / 2) * via;
    // Top of the person's head (see drawPerson) and the point under "You"
    L.headTop = L.you.y - L.you.r * .9;
    L.feet = L.you.y + L.you.r * 1.05;

    // Every route is computed once; drawing and dots share it
    var spreadYou = L.you.r * .32, spreadMid = L.mid.r * .5;
    L.wSrcYou = L.src.map(function (s) { return wireConverge(s.cx, s.dotY, L.you.x, L.headTop - 4, spreadYou, L.srcSpan); });
    L.wSrcMid = L.src.map(function (s) { return wireConverge(s.cx, s.dotY, L.mid.x, L.mid.y - L.mid.r * 1.05, spreadMid, L.srcSpan); });
    // SAS → you
    L.wMidYou = wireVertical(rowCentre, L.mid.y + L.mid.r * 1.35, L.headTop - 4);
    L.wYouDep = L.dep.map(function (d) { return wireDiverge(L.you.x, L.feet, d.cx, d.y - L.ch / 2, spreadYou, L.depSpan); });

    // Your people: three small circles on a shared ring (left, top, right).
    // Each has its own line to you, used both ways (ping-pong).
    L.ring = { x: rowCentre, y: L.mid.y, r: ringR, nodeR: nodeR };
    L.nodes = [150, -90, 30].map(function (deg) {
      var a = deg * Math.PI / 180;
      return { x: rowCentre + Math.cos(a) * ringR, y: L.mid.y + Math.sin(a) * ringR };
    });
    // Desk items on the left go to the left person, middle to the top one, right to the right one
    L.nodeOf = L.src.map(function (s, i) { return Math.min(2, Math.floor(i / L.src.length * 3)); });
    L.wSrcNode = L.src.map(function (s, i) {
      var n = L.nodes[L.nodeOf[i]];
      return wireConverge(s.cx, s.dotY, n.x, n.y - nodeR - 2, nodeR * .4, L.srcSpan);
    });
    L.wNodeYou = L.nodes.map(function (n) {
      var y0 = n.y + nodeR + 2, y1 = L.headTop - 4, m = (y0 + y1) / 2;
      return bezier(n.x, y0, n.x, m, L.you.x + (n.x - L.you.x) * .15, m, L.you.x + (n.x - L.you.x) * .15, y1);
    });
    L.wYouNode = L.wNodeYou.map(function (w) {
      return bezier(w[6], w[7], w[4], w[5], w[2], w[3], w[0], w[1]);
    });

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

  // Hand one finished decision from "You" down to a part of the business
  function passDown() {
    spawn('wYouDep', Math.floor(Math.random() * L.dep.length), 'g', 'dep');
  }

  function arrive(p) {
    if (p.to === 'you') {
      if (p.k === 'q') {
        pile = Math.min(L.pileMax, pile + 1);
        if (Math.random() < .12) passDown();          // now and then, you get one done
        // With your people, you hand questions straight back: ping-pong
        if (phase === 1 && Math.random() < .5) spawn('wYouNode', Math.floor(Math.random() * 3), 'q', 'node');
      } else if (p.k === 'd') {
        glow = 1;
        spawn('wYouDep', Math.floor(Math.random() * L.dep.length), 'g', 'dep');
      }
    } else if (p.to === 'node') {
      // Each person sends most questions back to you; very little gets done
      var k = p.route === 'wSrcNode' ? L.nodeOf[p.i] : p.i;
      if (Math.random() < .7) spawn('wNodeYou', k, 'q', 'you');
      else if (Math.random() < .15) passDown();
    } else if (p.to === 'sas') {
      // SAS turns every few questions into one prepared decision for you
      sasCount++;
      sasPulse = Math.min(1, sasPulse + .35);
      if (sasCount % 3 === 0) spawn('wMidYou', undefined, 'd', 'you');
    } else if (p.to === 'dep') {
      passed++;
      done[p.i]++;
      waiting[p.i] = Math.max(0, waiting[p.i] - 1);
    }
  }

  function simulate(dt) {
    if (!L.src) return;   // canvas had no size yet (hidden / not laid out)
    intro += dt;
    ['team', 'sas', 'lit'].forEach(function (k) {
      tween[k] += (target[k] - tween[k]) * Math.min(1, dt * 3);
    });
    // Height (and SAS's lower spot) ease a little slower; re-layout while moving
    var tallBefore = tween.tall, sasBefore = L.sasAt;
    tween.tall += (target.tall - tween.tall) * Math.min(1, dt * 2.2);
    L.sasAt = tween.sas + tween.team;   // the pair layout moves with either node
    if (Math.abs(tween.tall - tallBefore) > .0005 || Math.abs(L.sasAt - (sasBefore || 0)) > .0005) layoutContent();

    spawnAcc += SPAWN_RATE[phase] * flowRamp() * dt;
    while (spawnAcc >= 1) {
      spawnAcc--;
      var i = Math.floor(Math.random() * L.src.length);
      if (phase === 0) spawn('wSrcYou', i, 'q', 'you');
      else if (phase === 1) spawn('wSrcNode', i, 'q', 'node');
      else spawn('wSrcMid', i, 'q', 'sas');
    }

    // With SAS the business gets your attention straight away (green)
    if (phase === 2) {
      deptAcc += 2.6 * dt;
      while (deptAcc >= 1) {
        deptAcc--;
        spawn('wYouDep', Math.floor(Math.random() * L.dep.length), 'g', 'dep');
      }
    }

    // Tasks pile up in every part of the business until SAS is in
    waiting = waiting.map(function (w, j) {
      if (phase === 2) return Math.max(0, w - WAIT_CLEAR * dt);
      return w + WAIT_GROWTH[phase] * WAIT_WEIGHT[j] * flowRamp() * dt;
    });

    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k];
      p.t += p.speed * dt;
      if (p.t >= 1) {
        particles.splice(k, 1);
        arrive(p);
      }
    }

    pile = Math.max(0, pile - PILE_DECAY[phase] * dt);
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
    var topX = Math.min.apply(null, L.src.map(function (s) { return s.x; }));
    ctx.fillText('ON YOUR DESK:', topX, L.labelTopY);

    // YOUR BUSINESS: above Product, on a plate of the background colour so
    // the wire into Product passes behind the words, not through them
    var product = L.dep[0];
    var upper = Math.min.apply(null, L.dep.map(function (d) { return d.y; }));
    var bx = product.x, by = upper - L.ch / 2 - (compact ? 12 : 16);
    var bw = ctx.measureText('YOUR BUSINESS:').width;
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(bx - 6, by - L.labelSize * .75, bw + 12, L.labelSize * 1.5);
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText('YOUR BUSINESS:', bx, by);
    var bottomX = bx;
    ctx.restore();
  }

  // Where does a route end, and what colour does it turn into there?
  function endColorFor(to) {
    if (to === 'sas') return '#FFFFFF';
    if (to === 'node') return '#FFFFFF';
    return loadColor();
  }

  function drawWires() {
    var via = Math.max(tween.team, tween.sas);
    var midEnd = '#FFFFFF';   // lines into the team / SAS stay white

    L.src.forEach(function (s, i) {
      var on = appear(.35 + i * .14, .6);
      strokeWire(L.wSrcYou[i], loadColor(), .45 * (1 - via) * on, LINE, null, 'end');
      strokeWire(L.wSrcMid[i], midEnd, .45 * tween.sas * on, LINE, null, 'end');
      strokeWire(L.wSrcNode[i], '#FFFFFF', .45 * tween.team * on, LINE, null, 'end');
    });

    strokeWire(L.wMidYou, COLORS.green, .55 * tween.sas, LINE);
    // You ↔ each of your people (one line each, travelled both ways)
    L.wNodeYou.forEach(function (w) { strokeWire(w, loadColor(), .5 * tween.team, LINE); });

    // To the business: dashed white while it stalls, solid once it runs
    L.wYouDep.forEach(function (w, j) {
      var on = appear(1.4 + j * .12, .6);
      // Red-tinged while the business is on hold, white once it runs
      strokeWire(w, tween.lit > .5 ? '#FFFFFF' : COLORS.redLight, .8 * on, LINE, tween.lit > .6 ? null : [4, 6], 'start');
    });
  }

  function drawParticles() {
    particles.forEach(function (p) {
      var pt = pointOnWire(routeOf(p), p.t);
      var alpha = Math.min(1, p.t * 6, (1 - p.t) * 6);
      var color, size = compact ? 2.2 : 2.8;

      if (p.k === 'd') {
        color = COLORS.green;                           // prepared decision from SAS
        size = compact ? 3.4 : 4.4;
      } else if (p.k === 'g') {
        color = phase === 2 ? COLORS.green : '#FFFFFF';  // a trickle of your time, then real flow
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
  // Your people: a dashed ring, three separate circles on it (one person
  // each, no links between them), "Your team" in the middle
  function drawTeamNode() {
    if (tween.team <= .01 || !L.nodes) return;
    var R = L.ring, nr = R.nodeR;

    ctx.save();
    ctx.globalAlpha = tween.team;

    ctx.setLineDash([3, 6]);
    ctx.lineWidth = LINE;
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.arc(R.x, R.y, R.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    L.nodes.forEach(function (n) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, nr, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.bg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = LINE;
      ctx.stroke();
      drawPerson(n.x, n.y + nr * .12, nr * .95, '#FFFFFF');
    });

    ctx.fillStyle = '#FFFFFF';
    // Name beside the ring, never on top of the circles
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, compact ? 12 : 14);
    var tx = R.x + R.r + nr + (compact ? 8 : 14), ty = R.y - R.r * .5;
    var tw = ctx.measureText('Your team').width, th = compact ? 18 : 22;
    ctx.fillStyle = COLORS.bg;                       // plate: wires pass behind the name
    ctx.fillRect(tx - 5, ty - th / 2, tw + 10, th);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Your team', tx, ty);
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
      ctx.fillStyle = i < RED_AT ? COLORS.orange : COLORS.red;
      ctx.beginPath();
      ctx.arc(you.x + slot[0], you.y + slot[1], dotSize * (.4 + .6 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var overloaded = pile > RED_AT;
    var strain = overloaded && !reduceMotion ? Math.sin(time * 6) * Math.min(.06, pile / 400) : 0;

    // Green glow when a prepared decision arrives from SAS
    if (glow > 0) {
      ctx.globalAlpha = glow * .7;
      var g = ctx.createRadialGradient(you.x, you.y, you.r * .3, you.x, you.y, you.r * 2);
      g.addColorStop(0, 'rgba(74,222,155,.5)');
      g.addColorStop(1, 'rgba(74,222,155,0)');
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
    var tone = overloaded ? mix('#FFFFFF', COLORS.redLight, Math.min(1, (pile - RED_AT) / 12)) : '#FFFFFF';
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
    // Words and frames are always clearly white
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
      ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';   // solid frame
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      centeredText(d.n, d.x + d.w / 2, d.y);

      // Corner badge: red pause (‖) while the business waits, ✓ once it runs
      var ok = tween.lit > .5;
      var cx = d.x + d.w - 2, cy = d.y - L.ch / 2 + 2, br = compact ? 7 : 8;
      if (!ok && !reduceMotion) {
        // Alarm: the pause blinks with a red pulse ring (parts out of step)
        var beat = .5 + .5 * Math.sin(time * 5 + j * 1.3);
        ctx.save();
        ctx.globalAlpha = p * (.15 + .35 * beat);
        ctx.fillStyle = COLORS.red;
        ctx.beginPath();
        ctx.arc(cx, cy, br + 3 + 5 * beat, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = p * (.55 + .45 * beat);
      }
      ctx.fillStyle = ok ? COLORS.green : COLORS.red;
      ctx.beginPath();
      ctx.arc(cx, cy, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.bg;
      ctx.fillStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (ok) {
        ctx.beginPath();
        ctx.moveTo(cx - br * .45, cy + br * .02);
        ctx.lineTo(cx - br * .1, cy + br * .38);
        ctx.lineTo(cx + br * .48, cy - br * .35);
        ctx.stroke();
      } else {
        ctx.fillRect(cx - br * .38, cy - br * .42, br * .26, br * .84);
        ctx.fillRect(cx + br * .12, cy - br * .42, br * .26, br * .84);
      }
      ctx.restore();
    });
  }

  function draw() {
    if (!W || !L.src) return;
    ctx.clearRect(0, 0, W, H);
    drawWires();
    drawParticles();
    drawLabels();
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
    tween.tall = target.tall;
    layoutContent();
    pile = Math.min(L.pileMax || 30, [36, 30, 0][phase]);
    waiting = phase === 2 ? [0, 0, 0, 0] : [12, 9, 14, 8];
    done = phase === 2 ? [24, 19, 21, 17] : [2, 1, 3, 1];
    passed = [3, 9, 120][phase];
    particles = [];
    glow = phase === 2 ? .6 : 0;
    draw();
    updateStats(true);
  }

  /* ---------- Big counts under the diagram ---------- */
  var statEls = {
    done: document.querySelector('[data-stat="done"]'),
    stuck: document.querySelector('[data-stat="stuck"]')
  };
  var statsAt = 0;

  function updateStats(force) {
    if (!statEls.done || (!force && time - statsAt < .2)) return;
    statsAt = time;
    statEls.done.textContent = passed;
    // Stuck = what piles up on you + what the business is waiting on
    statEls.stuck.textContent = Math.round(pile + waiting.reduce(function (a, b) { return a + b; }, 0));
  }

  /* ---------- Scroll steps ---------- */
  var steps = [].slice.call(scrolly.querySelectorAll('.step'));
  var stateLabel = document.getElementById('stage-state');
  var dots = [].slice.call(document.querySelectorAll('.sdots i'));

  function setStep(i) {
    if (i === step) return;
    step = i;
    phase = PHASE[i];
    target = LOOK[phase];

    // Screen-reader caption for the step (visually hidden)
    stateLabel.textContent = STATES[i];
    canvas.setAttribute('aria-label', ARIA[i]);


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
        updateStats();
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
