(function () {
  const home = document.getElementById('home');
  if (!home) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  home.classList.add('js');

  /* ---------- 1. Counters ---------- */
  const counters = Array.from(home.querySelectorAll('[data-count]'));
  const easeOutExpo = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

  counters.forEach((el, i) => {
    el._target = parseFloat(el.dataset.count);
    el._dec    = (el.dataset.count.split('.')[1] || '').length;
    el._dur    = +el.dataset.dur   || 1000 + ((i * 0.618) % 1) * 1800;
    el._delay  = +el.dataset.delay || 250 + i * 70;
    if (!reduced) el.textContent = (0).toFixed(el._dec);
  });

  function runCounter(el) {
    const t0 = performance.now() + el._delay;
    (function frame(now) {
      const p = Math.max(0, Math.min((now - t0) / el._dur, 1));
      el.textContent = (el._target * easeOutExpo(p)).toFixed(el._dec);
      if (p < 1) return requestAnimationFrame(frame);
      const host = el.closest('.stat');
      if (host) host.classList.add('done');
    })(performance.now());
  }

  const startAll = () => {
    home.classList.add('in');
    const tierCols = home.querySelector('.tier-cols');
    const spectrum = home.querySelector('.spectrum');
    if (tierCols) tierCols.classList.add('in');
    if (spectrum) spectrum.classList.add('in');
  };

  if (reduced) {
    startAll();
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        runCounter(e.target);
      });
    }, { threshold: 0.4 });

    requestAnimationFrame(() => {
      startAll();
      counters.forEach(c => io.observe(c));
    });
  }

  /* ---------- 2. Title decode ---------- */
  const h1 = home.querySelector('.collection-title');
  if (h1 && !reduced) {
    const final = h1.textContent, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$';
    h1.setAttribute('aria-label', final);
    const start = performance.now(), dur = 1100;
    (function tick(now) {
      const p = Math.min((now - start) / dur, 1), lock = Math.floor(p * final.length);
      h1.textContent = final.split('').map((ch, i) =>
        ch === ' ' || i < lock ? ch : glyphs[(Math.random() * glyphs.length) | 0]).join('');
      if (p < 1) requestAnimationFrame(tick); else h1.textContent = final;
    })(start);
  }

  /* ---------- 3. Cursor spotlight ---------- */
  home.querySelectorAll('.stat, .type-card, .home-cta').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- 4. Live readout under the spectrum ---------- */
  const spectrum = home.querySelector('.spectrum');
  const note     = document.getElementById('spectrumNote');
  if (spectrum && note) {
    spectrum.addEventListener('mouseover', e => {
      const a = e.target.closest('a');
      if (a) note.textContent = '▸ ' + a.title;
    });
    spectrum.addEventListener('mouseleave', () => { note.textContent = note.dataset.default; });
  }

