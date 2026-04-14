/* ================================================================
   図描 (Zuhyo) — renderer.js
   Canvas renderer + PNG/SVG export.
   ================================================================ */

/* ── Helpers ── */
function _grp(cmds) {
  var g = [], c = null;
  for (var i = 0; i < cmds.length; i++) {
    var d = cmds[i];
    if (d.type === 'sep') c = null;
    else if (d.type === 'line' || d.type === 'circle') {
      if (!c) { c = { lines: [], circles: [], fill: null }; g.push(c); }
      if (d.type === 'line') c.lines.push(d);
      else c.circles.push(d);
    }
    else if (d.type === 'fill') {
      if (!c) { c = { lines: [], circles: [], fill: null }; g.push(c); }
      c.fill = d;
    }
  }
  return g;
}

function _ord(lines) {
  if (!lines.length) return lines;
  var adj = {}, i, s;
  for (i = 0; i < lines.length; i++) { s = lines[i]; (adj[s.from] || (adj[s.from] = [])).push(s); }
  var st = lines[0].from, path = [], used = [], cur = st;
  for (i = 0; i < lines.length * 2; i++) {
    var av = (adj[cur] || []).filter(function(x) { return used.indexOf(x) < 0; });
    if (!av.length) break;
    path.push(av[0]); used.push(av[0]); cur = av[0].to;
    if (cur === st && path.length > 1) break;
  }
  return path.length >= lines.length ? path : lines;
}

function _dl(url, n) { var a = document.createElement('a'); a.href = url; a.download = n; a.click(); }
function _sp(c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1) + ' '; }

/* ================================================================
   ZuhyoRenderer
   ================================================================ */
function ZuhyoRenderer(canvas) {
  this.cv = canvas;
  this.ctx = canvas.getContext('2d');
  this.scale = 80;
  this.offX = 0; this.offY = 0;
  this.gridSnap = false; this.gridSize = 1;
  this.showGrid = true;
  this.showLabels = true;
  this.selInstId = null;
  this.toolMode = 'camera'; // 'camera' | 'grab'

  // Animation
  this._dispMap = {}; this._fromMap = {}; this._targetMap = {};
  this._animT0 = null; this._animRAF = null; this.ANIM_DUR = 400;

  // Callbacks
  this.onInstanceClick = null;
  this.onMouseMove = null;
  this.onScaleChange = null;
  this.onInstanceDragStart = null;
  this.onInstanceDrag = null;
  this.onInstanceDragEnd = null;

  // Interaction state
  this._isDrag = false; this._clickStart = null;
  this._dragStart = null; this._offStart = null;
  this._potDrag = null; this._actDrag = false;

  // Fill pattern cache (removed)
  // this._pats = {};
  
  // Font for vector rendering
  this.font = null;
  var self = this;
  opentype.load('https://cdn.jsdelivr.net/gh/google/fonts@master/ofl/spacemono/SpaceMono-Regular.ttf', function(err, font) {
    if (err) console.error('Font could not be loaded: ' + err);
    else {
      self.font = font;
      self.draw();
    }
  });

  this._bindEvents();
}

