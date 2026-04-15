/**
 * 一次方程式のグラフ拡張機能 (Zuhyo Addon)
 */
ZuhyoAddonAPI.register({
  name: "Linear Equation",
  version: "1.0",
  type: "plugin",
  commands: [
    {
      type: "lineareq",
      // lineareq: a b [minX, maxX, step]
      regex: /^lineareq\s*:\s*([^\s]+)\s+([^\s\[]+)(?:\s+\[\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
         try {
           const aExpr = m[1], bExpr = m[2];
           const startExpr = m[3] || "-10";
           const endExpr = m[4] || "10";
           const stepExpr = m[5] || "0.1";
           
           function ev(expr) {
             let clean = expr.replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
             return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
           }
           
           cmds.push({ 
             type: 'lineareq', 
             a: ev(aExpr), 
             b: ev(bExpr), 
             start: ev(startExpr), 
             end: ev(endExpr), 
             step: ev(stepExpr) 
           });
         } catch(e) {
           errs.push('L' + (li + 1) + ': lineareq error - ' + e.message);
         }
      },
      render: function(cmd, pts, sel) {
         var ctx = this.ctx; // This inherits from ZuhyoRenderer
         ctx.save();
         ctx.strokeStyle = sel ? '#4a60b0' : '#2a4090'; // グラフ専用の青色
         ctx.lineWidth = sel ? 2.5 : 2.0;
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.beginPath();
         var first = true;
         for (var x = cmd.start; (cmd.step > 0 ? x <= cmd.end : x >= cmd.end); x += cmd.step) {
           var y = cmd.a * x + cmd.b;
           var c = this._w2c(x, y);
           if (first) { ctx.moveTo(c.x, c.y); first = false; }
           else ctx.lineTo(c.x, c.y);
         }
         ctx.stroke();
         ctx.restore();
      }
    }
  ],
  structures: [
    {
      name: "linear_graph([a], [b])",
      code: [
        "// 一次方程式 y = ax + b のグラフ",
        "// インポートされた lineareq コマンドを使用します",
        "lineareq: [a] [b] [-10, 10, 0.1]",
        "",
        "// X軸とY軸の描画",
        "180 o 10 = x_min",
        "0 o 10 = x_max",
        "x_min <-> x_max",
        "",
        "270 o 10 = y_min",
        "90 o 10 = y_max",
        "y_min <-> y_max"
      ].join("\n")
    }
  ],
  onLoad: function() {
    console.log("Linear Equation Addon loaded successfully!");
  }
});
