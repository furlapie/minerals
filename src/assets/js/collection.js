  /* ════════════════════════════════════════════════════════
     FPS DEBUG COUNTER  (temporary — remove when done)
     ════════════════════════════════════════════════════════ 
  (function fpsCounter() {
    const el = document.createElement('div');
    el.id = 'fpsDebug';
    el.style.cssText = `
      position: fixed; top: 14px; right: 14px; z-index: 99999;
      padding: 8px 12px; border-radius: 8px;
      background: rgba(0,0,0,.82); color: #ccc;
      font-family: Consolas, monospace; font-size: 11px;
      letter-spacing: .04em; line-height: 1.5;
      pointer-events: none;
      border: 1px solid rgba(255,255,255,.14);
      box-shadow: 0 6px 18px rgba(0,0,0,.45);
      text-align: right; min-width: 130px;
    `;
    document.body.appendChild(el);

    let frames = 0, longFrames = 0, worst = 0;
    let lastSample = performance.now();
    let lastFrame  = performance.now();

    (function tick(now) {
      requestAnimationFrame(tick);
      const delta = now - lastFrame;
      lastFrame = now;

      frames++;
      if (delta > 25) longFrames++;   // >25 ms = one dropped frame at 60 Hz
      if (delta > worst) worst = delta;

      if (now - lastSample >= 1000) {
        const secs = (now - lastSample) / 1000;
        const fps  = Math.round(frames / secs);
        const col  = fps >= 55 ? '#3ddc63' : fps >= 40 ? '#ffd23d' : '#ff5c5c';

        el.innerHTML =
          `<b style="color:${col};font-size:15px;letter-spacing:0">${fps} fps</b>` +
          `<br>worst ${worst.toFixed(1)}ms` +
          `<br>long&nbsp;frames ${longFrames}`;

        frames = 0;
        longFrames = 0;
        worst = 0;
        lastSample = now;
      }
    })(performance.now());
  })(); */