/* ── Events ── */
ZuhyoRenderer.prototype._bindEvents = function() {
  var self = this, cv = this.cv;
  cv.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  cv.addEventListener('mousedown', function(e) {
    self._clickStart = { x: e.clientX, y: e.clientY };
    self._dragStart = { x: e.clientX, y: e.clientY };

    // Middle-mouse or camera-mode left → pan
    if (e.button === 1 || (e.button === 0 && self.toolMode === 'camera')) {
      self._isDrag = true;
      self._offStart = { x: self.offX, y: self.offY };
      cv.classList.add('panning');
      if (e.button === 1) e.preventDefault();
      return;
    }
    // Grab mode left → potential instance drag
    if (e.button === 0 && self.toolMode === 'grab') {
      var r = cv.getBoundingClientRect();
      var hit = self._hitTest(e.clientX - r.left, e.clientY - r.top);
      if (hit) self._potDrag = hit;
    }
  });

  cv.addEventListener('mousemove', function(e) {
    var r = cv.getBoundingClientRect();
    var wx =  (e.clientX - r.left - cv.width / 2 - self.offX) / self.scale;
    var wy = -(e.clientY - r.top - cv.height / 2 - self.offY) / self.scale;
    if (self.onMouseMove) self.onMouseMove(wx, wy);

    if (self._isDrag) {
      self.offX = self._offStart.x + (e.clientX - self._dragStart.x);
      self.offY = self._offStart.y + (e.clientY - self._dragStart.y);
      self.draw();
    } else if (self._potDrag && !self._actDrag) {
      // Drag threshold
      if (Math.abs(e.clientX - self._dragStart.x) >= 4 ||
          Math.abs(e.clientY - self._dragStart.y) >= 4) {
        self._actDrag = true;
        if (self._potDrag !== self.selInstId && self.onInstanceClick)
          self.onInstanceClick(self._potDrag);
        if (self.onInstanceDragStart) self.onInstanceDragStart(self._potDrag);
        cv.style.cursor = 'grabbing';
      }
    } else if (self._actDrag && self._potDrag) {
      var ddx = (e.clientX - self._dragStart.x) / self.scale;
      var ddy = -(e.clientY - self._dragStart.y) / self.scale;
      if (self.onInstanceDrag) self.onInstanceDrag(self._potDrag, ddx, ddy);
    }
  });

  cv.addEventListener('mouseup', function(e) {
    cv.classList.remove('panning');
    cv.style.cursor = '';
    var cs = self._clickStart, moved = false;
    if (cs) moved = Math.abs(e.clientX - cs.x) >= 4 || Math.abs(e.clientY - cs.y) >= 4;

    if (self._isDrag) {
      self._isDrag = false;
      if (!moved) {
        var r = cv.getBoundingClientRect();
        var hit = self._hitTest(e.clientX - r.left, e.clientY - r.top);
        if (self.onInstanceClick) self.onInstanceClick(hit);
      }
    } else if (self._actDrag) {
      if (self.onInstanceDragEnd) self.onInstanceDragEnd(self._potDrag);
      self._actDrag = false; self._potDrag = null;
    } else if (self._potDrag) {
      if (self.onInstanceClick) self.onInstanceClick(self._potDrag);
      self._potDrag = null;
    } else if (self.toolMode === 'grab' && !moved) {
      if (self.onInstanceClick) self.onInstanceClick(null);
    }
    self._clickStart = null;
  });

  cv.addEventListener('mouseleave', function() {
    cv.classList.remove('panning'); cv.style.cursor = '';
    if (self._actDrag && self._potDrag && self.onInstanceDragEnd) self.onInstanceDragEnd(self._potDrag);
    self._isDrag = false; self._potDrag = null; self._actDrag = false;
  });

  cv.addEventListener('wheel', function(e) {
    e.preventDefault();
    self.scale = Math.max(10, Math.min(600, self.scale * (e.deltaY > 0 ? 0.88 : 1.14)));
    if (self.onScaleChange) self.onScaleChange(self.scale);
    self.draw();
  }, { passive: false });
};

/* ── Coordinate helpers ── */
ZuhyoRenderer.prototype._w2c = function(wx, wy) {
  return {
    x: this.cv.width / 2 + this.offX + wx * this.scale,
    y: this.cv.height / 2 + this.offY - wy * this.scale
  };
};

ZuhyoRenderer.prototype.snapVal = function(v) {
  return this.gridSnap ? Math.round(v / this.gridSize) * this.gridSize : v;
};

ZuhyoRenderer.prototype._hitTest = function(cx, cy) {
  var ids = Object.keys(this._dispMap), best = null, bestD = 20;

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i], inst = this._dispMap[id], pts = inst.pts;
    
    // 1. Check points
    var pks = Object.keys(pts);
    for (var j = 0; j < pks.length; j++) {
      if (pks[j] === 'o') continue;
      var pc = this._w2c(pts[pks[j]].x, pts[pks[j]].y);
      var d = Math.hypot(pc.x - cx, pc.y - cy);
      if (d < bestD) { bestD = d; best = id; }
    }

    // 2. Check commands (Text/Label/Circle)
    for (var ci = 0; ci < inst.cmds.length; ci++) {
      var cmd = inst.cmds[ci];
      if (cmd.type === 'text' || cmd.type === 'label') {
        var p1 = pts[cmd.p1], p2 = pts[cmd.p2] || p1;
        if (!p1 || !p2) continue;
        var c1 = this._w2c(p1.x, p1.y), c2 = this._w2c(p2.x, p2.y);
        var minX = Math.min(c1.x, c2.x), maxX = Math.max(c1.x, c2.x);
        var minY = Math.min(c1.y, c2.y), maxY = Math.max(c1.y, c2.y);
        
        // For label, p1=p2, so we add some padding
        if (cmd.type === 'label') {
          var sz = (cmd.size || 0.4) * this.scale;
          minX -= 5; maxX += sz * 5; // Rough estimate
          minY -= sz; maxY += 5;
        }

        if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
          best = id; bestD = 5; // Close match
        }
      } else if (cmd.type === 'circle') {
        var ctr = pts[cmd.center];
        if (!ctr) continue;
        var cc = this._w2c(ctr.x, ctr.y), rpx = cmd.r * this.scale;
        var dToCenter = Math.hypot(cc.x - cx, cc.y - cy);
        if (Math.abs(dToCenter - rpx) < 10) { // Click on edge
          best = id; bestD = 8;
        }
      }
    }
  }
  return best;
};



