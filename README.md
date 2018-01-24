![らむだフレンズ](logo.png "らむだフレンズ")

このプロジェクトでは、型付きλ計算のインタプリタ実装を目指します。

言語は、Typescript + Node.jsを用いています。
npmとNode.jsさえ入っていれば、きっと動きます。

## 今できること
* とりあえず型なしλ計算の抽象構文木はつくれる
* 自由変数の集合 `FV(M)` も求められる

## これからやるべきこと
* 型付きλ計算特有の構文を導入する
* β・η簡約ができるようにする
* マクロ定義ができるようにする

## 入力形式
* 「\」「¥」「λ」はすべて「λ」として解釈される
* 関数適用は左結合的に解釈される
* λ抽象は最長一致で解釈される
* 以上2つをもって曖昧性が排除される場合、括弧は省略して良い
* 空白は無視される
* 「λ」「.」「(」「)」以外の文字はすべて変数として扱われる
* 構文解析失敗時は、 `LambdaParseError` が `throw` される

## 試し方
```
$ git clone https://github.com/nikosai/lambda-friends.git
$ npm install
$ make run
```

すると、入力待ち状態になる。
適当なラムダ式を打ってやれば、次のように構文解析結果と自由変数が表示される。

```
> (\xy.xy)
[Lxy.[x,y]] FV:[]
> (\x.y)
[Lx.y] FV:[y]
> (\x.y)\x.x
[[Lx.y],[Lx.x]] FV:[y]
> \mn.\fx.n(mf)x
[Lmn.[Lfx.[[n,[m,f]],x]]] FV:[]
> \x.x\y.y
[Lx.[x,[Ly.y]]] FV:[]
```

## その他
* このプロジェクトは、[Lambda*Magica](https://github.com/YuukiARIA/LambdaMagica)に影響を受けて始動しました。
* 上記のロゴは、[けものフレンズ ロゴジェネレータ](https://aratama.github.io/kemonogen/)で作成しました。
