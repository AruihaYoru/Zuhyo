# Zuhyo

Zuhyo は幾何学描画言語とリアルタイム編集 UI を組み合わせた図形エディターです。

## 特徴

- 点・線・曲線・fill をテキストで表現し、即時描画
- `ID = name([param])` で構造を定義し、同じ図形を再利用できる
- `fill: style(args)` で領域内にパターンを埋める
- PNG / SVG / プロジェクトファイル `.zy` への書き出し
- マウス操作でパン、ズーム、インスタンス選択・ドラッグ
- `math()` 式による変数計算とパラメータ置換

## 言語仕様

### ヘッダー定義

- `ID = name` または `ID = name([radius], [height])`
- `name` は構造名、`[param]` は引数名

例:

```text
ID = cylinder([radius])
```

### コメント

- `//` 以降は行末までコメント

例:

```text
// これはコメントです
```

### 点の定義

- `angle fromId distance = newId`
- `angle` は 0°=右、反時計回り
- `fromId` は基準点、`distance` は距離
- `+angle` / `+distance` で直前の角度・距離に加算

例:

```text
0o1 = a
180o1 = b
+90b1 = c
```

### 中点・オフセット点

- `a~(pct,ang,dst)b = [name]`
- `pct` は a から b への位置割合（%）
- `ang` は方向角度、`dst` はオフセット距離

例:

```text
a~(50%, 90, 0.5)b = c
```

### 線の定義

- `A <conn> B` で `A` から `B` への線を描く
- `conn` は `<...>` 形式で、`-` `..` `--` `-.-` `-..-` などを指定可能
- 制御点を `(pct,ang,dst)` で追加できる

例:

```text
a <-> b
a <->(50%, 90,0.5) b
b <..>(50%, 270,0.5) a
```

### fill の仕様

- `fill: style(args)` は直前の線グループに適用される
- 空行が挟まれるまで、1つの fill は同じグループの線を対象とする
- `style` は `none`, `dot`, `line`, `cross`, `hatch`, `grid` などを指定できる
- `line` / `grid` は角度ベースの新仕様（トーン v2.0）で、未指定時の角度は `0`°
- `cross` / `hatch` は角度ベースの新仕様で、未指定時の角度は `45`°
- `dot` は従来どおりオフセットと密度を指定可能
- さらに `hatch` や `grid` で線の網目や格子のトーン表現が可能

#### トーン v2.0 例

```text
a <->(50%, 90,0.5) b
b <->(50%, 270,0.5) a
fill: line(45, 1.2)
```

- `line(angle, spacing, density)`
  - `angle`: 線の傾き（度数法）
  - `spacing`: 線の間隔スケール
  - `density`: 密度調整（値が大きいほど濃い）

```text
a <-> b
b <-> c
c <-> a
fill: cross(30, 0.8)
```

- `cross(angle, spacing, density)`
  - 2方向の交差線を描画

```text
a <-> b
b <-> c
c <-> a
fill: hatch(60, 1)
```

- `hatch(angle, spacing, density)`
  - 1方向のハッチ線を描画

```text
a <-> b
b <-> c
c <-> a
fill: grid(0, 1)
```

- `grid(angle, spacing, density)`
  - 2方向の格子線を描画

#### `dot` の引数

- `fill: dot(offsetX, offsetY, density)`
- `offsetX`, `offsetY` はパターンの移動、`density` は点の密度

例:

```text
a <->(50%, 90,0.5) b
b <->(50%, 270,0.5) a
fill: none

// 空行で区切ることで次の fill は新しいグループに適用される
c <-> d
fill: dot(0.5, 0.2, 1.5)
```

### 変数と math

- `[name] = math(expr)` で数値計算結果を変数に代入
- `sin`, `cos`, `tan`, `sqrt`, `abs`, `pow`, `max`, `min`, `floor`, `ceil`, `round`, `exp`, `log`, `pi`, `e` が使用可能

例:

```text
[theta] = math(45)
[rad]   = math(pi / 180)
[r]     = math(pow(2, 0.5))
[best]  = math(max(1, min(5, 3)))
```

### パラメータ置換

- `ID = shape([radius])` の定義内で `[radius]` を直接使用できる

例:

```text
ID = circle([radius])
0o[radius] = a
180o[radius] = b
```

## 例

```text
ID = circle([radius])
0o[radius] = a
180o[radius] = b
a <->(50%, 90,[radius]) b <->(50%, 270,[radius]) a
fill: dot
```

## 実装済み項目

- パーサー: 点定義、線定義、fill、コメント、ID / パラメータ、math
- レンダラー: Canvas 描画、曲線制御、fill パターン、SVG / PNG 書き出し
- UI: プロジェクト名、保存 / 読み込み / 書き出し、パン／ズーム、選択
