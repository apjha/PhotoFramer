/*
 * PhotoPacker — 2D rectangle packing (MaxRects) used to fit photo prints
 * onto as few sheets of paper as possible. Items may be rotated 90°.
 * Works in browsers (window.PhotoPacker) and Node (module.exports).
 */
(function (global) {
  'use strict';

  var EPS = 1e-6;
  var HEURISTICS = ['BSSF', 'BLSF', 'BAF', 'BL', 'CP'];

  function MaxRects(width, height) {
    this.width = width;
    this.height = height;
    this.free = [{ x: 0, y: 0, w: width, h: height }];
    this.used = [];
  }

  MaxRects.prototype.clone = function () {
    var c = new MaxRects(this.width, this.height);
    c.free = this.free.map(function (r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; });
    c.used = this.used.map(function (r) { return { x: r.x, y: r.y, w: r.w, h: r.h }; });
    return c;
  };

  // Length of the rectangle's edges touching the bin border or placed rects.
  MaxRects.prototype.contact = function (x, y, w, h) {
    var s = 0;
    if (Math.abs(x) < EPS || Math.abs(x + w - this.width) < EPS) s += h;
    if (Math.abs(y) < EPS || Math.abs(y + h - this.height) < EPS) s += w;
    for (var i = 0; i < this.used.length; i++) {
      var u = this.used[i];
      if (Math.abs(u.x - (x + w)) < EPS || Math.abs(u.x + u.w - x) < EPS) {
        s += Math.max(0, Math.min(y + h, u.y + u.h) - Math.max(y, u.y));
      }
      if (Math.abs(u.y - (y + h)) < EPS || Math.abs(u.y + u.h - y) < EPS) {
        s += Math.max(0, Math.min(x + w, u.x + u.w) - Math.max(x, u.x));
      }
    }
    return s;
  };

  // Best position for a w×h rectangle, or null if it cannot fit.
  // Lower scores are better.
  MaxRects.prototype.find = function (w, h, heuristic, allowRotate) {
    var best = null;
    var self = this;
    function tryOrient(rw, rh, rotated) {
      for (var i = 0; i < self.free.length; i++) {
        var f = self.free[i];
        if (rw > f.w + EPS || rh > f.h + EPS) continue;
        var lh = Math.abs(f.w - rw), lv = Math.abs(f.h - rh), s1, s2;
        switch (heuristic) {
          case 'BLSF': s1 = Math.max(lh, lv); s2 = Math.min(lh, lv); break;
          case 'BAF': s1 = f.w * f.h - rw * rh; s2 = Math.min(lh, lv); break;
          case 'BL': s1 = f.y + rh; s2 = f.x; break;
          case 'CP': s1 = -self.contact(f.x, f.y, rw, rh); s2 = f.y; break;
          default: s1 = Math.min(lh, lv); s2 = Math.max(lh, lv); // BSSF
        }
        if (!best || s1 < best.s1 - EPS || (Math.abs(s1 - best.s1) <= EPS && s2 < best.s2 - EPS)) {
          best = { x: f.x, y: f.y, w: rw, h: rh, rotated: rotated, s1: s1, s2: s2 };
        }
      }
    }
    tryOrient(w, h, false);
    if (allowRotate !== false && Math.abs(w - h) > EPS) tryOrient(h, w, true);
    return best;
  };

  function contains(a, b) { // a contains b
    return b.x >= a.x - EPS && b.y >= a.y - EPS &&
      b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS;
  }

  MaxRects.prototype.place = function (n) {
    var out = [];
    for (var i = 0; i < this.free.length; i++) {
      var f = this.free[i];
      if (n.x >= f.x + f.w - EPS || n.x + n.w <= f.x + EPS ||
          n.y >= f.y + f.h - EPS || n.y + n.h <= f.y + EPS) {
        out.push(f);
        continue;
      }
      if (n.x > f.x + EPS) out.push({ x: f.x, y: f.y, w: n.x - f.x, h: f.h });
      if (n.x + n.w < f.x + f.w - EPS) out.push({ x: n.x + n.w, y: f.y, w: f.x + f.w - n.x - n.w, h: f.h });
      if (n.y > f.y + EPS) out.push({ x: f.x, y: f.y, w: f.w, h: n.y - f.y });
      if (n.y + n.h < f.y + f.h - EPS) out.push({ x: f.x, y: n.y + n.h, w: f.w, h: f.y + f.h - n.y - n.h });
    }
    for (var a = 0; a < out.length; a++) {
      for (var b = a + 1; b < out.length; b++) {
        if (contains(out[b], out[a])) { out.splice(a, 1); a--; break; }
        if (contains(out[a], out[b])) { out.splice(b, 1); b--; }
      }
    }
    this.free = out;
    this.used.push({ x: n.x, y: n.y, w: n.w, h: n.h });
  };

  function better(a, b) {
    return a.s1 < b.s1 - EPS || (Math.abs(a.s1 - b.s1) <= EPS && a.s2 < b.s2 - EPS);
  }

  var SORTS = {
    area: function (a, b) { return b.w * b.h - a.w * a.h; },
    side: function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h); },
    perimeter: function (a, b) { return (b.w + b.h) - (a.w + a.h); }
  };

  function fitsBin(it, W, H) {
    return (it.w <= W + EPS && it.h <= H + EPS) || (it.h <= W + EPS && it.w <= H + EPS);
  }

  function packWith(items, W, H, heuristic, sortName) {
    var remaining = items.slice();
    if (sortName) remaining.sort(SORTS[sortName]);
    var pages = [];
    while (remaining.length) {
      var bin = new MaxRects(W, H), placements = [];
      if (!sortName) {
        // Global best-fit: at each step place the item/position with the best score.
        for (;;) {
          var best = null, bestIdx = -1, seen = {};
          for (var i = 0; i < remaining.length; i++) {
            var it = remaining[i], key = it.w + 'x' + it.h;
            if (seen[key]) continue;
            seen[key] = true;
            var n = bin.find(it.w, it.h, heuristic, true);
            if (n && (!best || better(n, best))) { best = n; bestIdx = i; }
          }
          if (!best) break;
          bin.place(best);
          placements.push({ item: remaining[bestIdx], x: best.x, y: best.y, w: best.w, h: best.h, rotated: best.rotated });
          remaining.splice(bestIdx, 1);
        }
      } else {
        var left = [];
        for (var j = 0; j < remaining.length; j++) {
          var r = remaining[j], p = bin.find(r.w, r.h, heuristic, true);
          if (p) {
            bin.place(p);
            placements.push({ item: r, x: p.x, y: p.y, w: p.w, h: p.h, rotated: p.rotated });
          } else {
            left.push(r);
          }
        }
        remaining = left;
      }
      pages.push({ placements: placements, bin: bin });
    }
    return pages;
  }

  function quality(pages, W, H) {
    var sq = 0;
    for (var i = 0; i < pages.length; i++) {
      var a = 0;
      pages[i].placements.forEach(function (p) { a += p.w * p.h; });
      var u = a / (W * H);
      sq += u * u;
    }
    return sq;
  }

  /**
   * Pack items ({w, h, ...}) onto as few W×H sheets as possible.
   * Tries several heuristics and orderings and keeps the best result:
   * fewest sheets first, then the most concentrated use of paper
   * (full sheets + one emptier sheet beats several half-full ones).
   * Returns { pages: [{placements, bin}], unplaced: [items] }.
   */
  function pack(items, W, H, options) {
    options = options || {};
    var unplaced = [], ok = [];
    items.forEach(function (it) { (fitsBin(it, W, H) ? ok : unplaced).push(it); });
    if (!ok.length) return { pages: [], unplaced: unplaced };

    var strategies = [];
    HEURISTICS.forEach(function (h) { strategies.push([h, null]); });
    if (!options.fast) {
      Object.keys(SORTS).forEach(function (s) {
        HEURISTICS.forEach(function (h) { strategies.push([h, s]); });
      });
    }
    var best = null, bestQ = -1;
    strategies.forEach(function (s) {
      var pages = packWith(ok, W, H, s[0], s[1]);
      var q = quality(pages, W, H);
      if (!best || pages.length < best.length || (pages.length === best.length && q > bestQ + EPS)) {
        best = pages;
        bestQ = q;
      }
    });
    return { pages: best, unplaced: unplaced };
  }

  // How many more w×h rectangles would fit into the free space of a packed bin.
  function countExtra(bin, w, h) {
    var most = 0;
    HEURISTICS.forEach(function (heuristic) {
      var b = bin.clone(), n = 0, p;
      while (n < 500 && (p = b.find(w, h, heuristic, true))) { b.place(p); n++; }
      if (n > most) most = n;
    });
    return most;
  }

  var api = { MaxRects: MaxRects, pack: pack, countExtra: countExtra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.PhotoPacker = api;
})(this);
