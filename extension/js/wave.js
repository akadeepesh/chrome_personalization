// The wave, drawn on a <canvas> for smooth 60 fps.
// Two drawing modes share one outline:
//  - chevron: the ">" itself, sliding toward the left edge and stretching into a line
//  - bell:    a bulge out of the left edge, x(y) = A · profile(y) - B
// The fill (site colour + diagonal watermark) is rendered once per target into an
// offscreen texture; each frame only clips that image and strokes the outline.

const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;
const easeInQuad = (t) => t * t;

const EDGE = 0.012; // the flat line sits this far inside the left edge (fraction of width)

// a = A / width, s = bell height scale (fraction of height), b = pull-back (fraction of width)
const RESTING = { a: 0.255, s: 0.205, b: 0 };
const SEED = { a: 0.004, s: 0.12, b: -EDGE }; // the thin line the bell grows from
const KEYS = ['a', 's', 'b'];

// Fitted to the original: a rounder nose (exponent 2.7) blended with softer Gaussian tails.
function profile(dy, sigma) {
  const u = Math.abs(dy) / sigma;
  const v = dy / (sigma * 1.55);
  return 0.82 * Math.exp(-(u ** 2.7)) + 0.18 * Math.exp(-(v * v));
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const fontsReady = document.fonts?.load('800 40px Onest').catch(() => {}) ?? Promise.resolve();

export function createWave({ root, canvas, label }, getSpeed, getThickness, getColor) {
  const ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas');
  const tctx = texture.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let mode = 'none'; // 'none' | 'chevron' | 'bell'
  let state = { ...SEED };
  let chev = null; // { tipX, cy, armX, armDy } in px
  let target = null;
  let painted = null;
  let stroke = '#f2f2f0';
  let raf = 0;
  let settle = null;

  // ---------- canvas & texture ----------
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    for (const c of [canvas, texture]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    if (painted) renderTexture(painted);
    draw();
  }

  function renderTexture(t) {
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = cssFill(tctx, t.bg, W, H);
    tctx.fillRect(0, 0, W, H);

    // Diagonal watermark: the name repeated in rows, alternate rows offset.
    const fs = Math.max(22, Math.min(60, W * 0.029));
    tctx.save();
    tctx.translate(W / 2, H / 2);
    tctx.rotate((-28 * Math.PI) / 180);
    tctx.font = `800 ${fs}px Onest, system-ui, sans-serif`;
    tctx.fillStyle = t.fg;
    tctx.globalAlpha = 0.22;
    tctx.textBaseline = 'middle';
    const word = t.name.toUpperCase();
    const step = tctx.measureText(word).width + fs * 2;
    const rowH = fs * 2.1;
    const R = Math.hypot(W, H) / 2 + step;
    let row = 0;
    for (let y = -R; y <= R; y += rowH, row++) {
      const offset = row % 2 ? step / 2 : 0;
      for (let x = -R - offset; x <= R; x += step) tctx.fillText(word, x, y);
    }
    tctx.restore();
  }

  // ---------- drawing ----------
  function bellPoints() {
    const A = state.a * W;
    const B = state.b * W;
    const sigma = Math.max(1, state.s * H);
    const cy = H / 2;
    const pad = 60;
    const N = 160;
    const pts = new Float32Array((N + 1) * 2);
    for (let i = 0; i <= N; i++) {
      const y = -pad + ((H + 2 * pad) * i) / N;
      pts[i * 2] = Math.min(A * profile(y - cy, sigma) - B, W * 4);
      pts[i * 2 + 1] = y;
    }
    return pts;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    label.style.opacity = '0';
    if (mode === 'none' || (mode === 'chevron' && !chev)) return;

    ctx.lineWidth = getThickness();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = stroke;

    if (mode === 'chevron') {
      const { tipX, cy, armX, armDy } = chev;
      ctx.beginPath();
      ctx.moveTo(armX, cy - armDy);
      ctx.lineTo(tipX, cy);
      ctx.lineTo(armX, cy + armDy);
      ctx.stroke();
      return;
    }

    const pts = bellPoints();
    const n = pts.length / 2;
    const line = new Path2D();
    line.moveTo(pts[0], pts[1]);
    for (let i = 1; i < n; i++) line.lineTo(pts[i * 2], pts[i * 2 + 1]);

    const area = new Path2D();
    area.moveTo(-200, pts[1]);
    for (let i = 0; i < n; i++) area.lineTo(pts[i * 2], pts[i * 2 + 1]);
    area.lineTo(-200, pts[(n - 1) * 2 + 1]);
    area.closePath();

    ctx.save();
    ctx.clip(area);
    ctx.drawImage(texture, 0, 0, W, H);
    ctx.restore();
    ctx.stroke(line);

    // Label rides in the middle of the visible bulge (composited transform, cheap).
    const reach = Math.max(0, state.a * W - state.b * W);
    label.style.transform = `translate3d(calc(${(reach * 0.48).toFixed(1)}px - 50%), -50%, 0)`;
    label.style.opacity = Math.max(0, Math.min(1, (reach / W - 0.13) / 0.08)).toFixed(3);
  }

  // ---------- animation primitives ----------
  function stop() {
    cancelAnimationFrame(raf);
    settle?.(false);
    settle = null;
  }

  /** Runs onFrame(easedProgress) for `duration` ms, then draws. Resolves false if interrupted. */
  function run(duration, onFrame, ease = easeInOut) {
    stop();
    if (reduceMotion.matches) duration = 0;
    return new Promise((resolve) => {
      settle = resolve;
      let start = null;
      const step = (now) => {
        start ??= now;
        const t = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        onFrame(ease(t));
        draw();
        if (t < 1) raf = requestAnimationFrame(step);
        else { settle = null; resolve(true); }
      };
      raf = requestAnimationFrame(step);
    });
  }

  /** Damped spring on the bell: overshoots wider and taller, wobbles, settles. */
  function spring(to) {
    stop();
    mode = 'bell';
    if (reduceMotion.matches) { state = { ...to }; draw(); return Promise.resolve(true); }
    const k = 400 / Math.max(80, getSpeed());
    const stiffness = 80 * k * k;
    const damping = 5.7 * k; // ζ ≈ 0.32 → ~35% overshoot, a couple of slow wobbles
    const v = { a: 0, s: 0, b: 0 };
    return new Promise((resolve) => {
      settle = resolve;
      let last = null;
      const step = (now) => {
        let dt = last == null ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
        last = now;
        while (dt > 0) {
          const h = Math.min(dt, 1 / 240);
          for (const key of KEYS) {
            v[key] += (-stiffness * (state[key] - to[key]) - damping * v[key]) * h;
            state[key] += v[key] * h;
          }
          dt -= h;
        }
        const done = KEYS.every((key) => Math.abs(state[key] - to[key]) < 0.0004 && Math.abs(v[key]) < 0.002);
        if (done) state = { ...to };
        draw();
        if (done) { settle = null; resolve(true); } else raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  const edgeLine = () => ({ tipX: W * (EDGE + SEED.a), cy: H / 2, armX: W * EDGE, armDy: H / 2 + 60 });
  const mixChev = (g0, g1, e) => ({
    tipX: lerp(g0.tipX, g1.tipX, e), cy: lerp(g0.cy, g1.cy, e), armX: lerp(g0.armX, g1.armX, e), armDy: lerp(g0.armDy, g1.armDy, e),
  });

  function morph(g0, g1, duration, ease) {
    return run(duration, (e) => { mode = 'chevron'; chev = mixChev(g0, g1, e); }, ease);
  }

  /** Chevron slides most of the way to the left edge, then stretches into the edge line. */
  async function chevronToEdge(g0, total) {
    const edge = edgeLine();
    const shift = 0.8 * (g0.armX - edge.armX);
    const slid = { ...g0, tipX: g0.tipX - shift, armX: g0.armX - shift };
    if (!(await morph(g0, slid, total * 0.7, easeInOut))) return false;
    return morph(slid, edge, total * 0.3, easeOut);
  }

  /** Bell shrinks back into the edge line. */
  function sink(duration, ease = easeInOut) {
    const from = { ...state };
    return run(duration, (e) => {
      mode = 'bell';
      for (const key of KEYS) state[key] = lerp(from[key], SEED[key], e);
    }, ease);
  }

  // ---------- public ----------

  /**
   * Show the wave for `next`, or hide it for null.
   * `chevronGeom` is the on-screen chevron: where the morph starts (show) or ends (hide).
   * Resolves true when finished, false if interrupted by a newer call.
   */
  async function show(next, chevronGeom = null) {
    if ((next?.id ?? null) === (target?.id ?? null)) return true;
    const prev = target;
    target = next;
    stroke = getColor();
    const speed = getSpeed();

    if (!next) {
      if (mode === 'bell' && !(await sink(speed * 0.8))) return false;
      if (chevronGeom && mode !== 'none') {
        const from = mode === 'chevron' && chev ? chev : edgeLine();
        if (!(await morph(from, chevronGeom, speed * 0.9, easeInOut))) return false;
      }
      mode = 'none';
      draw();
      return true;
    }

    await fontsReady;
    if (target !== next) return false;

    if (mode === 'bell') {
      // Different target: dip back to the edge, recolour, pop out again.
      if (prev && state.a > 0.03 && (!(await sink(speed * 0.6, easeIn)) || target !== next)) return false;
    } else {
      const from = mode === 'chevron' && chev ? chev : (chevronGeom || edgeLine());
      if (!(await chevronToEdge(from, speed * 1.4)) || target !== next) return false;
      state = { ...SEED };
    }
    painted = next;
    renderTexture(next);
    label.style.color = next.fg;
    label.textContent = next.label || '';
    return spring(RESTING);
  }

  /** Stretch the bell into a ribbon, then flood the screen. Resolves when covered. */
  function launch() {
    const from = { ...state };
    const a0 = Math.max(from.a, 0.05);
    return run(Math.max(600, getSpeed() * 2.2), (e) => {
      mode = 'bell';
      if (e < 0.5) {
        const u = e / 0.5;
        state = { a: Math.exp(lerp(Math.log(a0), Math.log(1.25), u)), s: lerp(from.s, 0.17, u), b: lerp(from.b, 0, u) };
      } else {
        const u = (e - 0.5) / 0.5;
        state = { a: Math.exp(lerp(Math.log(1.25), Math.log(80), u)), s: lerp(0.17, 0.7, u), b: 0 };
      }
    }, easeInQuad);
  }

  function reset() {
    stop();
    target = null;
    mode = 'none';
    chev = null;
    state = { ...SEED };
    root.classList.remove('front');
    draw();
  }

  let resizeQueued = false;
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; resize(); });
  });
  resize();
  return { show, launch, reset, get target() { return target; } };
}

// ---------- CSS background → canvas fill ----------
// Supports plain colours, linear-gradient(...) and radial-gradient(...), as used by the site colours.

function splitTop(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parseStops(parts) {
  const stops = parts.map((p) => {
    const m = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(p);
    return { color: m[1].trim(), pos: m[2] != null ? parseFloat(m[2]) / 100 : null };
  });
  if (!stops.length) return [];
  if (stops[0].pos == null) stops[0].pos = 0;
  if (stops[stops.length - 1].pos == null) stops[stops.length - 1].pos = 1;
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i].pos != null) continue;
    let j = i;
    while (stops[j].pos == null) j++;
    const a = stops[i - 1].pos;
    const b = stops[j].pos;
    for (let k = i; k < j; k++) stops[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  let last = 0;
  for (const s of stops) { s.pos = Math.min(1, Math.max(last, s.pos)); last = s.pos; }
  return stops;
}

const SIDES = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 };