ZuhyoRenderer.prototype._drawCircle = function(cmd, pts) {
  var ctr = pts[cmd.center];
  if (!ctr) return;
  var cc = this._w2c(ctr.x, ctr.y);
  var rpx = cmd.r * this.scale;
  
  var ctx = this.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cc.x, cc.y, rpx, 0, Math.PI * 2);
  ctx.strokeStyle = '#1a0800';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
};

/* ── Project update + animation ── */
ZuhyoRenderer.prototype.updateProject = function(project) {
  var newMap = {}, insts = project.instances || [], structs = project.structures || [];
  for (var i = 0; i < insts.length; i++) {
    var inst = insts[i], struct = null;
    for (var j = 0; j < structs.length; j++) if (structs[j].id === inst.structId) { struct = structs[j]; break; }
    if (!struct) continue;
    var parsed = parseDotDash(struct.code, inst.args || {});
    var ox = inst.offsetX || 0, oy = inst.offsetY || 0, offPts = {}, pks = Object.keys(parsed.pts);
    for (var k = 0; k < pks.length; k++) offPts[pks[k]] = { x: parsed.pts[pks[k]].x + ox, y: parsed.pts[pks[k]].y + oy };
    newMap[inst.id] = { pts: offPts, cmds: parsed.cmds, structId: inst.structId };
  }
  this._fromMap = {};
  var nids = Object.keys(newMap);
  for (var ni = 0; ni < nids.length; ni++) {
    var nid = nids[ni], tgt = newMap[nid], old = this._dispMap[nid], fp = {}, tpks = Object.keys(tgt.pts);
    for (var ti = 0; ti < tpks.length; ti++) {
      var tp = tpks[ti];
      fp[tp] = (old && old.pts[tp]) ? { x: old.pts[tp].x, y: old.pts[tp].y } : { x: 0, y: 0 };
    }
    this._fromMap[nid] = fp;
  }
  this._targetMap = newMap; this._animT0 = null;
  if (this._animRAF) cancelAnimationFrame(this._animRAF);
  var self = this;
  this._animRAF = requestAnimationFrame(function(t) { self._anim(t); });
};

ZuhyoRenderer.prototype._anim = function(now) {
  if (this._animT0 === null) this._animT0 = now;
  var t = (now - this._animT0) / this.ANIM_DUR;
  var e = 1 - Math.pow(1 - Math.min(t, 1), 3);
  var cur = {}, ids = Object.keys(this._targetMap);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i], tgt = this._targetMap[id], fp = this._fromMap[id] || {};
    var pts = {}, pks = Object.keys(tgt.pts);
    for (var j = 0; j < pks.length; j++) {
      var pk = pks[j], f = fp[pk] || { x: 0, y: 0 }, tp = tgt.pts[pk];
      pts[pk] = { x: f.x + (tp.x - f.x) * e, y: f.y + (tp.y - f.y) * e };
    }
    cur[id] = { pts: pts, cmds: tgt.cmds, structId: tgt.structId };
  }
  this._dispMap = cur; this.draw();
  if (t < 1) { var self = this; this._animRAF = requestAnimationFrame(function(ts) { self._anim(ts); }); }
  else { this._dispMap = this._targetMap; this.draw(); }
};

/* ================================================================
   Drawing
   ================================================================ */
ZuhyoRenderer.prototype.draw = function() {
  var ctx = this.ctx, W = this.cv.width, H = this.cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#fdf9f0'; ctx.fillRect(0, 0, W, H);
  this._drawGrid(W, H);
  var ids = Object.keys(this._dispMap);
  for (var i = 0; i < ids.length; i++) this._drawInst(ids[i], this._dispMap[ids[i]]);
  this._drawOrigin();
};

