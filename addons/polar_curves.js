/**
 * 極座標曲線拡張機能 (Polar Curves Addon)
 * r = f(θ) 形式の極座標グラフコマンドを提供します。
 * 対応曲線: polar(汎用), rose(バラ曲線), spiral(螺旋), cardioid(心臓形), lemniscate(レムニスケート)
 */
ZuhyoAddonAPI.register({
  name: "Polar Curves",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 汎用 polar ────────────────────────────────────────────────────────
    // polar: r_expr [tmin, tmax, step]
    // r_expr は θ の簡単式または定数
    {
      type: "polarplot",
      regex: /^polarplot\s*:\s*([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          // r_expr は文字列として保持し、render 時に θ 代入評価
          cmds.push({ type: 'polarplot', rExpr: m[1],
            tmin: ev(m[2] || '0'), tmax: ev(m[3] || '6.2832'), tstep: ev(m[4] || '0.04') });
        } catch(e) { errs.push('L' + (li + 1) + ': polarplot error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e0c030' : '#c0a010'; // 黄金系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = cmd.tmin; t <= cmd.tmax + cmd.tstep * 0.5; t += cmd.tstep) {
          var r;
          try { r = parseFloat(Function('"use strict"; var t='+t+'; var theta=t; return ('+cmd.rExpr.replace(/\[([a-zA-Z_]+)\]/g,'0')+');')()); } catch(_) { first = true; continue; }
          if (!isFinite(r)) { first = true; continue; }
          var wx = r * Math.cos(t), wy = r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── バラ曲線 r = a*cos(n*θ) ─────────────────────────────────────────
    {
      type: "rosecurve",
      // rosecurve: a n [tmin, tmax, step]
      regex: /^rosecurve\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var n = ev(m[2]);
          // n が偶数なら 0〜4π, 奇数なら 0〜2π で完結
          var defEnd = (Math.round(n) % 2 === 0) ? '12.566' : '6.2832';
          cmds.push({ type: 'rosecurve', a: ev(m[1]), n: n,
            tmin: ev(m[3] || '0'), tmax: ev(m[4] || defEnd), tstep: ev(m[5] || '0.03') });
        } catch(e) { errs.push('L' + (li + 1) + ': rosecurve error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e04080' : '#c02060'; // バラ色
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = cmd.tmin; t <= cmd.tmax + cmd.tstep * 0.5; t += cmd.tstep) {
          var r = cmd.a * Math.cos(cmd.n * t);
          var wx = r * Math.cos(t), wy = r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── アルキメデスの螺旋 r = a + b*θ ─────────────────────────────────
    {
      type: "spiral",
      // spiral: a b [tmin, tmax, step]
      regex: /^spiral\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'spiral', a: ev(m[1]), b: ev(m[2]),
            tmin: ev(m[3] || '0'), tmax: ev(m[4] || '18.85'), tstep: ev(m[5] || '0.05') });
        } catch(e) { errs.push('L' + (li + 1) + ': spiral error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#30b0e0' : '#1090c0'; // シアン系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = cmd.tmin; t <= cmd.tmax + cmd.tstep * 0.5; t += cmd.tstep) {
          var r = cmd.a + cmd.b * t;
          var wx = r * Math.cos(t), wy = r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── 心臓形 r = a(1 + cos θ) ─────────────────────────────────────────
    {
      type: "cardioid",
      // cardioid: a [step]
      regex: /^cardioid\s*:\s*([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'cardioid', a: ev(m[1]), tstep: ev(m[2] || '0.03') });
        } catch(e) { errs.push('L' + (li + 1) + ': cardioid error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e05060' : '#c03040'; // 赤ピンク
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var r = cmd.a * (1 + Math.cos(t));
          var wx = r * Math.cos(t), wy = r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── レムニスケート r² = a²cos(2θ) ───────────────────────────────────
    {
      type: "lemniscate",
      // lemniscate: a [step]
      regex: /^lemniscate\s*:\s*([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'lemniscate', a: ev(m[1]), tstep: ev(m[2] || '0.02') });
        } catch(e) { errs.push('L' + (li + 1) + ': lemniscate error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#60c0a0' : '#30a080'; // エメラルド
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var r2 = cmd.a * cmd.a * Math.cos(2 * t);
          if (r2 < 0) { first = true; continue; }
          var r = Math.sqrt(r2);
          var wx = r * Math.cos(t), wy = r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    }
  ],
  presets: {
    rosecurve: {
      name: "バラ曲線 (Rose Curve)",
      code: "ID = rose([a], [n])\n\n// r = a * cos(n*θ)\nrosecurve: [a] [n]\n\n// 座標軸\n180o12=xl\n0o12=xr\nxl<->xr\n270o12=yd\n90o12=yu\nyd<->yu\nfill: none"
    },
    spiral: {
      name: "アルキメデスの螺旋 (Spiral)",
      code: "ID = spiral([a], [b])\n\n// r = a + b*θ\nspiral: [a] [b] [0, 18.85, 0.05]\n\n// 座標軸\n180o12=xl\n0o12=xr\nxl<->xr\n270o12=yd\n90o12=yu\nyd<->yu\nfill: none"
    },
    cardioid: {
      name: "心臓形 (Cardioid)",
      code: "ID = cardioid([a])\n\n// r = a(1 + cosθ)\ncardioid: [a]\n\n// 座標軸\n180o12=xl\n0o12=xr\nxl<->xr\n270o12=yd\n90o12=yu\nyd<->yu\nfill: none"
    },
    lemniscate: {
      name: "レムニスケート (Lemniscate)",
      code: "ID = lemniscate([a])\n\n// r² = a²cos(2θ)\nlemniscate: [a]\n\n// 座標軸\n180o10=xl\n0o10=xr\nxl<->xr\n270o10=yd\n90o10=yu\nyd<->yu\nfill: none"
    }
  },
  doc: "## Polar Curves Addon\n\n極座標曲線を描画します。\n\n### コマンド一覧\n- `rosecurve: a n [tmin, tmax, step]`  バラ曲線 r=a·cos(n·θ)\n- `spiral: a b [tmin, tmax, step]`     アルキメデスの螺旋 r=a+b·θ\n- `cardioid: a [step]`                 心臓形 r=a(1+cosθ)\n- `lemniscate: a [step]`               レムニスケート r²=a²cos(2θ)\n- `polarplot: expr [tmin, tmax, step]` 汎用極座標プロット",
  onLoad: function() { console.log("Polar Curves Addon loaded!"); }
});
