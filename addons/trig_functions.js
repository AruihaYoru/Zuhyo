/**
 * 三角関数拡張機能 (Trigonometric Functions Addon)
 * sin, cos, tan, asin, acos, atan のグラフコマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Trigonometric Functions",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── sin ──────────────────────────────────────────────────────────────
    {
      type: "sinplot",
      // sinplot: amplitude frequency phase [min, max, step]
      regex: /^sinplot\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'sinplot', A: ev(m[1]), freq: ev(m[2]), phase: ev(m[3]),
            start: ev(m[4] || '-6.3'), end: ev(m[5] || '6.3'), step: ev(m[6] || '0.05') });
        } catch(e) { errs.push('L' + (li + 1) + ': sinplot error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e06030' : '#c04010';  // 橙系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var x = cmd.start; x <= cmd.end; x += cmd.step) {
          var y = cmd.A * Math.sin(cmd.freq * x + cmd.phase);
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── cos ──────────────────────────────────────────────────────────────
    {
      type: "cosplot",
      // cosplot: amplitude frequency phase [min, max, step]
      regex: /^cosplot\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'cosplot', A: ev(m[1]), freq: ev(m[2]), phase: ev(m[3]),
            start: ev(m[4] || '-6.3'), end: ev(m[5] || '6.3'), step: ev(m[6] || '0.05') });
        } catch(e) { errs.push('L' + (li + 1) + ': cosplot error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#6030e0' : '#4010c0';  // 紫系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var x = cmd.start; x <= cmd.end; x += cmd.step) {
          var y = cmd.A * Math.cos(cmd.freq * x + cmd.phase);
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── tan ──────────────────────────────────────────────────────────────
    {
      type: "tanplot",
      // tanplot: amplitude frequency phase [min, max, step]  ※漸近線で自動分断
      regex: /^tanplot\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr || '0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'tanplot', A: ev(m[1]), freq: ev(m[2]), phase: ev(m[3]),
            start: ev(m[4] || '-6.3'), end: ev(m[5] || '6.3'), step: ev(m[6] || '0.04') });
        } catch(e) { errs.push('L' + (li + 1) + ': tanplot error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#30c080' : '#10a060';  // 緑ティール系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true; var prevY = null; var CLIP = 30;
        for (var x = cmd.start; x <= cmd.end; x += cmd.step) {
          var y = cmd.A * Math.tan(cmd.freq * x + cmd.phase);
          if (!isFinite(y) || Math.abs(y) > CLIP || (prevY !== null && Math.abs(y - prevY) > CLIP)) {
            first = true; prevY = null; continue;
          }
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
          prevY = y;
        }
        ctx.stroke(); ctx.restore();
      }
    }
  ],
  presets: {
    sin: {
      name: "sin(x) グラフ",
      code: "ID = sin([A], [freq], [phase])\n\n// y = A * sin(freq*x + phase)\nsinplot: [A] [freq] [phase] [-6.3, 6.3, 0.05]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o8=yd\n90o8=yu\nyd<->yu\nfill: none"
    },
    cos: {
      name: "cos(x) グラフ",
      code: "ID = cos([A], [freq], [phase])\n\n// y = A * cos(freq*x + phase)\ncosplot: [A] [freq] [phase] [-6.3, 6.3, 0.05]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o8=yd\n90o8=yu\nyd<->yu\nfill: none"
    },
    tan: {
      name: "tan(x) グラフ",
      code: "ID = tan([A], [freq], [phase])\n\n// y = A * tan(freq*x + phase)\ntanplot: [A] [freq] [phase] [-6.3, 6.3, 0.04]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o8=yd\n90o8=yu\nyd<->yu\nfill: none"
    }
  },
  doc: "## Trigonometric Functions Addon\n\n三角関数グラフを描画します。\n\n### コマンド一覧\n- `sinplot: A freq phase [min, max, step]`  → y = A·sin(freq·x + phase)  橙色\n- `cosplot: A freq phase [min, max, step]`  → y = A·cos(freq·x + phase)  紫色\n- `tanplot: A freq phase [min, max, step]`  → y = A·tan(freq·x + phase)  緑色(漸近線で自動分断)\n\n### 例\n```\nsinplot: 2 1 0 [-6.3, 6.3, 0.05]\ncosplot: 1 2 0 [-6.3, 6.3, 0.05]\n```",
  onLoad: function() { console.log("Trigonometric Functions Addon loaded!"); }
});