ZuhyoRenderer.prototype._drawGrid = function(W, H) {
  var ctx = this.ctx, sc = this.scale;
  var rawCx = W / 2 + this.offX, rawCy = H / 2 + this.offY;
  var cx = Math.floor(rawCx) + 0.5, cy = Math.floor(rawCy) + 0.5;

  if (!this.showGrid) return;
  
  // Snap starting positions to half-pixel to match axis rendering
  var sfx = ((Math.floor(rawCx) % sc) + sc) % sc + 0.5;
  var sfy = ((Math.floor(rawCy) % sc) + sc) % sc + 0.5;

  if (sc >= 20) {
    // Minor grid
    ctx.strokeStyle = 'rgba(100,60,10,.07)'; ctx.lineWidth = 0.5; ctx.setLineDash([]);
    ctx.beginPath();
    for (var x = sfx; x <= W; x += sc) {
      ctx.moveTo(x, 0); ctx.lineTo(x, H);
    }
    for (var y = sfy; y <= H; y += sc) {
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();

    // Major grid (every 5 units)
    ctx.strokeStyle = 'rgba(100,60,10,.12)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (var mx = sfx; mx <= W; mx += sc * 5) {
      ctx.moveTo(mx, 0); ctx.lineTo(mx, H);
    }
    for (var my = sfy; my <= H; my += sc * 5) {
      ctx.moveTo(0, my); ctx.lineTo(W, my);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(100,60,10,.22)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

  if (sc > 28) {
    ctx.font = '9px Space Mono, monospace'; ctx.fillStyle = 'rgba(100,60,10,.28)';
    var R = Math.ceil(Math.max(W, H) / sc) + 1;
    for (var n = 1; n < R; n++) {
      if (cx + n * sc < W - 4) ctx.fillText('' + n, cx + n * sc - 4, cy + 12);
      if (cx - n * sc > 4)     ctx.fillText('' + (-n), cx - n * sc - 12, cy + 12);
      if (cy - n * sc > 4)     ctx.fillText('' + n, cx + 4, cy - n * sc + 4);
      if (cy + n * sc < H - 4) ctx.fillText('' + (-n), cx + 4, cy + n * sc + 4);
    }
  }

  if (this.gridSnap && sc >= 30) {
    ctx.fillStyle = 'rgba(139,90,26,.18)';
    var sfx = ((rawCx % sc) + sc) % sc, sfy = ((rawCy % sc) + sc) % sc;
    for (var sx2 = sfx; sx2 <= W; sx2 += sc)
      for (var sy2 = sfy; sy2 <= H; sy2 += sc) {
        ctx.beginPath(); ctx.arc(sx2, sy2, 1.5, 0, Math.PI * 2); ctx.fill();
      }
  }
};

ZuhyoRenderer.prototype._drawOrigin = function() {
  var c = this._w2c(0, 0), ctx = this.ctx;
  c.x = Math.floor(c.x) + 0.5; c.y = Math.floor(c.y) + 0.5;
  var r = 8;
  ctx.strokeStyle = 'rgba(150,90,20,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x - r * .55, c.y); ctx.lineTo(c.x + r * .55, c.y);
  ctx.moveTo(c.x, c.y - r * .55); ctx.lineTo(c.x, c.y + r * .55);
  ctx.stroke();
  ctx.fillStyle = 'rgba(100,58,15,.5)'; ctx.font = '10px Space Mono, monospace';
  ctx.fillText('O', c.x + 10, c.y - 3);
};

ZuhyoRenderer.prototype._drawInst = function(instId, inst) {
  var sel = instId === this.selInstId, groups = _grp(inst.cmds);

  if (sel) {
    var pks = Object.keys(inst.pts);
    if (pks.length) {
      var xs = [], ys = [];
      for (var k = 0; k < pks.length; k++) {
        var c = this._w2c(inst.pts[pks[k]].x, inst.pts[pks[k]].y);
        xs.push(c.x); ys.push(c.y);
      }
      var p = 14;
      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(139,90,26,.55)'; this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([5, 4]);
      this.ctx.strokeRect(Math.min.apply(null, xs) - p, Math.min.apply(null, ys) - p,
        Math.max.apply(null, xs) - Math.min.apply(null, xs) + 2 * p,
        Math.max.apply(null, ys) - Math.min.apply(null, ys) + 2 * p);
      this.ctx.restore();
    }
  }

  for (var fi = 0; fi < groups.length; fi++) {
    var g = groups[fi];
    if (g.fill && g.fill.style !== 'none') this._renderFill(g, inst.pts);
  }
  for (var li = 0; li < groups.length; li++) {
    for (var si = 0; si < groups[li].lines.length; si++)
      this._drawSeg(groups[li].lines[si], inst.pts, sel);
    for (var ci = 0; ci < groups[li].circles.length; ci++)
      this._drawCircle(groups[li].circles[ci], inst.pts);
  }

  for (var ci = 0; ci < inst.cmds.length; ci++) {
    var cmd = inst.cmds[ci];
    if (cmd.type === 'plot') this._drawPlot(cmd, inst.pts);
    if (cmd.type === 'text') this._drawText(cmd, inst.pts, sel);
    if (cmd.type === 'label') this._drawLabel(cmd, inst.pts);
  }

  var ptKeys = Object.keys(inst.pts);
  for (var pi = 0; pi < ptKeys.length; pi++)
    if (ptKeys[pi] !== 'o') this._drawPt(ptKeys[pi], inst.pts[ptKeys[pi]], sel);
};

ZuhyoRenderer.prototype._drawPlot = function(cmd, pts) {
  var ctx = this.ctx;
  ctx.save();
  ctx.strokeStyle = '#2a1a08'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  var first = true;
  var iter = 0;
  for (var x = cmd.start; (cmd.step > 0 ? x <= cmd.end : x >= cmd.end); x += cmd.step) {
    if (++iter > 2000) break; // Safety limit
    try {
      var y = _evalMath(cmd.expr.replace(/\bx\b/g, '(' + x + ')'), cmd.vars);
      var c = this._w2c(x, y);
      if (first) { ctx.moveTo(c.x, c.y); first = false; }
      else ctx.lineTo(c.x, c.y);
    } catch(e) {}
  }
  ctx.stroke(); ctx.restore();
};

ZuhyoRenderer.prototype._drawText = function(cmd, pts, sel) {
  var p1 = pts[cmd.p1], p2 = pts[cmd.p2];
  if (!p1 || !p2) return;
  
  var c1 = this._w2c(p1.x, p1.y), c2 = this._w2c(p2.x, p2.y);
  var rect = {
    x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y),
    w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y)
  };
  if (rect.w < 1 || rect.h < 1) return;

  var ctx = this.ctx;
  ctx.save();
  
  // Use a base font size and system fonts for robust Japanese support
  var baseSize = 80;
  ctx.font = 'bold ' + baseSize + 'px "Space Mono", "Meiryo", "Hiragino Kaku Gothic ProN", "MS PGothic", sans-serif';
  var metrics = ctx.measureText(cmd.content);
  
  // Calculate bounding box using modern metrics if available, or fallback to estimation
  var textW = metrics.width;
  var textH = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) || (baseSize * 0.85);
  var offY = metrics.actualBoundingBoxAscent || (baseSize * 0.75);

  if (textW > 0 && textH > 0) {
    var scaleX = rect.w / textW;
    var scaleY = rect.h / textH;
    
    ctx.translate(rect.x, rect.y + offY * scaleY);
    ctx.scale(scaleX, scaleY);
    
    ctx.fillStyle = sel ? '#3a1800' : '#1c0d00';
    ctx.fillText(cmd.content, 0, 0);
  }
  
  ctx.restore();
};

