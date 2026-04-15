# 図描 (Zuhyo) — 機能リファレンス

> バージョン 2.0 | 最終更新: 2026-04-15

---

## 目次

1. [基本構文](#1-基本構文)
2. [アニメーション — `[t]` 時間変数](#2-アニメーション--t-時間変数)
3. [スマートスナップ & 拘束 — `intersect:`](#3-スマートスナップ--拘束--intersect)
4. [反復コマンド — `repeat:`](#4-反復コマンド--repeat)
5. [ビジュアルテーマ](#5-ビジュアルテーマ)
6. [アドオンシステム](#6-アドオンシステム)
7. [インスペクター & スライダー](#7-インスペクター--スライダー)
8. [コマンドリファレンス一覧](#8-コマンドリファレンス一覧)

---

## 1. 基本構文

図描の構造コードは、**点の定義**と**線の定義**を組み合わせて図を作ります。

### 構造ヘッダー

```zuhyo
ID = structureName([param1], [param2])
```

- `ID = square` — パラメータなしの構造
- `ID = cylinder([radius], [height])` — パラメータ付きの構造

### 点の定義

```
角度  基準点  距離 = 新しいID
```

| 例 | 意味 |
|---|---|
| `90o1 = a` | 原点Oの真上 1 単位に点 `a` を定義 |
| `0a2 = b` | 点 `a` の右 2 単位に点 `b` を定義 |
| `+90b1 = c` | 前回の角度(0°) + 90° = 90° 方向、点 `b` から 1 単位に点 `c` |

### 中点の定義

```
a~(pct%, angle, dist)b = midPt
```

- `a~(50%, 90, 1)b = m` — `a`〜`b` の中点から 90° 方向 1 単位にオフセット

### 線の定義

```
a <-> b <-> c <-> a
```

| コネクタ | スタイル |
|---|---|
| `<->` | 実線 |
| `<..>` | 点線 |
| `<-->` | 破線 |
| `<-.->` | 一点鎖線 |
| `<->` `(50%, 90, 1)` | 曲線（制御点付き） |

### 塗りつぶし

```
fill: cross(45, 1, 0.5)
```

スタイル: `none` / `dot` / `line` / `hatch` / `cross` / `grid`

---

## 2. アニメーション — `[t]` 時間変数

**`[t]`** はグローバルな時間変数（秒）で、アニメーションコントロールバーが更新します。  
あらゆる数値の場所で使用できます。

### 使い方

```zuhyo
ID = spinning_dot

// [t] を角度に使って点を回転させる
math([t] * 36) o 1 = p
o <-> p
label: "t=[t]" p
```

```zuhyo
ID = wave

// 正弦波を [t] でシフト
plot: sin(x + [t]) [-5, 5, 0.1]
```

### アニメーションコントロール

| ボタン / 操作 | 機能 |
|---|---|
| ▶ / ⏸ ボタン | 再生 / 一時停止 |
| ◼ ボタン | `t = 0` にリセット |
| タイムラインスライダー | 任意の時刻にシーク（スライダー操作中は自動停止） |
| 速度セレクト | ×¼ / ×½ / ×1 / ×2 / ×4 |

### テクニック

```zuhyo
ID = pendulum([length])

// 振り子の角度を t の正弦で計算
[ang] = math(sin([t] * 2) * 45)
[ang]o[length] = tip
o <-> tip
```

> **ヒント**: インスペクタースライダーとアニメーションを組み合わせると、  
> パラメータを変えながらリアルタイムでアニメーションを確認できます。

---

## 3. スマートスナップ & 拘束 — `intersect:`

2つの直線の交点を数学的に正確に計算して、新しい点として定義します。

### 構文

```
intersect: pA pB pC pD = newPt
```

- `pA pB` — 1本目の直線を定義する2点
- `pC pD` — 2本目の直線を定義する2点
- `newPt` — 計算された交点の新しいID

### 例

```zuhyo
ID = triangle_centroid

// 三角形の頂点
210o1 = a
330o1 = b
90o1 = c

// 各辺の中点
a~(50%)b = mab
a~(50%)c = mac

// 中線の交点 = 重心
intersect: a mab c mac = centroid

// 描画
a <-> b <-> c <-> a
a <-> mab
c <-> centroid
label: "G" centroid
```

> **制限**: 現在は直線-直線の交点のみサポート。  
> 円-直線交点は `conic_sections` アドオンを使用してください。

---

## 4. 反復コマンド — `repeat:`

N個の点を円周上に等間隔で生成し、多角形を自動描画します。

### 構文

```
repeat: N fromId dist [startAngle] = prefix
```

| 引数 | 説明 | デフォルト |
|---|---|---|
| `N` | 点の数 | — |
| `fromId` | 中心点のID | — |
| `dist` | 半径（距離） | — |
| `[startAngle]` | 開始角度 (°) | `0` |
| `prefix` | 生成点の名前のプレフィックス | — |

生成される点：`prefix_0`, `prefix_1`, ... `prefix_(N-1)`

### 例

```zuhyo
ID = regular_polygon([n], [r])

// n角形を原点を中心に自動生成
repeat: [n] o [r] [90] = v
```

```zuhyo
ID = clock_face

// 時計の目盛り (12個)
repeat: 12 o 2 [90] = tick
// 30分ごとに太い目盛り（別の repeat でさらに重ねることも可）
```

```zuhyo
ID = star([n], [outer], [inner])

// 偶数番と奇数番で内外半径を切り替えた星形は
// repeat: [n] o [outer] [90] = outer_pts
// repeat: [n] o [inner] [90+180/[n]] = inner_pts
// で外点と内点を定義し、交互に結ぶ
```

> **ヒント**: `[t]` と組み合わせると、回転する多角形のアニメーションが作れます:
> ```zuhyo
> repeat: 6 o 1 [[t]*10] = hex
> ```

---

## 5. ビジュアルテーマ

ヘッダーのテーマピッカーで4種類のテーマを切り替えられます。テーマはブラウザに自動保存されます。

| ボタン | テーマ名 | 特徴 |
|---|---|---|
| □ | **セピア** (デフォルト) | 製図用紙風の温かみのある色調 |
| ◈ | **ブループリント** | 青写真風の暗い青背景に青白い線 |
| ◉ | **ダーク** | 暗いモノクロームの夜間モード |
| ○ | **ペーパー** | クリーンな白黒、論文・印刷向け |

### テーマのカスタマイズ（上級者向け）

`css/zuhyo.css` に `[data-theme="mytheme"]` セレクターを追加することで独自テーマを作成できます:

```css
[data-theme="midnight"] {
  --bg:       #0d0020;
  --cv-bg:    #0d0020;
  --cv-ink:   #cc88ff;
  --cv-grid:  rgba(150,80,255,.08);
  --cv-axis:  rgba(150,80,255,.30);
  /* ... 他の変数も定義 */
}
```

JavaScriptから `setTheme('midnight')` で適用できます。

---

## 6. アドオンシステム

### 同梱アドオン一覧

| ファイル | 名前 | 追加コマンド |
|---|---|---|
| `math_functions.js` | Math Functions | `linegraph`, `absgraph`, `stepfn` など |
| `trig_functions.js` | Trigonometric Functions | `sinplot`, `cosplot`, `tanplot` |
| `polar_curves.js` | Polar Curves | `rosecurve`, `spiral`, `cardioid`, `lemniscate` |
| `parametric_curves.js` | Parametric Curves | `circle`, `ellipse`, `lissajous`, `cycloid` |
| `conic_sections.js` | Conic Sections | `parabola`, `conicellipse`, `hyperbola` |
| `statistics.js` | Statistics | `normaldist`, `bargraph` |
| `number_theory.js` | Number Theory | `primeplot`, `fibospiral` |
| `vector_field.js` | Vector Field | `vecfield`, `heatmap` |
| `geometry_tools.js` | Geometry Tools | `polygon`, `anglemark`, `dimline` |
| `calculus.js` | Calculus | `fplot`, `integral`, `tangent`, `riemann` |

### アドオンの有効/無効

プラグインメニュー（ヘッダー「プラグイン ▾」）の各アドオン名の左にある ✓ / ○ でトグルできます。  
無効にしたアドオンのコマンドはパーサーで認識されなくなります。

### 独自アドオンの作成

```js
ZuhyoAddonAPI.register({
  name: "My Addon",
  version: "1.0",
  doc: "mycommand: x y z — 説明文",
  commands: [{
    type: 'mycommand',
    regex: /^mycommand\s*:\s*(.+)/i,
    parse: function(m, cmds, errs, vars, li) {
      // m[1] = キャプチャした引数文字列
      var val = ZuhyoAddonAPI.evalExpr(m[1], vars);
      cmds.push({ type: 'mycommand', value: val });
    },
    render: function(cmd, pts, sel) {
      // this = ZuhyoRenderer インスタンス
      var ctx = this.ctx;
      // ... 描画処理
    }
  }],
  presets: {
    example: {
      name: "サンプルプリセット",
      code: "ID = my_example\nmycommand: 1 2 3"
    }
  }
});
```

#### 共通ユーティリティ

```js
ZuhyoAddonAPI.evalExpr(expr, vars)  // 文字列式を評価して数値を返す
ZuhyoMath.eval(expr, vars)          // 同上（低レベルAPI）
window._zGV                         // グローバル変数オブジェクト { t: ... }
```

---

## 7. インスペクター & スライダー

インスタンスを選択すると右のインスペクターが開きます。

### 引数スライダー

- パラメータが数値の場合、スライダーが自動的に表示されます
- スライダーを動かすとキャンバスが**リアルタイム**に更新されます（アニメーションなし）
- テキストボックスに直接値を入力することもできます
- スライダーの範囲は入力値に応じて自動的に拡張します

### アニメーションとの組み合わせ

1. インスペクターで引数 `[n]` を 5 に設定
2. コードに `[t]` を使った回転式を書く
3. ▶ ボタンでアニメーション開始
4. スライダーで `[n]` を変えながらリアルタイム確認

---

## 8. コマンドリファレンス一覧

| コマンド | 書式 | 説明 |
|---|---|---|
| **構造定義** | `ID = name([p1], [p2])` | 構造の名前とパラメータ |
| **点定義** | `angle point dist = id` | 極座標で点を配置 |
| **相対角度** | `+angle point dist = id` | 前の角度からの差分 |
| **中点** | `a~(pct%, ang, dst)b = id` | 2点間の補間点 |
| **線** | `a <-> b` | 2点間を直線で結ぶ |
| **曲線** | `a <->(50%,90,1) b` | 制御点付きの弧 |
| **ベジェ** | `a <->(c1)(c2) b` | 3次ベジェ曲線 |
| **変数計算** | `[v] = math(expr)` | 変数を式で計算 |
| **グラフ描画** | `plot: f(x) [start, end, step]` | x-y グラフ |
| **塗りつぶし** | `fill: style(args)` | 閉じた形状の塗りつぶし |
| **テキスト** | `text: "str" pa pb` | 矩形内にフィットするテキスト |
| **ラベル** | `label: "str" p [size]` | 点の近くにラベル |
| **交点** ⭐ | `intersect: a b c d = p` | 2直線の交点を計算 |
| **反復** ⭐ | `repeat: N from dist [ang] = pfx` | N点を等間隔で生成 |
| **時間変数** ⭐ | `[t]` | アニメーション時間（秒） |

> ⭐ = v2.0 新機能

---

*図描 Zuhyo Diagram Engine — is-a.tokyo/math*
