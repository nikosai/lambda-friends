![らむだフレンズ](docs/logo.png "らむだフレンズ")

純粋型なしλ計算と、型付きλ計算（FL）のインタプリタです。

言語は、Typescript~~ + Node.js~~を用いています。
git cloneすれば手元でも動かせますが、[GitHub Pages上にも置いてあります](https://nikosai.github.io/lambda-friends/)。

## 今できること
* 純粋型なしλ計算と、型付きλ計算（FL）を扱える（設定により変更可）
* それぞれの推論規則に基づいた簡約ができる
  + 型なしの場合、η簡約の可否を設定できる。
  + 型なしの場合、簡約基を選択して簡約を進められる。
* マクロ定義ができる
  + 「マクロ」タブで定義済みマクロの一覧を表示する
* マクロ定義を書き並べたファイルを読み込める
  + [Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)との後方互換性あり。*.lm.txtを読み込める。
* LaTeX形式で出力ができる（「TeX」タブ）
  + 型推論の証明木（bussproofs形式、型付きのみ）
  + 簡約の途中経過
* 入力履歴を補完できる
  + Linuxのターミナルのように、上キーを押すと履歴を表示する。
  + 静的javascriptなので、セッションを超えて遡ることはできない。

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

## これからやるべきこと
### WebUI周り
* β簡約グラフ《型なし》
  + cytoscape.jsを使いたい

### 全体
* リファクタリング
  + TypeVariable.maxIdの管理方法を見直す？
  + etaAllowedをLambdaFriends側に持たせる？
  + toStringのやり方見直し（isTopLevelの廃止）
* 不動点演算子の追加《型付き》
* チャーチ数・true/falseの判定《型なし》

## CUIモードの動かし方（一応非推奨）
```
$ git clone https://github.com/nikosai/lambda-friends.git
$ npm install
$ make run
```

すると、入力待ち状態になる。詳しい操作方法は、`:h`で表示されるヘルプを参照してください。

## その他
* このプロジェクトは、[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
* 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
* 動作報告を歓迎します → Twitter: [@nikosai2531](https://twitter.com/nikosai2531)
* バグ報告はIssueを投げてください。