/* ---------- 5. By year: premium columns ---------- */
(function () {
  const root = document.getElementById('yrChart');
  if (!root) return;
  let data = {};
  try { data = JSON.parse(root.dataset.tiers); } catch (e) { return; }
  const years  = Object.keys(data), N = years.length;
  if (!N) return;
  const plot    = root.querySelector('.yr-plot');
  const readout = root.querySelector('.yr-readout');

  const counts = years.map(y => data[y].length);
  const max    = Math.max(1, ...counts);
  const total  = counts.reduce((a, b) => a + b, 0);
  const active = counts.filter(c => c > 0).length || 1;
  const avg    = total / active;
  const peakI  = counts.indexOf(max);

  const area = document.createElement('div');
  area.className = 'yr-area';
  const areaFrag = document.createDocumentFragment();

  // Build gridlines off-DOM, then append them together.
  [max, Math.round(max / 2), 0].forEach((v, k) => {
    const l = document.createElement('div');
    l.className = 'yr-line';
    l.style.top = (k * 50) + '%';
    l.innerHTML = '<span>' + v + '</span>';
    areaFrag.appendChild(l);
  });

  if (total && N > 1) {
    const l = document.createElement('div');
    l.className = 'yr-line avg';
    l.style.top = (100 - (avg / max) * 100) + '%';
    l.innerHTML = '<span>avg ' + (avg % 1 ? avg.toFixed(1) : avg) + '</span>';
    areaFrag.appendChild(l);
  }

  const cols = document.createElement('div');
  cols.className = 'yr-cols';
  areaFrag.appendChild(cols);
  area.appendChild(areaFrag);
  plot.appendChild(area);

  const labs = document.createElement('div');
  labs.className = 'yr-labels';
  plot.appendChild(labs);
  const colFrag = document.createDocumentFragment();
  const labFrag = document.createDocumentFragment();

  const idle = () => {
    readout.innerHTML = '<b>' + total + '</b> acquired · ' + years[0] + '–' + years[N - 1] +
      ' · best year <em>' + years[peakI] + '</em> (' + max + ')';
  };
  idle();

  const colEls = [], labEls = [];
  let activeIndex = -1;
  years.forEach((y, i) => {
    const n = counts[i];
    const col = document.createElement('a');
    col.href = '/collection/?year=' + encodeURIComponent(y);
    col.setAttribute('aria-label', y + ': ' + n + (n === 1 ? ' specimen' : ' specimens'));
    col.className = 'yr-col' + (n ? '' : ' zero') + (i === peakI && n ? ' peak' : '');
    col.style.setProperty('--r', n / max);
    col.style.setProperty('--i', i);
    col.innerHTML = n ? '<div class="yr-bar"></div><span class="yr-val">' + n + '</span>' : '';
    colFrag.appendChild(col);
    colEls.push(col);

    const lab = document.createElement('span');
    lab.textContent = (N <= 16 || i % 2 === 0) ? "'" + y.slice(2) : '';
    labFrag.appendChild(lab);
    labEls.push(lab);

    col.addEventListener('pointerenter', () => {
      root.classList.add('hov');
      if (activeIndex >= 0) {
        colEls[activeIndex].classList.remove('on');
        labEls[activeIndex].classList.remove('on');
      }
      activeIndex = i;
      col.classList.add('on');
      labEls[i].classList.add('on');
      readout.innerHTML = '<b>' + y + '</b> · <em>' + n + '</em> ' + (n === 1 ? 'specimen' : 'specimens') +
        ' · ' + (total ? Math.round(n / total * 100) : 0) + '% of the collection';
    });
    col.addEventListener('pointerleave', () => {
      root.classList.remove('hov');
      col.classList.remove('on');
      labEls[i].classList.remove('on');
      activeIndex = -1;
      idle();
    });
  });
  cols.appendChild(colFrag);
  labs.appendChild(labFrag);

  // show every value above its bar only when there is room
  const fit = () => root.classList.toggle('wide', cols.clientWidth / N >= 30);
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(cols);
})();

  /* ══════════════════════════════════════════════════════════════
     6. WORLD MAP — hover tooltip, in-place expand, viewBox pan + zoom
     ══════════════════════════════════════════════════════════════ */
  const map = document.getElementById('worldmap');
  if (!map) return;

  const stage     = map.querySelector('#wmStage');
  const tip       = map.querySelector('.wm-tip');
  const tipName   = tip.querySelector('.wm-tip-name');
  const tipCount  = tip.querySelector('.wm-tip-count b');
  const expandBtn = map.querySelector('.wm-expand');
  const closeBtn  = map.querySelector('.wm-close');

  const REGION_NAMES = {
    SOUTH_AMERICA: 'South America',
    NORTH_AMERICA: 'North America',
    EUROPE:        'Europe',
    AFRICA:        'Africa',
    ASIA:          'Asia',
    OCEANIA:       'Oceania',
    ANTARTICA:     'Antarctica',
    IT:            'Italy'
  };
  const prettify = id => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  let regionCounts = {};
  try { regionCounts = JSON.parse(map.dataset.regionCounts || '{}'); } catch (e) {}

  const svg = stage.querySelector('svg');
  if (!svg) {
    if (expandBtn) expandBtn.hidden = true;
    return;
  }

  const areas = Array.from(svg.querySelectorAll('.area'));
  const areasById = new Map(areas.map(el => [el.id, el]));
  const maxCount = Math.max(1, ...Object.values(regionCounts));
  // gold ramp: land → bronze → bright gold
  const hex2 = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const STOPS = [[0, '#4a3b1c'], [0.5, '#c79a2e'], [1, '#ffe08a']].map(([t, h]) => [t, hex2(h)]);
  const ramp = t => {
    t = Math.max(0, Math.min(1, t));
    const k = t < 0.5 ? 0 : 1;
    const [t0, a] = STOPS[k], [t1, b] = STOPS[k + 1], u = (t - t0) / (t1 - t0);
    return 'rgb(' + a.map((v, j) => Math.round(v + (b[j] - v) * u)).join(',') + ')';
  };
  const lvl = c => 0.2 + 0.8 * Math.sqrt(c / maxCount);

  areas.forEach((el, idx) => {
    const c = regionCounts[el.id] || 0;
    el.dataset.count = c;
    el.dataset.name  = REGION_NAMES[el.id] || prettify(el.id);
    el.style.setProperty('--k', idx);
    if (c > 0) {
      el.style.setProperty('--wm-fill', ramp(lvl(c)));
      el.style.setProperty('--wm-rim',  'rgba(255,236,170,' + (0.35 + 0.35 * lvl(c)) + ')');
    }
  });

  /* ---- Origins panel (shown while zoomed) ---- */
  const hud = map.querySelector('.wm-hud');
  if (hud) {
    const ids = Object.keys(regionCounts).filter(id => regionCounts[id] > 0).sort((a, b) => regionCounts[b] - regionCounts[a]).slice(0, 7);
    hud.innerHTML =
      '<div class="wm-key-mini" aria-hidden="true"><em>Fewer</em><i></i><em>More</em></div>' +
      '<div class="wm-hud-h">Origins</div>' +
      ids.map(id =>
        '<div class="wm-row" data-id="' + id + '"><span>' + (REGION_NAMES[id] || prettify(id)) + '</span><i style="--w:' + (regionCounts[id] / maxCount) + ';--f:' + ramp(lvl(regionCounts[id])) + '"></i><b>' + regionCounts[id] + '</b></div>'
      ).join('');
    let hudHl = null;
    const clearHl = () => {
      if (hudHl) hudHl.classList.remove('hl');
      hudHl = null;
    };
    hud.addEventListener('pointerover', e => {
      const row = e.target.closest('.wm-row');
      const next = row ? areasById.get(row.dataset.id) : null;
      if (next === hudHl) return;
      clearHl();
      if (next) { hudHl = next; hudHl.classList.add('hl'); }
    });
    hud.addEventListener('pointerleave', clearHl);
  }

  /* ---- Tooltip (counter-scaled so it stays readable while zoomed) ---- */
  const hideTip = () => { tip.hidden = true; };
  stage.addEventListener('pointermove', e => {
    if (typeof dragging !== 'undefined' && dragging) return hideTip();
    const a = e.target.closest('.area');
    if (!a) return hideTip();
    const r   = stage.getBoundingClientRect();
    const inv = stage.offsetWidth / r.width;          // 1 normally, 1/s when zoomed
    tipName.textContent  = a.dataset.name;
    tipCount.textContent = a.dataset.count;
    tip.hidden = false;
    tip.style.left = ((e.clientX - r.left) * inv) + 'px';
    tip.style.top  = ((e.clientY - r.top)  * inv) + 'px';
    tip.style.transform = 'translate(' + 12 * inv + 'px,-50%) scale(' + inv + ')';
  });
  stage.addEventListener('pointerleave', hideTip);

  /* ---- Camera: frame-by-frame, no CSS transition, so nothing re-renders at the end ---- */
  const homeEl = home;
  const DUR = reduced ? 0 : 1100;
  const ZOOM_W = 0.62, MARGIN = 28;
  let expanded = false, busy = false;

  const lerp   = (a, b, t) => a + (b - a) * t;
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const cam = { tx: 0, ty: 0, s: 1 };

  const setCam = () => {
    homeEl.style.transform = (cam.s === 1 && !cam.tx && !cam.ty) ? ''
      : 'translate3d(' + cam.tx.toFixed(2) + 'px,' + cam.ty.toFixed(2) + 'px,0) scale(' + cam.s.toFixed(4) + ')';
    homeEl.style.setProperty('--inv', (1 / cam.s).toFixed(4));
  };

  function flyTo(to, ms, done) {
    const from = { ...cam }, t0 = performance.now();
    if (!ms) { Object.assign(cam, to); setCam(); if (done) done(); return; }
    homeEl.classList.add('anim');
    (function step(now) {
      const p = Math.max(0, Math.min((now - t0) / ms, 1)), k = easeIO(p);
      cam.tx = lerp(from.tx, to.tx, k);
      cam.ty = lerp(from.ty, to.ty, k);
      cam.s  = lerp(from.s,  to.s,  k);
      setCam();
      if (p < 1) requestAnimationFrame(step);
      else {
        Object.assign(cam, to); setCam();
        homeEl.classList.remove('anim');
        if (done) done();
      }
    })(t0);
  }

  let savedScroll = 0;
  function lockScroll(on) {
    const b = document.body.style;
    if (on) {
      savedScroll = window.scrollY;
      b.position = 'fixed';
      b.top      = `-${savedScroll}px`;
      b.left     = '0';
      b.right    = '0';
      b.width    = '100%';
    } else {
      b.position = b.top = b.left = b.right = b.width = '';
      window.scrollTo(0, savedScroll);
    }
  }

  const navBottom = () => {
    const n = document.querySelector('body > header, header, nav');
    return n ? Math.max(0, n.getBoundingClientRect().bottom) : 0;
  };

  function expand() {
    if (expanded || busy) return;
    if (homeEl.classList.contains('focus-explore')) return;
    busy = true; hideTip();
    lockScroll(true);

    const r = stage.getBoundingClientRect();
    const h = homeEl.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const top = navBottom(), availH = vh - top;

    const s  = Math.max(1.15, Math.min(vw * ZOOM_W / r.width, availH * 0.7 / r.height, 2.2));
    const bw = r.width * s, bh = r.height * s;
    const cxT = Math.min(Math.max(vw * 0.58,           MARGIN + bw / 2), vw - MARGIN - bw / 2);
    const cyT = Math.min(Math.max(top + availH * 0.56, top + MARGIN + bh / 2), vh - MARGIN - bh / 2);

    const cx = r.left + r.width  / 2 - h.left;
    const cy = r.top  + r.height / 2 - h.top;

    homeEl.classList.remove('settled');
    homeEl.classList.add('focus-map');
    flyTo({ tx: cxT - h.left - s * cx, ty: cyT - h.top - s * cy, s }, DUR, () => {
      expanded = true; busy = false;
      homeEl.classList.add('settled');
    });
  }

  function tweenViewBox(ms) {
    const from = { ...vb }, t0 = performance.now();
    if (!ms) { resetViewBox(); return; }
    (function step(now) {
      const p = Math.max(0, Math.min((now - t0) / ms, 1)), k = 1 - Math.pow(1 - p, 3);
      for (const key of ['x', 'y', 'w', 'h']) vb[key] = from[key] + (VB0[key] - from[key]) * k;
      applyViewBox();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  function collapse(instant) {
    if (!expanded || busy) return;
    expanded = false; busy = true; hideTip();
    homeEl.classList.remove('settled');         // ← drop the heavy focused look NOW
    homeEl.classList.add('closing');
    tweenViewBox(instant ? 0 : 450);
    homeEl.classList.remove('focus-map');
    flyTo({ tx: 0, ty: 0, s: 1 }, instant ? 0 : DUR, () => {
      lockScroll(false);
      busy = false;
      homeEl.classList.remove('closing');
    });
  }

  if (expandBtn) expandBtn.addEventListener('click', e => { e.stopPropagation(); expand(); });
  if (closeBtn)  closeBtn.addEventListener('click',  e => { e.stopPropagation(); collapse(); });
  if (closeBtn) closeBtn.addEventListener('pointerenter', () => map.classList.add('close-hover'));
  if (closeBtn) closeBtn.addEventListener('pointerleave', () => map.classList.remove('close-hover'));
  if (closeBtn) closeBtn.addEventListener('click',        () => map.classList.remove('close-hover'));
  /* Clicking / pressing Enter on the map itself opens it. */
  stage.addEventListener('click', e => {
    if (expanded || busy) return;
    if (e.target.closest('.wm-close')) return;
    expand();
  });
  stage.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && !expanded && !busy) {
      e.preventDefault();
      expand();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') collapse(); });
  document.addEventListener('pointerdown', e => {
    if (expanded && !busy && !map.contains(e.target) && !e.target.closest('header, nav')) collapse();
  });
  window.addEventListener('resize', () => { if (expanded && !busy) collapse(true); });

  const NS = 'http://www.w3.org/2000/svg';
  const mkPath = (cls, w, c) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', c);
    p.setAttribute('stroke-width', w);
    p.setAttribute('stroke-linejoin', 'round');
    return p;
  };
  const hlLayer = document.createElementNS(NS, 'g');
  hlLayer.setAttribute('class', 'wm-hl-layer');
  const hlGlow = mkPath('wm-hl-glow', 900, 'rgba(255,214,120,.32)');
  const hlEdge = mkPath('wm-hl-edge', 320, '#ffe9a8');
  hlLayer.append(hlGlow, hlEdge);
  svg.appendChild(hlLayer);              // ← last child ⇒ drawn above everything

  let hlEl = null;
  const setHl = el => {
    if (el === hlEl) return;
    hlEl = el;
    if (el) {
      const d = el.getAttribute('d');
      hlGlow.setAttribute('d', d);
      hlEdge.setAttribute('d', d);
      hlLayer.classList.add('on');
    } else {
      hlLayer.classList.remove('on');
    }
  };
  areas.forEach(el => {
    el.addEventListener('pointerenter', () => setHl(el));
    el.addEventListener('pointerleave', () => setHl(null));
  });

  /* ---- viewBox-based pan + zoom --------------------------------
     We do NOT use CSS transform. That was the cause of the blurriness:
     a CSS `transform: scale()` on a giant inline SVG makes the browser
     rasterise the layer once and then stretch the bitmap. Manipulating
     the SVG's own `viewBox` re-rasterises at every step → crisp at any
     zoom, forever.
     ------------------------------------------------------------- */
  const VB0 = { x: 0, y: 0, w: 66989, h: 31063 };
  const vb  = { ...VB0 };

  function applyViewBox() {
    svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);
  }
  function resetViewBox() {
    vb.x = VB0.x; vb.y = VB0.y; vb.w = VB0.w; vb.h = VB0.h;
    applyViewBox();
  }
  
  let vbDirty = false;
  function scheduleVB() {
    if (vbDirty) return;
    vbDirty = true;
    requestAnimationFrame(() => { vbDirty = false; applyViewBox(); });
  }

  let dragging = false;
  let lastX = 0, lastY = 0;
  let dragRect = null;

  stage.addEventListener('pointerdown', e => {
    if (!expanded || e.button !== 0) return;
    if (e.target === expandBtn || e.target === closeBtn) return;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    dragRect = stage.getBoundingClientRect();   // ← cache once
    stage.classList.add('dragging');
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
  });

  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    vb.x -= (dx / dragRect.width)  * vb.w;
    vb.y -= (dy / dragRect.height) * vb.h;
    scheduleVB();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    dragRect = null;
    stage.classList.remove('dragging');
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener('wheel', e => {
    if (!expanded) return;
    e.preventDefault();

    const r  = stage.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;

    // point under the cursor in viewBox coords
    const vx = vb.x + (cx / r.width)  * vb.w;
    const vy = vb.y + (cy / r.height) * vb.h;

    // zoom factor — scroll up = zoom in
    const f = e.deltaY < 0 ? 0.86 : 1 / 0.86;

    const newW = Math.max(3000, Math.min(VB0.w, vb.w * f));
    const newH = newW * (VB0.h / VB0.w);

    // keep the anchor point stationary under the cursor
    vb.x = vx - (cx / r.width)  * newW;
    vb.y = vy - (cy / r.height) * newH;
    vb.w = newW;
    vb.h = newH;
    scheduleVB();
  }, { passive: false });

  // Double-click resets the view.
  stage.addEventListener('dblclick', () => {
    if (expanded) resetViewBox();
  });

})();
/* ══════════════════════════════════════════════════════════════
   7. EXPLORE — pan+lens drill-down (shelves → boxes → collection)
   ══════════════════════════════════════════════════════════════ */
