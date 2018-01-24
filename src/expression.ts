// ラムダ項（抽象クラス）
export abstract class Expression{
  className: string;
  freevals: Symbol[];

  constructor(className:string){
    this.className = className;
  }

  static makeAST(str: string):Expression{
    var strs:string[] = str.split(/\s*/).join("").split("");
    var tokens:Symbol[] = [];
    for (var c of strs){
      tokens.push(new Symbol(c));
    }
    return Expression.makeASTfromSymbols(tokens);
  }

  static makeASTfromSymbols(tokens: Symbol[]):Expression{
    var left:Expression = null;
    while (tokens.length>0){
      // 最初のSymbol
      var first:Symbol = tokens.shift();
      
      switch(first.name){
        case "\\":
        case "\u00a5":
        case "λ":
          // abst
          if (left===null) return new LambdaAbstraction(tokens);
          else return new Application(left, new LambdaAbstraction(tokens));
        case "(":
          // application
          var content:Symbol[] = [];
          var i=1;
          while (true){
            if (tokens.length==0) throw new LambdaParseError("Too many LPAREN '('");
            var t = tokens.shift();
            if (t.name==="(") i++;
            else if (t.name===")") i--;
            if (i==0) break;
            content.push(t);
          }
          var contentExpr:Expression = Expression.makeASTfromSymbols(content);
          if (left===null) left = contentExpr;
          else left = new Application(left, contentExpr);
          break;
        case ")":
        case ".":
          throw new LambdaParseError("Unexpected token: '"+first+"'");
        default:
          // variable
          if (left===null) left = first;
          else left = new Application(left, first);
      }
    }
    if (left===null) throw new LambdaParseError("No contents in Expression");
    return left;
  }
  public abstract toString():string;
  public abstract getFV():Symbol[];
  // equals, equalsAlpha 再帰的に定義
}

// 終端記号（未解析） または 変数 x
export class Symbol extends Expression{
  name: string;
  constructor(c:string){
    super("Symbol");
    this.name = c;
    this.freevals = [this];
  }
  equals(expr: Expression):boolean{
    return (expr instanceof Symbol) && (expr.name===this.name);
  }
  public toString():string{
    return this.name;
  }
  public getFV():Symbol[]{
    return this.freevals;
  }
}

// ラムダ抽象 \xyz.M
export class LambdaAbstraction extends Expression{
  boundvals: Symbol[];
  expr: Expression;

  constructor(tokens: Symbol[]){
    super("LambdaAbstraction");
    this.freevals = undefined;
    this.boundvals = [];
    while (tokens.length>0){
      var t:Symbol = tokens.shift();
      switch (t.name){
        case "\\":
        case "\u00a5":
        case "(":
        case ")":
        case "λ":
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        case ".":
          this.expr = Expression.makeASTfromSymbols(tokens);
          return;
        default:
          this.boundvals.push(t);
      }
    }
    throw new LambdaParseError("'.' is needed");
  }
  public toString():string{
    return "[L"+this.boundvals.toString().replace(/,/g,"")+"."+this.expr+"]";
  }
  public getFV():Symbol[]{
    if (this.freevals === undefined) {
      this.freevals = [];
      var childFV = this.expr.getFV();
      for (var v of childFV){
        var flag:boolean = true;
        for (var bv of this.boundvals){
          if (bv.equals(v)){
            flag = false;
            break;
          }
        }
        if (flag) this.freevals.push(v);
      }
      return this.freevals;
    }
  }
}

// 関数適用 MN
export class Application extends Expression{
  left: Expression;
  right: Expression;

  constructor(left:Expression, right:Expression){
    super("Application");
    this.left = left;
    this.right = right;
  }

  public toString():string{
    return "["+this.left+","+this.right+"]";
  }

  public getFV():Symbol[]{
    return this.freevals = this.left.getFV().concat(this.right.getFV());
  }
}

// 例外
export class LambdaParseError implements Error{
  public name = "LambdaParseError";
  constructor(public message: string){}
  public toString():string{
    return this.name+": "+this.message;
  }
}

// todo : equals, equalsAlpha, ParseErrorの場所