ZuhyoRenderer.prototype._drawSeg = function(seg, pts, sel) {
  var A = pts[seg.from], B = pts[seg.to];
  if (!A || !B || seg.lt.style === 'invis') return;
  var ac = this._w2c(A.x, A.y), bc = this._w2c(B.x, B.y), ctx = this.ctx;
  ctx.save();
  ctx.strokeStyle = sel ? '#3a1800' : '#1a0800';
  ctx.lineWidth = sel ? 2 : 1.6;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash(seg.lt.dash || []);
  ctx.beginPath(); ctx.moveTo(ac.x, ac.y);
  this._traceSeg(ctx, seg, ac, bc);
  ctx.stroke(); ctx.restore();
};

ZuhyoRenderer.prototype._traceSeg = function(ctx, seg, ac, bc) {
  if (seg.ctrl.length === 1) {
    // ── 1 Control Point: Ellipse (at 50%) or Circular Arc ──
    var c = seg.ctrl[0];
    var cp = this._cp(ac, bc, c);
    
    // Use ellipse if centered at 50%, providing smooth perpendicular tangents at ends
    if (Math.abs(c.pct - 0.5) < 0.01) {
      var dx = bc.x - ac.x, dy = bc.y - ac.y;
      var dist = Math.hypot(dx, dy);
      var midX = (ac.x + bc.x) / 2;
      var midY = (ac.y + bc.y) / 2;
      var angle = Math.atan2(dy, dx);
      var rx = dist / 2;
      var ry = Math.hypot(cp.x - midX, cp.y - midY);
      
      // Determine clockwise/counter-clockwise based on cross product
      var cross = dx * (cp.y - midY) - dy * (cp.x - midX);
      ctx.ellipse(midX, midY, rx, ry, angle, Math.PI, 0, cross > 0);
    } else {
      // Fallback to circular arc for off-center control points
      var circle = this._getCircle(ac, bc, cp);
      if (!circle) {
        ctx.lineTo(bc.x, bc.y);
      } else {
        var sa = Math.atan2(ac.y - circle.y, ac.x - circle.x);
        var ea = Math.atan2(bc.y - circle.y, bc.x - circle.x);
        var ma = Math.atan2(cp.y - circle.y, cp.x - circle.x);
        var diff = ea - sa;
        while (diff < 0) diff += Math.PI * 2;
        while (diff > Math.PI * 2) diff -= Math.PI * 2;
        var mDiff = ma - sa;
        while (mDiff < 0) mDiff += Math.PI * 2;
        while (mDiff > Math.PI * 2) mDiff -= Math.PI * 2;
        ctx.arc(circle.x, circle.y, circle.r, sa, ea, mDiff > diff);
      }
    }
  } else if (seg.ctrl.length === 2) {
    // ── Cubic Bezier ──
    var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[1]);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, bc.x, bc.y);
  } else if (seg.ctrl.length > 2) {
    // ── Higher Order (Approx with first two) ──
    var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[seg.ctrl.length - 1]);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, bc.x, bc.y);
  } else {
    ctx.lineTo(bc.x, bc.y);
  }
};

