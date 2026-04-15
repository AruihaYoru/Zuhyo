/**
 * 数学関数拡張機能 (Math Functions Addon)
 * 一次方程式、二次方程式、反比例のグラフコマンドとプリセット構造を提供します。
 */
ZuhyoAddonAPI.register({
  name: "Math Functions",
  version: "1.0",
  type: "plugin",
  commands: [
    {
      type: "lineareq",
      regex: /^lineareq\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
         try {
           function ev(expr) {
             let clean = expr.replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
             return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
           }
           cmds.push({ type: 'lineareq', a: ev(m[1]), b: ev(m[2]), start: ev(m[3]||"-10"), end: ev(m[4]||"10"), step: ev(m[5]||"0.1") });
         } catch(e) { errs.push('L' + (li + 1) + ': lineareq error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
         var ctx = this.ctx; ctx.save();
         ctx.strokeStyle = sel ? '#4a60b0' : '#2a4090'; ctx.lineWidth = sel ? 2.5 : 2.0;
         ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
         var first = true;
         for (var x = cmd.start; (cmd.step > 0 ? x <= cmd.end : x >= cmd.end); x += cmd.step) {
           var y = cmd.a * x + cmd.b;
           var c = this._w2c(x, y);
           if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
         }
         ctx.stroke(); ctx.restore();
      }
    },
    {
      type: "quadraticeq",
      regex: /^quadraticeq\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
         try {
           function ev(expr) {
             let clean = expr.replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
             return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
           }
           cmds.push({ type: 'quadraticeq', a: ev(m[1]), b: ev(m[2]), c: ev(m[3]), start: ev(m[4]||"-10"), end: ev(m[5]||"10"), step: ev(m[6]||"0.1") });
         } catch(e) { errs.push('L' + (li + 1) + ': quadraticeq error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
         var ctx = this.ctx; ctx.save();
         ctx.strokeStyle = sel ? '#4a9040' : '#2a7020'; ctx.lineWidth = sel ? 2.5 : 2.0; // 緑系統
         ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
         var first = true;
         for (var x = cmd.start; (cmd.step > 0 ? x <= cmd.end : x >= cmd.end); x += cmd.step) {
           var y = cmd.a * x * x + cmd.b * x + cmd.c;
           var c = this._w2c(x, y);
           if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
         }
         ctx.stroke(); ctx.restore();
      }
    },
    {
      type: "inverseprop",
      regex: /^inverseprop\s*:\s*([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
         try {
           function ev(expr) {
             let clean = expr.replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
             return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
           }
           cmds.push({ type: 'inverseprop', a: ev(m[1]), start: ev(m[2]||"-10"), end: ev(m[3]||"10"), step: ev(m[4]||"0.1") });
         } catch(e) { errs.push('L' + (li + 1) + ': inverseprop error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
         var ctx = this.ctx; ctx.save();
         ctx.strokeStyle = sel ? '#b04a4a' : '#902a2a'; ctx.lineWidth = sel ? 2.5 : 2.0; // 赤系統
         ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
         var first = true;
         for (var x = cmd.start; (cmd.step > 0 ? x <= cmd.end : x >= cmd.end); x += cmd.step) {
           if (Math.abs(x) < 0.05) { first = true; continue; } // 漸近線の飛躍を防ぐため分断
           var y = cmd.a / x;
           var c = this._w2c(x, y);
           if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
         }
         ctx.stroke(); ctx.restore();
      }
    }
  ],
  presets: {
    linear: {
      name: "1次方程式(Linear)",
      code: "ID = linear([a], [b])\n\n// 一次方程式 y = ax + b のグラフ\nlineareq: [a] [b] [-15, 15, 0.1]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o15=yd\n90o15=yu\nyd<->yu\nfill: none"
    },
    quadratic: {
      name: "2次方程式(Quadratic)",
      code: "ID = quadratic([a], [b], [c])\n\n// 二次方程式 y = ax^2 + bx + c のグラフ\nquadraticeq: [a] [b] [c] [-15, 15, 0.1]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o15=yd\n90o15=yu\nyd<->yu\nfill: none"
    },
    inverse: {
      name: "反比例(Inverse)",
      code: "ID = inverse([a])\n\n// 反比例 y = a \/ x のグラフ\ninverseprop: [a] [-15, 15, 0.05]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o15=yd\n90o15=yu\nyd<->yu\nfill: none"
    }
  },
  doc: "## Math Functions Addon\n\n数学的なグラフを簡単に描画するための事前定義済み拡張機能です。\n各専用コマンドは、通常の `plot:` コマンドよりも軽量で、色分けされた美しいプロットを提供します。\n\n### 利用可能なコマンド\n- `lineareq: a b [min, max, step]`\n  一次方程式 `y = ax + b` の青色のグラフを描画します。\n- `quadraticeq: a b c [min, max, step]`\n  二次方程式 `y = ax^2 + bx + c` の緑色のグラフを描画します。\n- `inverseprop: a [min, max, step]`\n  反比例 `y = a / x` の赤色のグラフを描画します。\n\n### プリセットの使い方\nヘッダーの「プラグイン ▾」メニューから、各種プリセットを選択すると、すぐに変数付きのテンプレート構造が読み込まれます。\nインスペクター上で変数 `[a]`, `[b]`, `[c]` を調整し、リアルタイムでのグラフの形状変化をお楽しみください。"
});
