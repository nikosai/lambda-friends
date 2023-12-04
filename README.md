![らむだフレンズ](docs/logo.png "らむだフレンズ")

[![CircleCI](https://circleci.com/gh/nikosai/lambda-friends.svg?style=svg)](https://circleci.com/gh/nikosai/lambda-friends)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

純粋型なし λ 計算と、型付き λ 計算（FL）のインタプリタです。

**_※現在メンテナンスのため、GUI の型付きモードを一時的に無効化しています。_**

[GitHub Pages 上に置いてあるのでそちらが標準の環境です](https://nikosai.github.io/lambda-friends/) が、`git clone`してから手元のブラウザで`docs/index.html`を開いても動きます。

## 今できること

- 純粋型なし λ 計算と、型付き λ 計算（FL）を扱える（設定により変更可）
- それぞれの推論規則に基づいた簡約ができる
  - 型なしの場合、η 簡約の可否を設定できる。
  - 型なしの場合、簡約基を選択して簡約を進められる。
  - 型なしの場合、評価戦略の指定ができる。
- マクロ定義ができる
  - 「マクロ」タブで定義済みマクロの一覧を表示する
- マクロ定義を書き並べたファイルを読み込める
  - [Lambda\*Magica](https://github.com/YuukiARIA/LambdaMagica)との後方互換性あり。\*.lm.txt（の形式のプレーンテキスト）を読み込める。
- LaTeX 形式で出力ができる（「Export」タブ）
  - 型推論の証明木（bussproofs 形式、型付きのみ）
  - 簡約の途中経過
- 入力履歴を補完できる
  - Linux のターミナルのように、上キーを押すと履歴を表示する。
  - ~~静的 javascript なので、セッションを超えて遡ることはできない。~~
  - localStorage を使い、セッションを越えて遡れるようになった。
- チャーチ数とチャーチ真理値の判定が出来る
  - 簡約後の形がチャーチ数・チャーチ真理値の場合、そのように表示
- 簡約グラフの表示ができる
  - 「グラフ」タブで簡約グラフを表示
  - [Cytoscape.js](http://js.cytoscape.org/)を利用
  - 多重辺はオン・オフ選択可能
  - png 形式の画像としてダウンロード可能
- LMNtal グラフと相互に変換できる
  - 「Import」「Export」タブ
  - エンコーディング方式は[後述](#lmntalコードへの変換について)
  - 型なしのみ
- SKI コンビネータと相互に変換できる
  - SKI → ラムダ は組み込みマクロとして
  - ラムダ → SKI は Export タブに
- de Bruijn Index と相互に変換できる
  - de Bruijn → ラムダ は Import タブに
  - ラムダ → de Bruijn は Export タブに
- 簡約グラフの形からラムダ式を逆引きできる（実験機能）
  - 「Import」タブ
  - まだ実験なので完全性はないが、健全性はある

## 基本的な入力形式

- 「\」「¥」「λ」はすべて「λ」として解釈される
- 関数適用は左結合的に解釈される
- λ 抽象は最長一致で解釈される
- 以上 2 つをもって曖昧性が排除される場合、括弧は省略して良い
- 空白は無視される
- 変数に使用できるのは大小英文字（計 52 文字）のみ。

## マクロ定義

[Lambda\*Magica](https://github.com/YuukiARIA/LambdaMagica)と同様の形式でマクロ定義ができる。

マクロは、 `false = \xy.y`のように定義し、 `<false>`のように使う。

型なしの場合、未定義のマクロは式中で使用できるが、自由変数と同様に扱われる（簡約基とみなされない）。

型付きの場合、未定義のマクロは式中で使用できない。

また、型付きで定義したものは型付きでしか使用できない（逆も然り）。

### 組み込みマクロ

以下の 3 つは、定義せずとも利用できる。ユーザ定義のマクロはこれらの名前を使用できない。

- チャーチ数 ex. `<3>` `<5>`
- チャーチ真理値 `<true>` `<false>`
- SKI コンビネータ `<S>` `<K>` `<I>`

## FL で新たに導入された構文

角括弧 `[ ]` で囲まれたキーワードは、型付き λ 計算（FL）のキーワードとして解釈する。

- 基本型
  - 整数(int)型　 ex. `[-1]` `[2531]`
  - 論理(bool)型　 ex. `[true]` `[false]`
- 基本型に対する組み込み演算（2 項演算、前置演算子）
  - `int -> int -> int`型 ： `[+]` `[-]` `[*]` `[/]` `[%]`  
    `[/]`は切り捨て後の商、`[%]`は余りを返す。
  - `int -> int -> bool`型 ： `[<]` `[>]` `[<=]` `[>=]` `[==]` `[!=]`
  - `bool -> bool -> bool`型 ： `[eq]` `[and]` `[or]` `[xor]` `[nand]` `[nor]`
- 空リスト `[nil]`
- 式（expression）
  - `[if] M [then] M [else] M`
  - `[let] x=M [in] M`
  - `[case] M [of] [nil] -> M | x::x -> M`
- 不動点演算子 `[fix]`

## LMNtal コードへの変換について

型なしモードで入力されたラムダ式を、[階層グラフ書き換え言語 LMNtal](http://www.ueda.info.waseda.ac.jp/lmntal/)の式に自動的に変換する。エンコーディング方式は以下の論文のものを採用。

1. Kazunori Ueda, Encoding the Pure Lambda Calculus into Hierarchical Graph Rewriting. Proc. RTA 2008, LNCS 5117, Springer, 2008, pp.392-408.

## CLI モードの動かし方（デバッグ用）

Node.js（`node`コマンド）と TypeScript（`tsc`コマンド）がグローバルに使える環境が必要です。

```bash
$ git clone https://github.com/nikosai/lambda-friends.git
$ cd lambda-friends
$ npm i
$ ./run.sh
```

すると、対話モード（REPL）が起動します。詳しい操作方法は、`:?` または `:h` で表示されるヘルプを参照してください。

また、実行時オプションを付けることもできます。使用できるオプションは、`./run.sh -h`で表示されます。

特に、`./run.sh -i "<2><2>"` のようにすると、ワンライナーで実行ができます。

## その他

- このプロジェクトは、MIT ライセンスでコードを公開しています。
- このプロジェクトは、[Lambda\*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
- 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
- 動作報告・フィードバックを歓迎します → Twitter: [@nikosai2531](https://twitter.com/nikosai2531)
- バグ報告は Issue を投げてください。