ZuhyoRenderer.prototype._getCircle = function(A, B, C) {
  var x1 = A.x, y1 = A.y, x2 = B.x, y2 = B.y, x3 = C.x, y3 = C.y;
  var D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 0.1) return null; // Collinear or too close
  var cx = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  var cy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
  var r = Math.sqrt((x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy));
  return { x: cx, y: cy, r: r };
};

ZuhyoRenderer.prototype._cp = function(ac, bc, c) {
  var mx = ac.x + (bc.x - ac.x) * c.pct, my = ac.y + (bc.y - ac.y) * c.pct;
  var rad = c.ang * Math.PI / 180;
  return { x: mx + c.dst * Math.cos(rad) * this.scale, y: my - c.dst * Math.sin(rad) * this.scale };
};

ZuhyoRenderer.prototype._drawPt = function(id, pt, sel) {
  var ctx = this.ctx, c = this._w2c(pt.x, pt.y);
  ctx.strokeStyle = 'rgba(28,13,0,.18)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = sel ? '#3a1800' : '#1c0d00';
  ctx.beginPath(); ctx.arc(c.x, c.y, 3, 0, Math.PI * 2); ctx.fill();
  if (this.showLabels) {
    ctx.fillStyle = '#5a3010'; ctx.font = '11px Space Mono, monospace';
    ctx.fillText(id, c.x + 9, c.y - 4);
  }
};

/* ── Fill (direct drawing) ── */
ZuhyoRenderer.prototype._renderFill = function(group, pts) {
  var ctx = this.ctx, path = _ord(group.lines);
  var fa = group.fill.args || [];
  var style = group.fill.style;
  var angle = 0, spacing = 1, dens = 1, offsetX = 0, offsetY = 0;

  if (style === 'line' || style === 'grid') {
    angle   = fa.length >= 1 ? fa[0] : 0;
    spacing = fa.length >= 2 ? fa[1] : 1;
    dens    = fa.length >= 3 ? fa[2] : 1;
  } else if (style === 'cross' || style === 'hatch') {
    angle   = fa.length >= 1 ? fa[0] : 45;
    spacing = fa.length >= 2 ? fa[1] : 1;
    dens    = fa.length >= 3 ? fa[2] : 1;
  } else if (style === 'dot') {
    offsetX = fa.length >= 1 ? fa[0] : 0;
    offsetY = fa.length >= 2 ? fa[1] : 0;
    dens    = fa.length >= 3 ? fa[2] : 1;
  }

  if (path.length > 0) {
    ctx.save();
    ctx.beginPath();
    var first = true, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < path.length; i++) {
      var seg = path[i], A = pts[seg.from], B = pts[seg.to];
      if (!A || !B) continue;
      var ac = this._w2c(A.x, A.y), bc = this._w2c(B.x, B.y);
      if (first) { ctx.moveTo(ac.x, ac.y); first = false; }
      this._traceSeg(ctx, seg, ac, bc);
      
      // Expand bounding box roughly
      minX = Math.min(minX, ac.x, bc.x); maxX = Math.max(maxX, ac.x, bc.x);
      minY = Math.min(minY, ac.y, bc.y); maxY = Math.max(maxY, ac.y, bc.y);
      if (seg.ctrl.length > 0) {
        var _localSelf = this;
        seg.ctrl.forEach(function(c) {
          var cp = _localSelf._cp(ac, bc, c);
          minX = Math.min(minX, cp.x); maxX = Math.max(maxX, cp.x);
          minY = Math.min(minY, cp.y); maxY = Math.max(maxY, cp.y);
        });
      }
      minX = Math.min(minX, ac.x, bc.x); maxX = Math.max(maxX, ac.x, bc.x);
      minY = Math.min(minY, ac.y, bc.y); maxY = Math.max(maxY, ac.y, bc.y);
    }
    ctx.closePath();
    ctx.clip();
    this._drawPattern(style, spacing, dens, offsetX, offsetY, minX, minY, maxX, maxY, angle);
    ctx.restore();
  }

  for (var i = 0; i < group.circles.length; i++) {
    var c = group.circles[i], ctr = pts[c.center];
    if (!ctr) continue;
    var cc = this._w2c(ctr.x, ctr.y), rpx = c.r * this.scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cc.x, cc.y, rpx, 0, Math.PI * 2);
    ctx.clip();
    this._drawPattern(style, spacing, dens, offsetX, offsetY, cc.x - rpx, cc.y - rpx, cc.x + rpx, cc.y + rpx, angle);
    ctx.restore();
  }
};

