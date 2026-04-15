/**
 * ベクトル場拡張機能 (Vector Field Addon)
 * ベクトル場・勾配場・流線の可視化コマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Vector Field",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── ベクトル場 (格子状矢印) ──────────────────────────────────────────
    // vecfield: ux_expr uy_expr [gmin, gmax, gstep]
    // ux, uy は x と y を使った簡易式 (e.g. "-y" "x")
    {
      type: "vecfield",
      regex: /^vecfield\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'vecfield', uxExpr: m[1], uyExpr: m[2],
            gmin: ev(m[3]||'-5'), gmax: ev(m[4]||'5'), gstep: ev(m[5]||'1') });
        } catch(e) { errs.push('L'+(li+1)+': vecfield error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#50c0f0' : '#2090d0';
        ctx.fillStyle   = sel ? '#50c0f0' : '#2090d0';
        ctx.lineWidth   = sel ? 1.5 : 1.0;

        function evalExpr(expr, x, y) {
          try {
            return parseFloat(Function('"use strict"; var x='+x+',y='+y+'; return ('+expr+');')());
          } catch(_) { return 0; }
        }

        // グリッド内の最大長を計算してスケーリング
        var maxLen = 0;
        var vectors = [];
        for (var gx = cmd.gmin; gx <= cmd.gmax; gx += cmd.gstep) {
          for (var gy = cmd.gmin; gy <= cmd.gmax; gy += cmd.gstep) {
            var ux = evalExpr(cmd.uxExpr, gx, gy);
            var uy = evalExpr(cmd.uyExpr, gx, gy);
            var len = Math.sqrt(ux*ux + uy*uy);
            if (len > maxLen) maxLen = len;
            vectors.push({ x: gx, y: gy, ux: ux, uy: uy, len: len });
          }
        }
        if (maxLen === 0) maxLen = 1;
        var arrowLen = cmd.gstep * 0.45; // 格子間隔の 45% に正規化

        vectors.forEach(function(v) {
          if (v.len === 0) return;
          var norm = v.len / maxLen;
          var dx = (v.ux / v.len) * arrowLen * norm;
          var dy = (v.uy / v.len) * arrowLen * norm;
          var p0 = this._w2c(v.x, v.y);
          var p1 = this._w2c(v.x + dx, v.y + dy);
          // シャフト
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
          // 矢頭
          var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          var hw = 5 * norm + 2;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p1.x - hw * Math.cos(angle - 0.45), p1.y - hw * Math.sin(angle - 0.45));
          ctx.lineTo(p1.x - hw * Math.cos(angle + 0.45), p1.y - hw * Math.sin(angle + 0.45));
          ctx.closePath(); ctx.fill();
        }.bind(this));
        ctx.restore();
      }
    },
    // ─── 単一ベクトル ─────────────────────────────────────────────────────
    // vector: ox oy ux uy
    {
      type: "vector",
      regex: /^vector\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'vector', ox: ev(m[1]), oy: ev(m[2]), ux: ev(m[3]), uy: ev(m[4]) });
        } catch(e) { errs.push('L'+(li+1)+': vector error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#f06040' : '#d04020';
        ctx.fillStyle   = sel ? '#f06040' : '#d04020';
        ctx.lineWidth   = sel ? 2.2 : 1.8;
        var p0 = this._w2c(cmd.ox, cmd.oy);
        var p1 = this._w2c(cmd.ox + cmd.ux, cmd.oy + cmd.uy);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        var angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        var hw = 9;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p1.x - hw * Math.cos(angle - 0.4), p1.y - hw * Math.sin(angle - 0.4));
        ctx.lineTo(p1.x - hw * Math.cos(angle + 0.4), p1.y - hw * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },
    // ─── ポテンシャル等高線 (グラデーション塗) ────────────────────────────
    // contour: expr levels [gmin, gmax, gstep]  (簡易版)
    {
      type: "heatmap",
      // heatmap: expr [gmin, gmax, gstep]
      regex: /^heatmap\s*:\s*([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          cmds.push({ type: 'heatmap', fExpr: m[1],
            gmin: ev(m[2]||'-5'), gmax: ev(m[3]||'5'), gstep: ev(m[4]||'0.25') });
        } catch(e) { errs.push('L'+(li+1)+': heatmap error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        function evalF(expr, x, y) {
          try { return parseFloat(Function('"use strict"; var x='+x+',y='+y+'; return ('+expr+');')()); } catch(_) { return 0; }
        }
        // 値の範囲を先にスキャン
        var vals = [], minV = Infinity, maxV = -Infinity;
        for (var gx = cmd.gmin; gx <= cmd.gmax; gx += cmd.gstep) {
          for (var gy = cmd.gmin; gy <= cmd.gmax; gy += cmd.gstep) {
            var v = evalF(cmd.fExpr, gx, gy);
            vals.push({x: gx, y: gy, v: v});
            if (isFinite(v)) { if (v < minV) minV = v; if (v > maxV) maxV = v; }
          }
        }
        var range = maxV - minV || 1;
        var step = cmd.gstep;
        vals.forEach(function(d) {
          if (!isFinite(d.v)) return;
          var t = (d.v - minV) / range; // 0..1
          // 青→白→赤 のカラーマップ
          var r, g, b;
          if (t < 0.5) { r = Math.round(t*2*255); g = Math.round(t*2*255); b = 255; }
          else { r = 255; g = Math.round((1-t)*2*255); b = Math.round((1-t)*2*255); }
          ctx.fillStyle = 'rgba('+r+','+g+','+b+','+(sel?'0.7':'0.5')+')';
          var tl = this._w2c(d.x - step*0.5, d.y + step*0.5);
          var br = this._w2c(d.x + step*0.5, d.y - step*0.5);
          ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
        }.bind(this));
        ctx.restore();
      }
    }
  ],
  presets: {
    vecfield: {
      name: "ベクトル場 (Vector Field)",
      code: "ID = vfield\n\n// vecfield: Ux式 Uy式 [gmin, gmax, gstep]\n// 例: 回転場 Ux=-y Uy=x\nvecfield: -y x [-5, 5, 1]\nfill: none"
    },
    vector: {
      name: "単一ベクトル (Vector)",
      code: "ID = vec([ox], [oy], [ux], [uy])\n\n// ベクトル (始点, 成分)\nvector: [ox] [oy] [ux] [uy]\nfill: none"
    },
    heatmap: {
      name: "ヒートマップ (Heatmap)",
      code: "ID = heat\n\n// f(x,y) のヒートマップ\nheatmap: x*x - y*y [-5, 5, 0.25]\nfill: none"
    }
  },
  doc: "## Vector Field Addon\n\nベクトル場や場の可視化を行います。\n\n### コマンド一覧\n- `vecfield: Ux_expr Uy_expr [gmin, gmax, gstep]`  ベクトル場 (格子矢印)\n- `vector: ox oy ux uy`                           単一矢印ベクトル\n- `heatmap: f(x,y)_expr [gmin, gmax, gstep]`       f(x,y) のヒートマップ\n\n### 注意\n- `vecfield` / `heatmap` の式には `x`, `y` をそのまま使えます。\n- 例: `vecfield: -y x` → 回転場, `heatmap: x*x+y*y` → 距離の二乗",
  onLoad: function() { console.log("Vector Field Addon loaded!"); }
});