document.addEventListener('DOMContentLoaded', function () {

  if (window.__COLL__) { console.warn('[collection] script ran twice — ignoring duplicate'); return; }
  window.__COLL__ = true;

  try {

  /* ════════════════════════════════════════════════════════
     1. DOM REFERENCES & STATE
     ════════════════════════════════════════════════════════ */

  const coll         = document.getElementById('coll');
  const table        = document.getElementById('specimenTable');
  const tbody        = table.querySelector('tbody');
  const rows         = Array.from(tbody.querySelectorAll('tr'));
  const originalRows = Array.from(rows);
  const gallery      = document.getElementById('gallery');
  const cards        = Array.from(gallery.querySelectorAll('.g-card'));
  const reduced      = matchMedia('(prefers-reduced-motion: reduce)').matches;

  originalRows.forEach((r, i) => {
    r._card = cards[i];
    r._cells = Array.from(r.cells);
    r._searchText = r.textContent.toLowerCase();
    r._habitValues = (r.dataset.habit || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
    const colorCell = r._cells[1];
    colorCell._colors = (colorCell.dataset.colors || '').split('|').filter(Boolean);
    r._cells.forEach(cell => {
      cell._text = cell.textContent.trim();
      cell._textLower = cell._text.toLowerCase();
    });
  });

  const toggles         = table.querySelectorAll('.filter-toggle');
  const popups          = table.querySelectorAll('.filter-popup');
  const sortBtns        = table.querySelectorAll('.sort-btn');
  const textInputs      = table.querySelectorAll('.filter-text');
  const numberInputs    = table.querySelectorAll('.filter-number');
  const colorFilterBtns = table.querySelectorAll('.color-filter-btn');
  const typeFilterBtns  = table.querySelectorAll('.type-filter-btn');

  const shinyFilterBtn = table.querySelector('.shiny-filter-btn');
  const wipFilterBtn   = table.querySelector('.wip-filter-btn');
  const tierPopup      = table.querySelector('.filter-popup[data-col="11"]');
  const backToTopBtn   = document.getElementById('backToTop');

  const globalSearch  = document.getElementById('globalSearch');
  const activeChipsEl = document.getElementById('activeChips');
  const resultCountEl = document.getElementById('resultCount');
  const densityToggle = document.getElementById('densityToggle');
  const clearAllBtn   = document.getElementById('clearAll');
  const emptyClearBtn = document.getElementById('emptyClear');
  const emptyState    = document.getElementById('emptyState');

  const footerCount  = document.getElementById('footerCount');
  const footerPieces = document.getElementById('footerPieces');
  const footerWeight = document.getElementById('footerWeight');
  const footerSpent  = document.getElementById('footerSpent');

  const railTypeBtns  = Array.from(document.querySelectorAll('.rail .tp'));
  const railTierBtns  = Array.from(document.querySelectorAll('.rail .tt'));
  const railColorBtns = Array.from(document.querySelectorAll('.rail .cd'));
  const railShiny     = document.getElementById('railShiny');
  const railWip       = document.getElementById('railWip');
  const viewBtns      = Array.from(document.querySelectorAll('.ct-seg-btn'));
  const modelsGrid    = document.getElementById('modelsGrid');
  const totalCountEl  = document.getElementById('totalCount');
  const specimenTotal = totalCountEl.textContent;
  let modelCards      = Array.from(modelsGrid.querySelectorAll('.model-card'));
  let urlHabitFilter  = null;
  let modelHabit      = '';
  let _scrolling      = false;
  let _scrollGuardTimer = 0;
  let _shimmerRow     = null;
  let _shimmerTimer   = 0;
  const modelGroups   = Array.from(modelsGrid.querySelectorAll('.model-group'));

  function debounce(fn, delay = 150) {
    let timer;
    return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); };
  }
  const debouncedApply = debounce(applyAllFilters, 150);

  setTimeout(() => coll.classList.remove('enter'), reduced ? 0 : 1800);


  /* ════════════════════════════════════════════════════════
     2. FILTER POPUP TOGGLES
     ════════════════════════════════════════════════════════ */

  popups.forEach(popup => popup.addEventListener('click', e => e.stopPropagation()));

  toggles.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const col    = this.dataset.col;
      const popup  = table.querySelector(`.filter-popup[data-col="${col}"]`);
      const isOpen = popup.classList.contains('open');

      popups.forEach(p => p.classList.remove('open'));
      if (!isOpen) popup.classList.add('open');

      requestAnimationFrame(() => clampPopupToTable(popup));

      toggles.forEach(t => {
        const associated = table.querySelector(`.filter-popup[data-col="${t.dataset.col}"]`);
        t.setAttribute('aria-expanded', associated.classList.contains('open'));
      });
    });
  });

  document.addEventListener('click', function () {
    popups.forEach(p => {
      p.classList.remove('open');
      const t = table.querySelector(`.filter-toggle[data-col="${p.dataset.col}"]`);
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  });

  function clampPopupToTable(popup) {
    popup.style.transform = '';
    const wrap = table.parentElement;
    const wr   = wrap.getBoundingClientRect();
    const pr   = popup.getBoundingClientRect();
    const overflowRight = pr.right - wr.right;
    const overflowLeft  = wr.left  - pr.left;
    if (overflowRight > 0)      popup.style.transform = `translateX(-${overflowRight + 4}px)`;
    else if (overflowLeft > 0)  popup.style.transform = `translateX(${overflowLeft + 4}px)`;
  }


  /* ════════════════════════════════════════════════════════
     3. SORT
     ════════════════════════════════════════════════════════ */

  sortBtns.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (this.classList.contains('active')) {
        this.classList.remove('active'); this.setAttribute('aria-pressed', 'false'); applyAllFilters(); return;
      }
      sortBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      this.classList.add('active'); this.setAttribute('aria-pressed', 'true'); applyAllFilters();
    });
  });


  /* ════════════════════════════════════════════════════════
     4. FILTER CONTROLS
     ════════════════════════════════════════════════════════ */

  if (globalSearch) globalSearch.addEventListener('input', debouncedApply);

  textInputs.forEach(input => {
    input.addEventListener('input', function () {
      const col    = parseInt(this.closest('.filter-popup').dataset.col);
      const value  = this.value.toLowerCase().trim();
      const toggle = table.querySelector(`.filter-toggle[data-col="${col}"]`);
      toggle.classList.toggle('active', value.length > 0);
      debouncedApply();
    });
  });

  numberInputs.forEach(input => input.addEventListener('input', debouncedApply));
  table.querySelectorAll('.filter-operator').forEach(el => el.addEventListener('change', applyAllFilters));

  colorFilterBtns.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isActive    = this.classList.contains('active');
      const isExclusive = this.classList.contains('exclusive');
      if (!isActive) {
        colorFilterBtns.forEach(b => { b.classList.remove('active', 'exclusive'); b.setAttribute('aria-pressed', 'false'); });
        this.classList.add('active'); this.setAttribute('aria-pressed', 'true');
      } else if (!isExclusive) {
        this.classList.add('exclusive');
      } else {
        this.classList.remove('active', 'exclusive'); this.setAttribute('aria-pressed', 'false');
      }
      applyAllFilters();
    });
  });

  [shinyFilterBtn, wipFilterBtn].forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      this.classList.toggle('active');
      this.setAttribute('aria-pressed', this.classList.contains('active'));
      applyAllFilters();
    });
  });

  typeFilterBtns.forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isActive = this.classList.contains('active');
      typeFilterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      if (!isActive) { this.classList.add('active'); this.setAttribute('aria-pressed', 'true'); }
      applyAllFilters();
    });
  });


  /* ════════════════════════════════════════════════════════
     4a. QUICK-FILTER RAIL
     ════════════════════════════════════════════════════════ */

  railTypeBtns.forEach(b => b.addEventListener('click', () => {
    const real = table.querySelector(`.type-filter-btn[data-type-value="${b.dataset.type}"]`);
    if (real) real.click();
  }));

  railTierBtns.forEach(b => b.addEventListener('click', () => {
    const op  = tierPopup.querySelector('.filter-operator');
    const num = tierPopup.querySelector('.filter-number');
    if (op.value === 'eq' && num.value === b.dataset.tier) num.value = '';
    else { op.value = 'eq'; num.value = b.dataset.tier; }
    applyAllFilters();
  }));

  railShiny.addEventListener('click', () => shinyFilterBtn.click());
  railWip.addEventListener('click',   () => wipFilterBtn.click());

  railColorBtns.forEach(b => b.addEventListener('click', () => {
    const real = table.querySelector(`.color-filter-btn[data-color="${b.dataset.color}"]`);
    if (real) real.click();
  }));

  (function () {
    const counts = {};
    rows.forEach(r => {
      (r.querySelector('.color-cell').dataset.colors || '').split('|').filter(Boolean)
        .forEach(h => { counts[h] = (counts[h] || 0) + 1; });
    });
    railColorBtns.forEach(b => {
      const n = counts[b.dataset.color] || 0;
      b.title = b.dataset.name + ' · ' + n;
      if (!n) b.classList.add('empty');
    });
  })();

  function setOn(btn, on) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncRails() {
    const activeType = table.querySelector('.type-filter-btn.active');
    railTypeBtns.forEach(b => setOn(b, !!activeType && activeType.dataset.typeValue === b.dataset.type));
    const op = tierPopup.querySelector('.filter-operator').value;
    const tv = parseFloat(tierPopup.querySelector('.filter-number').value);
    railTierBtns.forEach(b => setOn(b, op === 'eq' && tv === parseInt(b.dataset.tier)));
    setOn(railShiny, shinyFilterBtn.classList.contains('active'));
    setOn(railWip,   wipFilterBtn.classList.contains('active'));
    const ac = table.querySelector('.color-filter-btn.active');
    railColorBtns.forEach(b => {
      const on = !!ac && ac.dataset.color === b.dataset.color;
      b.classList.toggle('on', on);
      b.classList.toggle('exc', on && ac.classList.contains('exclusive'));
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }


  /* ════════════════════════════════════════════════════════
     4b. VIEW SWITCH + DENSITY
     ════════════════════════════════════════════════════════ */

  function setView(v, persist = true) {
    coll.dataset.view = v;
    viewBtns.forEach(b => {
      const on = b.dataset.view === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    updateCounter();
    if (v === 'grid') syncGallery();
    if (v === 'models') {
      requestAnimationFrame(() => {
        if (typeof window.initModels3D === 'function') window.initModels3D();
        else console.warn('[collection] 3D module not loaded — models view unavailable');
      });
    }
    hidePeek();
    if (persist) try { localStorage.setItem('coll-view', v); } catch (_) {}
  }
  viewBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

  if (densityToggle) {
    try {
      if (localStorage.getItem('coll-density') === 'compact') {
        table.classList.add('compact');
        densityToggle.classList.add('active');
        densityToggle.setAttribute('aria-pressed', 'true');
      }
    } catch (_) {}
    densityToggle.addEventListener('click', function () {
      const compact = table.classList.toggle('compact');
      this.classList.toggle('active', compact);
      this.setAttribute('aria-pressed', compact ? 'true' : 'false');
      try { localStorage.setItem('coll-density', compact ? 'compact' : 'normal'); } catch (_) {}
    });
  }


  /* ════════════════════════════════════════════════════════
     4c. CLEAR ALL
     ════════════════════════════════════════════════════════ */

  function clearAllFilters() {
    textInputs.forEach(i => { i.value = ''; });
    numberInputs.forEach(i => { i.value = ''; });
    table.querySelectorAll('.filter-operator').forEach(s => { s.value = 'gt'; });
    colorFilterBtns.forEach(b => { b.classList.remove('active', 'exclusive'); b.setAttribute('aria-pressed', 'false'); });
    if (shinyFilterBtn) { shinyFilterBtn.classList.remove('active'); shinyFilterBtn.setAttribute('aria-pressed', 'false'); }
    if (wipFilterBtn)   { wipFilterBtn.classList.remove('active');   wipFilterBtn.setAttribute('aria-pressed', 'false'); }
    typeFilterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    sortBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    if (globalSearch) globalSearch.value = '';
    urlHabitFilter = null;
    applyAllFilters();
  }
  if (clearAllBtn)   clearAllBtn.addEventListener('click', clearAllFilters);
  if (emptyClearBtn) emptyClearBtn.addEventListener('click', clearAllFilters);


  /* ════════════════════════════════════════════════════════
     5. BACK TO TOP + KEYBOARD
     ════════════════════════════════════════════════════════ */

  backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); globalSearch.focus(); globalSearch.select(); }
    else if (e.key === 'Escape' && e.target === globalSearch) {
      if (globalSearch.value) { globalSearch.value = ''; applyAllFilters(); }
      globalSearch.blur();
    }
  });


  /* ════════════════════════════════════════════════════════
     5.b. COUNTER
     ════════════════════════════════════════════════════════ */
  function updateCounter() {
    let shown, total;
    if (coll.dataset.view === 'models') {
      const q = globalSearch.value.trim().toLowerCase();
      shown = 0;
      modelCards.forEach(c => {
        const hit = (!q || c.dataset.search.includes(q)) && (c._macro || !modelHabit || c.dataset.habitTag === modelHabit);
        c.hidden = !hit;
        if (hit) shown++;
      });
      modelGroups.forEach(g => {
        const n = g.querySelectorAll('.model-card:not([hidden])').length;
        g.hidden = n === 0;
        g.querySelector('.model-group-count').textContent = n;
      });
      total = modelCards.length;
    } else {
      shown = rows.filter(r => r.style.display !== 'none').length;
      total = specimenTotal;
    }
    resultCountEl.textContent = shown;
    totalCountEl.textContent = total;
    emptyState.hidden = shown > 0;
  }

  window.addEventListener('model-missing', e => {
    modelCards = modelCards.filter(c => c !== e.detail);
    e.detail.remove();
    updateCounter();
  });

  modelCards.forEach(c => { c._macro = c.closest('.model-group').dataset.kind === 'macro'; });
  (function () {
    const host = document.getElementById('modelTools');
    if (!host) return;
    const crystals = modelCards.filter(c => !c._macro);
    const counts = {};
    crystals.forEach(c => { const h = c.dataset.habitTag; counts[h] = (counts[h] || 0) + 1; });
    const habits = Object.keys(counts).sort();
    const hue = h => Math.round(habits.indexOf(h) * 137.5) % 360;
    crystals.forEach(c => c.style.setProperty('--hh', hue(c.dataset.habitTag)));
    host.innerHTML =
      '<div class="mt-chips">' +
        '<button type="button" class="mt-chip on" data-h="">All<em>' + crystals.length + '</em></button>' +
        habits.map(h => '<button type="button" class="mt-chip" data-h="' + h + '" style="--hh:' + hue(h) + '"><i></i>' + h + '<em>' + counts[h] + '</em></button>').join('') +
      '</div>' +
      '<div class="mt-sort"><button type="button" class="on" data-s="az">A–Z</button><button type="button" data-s="habit">By habit</button></div>';
    host.addEventListener('click', e => {
      const chip = e.target.closest('.mt-chip');
      const sort = e.target.closest('.mt-sort button');
      if (chip) {
        modelHabit = chip.dataset.h;
        host.querySelectorAll('.mt-chip').forEach(b => b.classList.toggle('on', b === chip));
        updateCounter();
      }
      if (sort) {
        host.querySelectorAll('.mt-sort button').forEach(b => b.classList.toggle('on', b === sort));
        crystals.forEach(c => { c.style.order = ''; });
        if (sort.dataset.s === 'habit') {
          crystals.slice()
            .sort((a, b) => a.dataset.habitTag.localeCompare(b.dataset.habitTag) || a.dataset.name.localeCompare(b.dataset.name))
            .forEach((c, i) => { c.style.order = i; });
        }
      }
    });
  })();


  /* ════════════════════════════════════════════════════════
     6. FILTER + SORT ENGINE
     ════════════════════════════════════════════════════════ */

  function applyAllFilters() {
    const filters = [];
    const globalQuery = globalSearch ? globalSearch.value.trim().toLowerCase() : '';

    textInputs.forEach(input => {
      const col   = parseInt(input.closest('.filter-popup').dataset.col);
      const value = input.value.toLowerCase().trim();
      if (value.length > 0) filters.push({ col, type: 'text', value });
    });

    numberInputs.forEach(input => {
      const popup    = input.closest('.filter-popup');
      const col      = parseInt(popup.dataset.col);
      const numValue = parseFloat(input.value);
      const operator = popup.querySelector('.filter-operator').value;
      if (!isNaN(numValue)) filters.push({ col, type: 'numeric', operator, value: numValue });
    });

    const activeColorBtn = table.querySelector('.color-filter-btn.active');
    if (activeColorBtn) {
      filters.push({ col: 1, type: 'color', value: activeColorBtn.dataset.color, exclusive: activeColorBtn.classList.contains('exclusive') });
    }
    if (shinyFilterBtn.classList.contains('active')) filters.push({ col: 1, type: 'shiny' });
    if (wipFilterBtn.classList.contains('active'))   filters.push({ col: 0, type: 'wip' });

    const activeTypeBtn = table.querySelector('.type-filter-btn.active');
    if (activeTypeBtn) filters.push({ col: 7, type: 'typeCategory', value: activeTypeBtn.dataset.typeValue });

    if (urlHabitFilter) filters.push({ type: 'habit', value: urlHabitFilter });

    rows.forEach(row => {
      const cells = row._cells;
      let show = true;

      if (globalQuery.length > 0 && !row._searchText.includes(globalQuery)) show = false;

      if (show) {
        for (const filter of filters) {
          const cellText = cells[filter.col] ? cells[filter.col]._text : '';
          if (filter.type === 'text') {
            if (filter.col === 0 && /^[sb]\d+$/i.test(filter.value)) {
              const tokens = cells[0]._textLower.split(/\s+/);
              if (!tokens.includes(filter.value)) { show = false; break; }
            } else if (!cells[filter.col]._textLower.includes(filter.value)) {
              show = false; break;
            }
          } else if (filter.type === 'numeric') {
            const rawValue = cells[filter.col].dataset.value;
            const numCell  = rawValue !== undefined ? parseFloat(rawValue) : parseFloat(cellText);
            if (isNaN(numCell)) { show = false; break; }
            if (filter.operator === 'gt' && numCell <= filter.value) { show = false; break; }
            if (filter.operator === 'lt' && numCell >= filter.value) { show = false; break; }
            if (filter.operator === 'eq' && numCell !== filter.value) { show = false; break; }
          } else if (filter.type === 'color') {
            const cellColors = (cells[filter.col]._colors || []);
            if (filter.exclusive) {
              if (!(cellColors.length === 1 && cellColors[0] === filter.value)) { show = false; break; }
            } else if (!cellColors.includes(filter.value)) { show = false; break; }
          } else if (filter.type === 'shiny') {
            if (cells[filter.col].dataset.shiny !== 'true') { show = false; break; }
          } else if (filter.type === 'wip') {
            if (cells[filter.col].dataset.wip !== 'true') { show = false; break; }
          } else if (filter.type === 'typeCategory') {
            if (cells[filter.col].dataset.type !== filter.value) { show = false; break; }
          } else if (filter.type === 'habit') {
            const rowHabits = row._habitValues;
            if (!rowHabits.includes(filter.value.toLowerCase())) { show = false; break; }
          }
        }
      }
      row.style.display = show ? '' : 'none';
      row.classList.remove('settled');
    });

    let sortCol = null, sortDir = null;
    sortBtns.forEach(btn => {
      if (btn.classList.contains('active')) {
        sortCol = parseInt(btn.closest('.filter-popup').dataset.col);
        sortDir = btn.dataset.sort;
      }
    });

    if (sortCol !== null && sortDir !== '') {
      const visibleRows = rows.filter(row => row.style.display !== 'none');
      visibleRows.sort((a, b) => {
        const aCell = a._cells[sortCol];
        const bCell = b._cells[sortCol];
        if (aCell.dataset.value !== undefined && bCell.dataset.value !== undefined) {
          const aVal = parseFloat(aCell.dataset.value);
          const bVal = parseFloat(bCell.dataset.value);
          if (!isNaN(aVal) && !isNaN(bVal)) return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aSortAttr = aCell.dataset.sortValue;
        const bSortAttr = bCell.dataset.sortValue;
        if (aSortAttr !== undefined && bSortAttr !== undefined) {
          const aVal = parseFloat(aSortAttr);
          const bVal = parseFloat(bSortAttr);
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aText = aCell.textContent.trim();
        const bText = bCell.textContent.trim();
        const aNum  = parseFloat(aText);
        const bNum  = parseFloat(bText);
        if (!isNaN(aNum) && !isNaN(bNum)) return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
        const aStr = aText.toLowerCase();
        const bStr = bText.toLowerCase();
        if (sortDir === 'asc') return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        return aStr < bStr ? 1 : aStr > bStr ? -1 : 0;
      });
      visibleRows.forEach(row => tbody.appendChild(row));
    } else {
      originalRows.forEach(row => tbody.appendChild(row));
    }

    updateCounter();
    if (coll.dataset.view === 'grid') syncGallery();
    updateFooterStats();
    rebuildChips();
    updateToggleHighlights();
    syncRails();
    hidePeek();
  }

  function syncGallery() {
    Array.from(tbody.children).forEach(row => {
      const card = row._card;
      if (!card) return;
      card.hidden = row.style.display === 'none';
      gallery.appendChild(card);
    });
  }


  /* ════════════════════════════════════════════════════════
     6b. FOOTER STATS + LIVE MIX
     ════════════════════════════════════════════════════════ */

  const TYPES      = ['Crystal', 'Gem', 'Rock', 'Mineral', 'Geode', 'Fossil'];
  const TYPE_COLOR = { Crystal: '#7cafe3', Gem: '#ff7c80', Rock: '#9da2ca', Mineral: '#2FA8A0', Geode: '#E8C547', Fossil: '#E08B2F' };
  const TIER_COLOR = { 1: '#ff7c80', 2: '#df8898', 3: '#be95b1', 4: '#9da2ca', 5: '#7cafe3' };

  const mixType = document.getElementById('mixType');
  const mixTier = document.getElementById('mixTier');
  const typeSegs = {}, tierSegs = {};

  TYPES.forEach(k => { const i = document.createElement('i'); i.style.background = TYPE_COLOR[k]; mixType.appendChild(i); typeSegs[k] = i; });
  [1, 2, 3, 4, 5].forEach(k => { const i = document.createElement('i'); i.style.background = TIER_COLOR[k]; mixTier.appendChild(i); tierSegs[k] = i; });

  function tween(el, to, dec, prefix) {
    prefix = prefix || '';
    const from = el._v || 0;
    el._v = to;
    if (reduced || from === to) { el.textContent = prefix + to.toFixed(dec); return; }
    if (el._raf) cancelAnimationFrame(el._raf);
    const t0 = performance.now(), dur = 550;
    (function frame(now) {
      const p = Math.min((now - t0) / dur, 1);
      const k = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = prefix + (from + (to - from) * k).toFixed(dec);
      if (p < 1) el._raf = requestAnimationFrame(frame);
    })(t0);
  }

  function updateFooterStats() {
    let pieces = 0, weight = 0, spent = 0, count = 0;
    const typeCount = {}, tierCount = {};
    rows.forEach(row => {
      if (row.style.display === 'none') return;
      const cells = row._cells;
      count++;
      pieces += parseFloat(cells[9].dataset.value)  || 0;
      weight += parseFloat(cells[8].dataset.value)  || 0;
      spent  += parseFloat(cells[10].dataset.value) || 0;
      const ty = cells[7].dataset.type, ti = cells[11].dataset.value;
      typeCount[ty] = (typeCount[ty] || 0) + 1;
      tierCount[ti] = (tierCount[ti] || 0) + 1;
    });
    tween(footerCount,  count,  0);
    tween(footerPieces, pieces, 0);
    tween(footerWeight, weight / 1000, 2);
    tween(footerSpent,  spent, spent % 1 === 0 ? 0 : 2, '€');
    TYPES.forEach(k => {
      const n = typeCount[k] || 0;
      typeSegs[k].style.flexGrow = n;
      typeSegs[k].style.display = n > 0 ? '' : 'none';
      typeSegs[k].title = k + ': ' + n;
    });
    [1, 2, 3, 4, 5].forEach(k => {
      const n = tierCount[k] || 0;
      tierSegs[k].style.flexGrow = n;
      tierSegs[k].style.display = n > 0 ? '' : 'none';
      tierSegs[k].title = 'Tier ' + k + ': ' + n;
    });
  }


  /* ════════════════════════════════════════════════════════
     6c. ACTIVE FILTER CHIPS
     ════════════════════════════════════════════════════════ */

  function fieldLabel(col) {
    const th = table.querySelector(`thead th:nth-child(${parseInt(col) + 1}) .th-label`);
    return th ? th.textContent.trim() : 'Field';
  }

  function makeChip(opts) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chip';
    if (opts.swatch) { const sw = document.createElement('span'); sw.className = 'chip-swatch'; sw.style.background = opts.swatch; btn.appendChild(sw); }
    const label = document.createElement('span'); label.className = 'chip-label'; label.textContent = opts.label; btn.appendChild(label);
    const x = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    x.setAttribute('viewBox', '0 0 24 24'); x.setAttribute('fill', 'none'); x.setAttribute('stroke', 'currentColor');
    x.setAttribute('stroke-width', '2.4'); x.setAttribute('stroke-linecap', 'round');
    const xp = document.createElementNS('http://www.w3.org/2000/svg', 'path'); xp.setAttribute('d', 'M18 6 6 18M6 6l12 12');
    x.appendChild(xp); btn.appendChild(x);
    btn.addEventListener('click', () => { opts.clear(); applyAllFilters(); });
    return btn;
  }

  function rebuildChips() {
    if (!activeChipsEl) return;
    activeChipsEl.innerHTML = '';
    const chips = [];
    if (globalSearch && globalSearch.value.trim().length > 0) chips.push({ label: 'Search: ' + globalSearch.value.trim(), clear: () => { globalSearch.value = ''; } });
    textInputs.forEach(input => {
      if (input.value.trim().length > 0) {
        const col = parseInt(input.closest('.filter-popup').dataset.col);
        chips.push({ label: fieldLabel(col) + ': ' + input.value.trim(), clear: () => { input.value = ''; } });
      }
    });
    numberInputs.forEach(input => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        const popup = input.closest('.filter-popup');
        const col   = parseInt(popup.dataset.col);
        const op    = popup.querySelector('.filter-operator').value;
        const sym   = { gt: '>', lt: '<', eq: '=' }[op];
        chips.push({ label: fieldLabel(col) + ' ' + sym + ' ' + val, clear: () => { input.value = ''; } });
      }
    });
    const activeColor = table.querySelector('.color-filter-btn.active');
    if (activeColor) {
      const hex = activeColor.dataset.color;
      const exc = activeColor.classList.contains('exclusive');
      const nm  = (document.querySelector(`.rail .cd[data-color="${hex}"]`) || {}).dataset;
      chips.push({ swatch: hex, label: (exc ? 'Only ' : 'Color ') + (nm && nm.name ? nm.name : hex), clear: () => activeColor.classList.remove('active', 'exclusive') });
    }
    if (shinyFilterBtn.classList.contains('active')) chips.push({ label: 'Shiny', clear: () => shinyFilterBtn.classList.remove('active') });
    if (wipFilterBtn.classList.contains('active'))   chips.push({ label: 'Work in progress', clear: () => wipFilterBtn.classList.remove('active') });
    const activeType = table.querySelector('.type-filter-btn.active');
    if (activeType) chips.push({ label: 'Type: ' + activeType.dataset.typeValue, clear: () => activeType.classList.remove('active') });
    if (urlHabitFilter) chips.push({ label: 'Habit: ' + urlHabitFilter, clear: () => { urlHabitFilter = null; } });
    const activeSort = table.querySelector('.sort-btn.active');
    if (activeSort) {
      const col = activeSort.closest('.filter-popup').dataset.col;
      const dir = activeSort.dataset.sort;
      chips.push({ label: fieldLabel(col) + ' ' + (dir === 'asc' ? '↑' : '↓'), clear: () => activeSort.classList.remove('active') });
    }
    if (chips.length === 0) { activeChipsEl.hidden = true; return; }
    activeChipsEl.hidden = false;
    chips.forEach(c => activeChipsEl.appendChild(makeChip(c)));
  }


  /* ════════════════════════════════════════════════════════
     7. TOGGLE HIGHLIGHT SYNC
     ════════════════════════════════════════════════════════ */

  function updateToggleHighlights() {
    toggles.forEach(t => t.classList.remove('active'));
    textInputs.forEach(input => {
      const col    = parseInt(input.closest('.filter-popup').dataset.col);
      const toggle = table.querySelector(`.filter-toggle[data-col="${col}"]`);
      if (input.value.trim().length > 0) toggle.classList.add('active');
    });
    numberInputs.forEach(input => {
      const col    = parseInt(input.closest('.filter-popup').dataset.col);
      const toggle = table.querySelector(`.filter-toggle[data-col="${col}"]`);
      if (!isNaN(parseFloat(input.value))) toggle.classList.add('active');
    });
    const activeColorBtn = table.querySelector('.color-filter-btn.active');
    const colorToggle    = table.querySelector('.filter-toggle[data-col="1"]');
    if (activeColorBtn || shinyFilterBtn.classList.contains('active')) colorToggle.classList.add('active');
    if (table.querySelector('.type-filter-btn.active')) table.querySelector('.filter-toggle[data-col="7"]').classList.add('active');
    if (wipFilterBtn.classList.contains('active'))      table.querySelector('.filter-toggle[data-col="0"]').classList.add('active');
    sortBtns.forEach(btn => {
      if (btn.classList.contains('active')) {
        const col = parseInt(btn.closest('.filter-popup').dataset.col);
        table.querySelector(`.filter-toggle[data-col="${col}"]`).classList.add('active');
      }
    });
  }


  /* ════════════════════════════════════════════════════════
     8. SCROLL GUARD
     ════════════════════════════════════════════════════════ */

  window.addEventListener('scroll', () => {
    _scrolling = true;
    document.body.classList.add('is-scrolling');
    clearTimeout(_scrollGuardTimer);
    _scrollGuardTimer = setTimeout(() => {
      _scrolling = false;
      document.body.classList.remove('is-scrolling');
    }, 140);
  }, { passive: true });


  /* ════════════════════════════════════════════════════════
     8a. SHIMMER SETTLE
     Adds .settled to a row only after the pointer has been
     on it for 250ms without moving to another row. This is
     what fires the expensive background-clip:text shimmer.
     ════════════════════════════════════════════════════════ */

  tbody.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const row = e.target.closest('tr');
    if (!row || row === _shimmerRow) return;
    if (_shimmerRow) _shimmerRow.classList.remove('settled');
    _shimmerRow = row;
    clearTimeout(_shimmerTimer);
    _shimmerTimer = setTimeout(() => row.classList.add('settled'), 250);
  });
  tbody.addEventListener('pointerleave', () => {
    clearTimeout(_shimmerTimer);
    if (_shimmerRow) _shimmerRow.classList.remove('settled');
    _shimmerRow = null;
  });


  /* ════════════════════════════════════════════════════════
     8b. HOVER PEEK
     Trigger: pointerover (fires once per row transition).
     Position: pointermove on document, guarded by peekRow
     so that when the peek is off OR no row is hovered the
     handler returns in a couple of ns.
     ════════════════════════════════════════════════════════ */

  const peek = document.getElementById('peek');
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let peekRow = null, peekRaf = 0;
  let peekEnabled = true;
  try { peekEnabled = localStorage.getItem('coll-peek') !== 'off'; } catch (_) {}

  function hidePeek() {
    peekRow = null;
    if (peekRaf) { cancelAnimationFrame(peekRaf); peekRaf = 0; }
    if (peek) peek.classList.remove('on');
  }

  const peekToggle = document.getElementById('peekToggle');
  function syncPeekToggle() {
    if (!peekToggle) return;
    peekToggle.setAttribute('aria-pressed', peekEnabled ? 'true' : 'false');
    peekToggle.title = peekEnabled ? 'Hover preview: on' : 'Hover preview: off';
  }
  syncPeekToggle();

  function setPeekEnabled(on) {
    peekEnabled = !!on;
    syncPeekToggle();
    if (!peekEnabled) hidePeek();
    try { localStorage.setItem('coll-peek', peekEnabled ? 'on' : 'off'); } catch (_) {}
  }
  if (peekToggle) peekToggle.addEventListener('click', () => setPeekEnabled(!peekEnabled));

  if (peek && canHover) {
    const pImg  = peek.querySelector('img');
    const pName = peek.querySelector('.peek-meta b');

    pImg.addEventListener('error', () => peek.classList.add('noimg'));
    pImg.addEventListener('load',  () => peek.classList.remove('noimg'));

    let peekW = 0, peekH = 0;
    let px = 0, py = 0;

    function place() {
      peekRaf = 0;
      if (!peekW) { peekW = peek.offsetWidth; peekH = peek.offsetHeight; }
      let x = px + 24;
      if (x + peekW > window.innerWidth - 12) x = px - 24 - peekW;
      const y = Math.max(12, Math.min(window.innerHeight - peekH - 12, py - peekH / 2));
      peek.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    function showPeek(row) {
      peekRow = row;
      peek.style.setProperty('--c', TYPE_COLOR[row.dataset.type] || '');
      
      // Clear the previous image source to force a blank state while the new one loads
      const newSrc = row.dataset.img;
      if (newSrc) {
        peek.classList.remove('noimg');
        if (pImg.getAttribute('src') !== newSrc) {
          pImg.removeAttribute('src'); // Prevent showing the old image
          pImg.src = newSrc;
        }
      } else {
        peek.classList.add('noimg');
        pImg.removeAttribute('src');
      }

      pName.textContent = row.querySelector('.title-cell a').textContent;
      peek.classList.add('on');
      if (!peekRaf) peekRaf = requestAnimationFrame(place);
    }

    /* Trigger: fires only when the pointer crosses into a new
       row. Cheap even on rapid scrubbing — one call per row. */
    tbody.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      if (!peekEnabled || _scrolling) return;
      const row = e.target.closest('tr');
      if (!row || row === peekRow) return;
      showPeek(row);
    });

    /* Position: fires constantly, but guards out immediately
       when the peek isn't showing or the tab isn't active. */
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !peekRow || !peekEnabled || _scrolling) return;
      px = e.clientX; py = e.clientY;
      if (!peekRaf) peekRaf = requestAnimationFrame(place);
    });

    tbody.addEventListener('pointerleave', hidePeek);
    window.addEventListener('scroll', hidePeek, { passive: true });

    /* Preload all peek thumbnails during idle time to eliminate
       the 10–50 ms first-hover image decode hitch that was
       contributing to the stutter on rapid scrubbing. */
    (function preloadThumbs() {
      const urls = new Set();
      rows.forEach(r => { const s = r.dataset.img; if (s) urls.add(s); });
      const list = Array.from(urls);
      let i = 0;
      const load = () => {
        const end = Math.min(i + 4, list.length);
        for (; i < end; i++) { const img = new Image(); img.decoding = 'async'; img.src = list[i]; }
        if (i < list.length) {
          if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 2000 });
          else setTimeout(load, 200);
        }
      };
      if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
      else setTimeout(load, 500);
    })();
  }


  /* ════════════════════════════════════════════════════════
     9. URL PARAMS
     ════════════════════════════════════════════════════════ */

  try {
    (function applyUrlParams() {
      const q = new URLSearchParams(location.search);
      if (![...q.keys()].length) return;
      const press = btn => { btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true'); };
      const color = q.get('color');
      if (color) { const btn = table.querySelector(`.color-filter-btn[data-color="${color}"]`); if (btn) press(btn); }
      if (q.get('shiny') === '1') press(shinyFilterBtn);
      if (q.get('wip')   === '1') press(wipFilterBtn);
      const type = q.get('type');
      if (type) typeFilterBtns.forEach(b => { if (b.dataset.typeValue === type) press(b); });
      const tier = q.get('tier');
      if (tier) { tierPopup.querySelector('.filter-operator').value = 'eq'; tierPopup.querySelector('.filter-number').value = tier; }
      const year = q.get('year');
      if (year) {
        const datePopup = table.querySelector('.filter-popup[data-col="6"]');
        datePopup.querySelector('.filter-operator').value = 'eq';
        datePopup.querySelector('.filter-number').value = year;
      }
      const sort = q.get('sort');
      if (sort) {
        const [col, dir] = sort.split(':');
        const btn = table.querySelector(`.filter-popup[data-col="${col}"] .sort-btn[data-sort="${dir}"]`);
        if (btn) press(btn);
      }
      const habit = q.get('habit');
      if (habit) urlHabitFilter = habit;
      const locate = q.get('locate');
      if (locate) {
        const locateInput = table.querySelector('.filter-popup[data-col="0"] .filter-text');
        if (locateInput) locateInput.value = locate;
      }
      applyAllFilters();
    })();
  } catch (e) { console.error('[collection] URL params failed:', e); }


  /* ════════════════════════════════════════════════════════
     INIT
     ════════════════════════════════════════════════════════ */

  try {
    const params  = new URLSearchParams(location.search);
    const urlView = params.get('view');
    if (urlView === 'table' || urlView === 'grid' || urlView === 'models') {
      setView(urlView, false);
    } else {
      const hasFilter = ['habit','type','tier','color','shiny','wip','year','sort','locate'].some(k => params.has(k));
      if (hasFilter) setView('table', false);
      else {
        const saved = localStorage.getItem('coll-view');
        if (saved === 'grid' || saved === 'models') setView(saved, false);
      }
    }
  } catch (_) {}

  const mobileMQ = matchMedia('(max-width: 770px)');
  const forceGridOnMobile = () => {
    if (mobileMQ.matches && coll.dataset.view === 'table') setView('grid', false);
  };
  forceGridOnMobile();
  mobileMQ.addEventListener('change', forceGridOnMobile);

  updateToggleHighlights();
  updateFooterStats();
  syncRails();
  if (resultCountEl && (!resultCountEl.textContent.trim() || resultCountEl.textContent === '0')) {
    resultCountEl.textContent = rows.filter(r => r.style.display !== 'none').length;
  }

  } catch (err) {
    console.error('[collection] fatal:', err);
  } finally {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove('coll-boot');
    }));
  }

  const toggleFiltersBtn = document.getElementById('toggleFiltersMobile');
  const rail = document.querySelector('.rail');
  if (toggleFiltersBtn && rail) {
    toggleFiltersBtn.addEventListener('click', () => {
      rail.classList.toggle('mobile-visible');
      toggleFiltersBtn.classList.toggle('active');
    });
  }
});