function cssFill(ctx, bg, W, H) {
  const m = /^\s*(linear|radial)-gradient\((.*)\)\s*$/is.exec(bg || '');
  if (!m) return bg || '#444444';
  const parts = splitTop(m[2]);
  let g;
  if (m[1] === 'linear') {
    let angle = 180;
    const deg = /^(-?[\d.]+)deg$/.exec(parts[0]);
    const to = /^to\s+(.+)$/.exec(parts[0]);
    if (deg) { angle = parseFloat(deg[1]); parts.shift(); } else if (to) { angle = SIDES[to[1].trim()] ?? 180; parts.shift(); }
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const len = Math.abs(W * dx) + Math.abs(H * dy);
    g = ctx.createLinearGradient(W / 2 - (dx * len) / 2, H / 2 - (dy * len) / 2, W / 2 + (dx * len) / 2, H / 2 + (dy * len) / 2);
  } else {
    let cx = W / 2;
    let cy = H / 2;
    if (/^(circle|ellipse|at\s|closest|farthest)/.test(parts[0])) {
      const at = /at\s+(-?[\d.]+)%\s+(-?[\d.]+)%/.exec(parts[0]);
      if (at) { cx = (W * parseFloat(at[1])) / 100; cy = (H * parseFloat(at[2])) / 100; }
      parts.shift();
    }
    const r = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  }
  for (const s of parseStops(parts)) {
    try { g.addColorStop(s.pos, s.color); } catch { /* ignore unparsable colour */ }
  }
  return g;
}
