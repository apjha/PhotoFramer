/* PhotoFramer — UI, layout rendering and printing. All sizes are stored in millimetres. */
(function () {
  'use strict';

  var Packer = window.PhotoPacker;
  var MM = { in: 25.4, cm: 10, mm: 1 };
  var SVGNS = 'http://www.w3.org/2000/svg';
  var STORE_KEY = 'photoframer:v1';

  var PAPERS = [
    { id: 'letter', name: 'US Letter (8.5×11 in)', w: 215.9, h: 279.4 },
    { id: 'a4', name: 'A4 (210×297 mm)', w: 210, h: 297 },
    { id: 'legal', name: 'US Legal (8.5×14 in)', w: 215.9, h: 355.6 },
    { id: 'tabloid', name: 'Tabloid (11×17 in)', w: 279.4, h: 431.8 },
    { id: 'a3', name: 'A3 (297×420 mm)', w: 297, h: 420 },
    { id: 'a5', name: 'A5 (148×210 mm)', w: 148, h: 210 },
    { id: 'p4x6', name: 'Photo 4×6 in', w: 101.6, h: 152.4 },
    { id: 'p5x7', name: 'Photo 5×7 in', w: 127, h: 177.8 },
    { id: 'p8x10', name: 'Photo 8×10 in', w: 203.2, h: 254 },
    { id: 'p10x15', name: 'Photo 10×15 cm', w: 100, h: 150 },
    { id: 'p13x18', name: 'Photo 13×18 cm', w: 130, h: 180 },
    { id: 'custom', name: 'Custom size…' }
  ];

  var FRAME_PRESETS = [
    ['Wallet', 2.5, 3.5, 'in'], ['3.5×5', 3.5, 5, 'in'], ['4×6', 4, 6, 'in'],
    ['5×7', 5, 7, 'in'], ['6×8', 6, 8, 'in'], ['8×10', 8, 10, 'in'],
    ['4×4', 4, 4, 'in'], ['Passport 2×2', 2, 2, 'in'], ['Passport 35×45mm', 35, 45, 'mm'],
    ['10×15cm', 10, 15, 'cm'], ['13×18cm', 13, 18, 'cm']
  ].map(function (p) { return { name: p[0], w: p[1] * MM[p[3]], h: p[2] * MM[p[3]] }; });

  var usLocale = /^en-(US|CA)$|^es-(US|MX)$/i.test(navigator.language || '');

  var state = {
    unit: usLocale ? 'in' : 'cm',
    paperId: usLocale ? 'letter' : 'a4',
    paperW: 0, paperH: 0,
    margin: 3, gap: 3,
    fit: false, guides: true,
    frames: [],
    photos: []
  };

  var layout = null; // last computed layout for the current paper

  // ---------- helpers ----------
  function $(s) { return document.querySelector(s); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function fmt(mm) {
    var v = mm / MM[state.unit];
    return String(+v.toFixed(state.unit === 'mm' ? 1 : 2));
  }
  function toMM(v) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n * MM[state.unit] : NaN; }
  function sizeLabel(w, h) { return fmt(w) + '×' + fmt(h) + ' ' + state.unit; }
  function frameLabel(f) { return f.name || sizeLabel(f.w, f.h); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function paper() {
    var p = PAPERS.filter(function (x) { return x.id === state.paperId; })[0];
    return p && p.id !== 'custom' ? { w: p.w, h: p.h, name: p.name } :
      { w: state.paperW, h: state.paperH, name: sizeLabel(state.paperW, state.paperH) };
  }
  function frameById(id) { return state.frames.filter(function (f) { return f.id === id; })[0]; }
  function photosFor(frame) { return state.photos.filter(function (p) { return p.frameId === frame.id; }); }
  function printsFor(frame) {
    var ps = photosFor(frame);
    if (!ps.length) return frame.qty;
    return ps.reduce(function (n, p) { return n + p.copies; }, 0);
  }

  // ---------- persistence ----------
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        unit: state.unit, paperId: state.paperId, paperW: state.paperW, paperH: state.paperH,
        margin: state.margin, gap: state.gap, fit: state.fit, guides: state.guides,
        frames: state.frames
      }));
    } catch (e) { /* storage unavailable: fine */ }
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s) Object.keys(s).forEach(function (k) { if (k in state) state[k] = s[k]; });
    } catch (e) { /* ignore */ }
    if (!state.paperW) { state.paperW = 215.9; state.paperH = 279.4; }
    if (!state.frames.length) {
      state.frames = [
        { id: uid(), name: '4×6', w: FRAME_PRESETS[2].w, h: FRAME_PRESETS[2].h, qty: 2 },
        { id: uid(), name: '5×7', w: FRAME_PRESETS[3].w, h: FRAME_PRESETS[3].h, qty: 1 },
        { id: uid(), name: 'Wallet', w: FRAME_PRESETS[0].w, h: FRAME_PRESETS[0].h, qty: 4 }
      ];
    }
  }

  // ---------- step 1: paper ----------
  function renderPaper() {
    var sel = $('#paper');
    if (!sel.options.length) {
      PAPERS.forEach(function (p) { sel.appendChild(el('option', { value: p.id, text: p.name })); });
    }
    sel.value = state.paperId;
    document.body.classList.toggle('custom-paper', state.paperId === 'custom');
    $('#paper-w').value = fmt(state.paperW);
    $('#paper-h').value = fmt(state.paperH);
    $('#margin').value = fmt(state.margin);
    $('#gap').value = fmt(state.gap);
    document.querySelectorAll('.u').forEach(function (u) { u.textContent = '(' + state.unit + ')'; });
    document.querySelectorAll('input[name=unit]').forEach(function (r) { r.checked = r.value === state.unit; });
    $('#fit').checked = state.fit;
    $('#guides').checked = state.guides;
  }

  function bindPaper() {
    $('#paper').addEventListener('change', function (e) {
      var cur = paper();
      state.paperId = e.target.value;
      if (state.paperId === 'custom') { state.paperW = cur.w; state.paperH = cur.h; }
      renderPaper(); changed();
    });
    [['#paper-w', 'paperW'], ['#paper-h', 'paperH'], ['#margin', 'margin'], ['#gap', 'gap']].forEach(function (b) {
      $(b[0]).addEventListener('input', function (e) {
        var v = toMM(e.target.value);
        if (!isNaN(v)) { state[b[1]] = v; changed(); }
      });
    });
    document.querySelectorAll('input[name=unit]').forEach(function (r) {
      r.addEventListener('change', function () {
        state.unit = r.value; renderPaper(); renderFrames(); changed();
      });
    });
    $('#fit').addEventListener('change', function (e) { state.fit = e.target.checked; changed(); });
    $('#guides').addEventListener('change', function (e) { state.guides = e.target.checked; changed(); });
  }

  // ---------- step 2: frames ----------
  function renderFrames() {
    var box = $('#frames');
    box.innerHTML = '';
    if (!state.frames.length) box.appendChild(el('p', { class: 'empty', text: 'No frame sizes yet — add one below.' }));
    state.frames.forEach(function (f) {
      var assigned = photosFor(f).length;
      box.appendChild(el('div', { class: 'frame', 'data-id': f.id }, [
        el('label', { class: 'field name' }, ['Name',
          el('input', { 'data-k': 'name', value: f.name, placeholder: sizeLabel(f.w, f.h) })]),
        el('label', { class: 'field' }, ['W',
          el('input', { 'data-k': 'w', type: 'number', inputmode: 'decimal', min: 0, step: 'any', value: fmt(f.w) })]),
        el('span', { class: 'x', text: '×' }),
        el('label', { class: 'field' }, ['H',
          el('input', { 'data-k': 'h', type: 'number', inputmode: 'decimal', min: 0, step: 'any', value: fmt(f.h) })]),
        el('label', { class: 'field qty' }, ['Prints',
          el('input', { 'data-k': 'qty', type: 'number', inputmode: 'numeric', min: 0, step: 1,
            value: printsFor(f), disabled: assigned > 0,
            title: assigned ? 'Set by the photos assigned to this size' : '' })]),
        el('button', { class: 'icon-btn', type: 'button', 'data-remove': f.id, 'aria-label': 'Remove ' + frameLabel(f), text: '×' }),
        assigned ? el('small', { class: 'assigned', text: plural(assigned, 'photo') + ' assigned' }) : null
      ]));
    });
  }

  function bindFrames() {
    var box = $('#frames');
    box.addEventListener('input', function (e) {
      var row = e.target.closest('.frame'), k = e.target.getAttribute('data-k');
      var f = row && frameById(row.getAttribute('data-id'));
      if (!f || !k) return;
      if (k === 'name') f.name = e.target.value;
      else if (k === 'qty') { var q = parseInt(e.target.value, 10); if (q >= 0) f.qty = q; }
      else { var v = toMM(e.target.value); if (v > 0) f[k] = v; }
      changed();
    });
    box.addEventListener('change', function () { renderPhotos(); });
    box.addEventListener('click', function (e) {
      var id = e.target.getAttribute('data-remove');
      if (!id) return;
      state.frames = state.frames.filter(function (f) { return f.id !== id; });
      state.photos.forEach(function (p) { if (p.frameId === id) p.frameId = bestFrameFor(p.aspect); });
      renderFrames(); renderPhotos(); changed();
    });

    var chips = $('#frame-presets');
    FRAME_PRESETS.forEach(function (p) {
      chips.appendChild(el('button', { class: 'chip', type: 'button', text: p.name, onclick: function () { addFrame(p); } }));
    });
    $('#add-frame').addEventListener('click', function () {
      addFrame({ name: '', w: 3 * MM.in, h: 5 * MM.in });
      var inputs = $('#frames').querySelectorAll('.frame:last-child input');
      if (inputs[1]) inputs[1].focus();
    });
  }

  function addFrame(p) {
    var existing = state.frames.filter(function (f) {
      return Math.abs(f.w - p.w) < 0.05 && Math.abs(f.h - p.h) < 0.05;
    })[0];
    if (existing && p.name) {
      if (!photosFor(existing).length) existing.qty += 1;
    } else {
      state.frames.push({ id: uid(), name: p.name, w: p.w, h: p.h, qty: 1 });
    }
    renderFrames(); renderPhotos(); changed();
  }

  // ---------- step 3: photos ----------
  function bestFrameFor(aspect) {
    var best = null, bestD = Infinity;
    var a = aspect >= 1 ? aspect : 1 / aspect;
    state.frames.forEach(function (f) {
      var fa = Math.max(f.w, f.h) / Math.min(f.w, f.h), d = Math.abs(Math.log(fa / a));
      if (d < bestD - 1e-9) { bestD = d; best = f; }
    });
    return best ? best.id : null;
  }

  // Decode the photo once, apply its EXIF orientation and cap its size, so it
  // prints the right way up everywhere and stays light on phones.
  function loadPhoto(file) {
    return new Promise(function (resolve, reject) {
      var src = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, 4000 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          URL.revokeObjectURL(src);
          if (!blob) return reject(new Error('encode failed'));
          resolve({ url: URL.createObjectURL(blob), aspect: w / h });
        }, 'image/jpeg', 0.92);
      };
      img.onerror = function () { URL.revokeObjectURL(src); reject(new Error('unreadable')); };
      img.src = src;
    });
  }

  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(f.name); });
    if (!list.length) return;
    if (!state.frames.length) addFrame(FRAME_PRESETS[2]);
    var failed = [];
    $('#drop').classList.add('busy');
    list.reduce(function (chain, file) {
      return chain.then(function () {
        return loadPhoto(file).then(function (r) {
          state.photos.push({ id: uid(), name: file.name, url: r.url, aspect: r.aspect, frameId: bestFrameFor(r.aspect), copies: 1 });
          renderPhotos(); renderFrames(); changed();
        }, function () { failed.push(file.name); });
      });
    }, Promise.resolve()).then(function () {
      $('#drop').classList.remove('busy');
      if (failed.length) alert('Could not open: ' + failed.join(', ') + '\nTry JPEG or PNG images.');
    });
  }

  function renderPhotos() {
    var box = $('#photos');
    box.innerHTML = '';
    $('#clear-photos').hidden = !state.photos.length;
    state.photos.forEach(function (p) {
      var sel = el('select', { 'data-k': 'frameId', 'aria-label': 'Frame size for ' + p.name });
      if (!p.frameId) sel.appendChild(el('option', { value: '', text: 'Choose size…' }));
      state.frames.forEach(function (f) {
        sel.appendChild(el('option', { value: f.id, text: frameLabel(f), selected: f.id === p.frameId }));
      });
      box.appendChild(el('div', { class: 'photo', 'data-id': p.id }, [
        el('img', { src: p.url, alt: p.name, loading: 'lazy' }),
        el('button', { class: 'icon-btn remove', type: 'button', 'data-remove': p.id, 'aria-label': 'Remove ' + p.name, text: '×' }),
        sel,
        el('label', { class: 'copies' }, ['Copies',
          el('input', { 'data-k': 'copies', type: 'number', inputmode: 'numeric', min: 1, max: 99, step: 1, value: p.copies })])
      ]));
    });
  }

  function bindPhotos() {
    var input = $('#files'), drop = $('#drop');
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      drop.addEventListener(t, function () { drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (e) { e.preventDefault(); addFiles(e.dataTransfer.files); });
    // Allow dropping anywhere on the page, not just the drop zone.
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) { e.preventDefault(); if (!drop.contains(e.target)) addFiles(e.dataTransfer.files); });

    var box = $('#photos');
    box.addEventListener('change', function (e) {
      var card = e.target.closest('.photo'), k = e.target.getAttribute('data-k');
      var p = card && state.photos.filter(function (x) { return x.id === card.getAttribute('data-id'); })[0];
      if (!p) return;
      if (k === 'frameId') p.frameId = e.target.value || null;
      if (k === 'copies') { p.copies = Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)); e.target.value = p.copies; }
      renderFrames(); changed();
    });
    box.addEventListener('click', function (e) {
      var id = e.target.getAttribute('data-remove');
      if (!id) return;
      state.photos = state.photos.filter(function (p) {
        if (p.id === id) URL.revokeObjectURL(p.url);
        return p.id !== id;
      });
      renderPhotos(); renderFrames(); changed();
    });
    $('#clear-photos').addEventListener('click', function () {
      state.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
      state.photos = [];
      renderPhotos(); renderFrames(); changed();
    });
  }

  // ---------- layout ----------
  function buildItems() {
    var items = [];
    state.frames.forEach(function (f) {
      if (!(f.w > 0 && f.h > 0)) return;
      var photos = [];
      photosFor(f).forEach(function (p) { for (var i = 0; i < p.copies; i++) photos.push(p); });
      var n = photos.length || f.qty;
      for (var i = 0; i < n; i++) {
        items.push({ frame: f, photo: photos[i] || null, w: f.w + state.gap, h: f.h + state.gap });
      }
    });
    return items;
  }

  function computeLayout(pw, ph, fast) {
    var items = buildItems(), m = state.margin, g = state.gap;
    var W = pw - 2 * m + g, H = ph - 2 * m + g;
    if (!(W > g && H > g)) return { error: 'The margins are larger than the paper.', items: items, pages: [], unplaced: items };
    var res = Packer.pack(items, W, H, { fast: fast });
    var sheetArea = pw * ph, total = 0;
    res.pages.forEach(function (pg) {
      var a = 0;
      pg.placements.forEach(function (pl) { a += pl.item.frame.w * pl.item.frame.h; });
      pg.used = a / sheetArea;
      total += a;
    });
    res.items = items;
    res.used = res.pages.length ? total / (sheetArea * res.pages.length) : 0;
    return res;
  }

  // Which frame sizes would still fit in a sheet's empty space.
  function roomFor(page) {
    var seen = {}, out = [];
    state.frames.forEach(function (f) {
      var key = Math.min(f.w, f.h).toFixed(1) + 'x' + Math.max(f.w, f.h).toFixed(1);
      if (seen[key] || !(f.w > 0 && f.h > 0)) return;
      seen[key] = true;
      var n = Packer.countExtra(page.bin, f.w + state.gap, f.h + state.gap);
      if (n) out.push({ frame: f, n: n });
    });
    return out;
  }

  function sheetSVG(page, pw, ph, forPrint) {
    var s = svg('svg', { viewBox: '0 0 ' + pw + ' ' + ph, xmlns: SVGNS });
    if (forPrint) { s.setAttribute('width', pw + 'mm'); s.setAttribute('height', ph + 'mm'); }
    s.appendChild(svg('rect', { x: 0, y: 0, width: pw, height: ph, fill: '#fff' }));
    if (!forPrint) {
      s.appendChild(svg('rect', { class: 'margin-line', x: state.margin, y: state.margin,
        width: Math.max(0, pw - 2 * state.margin), height: Math.max(0, ph - 2 * state.margin) }));
    }
    var hairline = Math.max(pw, ph) / 1200;
    page.placements.forEach(function (pl) {
      var x = state.margin + pl.x, y = state.margin + pl.y;
      var w = pl.w - state.gap, h = pl.h - state.gap, photo = pl.item.photo;
      if (photo) {
        var box = svg('svg', { x: x, y: y, width: w, height: h, viewBox: '0 0 ' + w + ' ' + h });
        box.appendChild(svg('rect', { width: w, height: h, fill: '#fff' }));
        var landscapeSlot = w > h + 0.01, landscapePhoto = photo.aspect > 1.02, portraitPhoto = photo.aspect < 0.98;
        var rotate = Math.abs(w - h) > 0.01 && (landscapePhoto || portraitPhoto) && landscapeSlot !== landscapePhoto;
        var img = svg('image', { preserveAspectRatio: 'xMidYMid ' + (state.fit ? 'meet' : 'slice') });
        img.setAttribute('href', photo.url);
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', photo.url);
        if (rotate) {
          var g = svg('g', { transform: 'translate(' + w / 2 + ' ' + h / 2 + ') rotate(90)' });
          img.setAttribute('x', -h / 2); img.setAttribute('y', -w / 2);
          img.setAttribute('width', h); img.setAttribute('height', w);
          g.appendChild(img); box.appendChild(g);
        } else {
          img.setAttribute('x', 0); img.setAttribute('y', 0);
          img.setAttribute('width', w); img.setAttribute('height', h);
          box.appendChild(img);
        }
        s.appendChild(box);
        if (state.guides) {
          s.appendChild(svg('rect', { x: x, y: y, width: w, height: h, fill: 'none', stroke: '#9a9a9a', 'stroke-width': hairline }));
        }
      } else {
        s.appendChild(svg('rect', { x: x, y: y, width: w, height: h, fill: forPrint ? 'none' : '#eef3f1',
          stroke: '#8aa79d', 'stroke-width': hairline * 1.5, 'stroke-dasharray': hairline * 6 + ' ' + hairline * 4 }));
        var t = svg('text', { x: x + w / 2, y: y + h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-size': Math.min(w, h) / 6, fill: '#5d7b71', 'font-family': 'system-ui, sans-serif' });
        t.textContent = frameLabel(pl.item.frame);
        s.appendChild(t);
      }
    });
    return s;
  }

  // Largest margin (mm) at which a frame still fits on a paper, or -1 if it never fits.
  function maxMarginFor(f, pw, ph) {
    var a = Math.min(f.w, f.h), b = Math.max(f.w, f.h), W = Math.min(pw, ph), H = Math.max(pw, ph);
    var m = Math.min((W - a) / 2, (H - b) / 2);
    return m >= -1e-9 ? Math.max(0, m) : -1;
  }

  // Explain why a frame size is missing from the sheets and offer one-tap fixes.
  function tooBigWarning(frame, n, p) {
    var box = el('div', { class: 'warn' }, [el('p', { text: frameLabel(frame) + ' (' + plural(n, 'print') +
      ") doesn't fit on " + p.name + ' with a ' + fmt(state.margin) + ' ' + state.unit + ' margin, so it is left off the sheets.' })]);
    var actions = el('div', { class: 'warn-actions' });
    var m = maxMarginFor(frame, p.w, p.h);
    if (m >= 0) {
      var step = state.unit === 'mm' ? 10 : 100, shown = Math.floor(m / MM[state.unit] * step) / step;
      actions.appendChild(el('button', { class: 'btn small', type: 'button', text: 'Use ' + shown + ' ' + state.unit + ' margin',
        onclick: function () { state.margin = shown * MM[state.unit]; renderPaper(); changed(); } }));
    }
    var alt = PAPERS.filter(function (x) {
      return x.w && x.id !== state.paperId && maxMarginFor(frame, x.w, x.h) >= state.margin - 1e-9;
    }).sort(function (x, y) { return x.w * x.h - y.w * y.h; })[0];
    if (alt) {
      actions.appendChild(el('button', { class: 'btn small', type: 'button', text: 'Switch to ' + alt.name,
        onclick: function () { state.paperId = alt.id; renderPaper(); changed(); } }));
    }
    if (actions.childNodes.length) box.appendChild(actions);
    return box;
  }

  function renderLayout() {
    var p = paper();
    layout = computeLayout(p.w, p.h, false);
    var items = layout.items, pages = layout.pages;

    // Stats
    var stats = $('#stats');
    stats.innerHTML = '';
    var placed = items.length - layout.unplaced.length;
    [[pages.length, pages.length === 1 ? 'sheet' : 'sheets'], [placed, placed === 1 ? 'print' : 'prints'], [pct(layout.used), 'paper used']]
      .forEach(function (s) { stats.appendChild(el('div', { class: 'stat' }, [el('b', { text: String(s[0]) }), el('span', { text: s[1] })])); });

    // Warnings
    var warn = $('#warnings');
    warn.innerHTML = '';
    if (layout.error) warn.appendChild(el('p', { class: 'warn', text: layout.error }));
    var tooBig = [];
    layout.unplaced.forEach(function (it) {
      var entry = tooBig.filter(function (t) { return t.frame === it.frame; })[0];
      if (entry) entry.n++; else tooBig.push({ frame: it.frame, n: 1 });
    });
    if (!layout.error) tooBig.forEach(function (t) { warn.appendChild(tooBigWarning(t.frame, t.n, p)); });
    document.querySelectorAll('.frame').forEach(function (row) {
      var big = tooBig.some(function (t) { return t.frame.id === row.getAttribute('data-id'); });
      row.classList.toggle('too-big', big);
      var note = row.querySelector('.too-big-note');
      if (big && !note) row.appendChild(el('small', { class: 'too-big-note', text: 'Too big for this paper and margin — not on the sheets' }));
      if (!big && note) note.remove();
    });
    var unassigned = state.photos.filter(function (ph) { return !ph.frameId; }).length;
    if (unassigned) warn.appendChild(el('p', { class: 'warn', text: plural(unassigned, 'photo') + ' need a frame size.' }));
    if (!items.length) warn.appendChild(el('p', { class: 'empty', text: 'Add frame sizes or photos to see the layout.' }));

    // Sheets
    var box = $('#sheets');
    box.innerHTML = '';
    pages.forEach(function (pg, i) {
      var room = roomFor(pg);
      var caption = 'Sheet ' + (i + 1) + ' of ' + pages.length + ' · ' + pct(pg.used) + ' used';
      box.appendChild(el('figure', { class: 'sheet' }, [
        el('div', { class: 'paper', style: 'aspect-ratio:' + p.w + '/' + p.h }, [sheetSVG(pg, p.w, p.h, false)]),
        el('figcaption', {}, [
          el('span', { text: caption }),
          room.length ? el('small', { class: 'room', text: 'Free space still fits: ' + room.map(function (r) {
            return r.n + '× ' + frameLabel(r.frame);
          }).join(' or ') }) : null
        ])
      ]));
    });

    $('#print').disabled = !pages.length;
    $('#tip-paper').textContent = p.name;
    scheduleCompare();
  }

  var compareTimer;
  function scheduleCompare() {
    clearTimeout(compareTimer);
    compareTimer = setTimeout(renderCompare, 400);
  }

  function renderCompare() {
    var box = $('#compare');
    box.innerHTML = '';
    if (!buildItems().length) { box.appendChild(el('p', { class: 'empty', text: 'Nothing to compare yet.' })); return; }
    var rows = PAPERS.filter(function (x) { return x.id !== 'custom'; }).map(function (x) {
      var r = computeLayout(x.w, x.h, true);
      return { paper: x, sheets: r.pages.length, used: r.used, missing: r.unplaced.length };
    });
    var fitsAll = rows.filter(function (r) { return !r.missing; });
    var best = fitsAll.slice().sort(function (a, b) { return b.used - a.used; })[0];
    var tbody = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', { class: (r.paper.id === state.paperId ? 'current ' : '') + (r === best ? 'best' : ''),
        tabindex: 0, title: 'Use ' + r.paper.name });
      tr.appendChild(el('td', { text: r.paper.name }));
      tr.appendChild(el('td', { text: r.missing ? '—' : String(r.sheets) }));
      tr.appendChild(el('td', { text: r.missing ? r.missing + ' too big' : pct(r.used) + (r === best ? ' ★' : '') }));
      function pick() { state.paperId = r.paper.id; renderPaper(); changed(); }
      tr.addEventListener('click', pick);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      tbody.appendChild(tr);
    });
    box.appendChild(el('p', { class: 'hint', text: 'Tap a row to switch paper. ★ = least wasted paper.' }));
    box.appendChild(el('table', {}, [el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Paper' }), el('th', { text: 'Sheets' }), el('th', { text: 'Used' })])]), tbody]));
  }

  // ---------- printing ----------
  function doPrint() {
    if (!layout || !layout.pages.length) return;
    var p = paper(), root = $('#print-root');
    root.innerHTML = '';
    layout.pages.forEach(function (pg) {
      var sheet = el('div', { class: 'print-sheet' });
      sheet.appendChild(sheetSVG(pg, p.w, p.h, true));
      root.appendChild(sheet);
    });
    var style = $('#page-style') || document.head.appendChild(el('style', { id: 'page-style' }));
    // Sheets are a hair shorter than the page so rounding never spills onto a blank page.
    style.textContent = '@page { size: ' + p.w + 'mm ' + p.h + 'mm; margin: 0; }' +
      '.print-sheet { width: ' + p.w + 'mm; height: ' + (p.h - 0.5) + 'mm; }';
    setTimeout(function () { window.print(); }, 150);
  }

  // ---------- wiring ----------
  var layoutTimer;
  function changed() {
    save();
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(renderLayout, 120);
  }

  load();
  renderPaper();
  renderFrames();
  renderPhotos();
  bindPaper();
  bindFrames();
  bindPhotos();
  $('#print').addEventListener('click', doPrint);
  window.addEventListener('afterprint', function () { $('#print-root').innerHTML = ''; });
  renderLayout();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
