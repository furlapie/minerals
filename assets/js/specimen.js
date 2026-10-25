(function () {
  const root = document.getElementById('detail');
  if (!root) return;

  /* ════════════════════════════════════════════════════════
     1. ENTRANCE
     Marks the block as .js, forces a synchronous layout read,
     then flips to .in. The read guarantees the browser has
     painted the "before" state, so the CSS transition fires
     even on cold loads where two class changes would otherwise
     be batched into a single style pass.
     ════════════════════════════════════════════════════════ */
  root.classList.add('js');
  void root.offsetHeight;

  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));


  /* ════════════════════════════════════════════════════════
     2. LIGHTBOX — PAN & ZOOM
     Opens the hero image full-screen. Wheel zooms anchored at
     the cursor, pointer drag pans once zoomed, click zooms
     ×2 at the click point, double-click resets, Escape closes.
     The transform is expressed entirely through three CSS
     vars (--lbs, --lbx, --lby) so JS never touches the
     transform string directly.
     ════════════════════════════════════════════════════════ */
  const frame   = document.getElementById('heroFrame');
  const lb      = document.getElementById('lightbox');
  const lbImg   = document.getElementById('lbImage');
  const lbClose = lb.querySelector('.lb-close');
  const heroImg = frame ? frame.querySelector('img') : null;
  const largeSrc = frame ? frame.dataset.large : '';
  let lbToken = 0;

  const MIN_S = 1, MAX_S = 3;

  let s = 1;
  let x = 0, y = 0;
  let dragging = false;
  let startX = 0, startY = 0;
  let startTX = 0, startTY = 0;
  let moved = false;

  function apply() {
    lbImg.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`;
    lbImg.classList.toggle('is-zoomed', s > 1.001);
  }
  function reset() {
    s = 1; x = 0; y = 0; dragging = false; moved = false;
    lbImg.classList.remove('is-dragging', 'is-zoomed');
    apply();
  }
  /* Keep the panned image overlapping the viewport — never let the
     user drag past the edge and see empty space. */
  function clamp() {
    if (s <= 1) { x = 0; y = 0; return; }
    const w = lbImg.offsetWidth;
    const h = lbImg.offsetHeight;
    const maxX = Math.max(0, (w * s - window.innerWidth)  / 2);
    const maxY = Math.max(0, (h * s - window.innerHeight) / 2);
    if (x >  maxX) x =  maxX;
    if (x < -maxX) x = -maxX;
    if (y >  maxY) y =  maxY;
    if (y < -maxY) y = -maxY;
  }
  /* Zoom centred on (cx, cy) — the point under the cursor stays
     under the cursor. */
  function zoomAt(cx, cy, newS) {
    newS = Math.max(MIN_S, Math.min(MAX_S, newS));
    if (newS === s) return;
    const k = newS / s;
    const dx = cx - window.innerWidth  / 2;
    const dy = cy - window.innerHeight / 2;
    x = x * k + (1 - k) * dx;
    y = y * k + (1 - k) * dy;
    s = newS;
    clamp();
    apply();
  }

  function openLightbox() {
    if (!frame || frame.classList.contains('no-img') || !heroImg || !heroImg.src) return;
    lbImg.src = heroImg.src;                       // opens instantly with the 1800px file
    lbImg.alt = heroImg.alt || '';
    lb.hidden = false;
    lb.setAttribute('aria-hidden', 'false');
    reset();
    requestAnimationFrame(() => lb.classList.add('open'));
    document.documentElement.style.overflow = 'hidden';
    lbToken++;
  }
  function closeLightbox() {
    lbToken++;                                     // cancels any pending upgrade
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    setTimeout(() => {
      lb.hidden = true;
      lbImg.src = '';
      reset();
    }, 300);
  }

  if (frame) {
    frame.addEventListener('click', openLightbox);
    frame.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(); }
    });
  }
  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  lb.addEventListener('wheel', e => {
    if (!lb.classList.contains('open')) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(e.clientX, e.clientY, s * factor);
  }, { passive: false });

  lbImg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    if (s <= 1.001) return;
    e.preventDefault();
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startTX = x;
    startTY = y;
    lbImg.classList.add('is-dragging');
    try { lbImg.setPointerCapture(e.pointerId); } catch (_) {}
  });
  lbImg.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
    x = startTX + dx;
    y = startTY + dy;
    clamp();
    apply();
  });
  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    lbImg.classList.remove('is-dragging');
    try { lbImg.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  lbImg.addEventListener('pointerup', endDrag);
  lbImg.addEventListener('pointercancel', endDrag);

  lbImg.addEventListener('click', e => {
    if (moved) { moved = false; return; }
    if (s > 1.001) return;
    zoomAt(e.clientX, e.clientY, 2);
  });

  lbImg.addEventListener('dblclick', e => {
    e.preventDefault();
    reset();
  });


  /* ════════════════════════════════════════════════════════
     3. NAV THUMBNAIL SCALING
     The nav rows change height on hover (flex-grow .75 → 1.5).
     A ResizeObserver tracks each row's border-box height and
     writes --thumb-size = h * 0.55 (clamped 48–96px), so the
     thumbnail grows / shrinks in lockstep with the row. The
     entry's borderBoxSize avoids forcing a reflow to read it.
     ════════════════════════════════════════════════════════ */
  (function () {
    const items = document.querySelectorAll('.spec-nav .nav-item:not(.nav-empty)');
    if (!items.length || !window.ResizeObserver) return;

    const MIN = 48, MAX = 96, RATIO = 0.55;

    const apply = (el, h) => {
      const size = Math.round(Math.max(MIN, Math.min(MAX, h * RATIO)));
      el.style.setProperty('--thumb-size', size + 'px');
    };

    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const h = e.borderBoxSize?.[0]?.blockSize
              ?? e.contentRect.height;
        apply(e.target, h);
      }
    });

    items.forEach(el => {
      apply(el, el.clientHeight);
      ro.observe(el);
    });
  })();


  /* ════════════════════════════════════════════════════════
     4. WORLD MAP — ZOOM TO REGION + OVERLAY SIDE
     If the specimen has a mapped origin, highlights the region
     and animates the SVG viewBox from a wide frame to a tight
     one. Retries up to 3 animation frames because on cold
     loads the SVG can still be 0×0 when getBBox() first runs,
     which would produce a degenerate viewBox and no zoom.
     Also picks which corner of the map the provenance overlay
     sits in (opposite of the region's centroid).
     ════════════════════════════════════════════════════════ */
  const ocMap = root.querySelector('.oc-map');
  if (!ocMap) return;

  const svg = ocMap.querySelector('svg');
  if (!svg) return;

  const overlay  = ocMap.querySelector('.oc-overlay');
  const regionId = ocMap.dataset.region || '';

  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svg.querySelectorAll('.area').forEach(p => {
    p.style.removeProperty('--wm-fill');
    p.style.removeProperty('--wm-rim');
  });

  if (!regionId) return;

  const target = svg.querySelector('#' + CSS.escape(regionId));
  if (!target) return;

  target.classList.add('active');

  (function () {
    const NS = 'http://www.w3.org/2000/svg';
    const d = target.getAttribute('d');
    if (!d) return;

    const border = document.createElementNS(NS, 'path');
    border.setAttribute('class', 'oc-border');
    border.setAttribute('d', d);
    svg.appendChild(border);
  })();

  const zoomToTarget = () => {
    try {
      const bb = target.getBBox();
      /* Bail + retry if the SVG hasn't been laid out yet. */
      if (!bb || bb.width === 0 || bb.height === 0) return false;

      const padX = bb.width  * 0.35;
      const padY = bb.height * 0.35;
      const vx = bb.x - padX;
      const vy = bb.y - padY;
      const vw = bb.width  + padX * 2;
      const vh = bb.height + padY * 2;

      /* Start wide, then settle to the padded frame 60ms later —
         the SVG's own transition:transform handles the easing. */
      const startPad = 1.9;
      const sx = bb.x - bb.width  * startPad;
      const sy = bb.y - bb.height * startPad;
      const sw = bb.width  * (startPad * 2 + 1);
      const sh = bb.height * (startPad * 2 + 1);

      svg.setAttribute('viewBox', `${sx} ${sy} ${sw} ${sh}`);
      setTimeout(() => {
        svg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
      }, 60);

      /* Pin the overlay to the opposite corner of the region. */
      if (overlay) {
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;
        const svgW = 66989, svgH = 31063;
        overlay.dataset.side = cx < svgW / 2 ? 'right' : 'left';
        overlay.dataset.v    = cy < svgH / 2 ? 'bottom' : 'top';
      }
      return true;
    } catch (_) {
      /* getBBox() can throw on hidden SVGs — treat as "not ready". */
      return false;
    }
  };

  let tries = 0;
  const tryZoom = () => {
    if (zoomToTarget() || ++tries >= 3) return;
    requestAnimationFrame(tryZoom);
  };
  requestAnimationFrame(tryZoom);

  /* ── Composition carousel ─────────────────────────────── */
  (function () {
    const root = document.querySelector('#detail .composition');
    if (!root) return;
    const slides = root.querySelectorAll('.comp-slide');
    if (slides.length < 2) return;

    const dots = root.querySelectorAll('.comp-dots i');
    let i = 0;

    const nextBtn = root.querySelector('[data-comp-dir="next"]');
    const prevBtn = root.querySelector('[data-comp-dir="prev"]');

    const goTo = (n) => {
      slides[i].hidden = true;
      dots[i]?.classList.remove('on');
      i = ((n % slides.length) + slides.length) % slides.length;
      slides[i].hidden = false;
      dots[i]?.classList.add('on');
    };

    nextBtn.addEventListener('click', () => goTo(i + 1));
    prevBtn.addEventListener('click', () => goTo(i - 1));
  })();
})();