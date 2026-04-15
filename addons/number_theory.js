/**
 * 数論可視化拡張機能 (Number Theory Addon)
 * 素数散布図・フィボナッチ螺旋・ユークリッド互除法図を提供します。
 */
ZuhyoAddonAPI.register({
  name: "Number Theory",
  version: "1.0",
  type: "plugin",
  commands: [
    // ─── 素数散布図 ───────────────────────────────────────────────────────
    // primeplot: N  → 2..N の素数を横軸に並べて点描画
    {
      type: "primeplot",
      regex: /^primeplot\s*:\s*([^\s\[]+)(?:\s+\[\s*([^\]]+)\s*\])?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var N = Math.min(Math.max(Math.round(ev(m[1])), 2), 500);
          // エラトステネスの篩
          var sieve = new Array(N + 1).fill(true);
          sieve[0] = sieve[1] = false;
          for (var i = 2; i * i <= N; i++) {
            if (sieve[i]) for (var j = i * i; j <= N; j += i) sieve[j] = false;
          }
          var primes = [];
          for (var k = 2; k <= N; k++) { if (sieve[k]) primes.push(k); }
          cmds.push({ type: 'primeplot', primes: primes, dotSize: ev(m[2]||'0.12') });
        } catch(e) { errs.push('L'+(li+1)+': primeplot error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.fillStyle = sel ? '#f08040' : '#d06020';
        cmd.primes.forEach(function(p, idx) {
          // x = index, y = p をマッピング
          var c = this._w2c(idx, p);
          ctx.beginPath();
          var sc = this._w2c(0, 0), sc1 = this._w2c(cmd.dotSize, 0);
          var r = Math.abs(sc1.x - sc.x);
          if (r < 1) r = 1.5;
          ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
        }.bind(this));
        ctx.restore();
      }
    },
    // ─── フィボナッチ螺旋 ─────────────────────────────────────────────────
    // fibospiral: N  → N 項のフィボナッチ数列を使った四角螺旋
    {
      type: "fibospiral",
      regex: /^fibospiral\s*:\s*([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var N = Math.min(Math.max(Math.round(ev(m[1])), 2), 18);
          var scale = ev(m[2] || '1');
          // フィボナッチ数列
          var fibs = [1, 1];
          for (var i = 2; i < N; i++) fibs.push(fibs[i-1] + fibs[i-2]);
          cmds.push({ type: 'fibospiral', fibs: fibs, scale: scale });
        } catch(e) { errs.push('L'+(li+1)+': fibospiral error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.strokeStyle = sel ? '#c0a030' : '#a08010'; // 黄金色
        ctx.lineWidth = sel ? 2.0 : 1.5;
        ctx.lineCap = 'round';
        var sc = cmd.scale;
        // 各フィボナッチ正方形に4分の1円弧を描く
        var dirs = [[1,0],[0,1],[-1,0],[0,-1]]; // 右, 下, 左, 上
        var ox = 0, oy = 0;
        cmd.fibs.forEach(function(f, i) {
          var r = f * sc;
          var dir = i % 4;
          // 円弧の中心の基準オフセット
          var centers = [
            [ox + r, oy + 0],
            [ox + 0, oy + r],
            [ox - r, oy + 0],
            [ox + 0, oy - r]
          ];
          var cen = centers[dir];
          var startAngle = [Math.PI, 1.5*Math.PI, 0, 0.5*Math.PI][dir];
          var endAngle   = [1.5*Math.PI, 2*Math.PI, 0.5*Math.PI, Math.PI][dir];
          var wc = this._w2c(cen[0], cen[1]);
          var sc1 = this._w2c(cen[0] + r, cen[1]);
          var pxR = Math.abs(sc1.x - wc.x);
          ctx.beginPath();
          ctx.arc(wc.x, wc.y, pxR, startAngle, endAngle);
          ctx.stroke();
          // 原点を次の位置に進める
          var d = dirs[dir];
          ox += d[0] * r;
          oy += d[1] * r;
        }.bind(this));
        ctx.restore();
      }
    },
    // ─── 黄金比矩形タイル ────────────────────────────────────────────────
    // goldentile: N scale  → N 段の黄金比矩形を描画
    {
      type: "goldentile",
      regex: /^goldentile\s*:\s*([^\s]+)(?:\s+([^\s]+))?/i,
      parse: function(m, cmds, errs, vars, li) {
        try {
          function ev(expr) {
            var clean = (expr||'0').replace(/\[([a-zA-Z_]+)\]/g, function(_, v) { return vars[v] !== undefined ? String(vars[v]) : '0'; });
            return window.ZuhyoMath && window.ZuhyoMath.eval ? window.ZuhyoMath.eval(clean, vars) : parseFloat(clean);
          }
          var N = Math.min(Math.max(Math.round(ev(m[1])), 2), 12);
          var scale = ev(m[2] || '1');
          var fibs = [1, 1];
          for (var i = 2; i < N; i++) fibs.push(fibs[i-1] + fibs[i-2]);
          cmds.push({ type: 'goldentile', fibs: fibs, scale: scale });
        } catch(e) { errs.push('L'+(li+1)+': goldentile error - '+e.message); }
      },
      render: function(cmd, pts, sel) {
        var ctx = this.ctx; ctx.save();
        ctx.lineWidth = sel ? 1.8 : 1.2;
        var palette = ['#e06030','#30a0e0','#60c040','#e0a020','#9040d0','#30c0b0'];
        var dirs = [[1,0],[0,-1],[-1,0],[0,1]];
        var ox = 0, oy = 0;
        cmd.fibs.forEach(function(f, i) {
          var r = f * cmd.scale;
          var dir = i % 4;
          ctx.strokeStyle = palette[i % palette.length];
          var d = dirs[dir];
          // 正方形
          var corners = [[ox, oy],[ox+r*d[1], oy+r*d[0]],[ox+r*d[1]+r*d[0], oy+r*d[0]+r*d[1]],[ox+r*d[0], oy+r*d[1]]];
          ctx.beginPath();
          corners.forEach(function(pt, ci) {
            var c = this._w2c(pt[0], pt[1]);
            ci === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
          }.bind(this));
          ctx.closePath(); ctx.stroke();
          ox += d[0] * r; oy += d[1] * r;
        }.bind(this));
        ctx.restore();
      }
    }
  ],
  presets: {
    primeplot: {
      name: "素数散布図 (Prime Plot)",
      code: "ID = primes([N])\n\n// 2〜N の素数を点で表示\nprimeplot: [N]\n\n// 座標軸\n180o2=xl\n0o50=xr\nxl<->xr\n270o2=yd\n90o500=yu\nyd<->yu\nfill: none"
    },
    fibospiral: {
      name: "フィボナッチ螺旋 (Fibonacci Spiral)",
      code: "ID = fibo([N], [scale])\n\n// フィボナッチ螺旋\nfibospiral: [N] [scale]\nfill: none"
    },
    goldentile: {
      name: "黄金比タイル (Golden Tile)",
      code: "ID = golden([N], [scale])\n\n// 黄金比矩形の入れ子\ngoldentile: [N] [scale]\nfill: none"
    }
  },
  doc: "## Number Theory Addon\n\n数論的な図形を可視化します。\n\n### コマンド一覧\n- `primeplot: N`            2〜N の素数を散布図表示\n- `fibospiral: N scale`     フィボナッチ螺旋 (四分円弧)\n- `goldentile: N scale`     黄金比矩形タイル",
  onLoad: function() { console.log("Number Theory Addon loaded!"); }
});
