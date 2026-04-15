/**
 * 円錐曲線拡張機能 (Conic Sections Addon)
 * 放物線 / 双曲線 / 楕円の標準形コマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Conic Sections",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 放物線 y = a(x-h)² + k ──────────────────────────────────────────
    {
      type: "parabola",
      // parabola: a h k [xmin, xmax, step]
      regex: /^parabola\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'parabola', a: ev(m[1]), h: ev(m[2]), k: ev(m[3]),
            start: ev(m[4]||'-10'), end: ev(m[5]||'10'), step: ev(m[6]||'0.08') });
        } catch(e) { errs.push('L'+(li+1)+': parabola error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#60b840' : '#40a020'; // 黄緑
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var x = cmd.start; x <= cmd.end + cmd.step * 0.5; x += cmd.step) {
          var y = cmd.a * (x - cmd.h) * (x - cmd.h) + cmd.k;
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── 楕円 (x-h)²/a² + (y-k)²/b² = 1 ────────────────────────────────
    {
      type: "conicellipse",
      // conicellipse: cx cy a b [step]
      regex: /^conicellipse\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'conicellipse', cx: ev(m[1]), cy: ev(m[2]), a: ev(m[3]), b: ev(m[4]), tstep: ev(m[5]||'0.025') });
        } catch(e) { errs.push('L'+(li+1)+': conicellipse error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e06030' : '#c04010'; // 橙
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var wx = cmd.cx + cmd.a * Math.cos(t), wy = cmd.cy + cmd.b * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── 双曲線 (x-h)²/a² - (y-k)²/b² = 1 (横向き) ──────────────────────
    {
      type: "hyperbola",
      // hyperbola: cx cy a b [xmin, xmax, step]
      regex: /^hyperbola\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'hyperbola', cx: ev(m[1]), cy: ev(m[2]), a: ev(m[3]), b: ev(m[4]),
            start: ev(m[5]||'-10'), end: ev(m[6]||'10'), step: ev(m[7]||'0.06') });
        } catch(e) { errs.push('L'+(li+1)+': hyperbola error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#9040e0' : '#7020c0'; // 鮮紫
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        var renderBranch = function(sign) {
          ctx.beginPath();
          var first = true;
          for (var t = -Math.PI * 0.5 + 0.02; t <= Math.PI * 0.5 - 0.02; t += 0.03) {
            // x = ±a*cosh(t), y = b*sinh(t)
            var wx = cmd.cx + sign * cmd.a / Math.cos(t); // secant parametrization
            var wy = cmd.cy + cmd.b * Math.tan(t);
            if (!isFinite(wx) || !isFinite(wy)) { first = true; continue; }
            var c = this._w2c(wx, wy);
            if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
          }
          ctx.stroke();
        }.bind(this);
        renderBranch(1); renderBranch(-1);
        // 漸近線 (破線)
        ctx.setLineDash([4, 4]); ctx.lineWidth = 0.8;
        ctx.strokeStyle = sel ? 'rgba(144,64,224,0.5)' : 'rgba(112,32,192,0.4)';
        var slope = cmd.b / cmd.a;
        // y - cy = ±slope*(x - cx)
        var xl = cmd.start, xr = cmd.end;
        [1, -1].forEach(function(s) {
          ctx.beginPath();
          var p1 = this._w2c(xl, cmd.cy + s * slope * (xl - cmd.cx));
          var p2 = this._w2c(xr, cmd.cy + s * slope * (xr - cmd.cx));
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }.bind(this));
        ctx.setLineDash([]); ctx.restore();
      }
    },
    // ─── 焦点表示付き楕円 ─────────────────────────────────────────────────
    {
      type: "focusellipse",
      // focusellipse: cx cy a b  → 焦点に点を打ちながら楕円描画
      regex: /^focusellipse\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var a = ev(m[3]), b = ev(m[4]);
          var c = Math.sqrt(Math.abs(a * a - b * b));
          cmds.push({ type: 'focusellipse', cx: ev(m[1]), cy: ev(m[2]), a: a, b: b, c: c, tstep: ev(m[5]||'0.025') });
        } catch(e) { errs.push('L'+(li+1)+': focusellipse error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        // 楕円本体
        ctx.strokeStyle = sel ? '#f07030' : '#d05010';
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var wx = cmd.cx + cmd.a * Math.cos(t), wy = cmd.cy + cmd.b * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke();
        // 焦点 F1, F2
        [cmd.c, -cmd.c].forEach(function(dx) {
          var fc = this._w2c(cmd.cx + dx, cmd.cy);
          ctx.beginPath(); ctx.arc(fc.x, fc.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = sel ? '#f07030' : '#d05010'; ctx.fill();
        }.bind(this));
        ctx.restore();
      }
    }
  ],
  presets: {
    parabola: {
      name: "放物線 y=a(x-h)²+k",
      code: "ID = parabola([a], [h], [k])\n\n// y = a(x-h)^2 + k\nparabola: [a] [h] [k] [-10, 10, 0.08]\n\n// 座標軸\n180o13=xl\n0o13=xr\nxl<->xr\n270o13=yd\n90o13=yu\nyd<->yu\nfill: none"
    },
    conicellipse: {
      name: "楕円 (Ellipse 標準形)",
      code: "ID = ellipse([cx], [cy], [a], [b])\n\n// (x-cx)²/a² + (y-cy)²/b² = 1\nconicellipse: [cx] [cy] [a] [b]\nfill: none"
    },
    hyperbola: {
      name: "双曲線 (Hyperbola)",
      code: "ID = hyperbola([cx], [cy], [a], [b])\n\n// (x-cx)²/a² - (y-cy)²/b² = 1\nhyperbola: [cx] [cy] [a] [b] [-12, 12, 0.06]\nfill: none"
    },
    focusellipse: {
      name: "焦点付き楕円",
      code: "ID = focusellipse([cx], [cy], [a], [b])\n\n// 焦点を表示した楕円\nfocusellipse: [cx] [cy] [a] [b]\nfill: none"
    }
  },
  doc: "## Conic Sections Addon\n\n円錐曲線を描画します。\n\n### コマンド一覧\n- `parabola: a h k [xmin, xmax, step]`   放物線 y=a(x-h)²+k\n- `conicellipse: cx cy a b [step]`        楕円 標準形\n- `hyperbola: cx cy a b [xmin, xmax, step]` 双曲線(漸近線付き)\n- `focusellipse: cx cy a b [step]`        焦点付き楕円",
  onLoad: function() { console.log("Conic Sections Addon loaded!"); }
});
