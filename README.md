![らむだフレンズ](docs/logo.png "らむだフレンズ")

このプロジェクトでは、型付きλ計算のインタプリタ実装を目指します。

言語は、Typescript + Node.jsを用いています。
npmとNode.jsさえ入っていれば、きっと動きます。

## 今できること
* 型付きλ計算（FL）の抽象構文木がつくれる
* FLの推論規則に基づいた簡約ができる
* GitHub Pages上で動作する → [すぐに試してみる](https://nikosai.github.io/lambda-friends/)

## これからやるべきこと
* マクロ定義ができるようにする
* 型推論ができるようにする
  + できればLaTeX(buffproofs)形式で出力したい
* 設定により型付きと型なし両方の形式で簡約ができるようにしたい
  + FLの制約上、互換性はない（λ抽象の本体と引数が簡約できない）

## 基本的な入力形式
* 「\」「¥」「λ」はすべて「λ」として解釈される
* 関数適用は左結合的に解釈される
* λ抽象は最長一致で解釈される
* 以上2つをもって曖昧性が排除される場合、括弧は省略して良い
* 空白は無視される
* 変数に使用できるのは英字のみ。大文字と小文字は区別する。
* 構文解析失敗時は、 `LambdaParseError` が `throw` される

## 型付きラムダ計算で新たに導入された構文
角括弧 `[ ]` で囲まれたキーワードは、FLのキーワードとして解釈する。
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

## CUIモードの動かし方
```
$ git clone https://github.com/nikosai/lambda-friends.git
$ npm install
$ make run
```

すると、入力待ち状態になる。

```
============================================
  Welcome to Lambda-Friends!
  Type ".quit" or ".exit" to close.
  Type ".input <filename>" to open file.
============================================

input> (\x.xa)y
((\x.(xa))y)
 ==> (ya)

input> (\x.(\y.xy))(yx)
((\xy.(xy))(yx))
 ==> (\a.((yx)a))

input> (\x.(\z.(\x.yx)xz))(zx)
((\xz.(((\x.(yx))x)z))(zx))
 ==> (\a.(((\x.(yx))(zx))a))

input> .input sample.txt
input> (\xy.[if] [==] x y [then] a [else] b)([+] [1] [2])[3]
(((\xy.(if ((==x)y) then a else b))((+1)2))3)
 ==> ((\y.(if ((==((+1)2))y) then a else b))3)
 ==> (if ((==((+1)2))3) then a else b)
 ==> (if ((==3)3) then a else b)
 ==> (if true then a else b)
 ==> a

input> (\xy.[if] [==] x y [then] a [else] b)([+] [1] [2])[2]
(((\xy.(if ((==x)y) then a else b))((+1)2))2)
 ==> ((\y.(if ((==((+1)2))y) then a else b))2)
 ==> (if ((==((+1)2))2) then a else b)
 ==> (if ((==3)2) then a else b)
 ==> (if false then a else b)
 ==> b

input> [let] x = [5] [in] [+] x [1]
(let x = 5 in ((+x)1))
 ==> ((+5)1)
 ==> 6

input> [case] x::y [of] [nil] -> [nil] | h::t -> h
(case x::y of nil->nil | h::t->h)
 ==> x

input> [case] [nil] [of] [nil] -> [nil] | h::t -> h
(case nil of nil->nil | h::t->h)
 ==> nil

input> .quit
```

## その他
* このプロジェクトは、[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
* 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
* 動作報告を歓迎します → [Twitter:@nikosai2531](https://twitter.com/nikosai2531)