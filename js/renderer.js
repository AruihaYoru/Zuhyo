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
    else if (d.type === 'line') { if (!c) { c = { lines: [], fill: null }; g.push(c); } c.lines.push(d); }
    else if (d.type === 'fill') { if (!c) { c = { lines: [], fill: null }; g.push(c); } c.fill = d; }
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
    var inst = this._dispMap[ids[i]], pks = Object.keys(inst.pts);
    for (var j = 0; j < pks.length; j++) {
      if (pks[j] === 'o') continue;
      var pc = this._w2c(inst.pts[pks[j]].x, inst.pts[pks[j]].y);
      var d = Math.hypot(pc.x - cx, pc.y - cy);
      if (d < bestD) { bestD = d; best = ids[i]; }
    }
  }
  return best;
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
  // Half-pixel snap: crisp 1px lines on integer boundaries
  var rawCx = W / 2 + this.offX, rawCy = H / 2 + this.offY;
  var cx = Math.floor(rawCx) + 0.5, cy = Math.floor(rawCy) + 0.5;

  // Minor grid (skip when too zoomed out)
  if (sc >= 20) {
    ctx.strokeStyle = 'rgba(100,60,10,.07)'; ctx.lineWidth = 0.5; ctx.setLineDash([]);
    var fx = ((rawCx % sc) + sc) % sc, fy = ((rawCy % sc) + sc) % sc;
    for (var gx = fx; gx < W; gx += sc) {
      var sx = Math.floor(gx) + 0.5;
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (var gy = fy; gy < H; gy += sc) {
      var sy = Math.floor(gy) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }
  }

  // Axes
  ctx.strokeStyle = 'rgba(100,60,10,.22)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

  // Tick labels
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

  // Grid snap dots
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
  // Snap to half-pixel to match grid axes
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

  // Selection bbox
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
  for (var li = 0; li < groups.length; li++)
    for (var si = 0; si < groups[li].lines.length; si++)
      this._drawSeg(groups[li].lines[si], inst.pts, sel);
  var ptKeys = Object.keys(inst.pts);
  for (var pi = 0; pi < ptKeys.length; pi++)
    if (ptKeys[pi] !== 'o') this._drawPt(ptKeys[pi], inst.pts[ptKeys[pi]], sel);
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
  if (seg.ctrl.length === 1) {
    var cp = this._cp(ac, bc, seg.ctrl[0]);
    ctx.quadraticCurveTo(cp.x, cp.y, bc.x, bc.y);
  } else if (seg.ctrl.length >= 2) {
    var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[1]);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, bc.x, bc.y);
  } else { ctx.lineTo(bc.x, bc.y); }
  ctx.stroke(); ctx.restore();
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
  if (!path.length) return;
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
  } else {
    offsetX = fa.length >= 1 ? fa[0] : 0;
    offsetY = fa.length >= 2 ? fa[1] : 0;
    dens    = fa.length >= 3 ? fa[2] : 1;
  }

  // Create path and compute bbox
  ctx.save();
  ctx.beginPath();
  var first = true, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (var i = 0; i < path.length; i++) {
    var seg = path[i], A = pts[seg.from], B = pts[seg.to];
    if (!A || !B) continue;
    var ac = this._w2c(A.x, A.y), bc = this._w2c(B.x, B.y);
    if (first) { ctx.moveTo(ac.x, ac.y); first = false; }
    if (seg.ctrl.length === 1) {
      var cp = this._cp(ac, bc, seg.ctrl[0]);
      ctx.quadraticCurveTo(cp.x, cp.y, bc.x, bc.y);
    } else if (seg.ctrl.length >= 2) {
      var c1 = this._cp(ac, bc, seg.ctrl[0]), c2 = this._cp(ac, bc, seg.ctrl[1]);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, bc.x, bc.y);
    } else { ctx.lineTo(bc.x, bc.y); }
    minX = Math.min(minX, ac.x, bc.x); maxX = Math.max(maxX, ac.x, bc.x);
    minY = Math.min(minY, ac.y, bc.y); maxY = Math.max(maxY, ac.y, bc.y);
  }
  ctx.closePath();
  ctx.clip();

  // Draw fill directly
  ctx.strokeStyle = 'rgba(26,8,0,.28)';
  ctx.lineWidth = 1.2;
  ctx.fillStyle = 'rgba(26,8,0,.45)';
  // Pitch should scale with renderer scale so textures zoom appropriately
  var pitch = Math.max(6, Math.round(14 * spacing * this.scale / dens));

  if (style === 'dot') {
    var dotPitch = Math.max(6, Math.round(14 * spacing * this.scale / dens));
    for (var dx = minX - pitch; dx <= maxX + pitch; dx += dotPitch) {
      for (var dy = minY - pitch; dy <= maxY + pitch; dy += dotPitch) {
        ctx.beginPath();
        ctx.arc(dx + offsetX * this.scale, dy + offsetY * this.scale, Math.max(0.8, dotPitch * 0.08), 0, Math.PI * 2);
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
      var step = pitch;
      var bboxW = maxX - minX, bboxH = maxY - minY;
      var numLines = Math.ceil((bboxW + bboxH) / step) + 2;
      for (var li = -numLines; li <= numLines; li++) {
        var offset = li * step;
        var startX = minX + offset * cos - 1000 * perpCos;
        var startY = minY + offset * sin - 1000 * perpSin;
        var endX = minX + offset * cos + 1000 * perpCos;
        var endY = minY + offset * sin + 1000 * perpSin;
        lines.push({ sx: startX, sy: startY, ex: endX, ey: endY });
      }

      for (var li = 0; li < lines.length; li++) {
        ctx.beginPath();
        ctx.moveTo(lines[li].sx, lines[li].sy);
        ctx.lineTo(lines[li].ex, lines[li].ey);
        ctx.stroke();
      }
    }
  }

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