(function () {
  const btn   = document.getElementById('exploreBtn');
  const panel = document.getElementById('exPanel');
  if (!btn || !panel) return;

  const home    = document.getElementById('home');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!home) return;

  const homeEl    = home;
  const shelvesEl = panel.querySelector('[data-level="shelves"]');
  const boxesEl   = panel.querySelector('[data-level="boxes"]');
  const subEl     = panel.querySelector('.ex-sub');
  const closeBtn  = panel.querySelector('.ex-close');

  let data = [];
  try { data = JSON.parse(panel.dataset.explore); } catch (e) { return; }
  if (!data || !data.length) return;

  const totalBoxes = data.reduce((s, sh) => s + (sh.boxes ? sh.boxes.length : 0), 0);
  subEl.textContent = data.length + ' shelves · ' + totalBoxes + ' boxes';

  const fmtKg  = g => (g / 1000).toFixed(2);
  const fmtEur = v => '€' + (v % 1 === 0 ? v : v.toFixed(2));

  function statHtml(s, small) {
    const cl = small ? 'ex-box-stats' : 'ex-shelf-stats';
    return '<dl class="' + cl + '">' +
      '<div><dt>Specimens</dt><dd>' + s.count + '</dd></div>' +
      '<div><dt>Unique</dt><dd>'    + s.unique + '</dd></div>' +
      '<div><dt>Pieces</dt><dd>'    + s.pieces + '</dd></div>' +
      '<div><dt>Weight</dt><dd>' + fmtKg(s.weight_g) + '<small>kg</small></dd></div>' +
      '<div><dt>Invested</dt><dd>' + fmtEur(s.price) + '</dd></div>' +
      '</dl>';
  }

  const ISLAND_COLORS = ['#5bbd86', '#5aa6e0', '#a98bcf', '#e08585'];
  const totalSpecs = data.reduce((s, sh) => s + sh.count, 0) || 1;

  shelvesEl.innerHTML = data.map((sh, i) =>
    '<button class="ex-shelf" type="button" data-shelf="' + sh.shelf + '" style="--i:' + i + ';--c:' + ISLAND_COLORS[i % ISLAND_COLORS.length] + '">' +
      '<span class="ex-shelf-badge">' + sh.shelf + '</span>' +
      '<span class="ex-shelf-name">Shelf ' + sh.shelf + '</span>' +
      '<span class="ex-share"><i style="--w:' + (sh.count / totalSpecs) + '"></i></span>' +
      statHtml(sh) +
    '</button>'
  ).join('');

  /* ---- Camera ---- */
  const DUR = reduced ? 0 : 1100;
  const MARGIN = 28;
  const lerp   = (a, b, t) => a + (b - a) * t;
  const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const cam = { tx: 0, ty: 0, s: 1 };
  let expanded = false, busy = false, savedScroll = 0, activeShelf = null;

  const setCam = () => {
    homeEl.style.transform = (cam.s === 1 && !cam.tx && !cam.ty) ? ''
      : 'translate3d(' + cam.tx.toFixed(2) + 'px,' + cam.ty.toFixed(2) + 'px,0) scale(' + cam.s.toFixed(4) + ')';
    homeEl.style.setProperty('--inv', (1 / cam.s).toFixed(4));
  };

  function flyTo(to, ms, done) {
    const from = { ...cam }, t0 = performance.now();
    if (!ms) { Object.assign(cam, to); setCam(); if (done) done(); return; }
    homeEl.classList.add('anim');
    (function step(now) {
      const p = Math.max(0, Math.min((now - t0) / ms, 1)), k = easeIO(p);
      cam.tx = lerp(from.tx, to.tx, k);
      cam.ty = lerp(from.ty, to.ty, k);
      cam.s  = lerp(from.s,  to.s,  k);
      setCam();
      if (p < 1) requestAnimationFrame(step);
      else {
        Object.assign(cam, to); setCam();
        homeEl.classList.remove('anim');
        if (done) done();
      }
    })(t0);
  }

  function lockScroll(on) {
    const b = document.body.style;
    if (on) {
      savedScroll = window.scrollY;
      b.position = 'fixed';
      b.top    = '-' + savedScroll + 'px';
      b.left   = '0';
      b.right  = '0';
      b.width  = '100%';
    } else {
      b.position = b.top = b.left = b.right = b.width = '';
      window.scrollTo(0, savedScroll);
    }
  }

  const navBottom = () => {
    const n = document.querySelector('body > header, header, nav');
    return n ? Math.max(0, n.getBoundingClientRect().bottom) : 0;
  };

  /* ---- Open / close ---- */
  function open() {
    if (expanded || busy) return;
    if (homeEl.classList.contains('focus-map')) return;

    busy = true;
    showShelves();
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    lockScroll(true);

    const r = panel.getBoundingClientRect();
    const h = homeEl.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const top = navBottom(), availH = vh - top;

    const PAD = 28;
    const s = Math.min(
      (vw      - 2 * PAD) / r.width,
      (availH  - 2 * PAD) / r.height,
      2.4
    );

    const rx = r.left - h.left;
    const ry = r.top  - h.top;
    const tx = PAD      - h.left - s * rx;
    const ty = top + PAD - h.top  - s * ry;

    homeEl.classList.remove('settled');
    homeEl.classList.add('focus-explore');
    flyTo({ tx, ty, s }, DUR, () => {
      expanded = true; busy = false;
      homeEl.classList.add('settled');
    });
  }

  function close(instant) {
    if (!expanded || busy) return;
    expanded = false; busy = true;
    homeEl.classList.remove('settled');
    homeEl.classList.add('closing');
    homeEl.classList.remove('focus-explore');
    flyTo({ tx: 0, ty: 0, s: 1 }, instant ? 0 : DUR, () => {
      lockScroll(false);
      busy = false;
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      homeEl.classList.remove('closing');
    });
  }

  /* ---- Level switching ---- */
  function showShelves() {
    shelvesEl.hidden = false;
    boxesEl.hidden   = true;
    activeShelf = null;
    subEl.textContent = data.length + ' shelves · ' + totalBoxes + ' boxes';
  }

  function showBoxes(shelfNum) {
    const sh = data.find(d => d.shelf === shelfNum);
    if (!sh) return;
    activeShelf = shelfNum;
    shelvesEl.hidden = true;
    boxesEl.hidden   = false;
    subEl.textContent = 'Shelf ' + shelfNum + ' · ' + sh.boxes.length + (sh.boxes.length === 1 ? ' box' : ' boxes');

    const col = ISLAND_COLORS[data.indexOf(sh) % ISLAND_COLORS.length];
    boxesEl.style.setProperty('--c', col);

    let html = '<div class="ex-box-toolbar">' +
      '<button class="ex-back" type="button">← Shelves</button>' +
      '<button class="ex-all" type="button">ALL <em>Shelf ' + shelfNum + '</em></button>' +
    '</div>';

    html += '<div class="ex-box-grid">' + sh.boxes.map((b, i) =>
      '<button class="ex-box" type="button" data-box="' + b.box + '" style="--i:' + i + '">' +
        '<span class="ex-box-badge">B' + b.box + '</span>' +
        '<span class="ex-share"><i style="--w:' + (sh.count ? b.count / sh.count : 0) + '"></i></span>' +
        statHtml(b, true) +
      '</button>'
    ).join('') + '</div>';

    boxesEl.innerHTML = html;
  }

  panel.addEventListener('pointermove', e => {
    const t = e.target.closest('.ex-shelf, .ex-box');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', (e.clientX - r.left) / cam.s + 'px');
    t.style.setProperty('--my', (e.clientY - r.top) / cam.s + 'px');
  });

  /* ---- Events ---- */
  btn.addEventListener('click', open);
  closeBtn.addEventListener('click', () => close());

  panel.addEventListener('click', e => {
    const shelfBtn = e.target.closest('.ex-shelf');
    if (shelfBtn) { showBoxes(parseInt(shelfBtn.dataset.shelf, 10)); return; }
    if (e.target.closest('.ex-back')) { showShelves(); return; }
    if (e.target.closest('.ex-all'))  { location.href = '/collection/?locate=S' + activeShelf; return; }
    const boxBtn = e.target.closest('.ex-box');
    if (boxBtn) { location.href = '/collection/?locate=B' + boxBtn.dataset.box; return; }
  });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.addEventListener('pointerdown', e => {
    if (expanded && !busy && !panel.contains(e.target) && !e.target.closest('header, nav')) close();
  });
  window.addEventListener('resize', () => { if (expanded && !busy) close(true); });
})();