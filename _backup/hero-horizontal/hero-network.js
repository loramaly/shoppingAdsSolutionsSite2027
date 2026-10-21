/* ==========================================================================
   HERO NETWORK · "Your week" scroll story
   --------------------------------------------------------------------------
   A canvas diagram on the sticky stage. Questions (dots) travel from work
   sources (Campaigns, Creatives…) to "You". As the reader scrolls through the
   five text steps, the diagram changes:
     0  Now · questions flow to you
     1  Now · everything waits for you      (pile grows)
     2  Now · your team at capacity         ("Your team" node, red ring)
     3  With SAS · routed and handled       (SAS node takes the questions)
     4  With SAS · you lead the business    (green flows to the business)
   With prefers-reduced-motion the diagram is drawn once per step, no loop.
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

  // Target look for each step: team node, SAS node, lit departments
  var TARGETS = [
    { team: 0, sas: 0, lit: .15 },
    { team: 0, sas: 0, lit: 0 },
    { team: 1, sas: 0, lit: 0 },
    { team: 0, sas: 1, lit: .35 },
    { team: 0, sas: 1, lit: 1 }
  ];

  var STATES = [
    ['Now · questions flow to you', 'is-bad'],
    ['Now · everything waits for you', 'is-bad'],
    ['Now · your team at capacity', 'is-bad'],
    ['With SAS · routed and handled', 'is-good'],
    ['With SAS · you lead the business', 'is-good']
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
  var tween = { team: 0, sas: 0, lit: .15, ring: 0 };
  var intro = reduceMotion ? 99 : 0;   // seconds since the diagram first came into view
  var LINE = 1.3;                      // one stroke width for every wire and outline
  var target = TARGETS[0];

  /* ---------- Helpers ---------- */
  function font(weight, size) {
    return weight + ' ' + size + 'px "Maven Pro", system-ui, sans-serif';
  }

  function monoFont(size) {
    return '500 ' + size + 'px "JetBrains Mono", ui-monospace, monospace';
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

  // From a pill's edge into a circle node. The curve leaves the pill
  // horizontally and meets the circle head-on (along its radius), so a
  // fan of wires closes smoothly around the node.
  function wireIntoNode(x0, y0, node) {
    var ang = Math.atan2(y0 - node.y, x0 - node.x);          // towards the pill
    var spread = Math.PI + (((ang + 2 * Math.PI) % (2 * Math.PI)) - Math.PI) * .55;
    var ex = node.x + Math.cos(spread) * node.r;
    var ey = node.y + Math.sin(spread) * node.r;
    var reach = Math.abs(ex - x0) * .45;
    return bezier(x0, y0, x0 + reach, y0, ex + Math.cos(spread) * reach, ey + Math.sin(spread) * reach, ex, ey);
  }

  // From a circle node out to a pill's edge (mirror of wireIntoNode)
  function wireOutOfNode(node, x1, y1) {
    var ang = Math.atan2(y1 - node.y, x1 - node.x);
    var spread = ang * .55;
    var sx = node.x + Math.cos(spread) * node.r;
    var sy = node.y + Math.sin(spread) * node.r;
    var reach = Math.abs(x1 - sx) * .45;
    return bezier(sx, sy, sx + Math.cos(spread) * reach, sy + Math.sin(spread) * reach, x1 - reach, y1, x1, y1);
  }

  // Straight link between two nodes on the same row
  function wireBetween(x0, x1, y) {
    var mx = (x0 + x1) / 2;
    return bezier(x0, y, mx, y, mx, y, x1, y);
  }

  // Wire stroke that starts white and turns into `endColor` near its end
  function strokeWire(w, endColor, alpha, width, dash) {
    if (alpha <= .004) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    var g = ctx.createLinearGradient(w[0], w[1], w[6], w[7]);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(.55, '#FFFFFF');
    g.addColorStop(1, endColor || '#FFFFFF');
    ctx.strokeStyle = g;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(w[0], w[1]);
    ctx.bezierCurveTo(w[2], w[3], w[4], w[5], w[6], w[7]);
    ctx.stroke();
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
    var fs = compact ? 11 : 13.5;
    var pad = compact ? 14 : 24;
    L.fs = fs;
    L.ch = compact ? 24 : 32;            // pill height
    ctx.font = font(600, fs);

    // Sources: left column
    var top = H * .12, bottom = H * .88, maxRight = 0;
    L.src = SOURCES.map(function (name, i) {
      var w = ctx.measureText(name).width + pad;
      var y = top + (bottom - top) * i / (SOURCES.length - 1);
      maxRight = Math.max(maxRight, 2 + w);
      return { n: name, x: 2, y: y, w: w };
    });

    // Departments: right column
    var dTop = H * .24, dBottom = H * .76;
    L.dep = DEPARTMENTS.map(function (name, i) {
      var w = ctx.measureText(name).width + pad;
      var y = dTop + (dBottom - dTop) * i / (DEPARTMENTS.length - 1);
      return { n: name, x: W - 2 - w, y: y, w: w };
    });

    // "You" sits in the middle (a little right of centre on phones,
    // where the pills on the left take more of the width)
    var m = Math.min(W, H);
    L.you = {
      r: compact ? Math.max(22, Math.min(30, m * .075)) : Math.max(28, Math.min(52, m * .085)),
      x: W * (compact ? .56 : .5),
      y: H * .5
    };

    // Middle node (team / SAS) halfway between the pills and "You"
    L.mid = {
      r: compact ? Math.max(19, Math.min(26, m * .06)) : Math.max(22, Math.min(42, m * .07)),
      y: H * .5
    };
    L.mid.x = (maxRight + (L.you.x - L.you.r)) / 2;

    // Every route is computed once; drawing and dots share it
    L.wSrcYou = L.src.map(function (s) { return wireIntoNode(s.x + s.w, s.y, L.you); });
    L.wSrcMid = L.src.map(function (s) { return wireIntoNode(s.x + s.w, s.y, L.mid); });
    L.wMidYou = wireBetween(L.mid.x + L.mid.r * 1.15, L.you.x - L.you.r, L.you.y);
    L.wYouDep = L.dep.map(function (d) { return wireOutOfNode(L.you, d.x, d.y); });

    L.pileMax = compact ? 20 : 48;
    pile = Math.min(pile, L.pileMax);

    // Where each waiting question settles: scattered around "You" with no
    // shield in between. Later questions land a little further out.
    L.slots = [];
    for (var k = 0; k < L.pileMax; k++) {
      var reach = L.you.r * (1.05 + Math.random() * (.35 + .9 * k / L.pileMax));
      var ang = Math.random() * Math.PI * 2;
      L.slots.push([Math.cos(ang) * reach, Math.sin(ang) * reach]);
    }
    particles = [];
  }

  /* ---------- Simulation ---------- */
  // kind: 'q' question · 'd' prepared decision · 'g' your attention, to the business
  function spawn(w, kind, to) {
    particles.push({
      w: w,
      t: 0,
      speed: (compact ? 170 : 260) / (wireLength(w) + 1),
      k: kind,
      to: to
    });
  }

  function arrive(p) {
    if (p.to === 'you') {
      if (p.k === 'q') pile = Math.min(L.pileMax, pile + 1);
      else if (p.k === 'd') glow = 1;
    } else if (p.to === 'team') {
      // A team at capacity passes more questions up to you
      if (Math.random() < .3 + .7 * tween.ring) spawn(L.wMidYou, 'q', 'you');
    } else if (p.to === 'sas') {
      // SAS sends you one prepared decision for every six questions
      sasCount++;
      sasPulse = Math.min(1, sasPulse + .35);
      if (sasCount % 6 === 0) spawn(L.wMidYou, 'd', 'you');
    }
  }

  function simulate(dt) {
    if (!L.src) return;   // canvas had no size yet (hidden / not laid out)
    intro += dt;
    ['team', 'sas', 'lit'].forEach(function (k) {
      tween[k] += (target[k] - tween[k]) * Math.min(1, dt * 3);
    });
    tween.ring = step === 2 ? Math.min(1, tween.ring + dt * .45) : Math.max(0, tween.ring - dt * 1.5);

    spawnAcc += SPAWN_RATE[step] * flowRamp() * dt;
    while (spawnAcc >= 1) {
      spawnAcc--;
      var i = Math.floor(Math.random() * L.src.length);
      if (step <= 1) spawn(L.wSrcYou[i], 'q', 'you');
      else spawn(L.wSrcMid[i], 'q', step === 2 ? 'team' : 'sas');
    }

    if (step === 4) {
      deptAcc += 2.4 * dt;
      while (deptAcc >= 1) {
        deptAcc--;
        spawn(L.wYouDep[Math.floor(Math.random() * L.dep.length)], 'g', 'dep');
      }
    }

    for (var k = particles.length - 1; k >= 0; k--) {
      var p = particles[k];
      p.t += p.speed * dt;
      if (p.t >= 1) {
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

  function drawLabels() {
    ctx.save();
    ctx.globalAlpha = appear(0, .5);
    ctx.textBaseline = 'middle';
    ctx.font = monoFont(compact ? 12 : 14);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.fillStyle = LABEL_COLOR;

    ctx.textAlign = 'left';
    ctx.fillText(step >= 3 ? 'HANDLED BY SAS' : 'ON YOUR DESK', 2, L.src[0].y - L.ch / 2 - 18);

    ctx.textAlign = 'right';
    var waiting = step === 1 || step === 2;
    ctx.fillText(step === 4 ? 'LED BY YOU' : (waiting ? 'WAITING' : 'YOUR BUSINESS'), W - 2, L.dep[0].y - L.ch / 2 - 18);
    ctx.restore();
  }

  // Where does a route end, and what colour does it turn into there?
  function endColorFor(to) {
    if (to === 'sas') return COLORS.violetLight;
    if (to === 'team') return COLORS.orange;
    return loadColor();
  }

  function drawWires() {
    var via = Math.max(tween.team, tween.sas);
    var midEnd = tween.sas > tween.team ? COLORS.violetLight : COLORS.orange;

    L.src.forEach(function (s, i) {
      var on = appear(.35 + i * .14, .6);
      strokeWire(L.wSrcYou[i], loadColor(), .3 * (1 - via) * on, LINE);
      strokeWire(L.wSrcMid[i], midEnd, .34 * via * on, LINE);
    });

    strokeWire(L.wMidYou, tween.sas > .5 ? COLORS.gold : loadColor(), .55 * via, LINE);

    // To the business: dashed white curves, brighter once you lead it
    L.wYouDep.forEach(function (w, j) {
      strokeWire(w, '#FFFFFF', (.22 + .35 * tween.lit) * appear(1.4 + j * .12, .6), LINE, [4, 6]);
    });
  }

  function drawParticles() {
    particles.forEach(function (p) {
      var pt = pointOnWire(p.w, p.t);
      var alpha = Math.min(1, p.t * 6, (1 - p.t) * 6);
      var color, size = compact ? 2.2 : 2.8;

      if (p.k === 'd') {
        color = COLORS.gold;
        size = compact ? 3.4 : 4.4;
      } else if (p.k === 'g') {
        color = COLORS.green;
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

  function drawSources() {
    ctx.font = font(600, L.fs);
    ctx.textAlign = 'left';
    L.src.forEach(function (s, i) {
      var p = appear(.2 + i * .14, .45);
      if (p <= 0) return;
      var flash = p < 1 ? Math.sin(p * Math.PI) : 0;   // brief glow while lighting up

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate((1 - p) * -10, 0);                  // slides in from the left
      roundRect(s.x, s.y - L.ch / 2, s.w, L.ch, compact ? 7 : 9);
      ctx.shadowColor = 'rgba(255,255,255,' + (.9 * flash).toFixed(3) + ')';
      ctx.shadowBlur = 22 * flash;
      ctx.fillStyle = COLORS.paper;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.ink;
      centeredText(s.n, s.x + s.w / 2, s.y);
      ctx.restore();
    });
  }

  function drawTeamNode() {
    if (tween.team <= .01) return;
    var mid = L.mid;

    ctx.globalAlpha = tween.team;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, mid.r, 0, Math.PI * 2);
    ctx.fillStyle = '#1B1D2F';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.orange;
    ctx.stroke();

    // Capacity ring fills up while step 2 is active
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, mid.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(.001, tween.ring));
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.fillStyle = '#fff';
    ctx.font = font(700, compact ? 11 : 13);
    ctx.textAlign = 'center';
    ctx.fillText('Your', mid.x, mid.y - (compact ? 6 : 8));
    ctx.fillText('team', mid.x, mid.y + (compact ? 7 : 9));

    if (tween.ring > .95) {
      ctx.font = monoFont(compact ? 9.5 : 10.5);
      ctx.fillStyle = COLORS.redLight;
      ctx.fillText('AT CAPACITY', mid.x, mid.y + mid.r + (compact ? 20 : 26));
    }
    ctx.globalAlpha = 1;
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
    ctx.lineWidth = 1.5 / orbit;
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

    // Gradient layers + a light inner rim, clipped to the plate
    ctx.save();
    ctx.clip(BADGE.path);
    BADGE.layers.forEach(paintBadgeLayer);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.stroke(BADGE.path);
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
    var a = .5 + .45 * tween.lit;          // 50% white, full white once you lead
    L.dep.forEach(function (d, j) {
      var p = appear(1.3 + j * .12, .45);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate((1 - p) * 10, 0);                   // slides in from the right
      roundRect(d.x, d.y - L.ch / 2, d.w, L.ch, compact ? 7 : 9);
      ctx.fillStyle = 'rgba(255,255,255,' + (.04 + .06 * tween.lit).toFixed(3) + ')';
      ctx.fill();
      ctx.lineWidth = LINE;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
      centeredText(d.n, d.x + d.w / 2, d.y);
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

    stateLabel.textContent = STATES[i][0];
    stateLabel.className = STATES[i][1];
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
