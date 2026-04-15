/**
 * 統計グラフ拡張機能 (Statistics Addon)
 * 正規分布曲線・棒グラフ・ヒストグラムのコマンドを提供します。
 */
ZuhyoAddonAPI.register({
  name: "Statistics",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 正規分布 N(μ, σ) ────────────────────────────────────────────────
    {
      type: "normaldist",
      // normaldist: mu sigma [xmin, xmax, step]
      regex: /^normaldist\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var mu = ev(m[1]), sigma = ev(m[2]);
          cmds.push({ type: 'normaldist', mu: mu, sigma: sigma,
            start: ev(m[3] || String(mu - 4 * sigma)),
            end:   ev(m[4] || String(mu + 4 * sigma)),
            step:  ev(m[5] || String(sigma * 0.05)) });
        } catch(e) { errs.push('L' + (li+1) + ': normaldist error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#40a8e0' : '#2088c0'; // 青系
        ctx.lineWidth = sel ? 2.5 : 2.0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        var first = true; var mu = cmd.mu, sig = cmd.sigma;
        var coeff = 1 / (sig * Math.sqrt(2 * Math.PI));
        for (var x = cmd.start; x <= cmd.end + cmd.step * 0.5; x += cmd.step) {
          var exp = -0.5 * Math.pow((x - mu) / sig, 2);
          var y = coeff * Math.exp(exp);
          var c = this._w2c(x, y);
          if (first) { ctx.moveTo(c.x, c.y); first = false; } else ctx.lineTo(c.x, c.y);
        }
        ctx.stroke(); ctx.restore();
      }
    },
    // ─── 棒グラフ ─────────────────────────────────────────────────────────
    {
      type: "bargraph",
      // bargraph: x1,y1,x2,y2,...  (カンマ区切りペアを連続して)
      // 実装: bargraph: [barwidth] val1 val2 val3 ...
      regex: /^bargraph\s*:\s*([^\s]+)\s+(.+)/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var w = ev(m[1]);
          var vals = m[2].trim().split(/[\s,]+/).map(function(s){ return ev(s); });
          cmds.push({ type: 'bargraph', barWidth: w, values: vals });
        } catch(e) { errs.push('L' + (li+1) + ': bargraph error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        var fillCol = sel ? 'rgba(80,160,240,0.55)' : 'rgba(50,120,200,0.45)';
        var strokeCol = sel ? '#40a0f0' : '#3080d0';
        var bw = cmd.barWidth; var n = cmd.values.length;
        for (var i = 0; i < n; i++) {
          var x = i * bw; var y = cmd.values[i];
          var tl = this._w2c(x, Math.max(0, y));
          var br = this._w2c(x + bw * 0.85, Math.min(0, y));
          var rectX = tl.x, rectY = tl.y;
          var rectW = br.x - tl.x, rectH = br.y - tl.y;
          ctx.fillStyle = fillCol;
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = sel ? 1.5 : 1.0;
          ctx.fillRect(rectX, rectY, rectW, rectH);
          ctx.strokeRect(rectX, rectY, rectW, rectH);
        }
        ctx.restore();
      }
    },
    // ─── 正規分布の下塗りあり ─────────────────────────────────────────────
    {
      type: "normalfill",
      // normalfill: mu sigma xfrom xto  (塗りつぶし範囲)
      regex: /^normalfill\s*:\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            let clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var mu = ev(m[1]), sigma = ev(m[2]);
          cmds.push({ type: 'normalfill', mu: mu, sigma: sigma,
            xfrom: ev(m[3]), xto: ev(m[4]),
            step: ev(m[5] || String(sigma * 0.05)) });
        } catch(e) { errs.push('L' + (li+1) + ': normalfill error - ' + e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        var mu = cmd.mu, sig = cmd.sigma;
        var coeff = 1 / (sig * Math.sqrt(2 * Math.PI));
        ctx.fillStyle = sel ? 'rgba(80,160,240,0.35)' : 'rgba(50,120,200,0.25)';
        ctx.strokeStyle = sel ? '#40a0f0' : '#3080d0';
        ctx.lineWidth = sel ? 2.0 : 1.5;
        ctx.beginPath();
        var start = this._w2c(cmd.xfrom, 0);
        ctx.moveTo(start.x, start.y);
        for (var x = cmd.xfrom; x <= cmd.xto + cmd.step * 0.5; x += cmd.step) {
          var y = coeff * Math.exp(-0.5 * Math.pow((x - mu) / sig, 2));
          var c = this._w2c(x, y);
          ctx.lineTo(c.x, c.y);
        }
        var end = this._w2c(cmd.xto, 0);
        ctx.lineTo(end.x, end.y);
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  ],
  presets: {
    normaldist: {
      name: "正規分布 N(μ,σ)",
      code: "ID = normal([mu], [sigma])\n\n// 正規分布曲線\nnormaldist: [mu] [sigma]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o5=yd\n90o5=yu\nyd<->yu\nfill: none"
    },
    normalfill: {
      name: "正規分布 (区間塗りつぶし)",
      code: "ID = normalfill([mu], [sigma], [from], [to])\n\n// 区間 [from, to] を塗りつぶし\nnormaldist: [mu] [sigma]\nnormalfill: [mu] [sigma] [from] [to]\n\n// 座標軸\n180o15=xl\n0o15=xr\nxl<->xr\n270o5=yd\n90o5=yu\nyd<->yu\nfill: none"
    },
    bargraph: {
      name: "棒グラフ (Bar Graph)",
      code: "ID = bar([width])\n\n// bargraph: 棒幅 値1 値2 ...\nbargraph: [width] 3 5 2 8 6 4\n\n// 座標軸\n180o2=xl\n0o12=xr\nxl<->xr\n270o2=yd\n90o10=yu\nyd<->yu\nfill: none"
    }
  },
  doc: "## Statistics Addon\n\n統計グラフを描画します。\n\n### コマンド一覧\n- `normaldist: mu sigma [xmin, xmax, step]`   正規分布曲線\n- `normalfill: mu sigma xfrom xto [step]`      区間の確率塗りつぶし\n- `bargraph: barWidth v1 v2 v3 ...`            棒グラフ",
  onLoad: function() { console.log("Statistics Addon loaded!"); }
});
