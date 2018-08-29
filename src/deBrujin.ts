import { putParens } from "./util";
import { LambdaParseError, TranslateError } from "./error";
import { Expression, Variable, LambdaAbstraction, Application } from "./expression";

export abstract class deBrujinExpression{
  className:string;
  constructor(className:string){
    this.className = className;
  }
  public toString():string{
    return this.getString(true);
  }
  public abstract getString(noParens:boolean):string;
  public static parse(str:string):deBrujinExpression{
    let cs = str.split("");
    let left:deBrujinExpression = null;
    while (cs.length>0){
      let t = cs.shift();
      switch (t){
        case "(":{
          let count = 1;
          let content = "";
          while (true){
            if (cs.length===0) throw new LambdaParseError("Too many LPAREN '('");
            let t1 = cs.shift();
            if (t1 === "(") count++;
            if (t1 === ")") count--;
            if (count === 0) break;
            content += t1;
          }
          if (left===null) left = this.parse(content);
          else left = new deBrujinApplication(left,this.parse(content));
          break;
        }
        case "\\":
        case "\u00a5":
        case "λ":{
          let ret = new deBrujinLambda(this.parse(cs.join("")));
          if (left===null) return ret;
          else return new deBrujinApplication(left, ret);
        }
        case " ":
          break;
        default:{
          if (t.match(/^[0-9]$/)===null)
            throw new LambdaParseError("Unexpected token: '"+t+"'");
          let content = t;
          while (cs.length>0){
            if (cs[0].match(/^[0-9]$/)===null) break;
            content += cs.shift();
          }
          let ret = new deBrujinIndex(parseInt(content));
          if (left===null) left = ret;
          else left = new deBrujinApplication(left, ret);
        }
      }
    }
    if (left===null) throw new LambdaParseError("No contents in Expression");
    return left;
  }
  public toLambda():Expression{
    return this.getLambda([]);
  }
  public abstract getLambda(vars:Variable[]):Expression;
}

class deBrujinLambda extends deBrujinExpression{
  expr:deBrujinExpression;
  constructor(expr:deBrujinExpression){
    super("deBrujinLambda");
    this.expr = expr;
  }
  public getString(noParens:boolean):string{
    return putParens("\\ "+this.expr.getString(true),noParens);
  }
  public getLambda(vars:Variable[]):Expression{
    let v = Variable.getNew(vars);
    vars.unshift(v);
    let ret = this.expr.getLambda(vars);
    vars.shift();
    return new LambdaAbstraction(v,ret);
  }
}

class deBrujinApplication extends deBrujinExpression{
  left:deBrujinExpression;
  right:deBrujinExpression;
  constructor(left:deBrujinExpression,right:deBrujinExpression){
    super("deBrujinApplication");
    this.left = left;
    this.right = right;
  }
  public getString(noParens:boolean):string{
    return putParens(this.left.getString(this.left instanceof deBrujinApplication)+" "+this.right.getString(false),noParens);
  }
  public getLambda(vars:Variable[]):Expression{
    return new Application(this.left.getLambda(vars),this.right.getLambda(vars));
  }
}

class deBrujinIndex extends deBrujinExpression{
  index:number;
  constructor(index:number){
    super("deBrujinIndex");
    this.index = index;
  }
  public getString(noParens:boolean):string{
    return this.index.toString();
  }
  public getLambda(vars:Variable[]):Expression{
    if (this.index < vars.length) return vars[this.index];
    else throw new TranslateError("de Brujin Index must be less than # of ancestor lambdas.");
  }
}
