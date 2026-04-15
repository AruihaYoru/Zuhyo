/**
 * 媒介変数曲線拡張機能 (Parametric Curves Addon)
 * x=f(t), y=g(t) 形式の媒介変数曲線コマンドを提供します。
 * 対応曲線: circle, ellipse, lissajous, cycloid, epicycloid, hypotrochoid
 */
ZuhyoAddonAPI.register({
  name: "Parametric Curves",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 円 ───────────────────────────────────────────────────────────────
    {
      type: "circle",
      // circle: cx cy r [step]
      regex: /^circle\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'circle', cx: ev(m[1]), cy: ev(m[2]), r: ev(m[3]), tstep: ev(m[4] || '0.03') });
        } catch(e) { errs.push('L' + (li+1) + ': circle error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#4080e0' : '#2060c0';
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var wx = cmd.cx + cmd.r * Math.cos(t), wy = cmd.cy + cmd.r * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── 楕円 ─────────────────────────────────────────────────────────────
    {
      type: "ellipse",
      // ellipse: cx cy rx ry [step]
      regex: /^ellipse\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'ellipse', cx: ev(m[1]), cy: ev(m[2]), rx: ev(m[3]), ry: ev(m[4]), tstep: ev(m[5] || '0.03') });
        } catch(e) { errs.push('L' + (li+1) + ': ellipse error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e08030' : '#c06010';
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = 0; t <= Math.PI * 2 + cmd.tstep; t += cmd.tstep) {
          var wx = cmd.cx + cmd.rx * Math.cos(t), wy = cmd.cy + cmd.ry * Math.sin(t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
    // ─── リサージュ曲線 ───────────────────────────────────────────────────
    {
      type: "lissajous",
      // lissajous: A B a b delta [tmin, tmax, step]
      // x = A*sin(a*t + delta), y = B*sin(b*t)
      regex: /^lissajous\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'lissajous', A: ev(m[1]), B: ev(m[2]), a: ev(m[3]), b: ev(m[4]), delta: ev(m[5]),
            tmin: ev(m[6]||'0'), tmax: ev(m[7]||'6.2832'), tstep: ev(m[8]||'0.02') });
        } catch(e) { errs.push('L' + (li+1) + ': lissajous error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#c040e0' : '#a020c0'; // 紫マゼンタ
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = cmd.tmin; t <= cmd.tmax + cmd.tstep * 0.5; t += cmd.tstep) {
          var wx = cmd.A * Math.sin(cmd.a * t + cmd.delta);
          var wy = cmd.B * Math.sin(cmd.b * t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── サイクロイド ─────────────────────────────────────────────────────
    {
      type: "cycloid",
      // cycloid: r [tmin, tmax, step]
      // x = r(t - sin t), y = r(1 - cos t)
      regex: /^cycloid\s*:\s*([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'cycloid', r: ev(m[1]),
            tmin: ev(m[2]||'-12.57'), tmax: ev(m[3]||'12.57'), tstep: ev(m[4]||'0.05') });
        } catch(e) { errs.push('L' + (li+1) + ': cycloid error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#e0a030' : '#c08010'; // 黄系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true;
        for (var t = cmd.tmin; t <= cmd.tmax + cmd.tstep * 0.5; t += cmd.tstep) {
          var wx = cmd.r * (t - Math.sin(t));
          var wy = cmd.r * (1 - Math.cos(t));
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── エピサイクロイド ──────────────────────────────────────────────────
    {
      type: "epicycloid",
      // epicycloid: R r [step]
      // x=(R+r)cos(t) - r*cos((R+r)/r * t)
      regex: /^epicycloid\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'epicycloid', R: ev(m[1]), r: ev(m[2]), tstep: ev(m[3]||'0.02') });
        } catch(e) { errs.push('L' + (li+1) + ': epicycloid error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#40d0a0' : '#20b080'; // ミント
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var R = cmd.R, r = cmd.r; var tmax = Math.PI * 2;
        var first = true;
        for (var t = 0; t <= tmax + cmd.tstep; t += cmd.tstep) {
          var wx = (R + r) * Math.cos(t) - r * Math.cos((R + r) / r * t);
          var wy = (R + r) * Math.sin(t) - r * Math.sin((R + r) / r * t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── ヒポトロコイド ───────────────────────────────────────────────────
    {
      type: "hypotrochoid",
      // hypotrochoid: R r d [turns] (turnsを省略すると自動計算)
      regex: /^hypotrochoid\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var R = ev(m[1]), r = ev(m[2]);
          // LCM で閉じる周期を計算
          function gcd(a,b){a=Math.round(Math.abs(a));b=Math.round(Math.abs(b));while(b){var t=b;b=a%b;a=t;}return a;}
          var g = gcd(Math.round(R), Math.round(r));
          var periods = r / g;
          cmds.push({ type: 'hypotrochoid', R: R, r: r, d: ev(m[3]),
            tmax: Math.PI * 2 * periods, tstep: ev(m[4]||'0.03') });
        } catch(e) { errs.push('L' + (li+1) + ': hypotrochoid error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#f06080' : '#d04060'; // コーラル
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var R = cmd.R, r = cmd.r, d = cmd.d; var first = true;
        for (var t = 0; t <= cmd.tmax + cmd.tstep; t += cmd.tstep) {
          var wx = (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t);
          var wy = (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t);
          var c = this._w2c(wx, wy);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    }
  ],
  presets: {
    circle: {
      name: "円 (Circle)",
      code: "ID = circle([cx], [cy], [r])\n\n// 円\ncircle: [cx] [cy] [r]\nfill: none"
    },
    ellipse: {
      name: "楕円 (Ellipse)",
      code: "ID = ellipse([cx], [cy], [rx], [ry])\n\n// 楕円\nellipse: [cx] [cy] [rx] [ry]\nfill: none"
    },
    lissajous: {
      name: "リサージュ曲線 (Lissajous)",
      code: "ID = lissajous([A], [B], [a], [b], [delta])\n\n// x=A*sin(a*t+delta), y=B*sin(b*t)\nlissajous: [A] [B] [a] [b] [delta] [0, 6.2832, 0.01]\nfill: none"
    },
    cycloid: {
      name: "サイクロイド (Cycloid)",
      code: "ID = cycloid([r])\n\n// x=r(t-sin t), y=r(1-cos t)\ncycloid: [r] [-12.57, 12.57, 0.05]\nfill: none"
    },
    epicycloid: {
      name: "エピサイクロイド (Epicycloid)",
      code: "ID = epicycloid([R], [r])\n\n// エピサイクロイド\nepicycloid: [R] [r]\nfill: none"
    },
    hypotrochoid: {
      name: "ヒポトロコイド (Hypotrochoid)",
      code: "ID = hypotrochoid([R], [r], [d])\n\n// ヒポトロコイド (スピログラフ)\nhypotrochoid: [R] [r] [d]\nfill: none"
    }
  },
  doc: "## Parametric Curves Addon\n\n媒介変数表示の曲線を描画します。\n\n### コマンド一覧\n- `circle: cx cy r`                       → 円\n- `ellipse: cx cy rx ry`                  → 楕円\n- `lissajous: A B a b delta`              → リサージュ曲線\n- `cycloid: r`                            → サイクロイド\n- `epicycloid: R r`                       → エピサイクロイド\n- `hypotrochoid: R r d`                   → ヒポトロコイド",
  onLoad: function() { console.log("Parametric Curves Addon loaded!"); }
});
