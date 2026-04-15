/**
 * 幾何ツール拡張機能 (Geometry Tools Addon)
 * 正多角形・角度円弧・測定ブラケット・グリッドラインなどの補助コマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Geometry Tools",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 正多角形 ─────────────────────────────────────────────────────────
    // polygon: cx cy r n [rotDeg]
    {
      type: "polygon",
      regex: /^polygon\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'polygon', cx: ev(m[1]), cy: ev(m[2]), r: ev(m[3]),
            n: Math.max(3, Math.round(ev(m[4]))),
            rot: ev(m[5]||'0') * Math.PI / 180 });
        } catch(e) { errs.push('L'+(li+1)+': polygon error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#40b8f0' : '#2090d0';
        ctx.lineWidth = sel ? 2.2 : 1.8;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        for (var i = 0; i <= cmd.n; i++) {
          var angle = cmd.rot + (Math.PI * 2 * i) / cmd.n;
          var wx = cmd.cx + cmd.r * Math.cos(angle);
          var wy = cmd.cy + cmd.r * Math.sin(angle);
          var c = this._w2c(wx, wy);
          i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── 角度マーク (円弧) ────────────────────────────────────────────────
    // anglemark: cx cy r startDeg endDeg
    {
      type: "anglemark",
      regex: /^anglemark\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'anglemark', cx: ev(m[1]), cy: ev(m[2]), r: ev(m[3]),
            startRad: ev(m[4]) * Math.PI / 180,
            endRad:   ev(m[5]) * Math.PI / 180 });
        } catch(e) { errs.push('L'+(li+1)+': anglemark error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e08040' : '#c06020';
        ctx.fillStyle   = sel ? 'rgba(224,128,64,0.15)' : 'rgba(192,96,32,0.10)';
        ctx.lineWidth   = sel ? 2.0 : 1.5;
        var wc  = this._w2c(cmd.cx, cmd.cy);
        var wr  = this._w2c(cmd.cx + cmd.r, cmd.cy);
        var pxR = Math.abs(wr.x - wc.x);
        ctx.beginPath();
        ctx.moveTo(wc.x, wc.y);
        ctx.arc(wc.x, wc.y, pxR, -cmd.startRad, -cmd.endRad, cmd.endRad < cmd.startRad);
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── 2点間距離ブラケット ──────────────────────────────────────────────
    // dimline: x1 y1 x2 y2 [offset]  → 測定線 (建築図面風)
    {
      type: "dimline",
      regex: /^dimline\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'dimline', x1: ev(m[1]), y1: ev(m[2]), x2: ev(m[3]), y2: ev(m[4]),
            offset: ev(m[5]||'0.5') });
        } catch(e) { errs.push('L'+(li+1)+': dimline error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#60c060' : '#20a020';
        ctx.lineWidth = sel ? 1.5 : 1.0;
        // 法線方向へオフセット
        var dx = cmd.x2 - cmd.x1, dy = cmd.y2 - cmd.y1;
        var len = Math.sqrt(dx*dx + dy*dy);
        var nx = -dy / len * cmd.offset, ny = dx / len * cmd.offset;
        var ax1 = cmd.x1 + nx, ay1 = cmd.y1 + ny;
        var ax2 = cmd.x2 + nx, ay2 = cmd.y2 + ny;
        // メインライン
        var pa1 = this._w2c(ax1, ay1), pa2 = this._w2c(ax2, ay2);
        ctx.beginPath(); ctx.moveTo(pa1.x, pa1.y); ctx.lineTo(pa2.x, pa2.y); ctx.stroke();
        // 端の垂線
        var ex1 = this._w2c(cmd.x1, cmd.y1); var ex2 = this._w2c(cmd.x2, cmd.y2);
        ctx.beginPath(); ctx.moveTo(ex1.x, ex1.y); ctx.lineTo(pa1.x, pa1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex2.x, ex2.y); ctx.lineTo(pa2.x, pa2.y); ctx.stroke();
        // 矢頭
        var angle = Math.atan2(pa2.y - pa1.y, pa2.x - pa1.x);
        var hw = 6;
        [[pa1, angle+Math.PI],[pa2, angle]].forEach(function(pair) {
          var p = pair[0], a = pair[1];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + hw*Math.cos(a-0.4), p.y + hw*Math.sin(a-0.4));
          ctx.lineTo(p.x + hw*Math.cos(a+0.4), p.y + hw*Math.sin(a+0.4));
          ctx.closePath(); ctx.fillStyle = sel ? '#60c060' : '#20a020'; ctx.fill();
        });
        ctx.restore();
      }
    },
    // ─── グリッドオーバーレイ ─────────────────────────────────────────────
    // gridoverlay: xstep ystep [xmin, xmax, ymin, ymax]
    {
      type: "gridoverlay",
      regex: /^gridoverlay\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'gridoverlay', xs: ev(m[1]), ys: ev(m[2]),
            xmin: ev(m[3]||'-10'), xmax: ev(m[4]||'10'),
            ymin: ev(m[5]||'-10'), ymax: ev(m[6]||'10') });
        } catch(e) { errs.push('L'+(li+1)+': gridoverlay error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? 'rgba(120,180,240,0.5)' : 'rgba(80,140,200,0.3)';
        ctx.lineWidth = 0.7;
        ctx.setLineDash([3, 3]);
        for (var x = cmd.xmin; x <= cmd.xmax; x += cmd.xs) {
          var p1 = this._w2c(x, cmd.ymin), p2 = this._w2c(x, cmd.ymax);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
        for (var y = cmd.ymin; y <= cmd.ymax; y += cmd.ys) {
          var q1 = this._w2c(cmd.xmin, y), q2 = this._w2c(cmd.xmax, y);
          ctx.beginPath(); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.stroke();
        }
        ctx.setLineDash([]); ctx.restore();
      }
    },
    // ─── 垂直二等分線 ─────────────────────────────────────────────────────
    // perpbisect: x1 y1 x2 y2 [length]
    {
      type: "perpbisect",
      regex: /^perpbisect\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'perpbisect', x1: ev(m[1]), y1: ev(m[2]), x2: ev(m[3]), y2: ev(m[4]),
            halfLen: ev(m[5]||'3') });
        } catch(e) { errs.push('L'+(li+1)+': perpbisect error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#d040d0' : '#a020a0';
        ctx.lineWidth = sel ? 2.0 : 1.5;
        ctx.setLineDash([6, 3]);
        var mx = (cmd.x1 + cmd.x2) / 2, my = (cmd.y1 + cmd.y2) / 2;
        var dx = cmd.x2 - cmd.x1, dy = cmd.y2 - cmd.y1;
        var len = Math.sqrt(dx*dx + dy*dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var pa = this._w2c(mx + nx * cmd.halfLen, my + ny * cmd.halfLen);
        var pb = this._w2c(mx - nx * cmd.halfLen, my - ny * cmd.halfLen);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        // 中点マーク
        ctx.setLineDash([]);
        var pm = this._w2c(mx, my);
        ctx.beginPath(); ctx.arc(pm.x, pm.y, 3, 0, Math.PI*2);
        ctx.fillStyle = sel ? '#d040d0' : '#a020a0'; ctx.fill();
        ctx.restore();
      }
    }
  ],
  presets: {
    polygon: {
      name: "正多角形 (Regular Polygon)",
      code: "ID = poly([cx], [cy], [r], [n])\n\n// 正n角形\npolygon: [cx] [cy] [r] [n]\nfill: none"
    },
    anglemark: {
      name: "角度マーク (Angle Arc)",
      code: "ID = angle\n\n// 角度マーク (中心, 半径, 開始角度, 終了角度)\nanglemark: 0 0 1.5 0 60\nfill: none"
    },
    dimline: {
      name: "寸法線 (Dimension Line)",
      code: "ID = dim\n\n// 寸法線 (x1 y1 x2 y2 オフセット)\ndimline: -3 0 3 0 1\nfill: none"
    },
    gridoverlay: {
      name: "グリッドオーバーレイ",
      code: "ID = grid\n\n// 補助グリッド\ngridoverlay: 1 1 [-8, 8, -8, 8]\nfill: none"
    }
  },
  doc: "## Geometry Tools Addon\n\n幾何図形補助コマンドです。\n\n### コマンド一覧\n- `polygon: cx cy r n [rotDeg]`          正n角形\n- `anglemark: cx cy r startDeg endDeg`   角度マーク円弧\n- `dimline: x1 y1 x2 y2 [offset]`        寸法線\n- `gridoverlay: xs ys [xmin,xmax,ymin,ymax]` 補助グリッド\n- `perpbisect: x1 y1 x2 y2 [halfLen]`   垂直二等分線",
  onLoad: function() { console.log("Geometry Tools Addon loaded!"); }
});
