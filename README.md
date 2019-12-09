![らむだフレンズ](docs/logo.png "らむだフレンズ")

[![CircleCI](https://circleci.com/gh/nikosai/lambda-friends.svg?style=svg)](https://circleci.com/gh/nikosai/lambda-friends)
[![MIT License](http://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

純粋型なしλ計算と、型付きλ計算（FL）のインタプリタです。

***※現在メンテナンスのため、GUIの型付きモードを一時的に無効化しています。***

言語は、Typescriptを用いています。
git cloneすれば手元でも動かせますが、[GitHub Pages上にも置いてあります](https://nikosai.github.io/lambda-friends/)。

## 今できること
* 純粋型なしλ計算と、型付きλ計算（FL）を扱える（設定により変更可）
* それぞれの推論規則に基づいた簡約ができる
  + 型なしの場合、η簡約の可否を設定できる。
  + 型なしの場合、簡約基を選択して簡約を進められる。
  + 型なしの場合、評価戦略の指定ができる。
* マクロ定義ができる
  + 「マクロ」タブで定義済みマクロの一覧を表示する
* マクロ定義を書き並べたファイルを読み込める
  + [Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)との後方互換性あり。*.lm.txt（の形式のプレーンテキスト）を読み込める。
* LaTeX形式で出力ができる（「Export」タブ）
  + 型推論の証明木（bussproofs形式、型付きのみ）
  + 簡約の途中経過
* 入力履歴を補完できる
  + Linuxのターミナルのように、上キーを押すと履歴を表示する。
  + ~~静的javascriptなので、セッションを超えて遡ることはできない。~~
  + localStorageを使い、セッションを越えて遡れるようになった。
* チャーチ数とチャーチ真理値の判定が出来る
  + 簡約後の形がチャーチ数・チャーチ真理値の場合、そのように表示
* 簡約グラフの表示ができる
  + 「グラフ」タブで簡約グラフを表示
  + [Cytoscape.js](http://js.cytoscape.org/)を利用
  + 多重辺はオン・オフ選択可能
  + png形式の画像としてダウンロード可能
* LMNtalグラフと相互に変換できる
  + 「Import」「Export」タブ
  + エンコーディング方式は[後述](#lmntalコードへの変換について)
  + 型なしのみ
* SKIコンビネータと相互に変換できる
  + SKI → ラムダ は組み込みマクロとして
  + ラムダ → SKI は Export タブに
* de Brujin Indexと相互に変換できる
  + de Brujin → ラムダ は Import タブに
  + ラムダ → de Brujin は Export タブに
* 簡約グラフの形からラムダ式を逆引きできる（実験機能）
  + 「Import」タブ
  + まだ実験なので完全性はないが、健全性はある

## 基本的な入力形式
* 「\」「¥」「λ」はすべて「λ」として解釈される
* 関数適用は左結合的に解釈される
* λ抽象は最長一致で解釈される
* 以上2つをもって曖昧性が排除される場合、括弧は省略して良い
* 空白は無視される
* 変数に使用できるのは大小英文字（計52文字）のみ。

## マクロ定義
[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)と同様の形式でマクロ定義ができる。

マクロは、 `false = \xy.y`のように定義し、 `<false>`のように使う。

型なしの場合、未定義のマクロは式中で使用できるが、自由変数と同様に扱われる（簡約基とみなされない）。

型付きの場合、未定義のマクロは式中で使用できない。

また、型付きで定義したものは型付きでしか使用できない（逆も然り）。

### 組み込みマクロ
以下の3つは、定義せずとも利用できる。ユーザ定義のマクロはこれらの名前を使用できない。
* チャーチ数 ex. `<3>` `<5>`
* チャーチ真理値 `<true>` `<false>`
* SKIコンビネータ `<S>` `<K>` `<I>`

## FLで新たに導入された構文
角括弧 `[ ]` で囲まれたキーワードは、型付きλ計算（FL）のキーワードとして解釈する。
* 基本型
  + 整数(int)型　ex. `[-1]` `[2531]`
  + 論理(bool)型　ex. `[true]` `[false]`
* 基本型に対する組み込み演算（2項演算、前置演算子）
  + `int -> int -> int`型 ： `[+]` `[-]` `[*]` `[/]` `[%]`  
    `[/]`は切り捨て後の商、`[%]`は余りを返す。
  + `int -> int -> bool`型 ： `[<]` `[>]` `[<=]` `[>=]` `[==]` `[!=]`
  + `bool -> bool -> bool`型 ： `[eq]` `[and]` `[or]` `[xor]` `[nand]` `[nor]`
* 空リスト `[nil]`
* 文（statement）
  + `[if] M [then] M [else] M`
  + `[let] x=M [in] M`
  + `[case] M [of] [nil] -> M | x::x -> M`
* 不動点演算子 `[fix]`

## LMNtalコードへの変換について
型なしモードで入力されたラムダ式を、[階層グラフ書き換え言語 LMNtal](http://www.ueda.info.waseda.ac.jp/lmntal/)の式に自動的に変換する。エンコーディング方式は以下の論文のものを採用。

1. Kazunori Ueda, Encoding the Pure Lambda Calculus into Hierarchical Graph Rewriting. Proc. RTA 2008, LNCS 5117, Springer, 2008, pp.392-408.

## CLIモードの動かし方
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
* このプロジェクトは、MITライセンスでコードを公開しています。
* このプロジェクトは、[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
* 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
* 動作報告・フィードバックを歓迎します → Twitter: [@nikosai2531](https://twitter.com/nikosai2531)
* バグ報告はIssueを投げてください。
