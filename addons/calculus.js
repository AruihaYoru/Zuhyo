/**
 * 微積分可視化拡張機能 (Calculus Addon)
 * 接線・法線・積分範囲塗りつぶし・リーマン和・数値勾配場の可視化コマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Calculus",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 汎用関数プロット (f(x) = expr) ──────────────────────────────────
    // fplot: f_expr [xmin, xmax, step]
    {
      type: "fplot",
      regex: /^fplot\s*:\s*([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'fplot', fExpr: m[1],
            start: ev(m[2]||'-10'), end: ev(m[3]||'10'), step: ev(m[4]||'0.05') });
        } catch(e) { errs.push('L'+(li+1)+': fplot error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#5090f0' : '#2060d0';
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true; var CLIP = 1e6;
        for (var x = cmd.start; x <= cmd.end + cmd.step * 0.5; x += cmd.step) {
          var y;
          try { y = parseFloat(Function('"use strict"; var x='+x+'; return ('+cmd.fExpr+');')()); } catch(_) { first = true; continue; }
          if (!isFinite(y) || Math.abs(y) > CLIP) { first = true; continue; }
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── 積分領域塗りつぶし ────────────────────────────────────────────────
    // integral: f_expr xfrom xto [step]
    {
      type: "integral",
      regex: /^integral\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'integral', fExpr: m[1], xfrom: ev(m[2]), xto: ev(m[3]),
            step: ev(m[4]||'0.05') });
        } catch(e) { errs.push('L'+(li+1)+': integral error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.fillStyle   = sel ? 'rgba(80,160,100,0.35)' : 'rgba(40,130,70,0.22)';
        ctx.strokeStyle = sel ? '#50c070' : '#30a050';
        ctx.lineWidth   = sel ? 2.0 : 1.5;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var p0 = this._w2c(cmd.xfrom, 0); ctx.moveTo(p0.x, p0.y);
        for (var x = cmd.xfrom; x <= cmd.xto + cmd.step * 0.5; x += cmd.step) {
          var y; try { y = parseFloat(Function('"use strict"; var x='+x+'; return ('+cmd.fExpr+');')()); } catch(_) { y = 0; }
          if (!isFinite(y)) y = 0;
          var c = this._w2c(x, y); ctx.lineTo(c.x, c.y);
        }
        var p1 = this._w2c(cmd.xto, 0); ctx.lineTo(p1.x, p1.y);
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── 接線 ─────────────────────────────────────────────────────────────
    // tangent: f_expr x0 [halfLen]
    {
      type: "tangent",
      regex: /^tangent\s*:\s*([^\s]+)\s+([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var x0 = ev(m[2]);
          var h = 1e-5;
          var f  = function(x) { return parseFloat(Function('"use strict"; var x='+x+'; return ('+m[1]+');')()); };
          var y0 = f(x0);
          var slope = (f(x0 + h) - f(x0 - h)) / (2 * h);
          cmds.push({ type: 'tangent', x0: x0, y0: y0, slope: slope,
            halfLen: ev(m[3]||'3') });
        } catch(e) { errs.push('L'+(li+1)+': tangent error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#f04060' : '#d02040';
        ctx.lineWidth   = sel ? 2.0 : 1.5;
        ctx.setLineDash([8, 4]);
        var x1 = cmd.x0 - cmd.halfLen, x2 = cmd.x0 + cmd.halfLen;
        var y1 = cmd.y0 + cmd.slope * (x1 - cmd.x0);
        var y2 = cmd.y0 + cmd.slope * (x2 - cmd.x0);
        var pa = this._w2c(x1, y1), pb = this._w2c(x2, y2);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.setLineDash([]);
        // 接点マーク
        var pt = this._w2c(cmd.x0, cmd.y0);
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, Math.PI*2);
        ctx.fillStyle = sel ? '#f04060' : '#d02040'; ctx.fill();
        ctx.restore();
      }
    },
    // ─── リーマン和 ────────────────────────────────────────────────────────
    // riemann: f_expr xfrom xto n [left|mid|right]
    {
      type: "riemann",
      regex: /^riemann\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)(?:\s+(left|mid|right))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'riemann', fExpr: m[1], xfrom: ev(m[2]), xto: ev(m[3]),
            n: Math.max(1, Math.round(ev(m[4]))),
            mode: (m[5] || 'mid').toLowerCase() });
        } catch(e) { errs.push('L'+(li+1)+': riemann error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.fillStyle   = sel ? 'rgba(200,150,50,0.40)' : 'rgba(180,130,30,0.28)';
        ctx.strokeStyle = sel ? '#d09020' : '#b07010';
        ctx.lineWidth   = sel ? 1.5 : 1.0;
        var dx = (cmd.xto - cmd.xfrom) / cmd.n;
        function f(x) {
          try { return parseFloat(Function('"use strict"; var x='+x+'; return ('+cmd.fExpr+');')()); } catch(_) { return 0; }
        }
        for (var i = 0; i < cmd.n; i++) {
          var xl = cmd.xfrom + i * dx;
          var xr = xl + dx;
          var xSample = cmd.mode === 'left' ? xl : (cmd.mode === 'right' ? xr : (xl + xr) / 2);
          var y = f(xSample);
          if (!isFinite(y)) continue;
          var tl = this._w2c(xl, Math.max(0, y));
          var br = this._w2c(xr, Math.min(0, y));
          ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
          ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        }
        ctx.restore();
      }
    }
  ],
  presets: {
    fplot: {
      name: "関数プロット fplot",
      code: "ID = f\n\n// 任意の f(x) をプロット\nfplot: Math.sin(x)*x [-10, 10, 0.05]\n\n// 座標軸\n180o12=xl\n0o12=xr\nxl<->xr\n270o12=yd\n90o12=yu\nyd<->yu\nfill: none"
    },
    integral: {
      name: "積分領域 (Integral)",
      code: "ID = intg([from], [to])\n\n// y = f(x) の積分領域塗りつぶし\nfplot: x*x-3 [-5, 5, 0.05]\nintegral: x*x-3 [from] [to]\n\n// 座標軸\n180o7=xl\n0o7=xr\nxl<->xr\n270o10=yd\n90o10=yu\nyd<->yu\nfill: none"
    },
    tangent: {
      name: "接線 (Tangent Line)",
      code: "ID = tan([x0])\n\n// f(x) = sin(x) の x0 での接線\nfplot: Math.sin(x) [-6.3, 6.3, 0.05]\ntangent: Math.sin(x) [x0] 4\nfill: none"
    },
    riemann: {
      name: "リーマン和 (Riemann Sum)",
      code: "ID = riemann([n])\n\n// f(x) のリーマン和\nfplot: x*x [-3, 3, 0.05]\nriemann: x*x -3 3 [n] mid\n\n// 座標軸\n180o5=xl\n0o5=xr\nxl<->xr\n270o10=yd\n90o10=yu\nyd<->yu\nfill: none"
    }
  },
  doc: "## Calculus Addon\n\n微積分の可視化コマンドです。\n\n### コマンド一覧\n- `fplot: f(x)_expr [xmin, xmax, step]`        汎用関数プロット\n- `integral: f(x) xfrom xto [step]`             積分領域塗りつぶし\n- `tangent: f(x) x0 [halfLen]`                  接線 (数値微分)\n- `riemann: f(x) xfrom xto n [left|mid|right]`  リーマン和\n\n### 注意\n- `fplot` / `integral` / `tangent` / `riemann` の式では `x` を使います (例: `x*x`, `Math.sin(x)`)。\n- JavaScriptの数学関数を直接使えます: `Math.sqrt(x)`, `Math.exp(x)` など。",
  onLoad: function() { console.log("Calculus Addon loaded!"); }
});