ZuhyoRenderer.prototype._drawPattern = function(style, spacing, dens, offsetX, offsetY, minX, minY, maxX, maxY, angle) {
  var ctx = this.ctx;
  var pitchPx = Math.max(6, Math.round(12 * spacing / Math.max(0.01, dens)));

  if (style === 'dot') {
    for (var sx = Math.floor(minX - pitchPx); sx <= Math.ceil(maxX + pitchPx); sx += pitchPx) {
      for (var sy = Math.floor(minY - pitchPx); sy <= Math.ceil(maxY + pitchPx); sy += pitchPx) {
        ctx.beginPath();
        ctx.arc(sx + offsetX * this.scale, sy + offsetY * this.scale, Math.max(0.8, pitchPx * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(26,8,0,.45)';
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = 'rgba(26,8,0,.45)';
    var directions = [];
    if (style === 'line' || style === 'hatch') directions = [angle];
    else if (style === 'cross' || style === 'grid') directions = [angle, angle + 90];

    for (var di = 0; di < directions.length; di++) {
      var ang = directions[di];
      var rad = ang * Math.PI / 180;
      var cos = Math.cos(rad), sin = Math.sin(rad);
      var perpCos = -sin, perpSin = cos; // perpendicular for line bounds

      // Compute line bounds in bbox
      var lines = [];
      // Use pixel-based spacing so multiple lines appear reliably
      var step = pitchPx;
      var bboxW = maxX - minX, bboxH = maxY - minY;
      var diag = Math.ceil(Math.hypot(bboxW, bboxH)) + 2000;
      var numLines = Math.ceil(diag / step) + 2;
      for (var li = -numLines; li <= numLines; li++) {
        var offset = li * step;
        var startX = minX + offset * cos - 1000 * perpCos;
        var startY = minY + offset * sin - 1000 * perpSin;
        var endX = minX + offset * cos + 1000 * perpCos;
        var endY = minY + offset * sin + 1000 * perpSin;
        lines.push({ sx: startX, sy: startY, ex: endX, ey: endY });
      }

      for (var li = 0; li < lines.length; li++) {
        // avoid exact overlap with shape edges by applying a tiny perpendicular jitter
        var s = lines[li];
        var jitter = ((li & 1) ? 0.5 : -0.5);
        var sx = s.sx + perpCos * jitter, sy = s.sy + perpSin * jitter;
        var ex = s.ex + perpCos * jitter, ey = s.ey + perpSin * jitter;
        ctx.save();
        // Use same visual style as connectors: dark ink and similar width
        ctx.strokeStyle = '#1a0800';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  ctx.restore();
};

ZuhyoRenderer.prototype._drawLabel = function(cmd, pts) {
  var p = pts[cmd.p1];
  if (!p) return;
  var cc = this._w2c(p.x, p.y);
  var fontSize = (cmd.size || 0.4) * this.scale;
  var ctx = this.ctx;
  ctx.save();
  ctx.font = fontSize + 'px "Space Mono", "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillStyle = '#1c0d00';
  ctx.fillText(cmd.content, cc.x, cc.y);
  ctx.restore();
};

/* ================================================================
   Export
   ================================================================ */
ZuhyoRenderer.prototype.resetView = function() {
  this.scale = 80; this.offX = 0; this.offY = 0; this._pats = {}; this.draw();
};

ZuhyoRenderer.prototype.exportPNG = function(trans) {
  var tmp = document.createElement('canvas');
  tmp.width = this.cv.width; tmp.height = this.cv.height;
  var c = tmp.getContext('2d');
  if (!trans) { c.fillStyle = '#fdf9f0'; c.fillRect(0, 0, tmp.width, tmp.height); }
  c.drawImage(this.cv, 0, 0);
  _dl(tmp.toDataURL('image/png'), 'zuhyo_export.png');
};

ZuhyoRenderer.prototype.exportSVG = function() {
  var W = this.cv.width, H = this.cv.height;
  var rawCx = W / 2 + this.offX, rawCy = H / 2 + this.offY;
  var o = [];
  o.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
  o.push('<rect width="' + W + '" height="' + H + '" fill="#fdf9f0"/>');
  o.push('<defs>');
  o.push('<pattern id="zpd" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1" fill="rgba(26,8,0,.35)"/></pattern>');
  o.push('<pattern id="zpl" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="-10" x2="0" y2="20" stroke="rgba(26,8,0,.28)" stroke-width="1.2"/></pattern>');
  o.push('<pattern id="zpc" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="-10" x2="0" y2="20" stroke="rgba(26,8,0,.28)" stroke-width="1.2"/><line x1="-10" y1="0" x2="20" y2="0" stroke="rgba(26,8,0,.28)" stroke-width="1.2"/></pattern>');
  o.push('</defs>');
  o.push('<line x1="0" y1="' + rawCy.toFixed(1) + '" x2="' + W + '" y2="' + rawCy.toFixed(1) + '" stroke="rgba(100,60,10,.22)"/>');
  o.push('<line x1="' + rawCx.toFixed(1) + '" y1="0" x2="' + rawCx.toFixed(1) + '" y2="' + H + '" stroke="rgba(100,60,10,.22)"/>');

  var pm = { dot: 'zpd', line: 'zpl', cross: 'zpc', hatch: 'zpl', grid: 'zpc' };
  var ids = Object.keys(this._dispMap);
  for (var ii = 0; ii < ids.length; ii++) {
    var inst = this._dispMap[ids[ii]], groups = _grp(inst.cmds);
    o.push('<g>');
    for (var fi = 0; fi < groups.length; fi++) {
      var fg = groups[fi];
      if (!fg.fill || fg.fill.style === 'none' || !pm[fg.fill.style]) continue;
      var fd = this._svgShape(fg.lines, inst.pts);
      if (fd) o.push('<path d="' + fd + '" fill="url(#' + pm[fg.fill.style] + ')"/>');
    }
    for (var gi = 0; gi < groups.length; gi++) {
      var gl = groups[gi].lines;
      for (var si = 0; si < gl.length; si++) {
        var seg = gl[si]; if (seg.lt.style === 'invis') continue;
        var pd = this._svgSeg(seg, inst.pts); if (!pd) continue;
        var da = seg.lt.dash && seg.lt.dash.length ? ' stroke-dasharray="' + seg.lt.dash.join(' ') + '"' : '';
        o.push('<path d="' + pd + '" fill="none" stroke="#1a0800" stroke-width="1.6" stroke-linecap="round"' + da + '/>');
      }
    }
    var pks = Object.keys(inst.pts);
    for (var pi = 0; pi < pks.length; pi++) {
      if (pks[pi] === 'o') continue;
      var pc = this._w2c(inst.pts[pks[pi]].x, inst.pts[pks[pi]].y);
      o.push('<circle cx="' + pc.x.toFixed(1) + '" cy="' + pc.y.toFixed(1) + '" r="3" fill="#1c0d00"/>');
      if (this.showLabels) o.push('<text x="' + (pc.x + 9).toFixed(1) + '" y="' + (pc.y - 4).toFixed(1) + '" font-family="monospace" font-size="11" fill="#5a3010">' + pks[pi] + '</text>');
    }
    o.push('</g>');
  }
  var oc = this._w2c(0, 0);
  o.push('<circle cx="' + oc.x.toFixed(1) + '" cy="' + oc.y.toFixed(1) + '" r="8" fill="none" stroke="rgba(150,90,20,.5)" stroke-width="1.5"/>');
  o.push('<text x="' + (oc.x + 10).toFixed(1) + '" y="' + (oc.y - 3).toFixed(1) + '" font-family="monospace" font-size="10" fill="rgba(100,58,15,.5)">O</text>');
  o.push('</svg>');
  var blob = new Blob([o.join('\n')], { type: 'image/svg+xml' });
  var url = URL.createObjectURL(blob);
  _dl(url, 'zuhyo_export.svg'); URL.revokeObjectURL(url);
};

/* SVG path helpers */
ZuhyoRenderer.prototype._svgSeg = function(seg, pts) {
  var A = pts[seg.from], B = pts[seg.to]; if (!A || !B) return null;
  var ac = this._w2c(A.x, A.y), bc = this._w2c(B.x, B.y);
  if (seg.ctrl.length === 1) { var cp = this._cp(ac, bc, seg.ctrl[0]); return 'M' + _sp(ac) + 'Q' + _sp(cp) + _sp(bc); }
  if (seg.ctrl.length >= 2) { var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[1]); return 'M' + _sp(ac) + 'C' + _sp(c1) + _sp(c2) + _sp(bc); }
  return 'M' + _sp(ac) + 'L' + _sp(bc);
};

ZuhyoRenderer.prototype._svgShape = function(lines, pts) {
  var path = _ord(lines); if (!path.length) return null;
  var d = '', first = true;
  for (var i = 0; i < path.length; i++) {
    var seg = path[i], A = pts[seg.from], B = pts[seg.to]; if (!A || !B) continue;
    var ac = this._w2c(A.x, A.y), bc = this._w2c(B.x, B.y);
    if (first) { d += 'M' + _sp(ac); first = false; }
    if (seg.ctrl.length === 1) { var cp = this._cp(ac, bc, seg.ctrl[0]); d += 'Q' + _sp(cp) + _sp(bc); }
    else if (seg.ctrl.length >= 2) { var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[1]); d += 'C' + _sp(c1) + _sp(c2) + _sp(bc); }
    else { d += 'L' + _sp(bc); }
  }
  return d + 'Z';
};
