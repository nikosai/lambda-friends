import { putParens } from "./util";
import { LambdaParseError, TranslateError } from "./error";
import {
  Expression,
  Variable,
  LambdaAbstraction,
  Application,
  Macro,
} from "./expression";

export abstract class deBruijnExpression {
  className: string;
  constructor(className: string) {
    this.className = className;
  }
  public toString(): string {
    return this.getString(true);
  }
  public abstract getString(noParens: boolean): string;
  public static parse(str: string): deBruijnExpression {
    let cs = str.split("");
    let left: deBruijnExpression = null;
    while (cs.length > 0) {
      let t = cs.shift();
      switch (t) {
        case "(": {
          let count = 1;
          let content = "";
          while (true) {
            if (cs.length === 0)
              throw new LambdaParseError("Too many LPAREN '('");
            let t1 = cs.shift();
            if (t1 === "(") count++;
            if (t1 === ")") count--;
            if (count === 0) break;
            content += t1;
          }
          if (left === null) left = this.parse(content);
          else left = new deBruijnApplication(left, this.parse(content));
          break;
        }
        case "\\":
        case "\u00a5":
        case "λ": {
          let ret = new deBruijnLambda(this.parse(cs.join("")));
          if (left === null) return ret;
          else return new deBruijnApplication(left, ret);
        }
        case " ":
          break;
        default: {
          let ret: deBruijnExpression;
          if (t.match(/^[0-9]$/) !== null) {
            let content = t;
            while (cs.length > 0) {
              if (cs[0].match(/^[0-9]$/) === null) break;
              content += cs.shift();
            }
            ret = new deBruijnIndex(parseInt(content));
          } else if (t.match(/^[a-zA-Z]$/) !== null) {
            let content = t;
            while (cs.length > 0) {
              if (cs[0].match(/^[a-zA-Z0-9]$/) === null) break;
              content += cs.shift();
            }
            ret = new deBruijnFreeVar(content);
          } else {
            throw new LambdaParseError("Unexpected token: '" + t + "'");
          }
          if (left === null) left = ret;
          else left = new deBruijnApplication(left, ret);
        }
      }
    }
    if (left === null) throw new LambdaParseError("No contents in Expression");
    return left;
  }
  public toLambda(): Expression {
    return this.getLambda(deBruijnFreeVar.toVariables(this.getFV()));
  }
  public abstract getLambda(vars: Variable[]): Expression;
  public abstract getFV(): deBruijnFreeVar[];
}

export class deBruijnLambda extends deBruijnExpression {
  expr: deBruijnExpression;
  constructor(expr: deBruijnExpression) {
    super("deBruijnLambda");
    this.expr = expr;
  }
  public getString(noParens: boolean): string {
    return putParens("\\ " + this.expr.getString(true), noParens);
  }
  public getLambda(vars: Variable[]): Expression {
    let v = Variable.getNew(vars);
    vars.unshift(v);
    let ret = this.expr.getLambda(vars);
    vars.shift();
    return new LambdaAbstraction(v, ret);
  }
  public getFV(): deBruijnFreeVar[] {
    return this.expr.getFV();
  }
}

export class deBruijnApplication extends deBruijnExpression {
  left: deBruijnExpression;
  right: deBruijnExpression;
  constructor(left: deBruijnExpression, right: deBruijnExpression) {
    super("deBruijnApplication");
    this.left = left;
    this.right = right;
  }
  public getString(noParens: boolean): string {
    return putParens(
      this.left.getString(this.left instanceof deBruijnApplication) +
        " " +
        this.right.getString(false),
      noParens
    );
  }
  public getLambda(vars: Variable[]): Expression {
    return new Application(
      this.left.getLambda(vars),
      this.right.getLambda(vars)
    );
  }
  public getFV(): deBruijnFreeVar[] {
    return this.left.getFV().concat(this.right.getFV());
  }
}

export class deBruijnIndex extends deBruijnExpression {
  index: number;
  constructor(index: number) {
    super("deBruijnIndex");
    this.index = index;
  }
  public getString(noParens: boolean): string {
    return this.index.toString();
  }
  public getLambda(vars: Variable[]): Expression {
    if (this.index < vars.length) return vars[this.index];
    else
      throw new TranslateError(
        "de Bruijn Index must be less than # of ancestor lambdas."
      );
  }
  public getFV(): deBruijnFreeVar[] {
    return [];
  }
}

export class deBruijnFreeVar extends deBruijnExpression {
  name: string;
  constructor(name: string) {
    super("deBruijnFreeVar");
    this.name = name;
  }
  public getString(noParens: boolean): string {
    return this.name;
  }
  public getLambda(vars: Variable[]): Expression {
    if (this.name.length === 1) return this.toVariable();
    else return Macro.get(this.name, false);
  }
  public toVariable(): Variable {
    return new Variable(this.name);
  }
  public static toVariables(fvs: deBruijnFreeVar[]): Variable[] {
    let ret: Variable[] = [];
    for (let fv of fvs) {
      ret.push(fv.toVariable());
    }
    return ret;
  }
  public getFV(): deBruijnFreeVar[] {
    return [this];
  }
}
