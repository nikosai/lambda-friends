![らむだフレンズ](docs/logo.png "らむだフレンズ")

~~このプロジェクトでは、型付きλ計算のインタプリタ実装を目指します。~~  
型付きλ計算（FL）のインタプリタができました。

言語は、Typescript + Node.jsを用いています。
git cloneすれば手元でも動かせますが、[GitHub Pages上にも置いてあります](https://nikosai.github.io/lambda-friends/)。

## 今できること
* 純粋型なしλ計算と、型付きλ計算（FL）を扱える（設定により変更可）
* それぞれの推論規則に基づいた簡約ができる
  + 型なしの場合、η簡約の可否を設定できる
  + 現在、型なしの場合は最左戦略のみが可能
* マクロ定義ができる
* マクロ定義を書き並べたファイルを読み込める
  + [Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)との後方互換性あり。*.lm.txtを読み込める。

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
* β基の表示・選択《型なし》
  + 一応準備はできているが、UIをどうするか……
* マクロ一覧の表示
* β簡約グラフ《型なし》
  + cytoscape.jsを使いたい
* LaTeX形式での出力
  + buffproofs形式の証明木と、簡約の途中経過
* 入力履歴補完
  + シェルみたいに上キーで履歴が出せるようにしたい
* ステップ上限到達時の選択《型なし、型付きは無制限で良い》
  + 現状、ステップ上限に達した場合、それ以上進めない

### 全体
* リファクタリング（TypeVariable.maxIdの管理方法を見直すなど）
* 不動点演算子の追加《型付き》
* チャーチ数・true/falseの判定《型なし》
* 簡約部・適用した規則の明示《主に型付き》

## CUIモードの動かし方（旧）
```
$ git clone https://github.com/nikosai/lambda-friends.git
$ npm install
$ make run
```

すると、入力待ち状態になる。

```
============================================
  Welcome to Lambda-Friends!
  Type ":?" to show command help.
  Type ":q" to close.
============================================

input> :?
=============== Command Help ===============
  :?            - show this command help
  :l <filename> - load macros from textfile
  :s            - show current continuation steps
  :s <number>   - set continuation steps
  :t            - show current Typed/Untyped
  :t <y/n>      - set Typed/Untyped
  :e            - show whether eta-reduction is allowed
  :e <y/n>      - enable/disable eta-reduction
  :q            - close this interpreter

input> (\x.(\y.xy))(yx)
((\xy.(xy))(yx)) : Untyped
 ==> (\a.((yx)a))

input> :t y
Current setting: Typed

input> \ab.(\xy.[if] [==] x y [then] [12] [else] [34])([+] [1] [2])[3]
(\ab.(((\xy.(if ((==x)y) then 12 else 34))((+1)2))3)) : 'a -> 'b -> int

input> :q
```

## その他
* このプロジェクトは、[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
* 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
* 動作報告を歓迎します → Twitter: [@nikosai2531](https://twitter.com/nikosai2531)
* バグ報告はIssueを投げてください。