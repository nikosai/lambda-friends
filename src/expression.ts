import { Type, TypeFunc, TypeInt, TypeBool, TypeEquation, TypeList, TypeVariable } from "./type";
import { LambdaParseError, SubstitutionError, ReductionError, MacroError, TypeError, TexError, TranslateError } from "./error";
import { LambdaFriends } from "./lambda-friends";
import { Redex, MacroRedex, EtaRedex, TypedRedex, BetaRedex } from "./redex";
import * as Util from "./util";
import { deBrujinExpression, deBrujinLambda, deBrujinIndex, deBrujinApplication, deBrujinFreeVar } from "./deBrujin";

// 型の連立方程式と証明木の組
class TypeResult{
  constructor(public eqs:TypeEquation[], public proofTree:string){}
}

// ラムダ項（抽象クラス）
export abstract class Expression{
  className: string;
  freevars: Variable[];
  // type: Type;

  constructor(className:string){
    this.className = className;
  }

  public parseChurchNum():number{
    if (!(this instanceof LambdaAbstraction)) return null;
    const f = this.boundvar;
    let e = this.expr;
    let n = 0;
    if (!(e instanceof LambdaAbstraction)) return null;
    const x = e.boundvar;
    if (f.equals(x)) return null;
    e = e.expr;
    while (e instanceof Application) {
      n++;
      if (!(e.left.equals(f))) return null;
      e = e.right;
    }
    if (e.equals(x)) return n;
    else return null;
  }

  public parseChurchBool():boolean{
    const t = new LambdaAbstraction(new Variable("x"),new LambdaAbstraction(new Variable("y"),new Variable("x")));
    const f = new LambdaAbstraction(new Variable("x"),new LambdaAbstraction(new Variable("y"),new Variable("y")));
    if (this.equalsAlpha(t)) return true;
    else if (this.equalsAlpha(f)) return false;
    else return null;
  }

  public toLMNtal():string{
    throw new TypeError("Expression '"+this+"' cannot be converted into LMNtal (untyped only).");
  }

  public toSKI():Expression{
    throw new TypeError("Expression '"+this+"' cannot be converted to SKI combinators (untyped only).")
  }

  public getDeBrujin(vars:Variable[]):deBrujinExpression{
    throw new TypeError("Expression '"+this+"' cannot be converted to de Brujin indexes (untyped only).")
  }

  public toDeBrujin():deBrujinExpression{
    return this.getDeBrujin([]);
  }

  public abstract toString(noParens:boolean):string;
  public abstract toTexString(noParens:boolean):string;
  public abstract getFV():Variable[];
  public abstract substitute(x:Variable, expr:Expression):Expression;
  public abstract equals(expr:Expression):boolean;
  public abstract equalsAlpha(expr:Expression):boolean;
  public abstract getEquations(gamma:Variable[], type:Type, noParens:boolean):TypeResult;
  public abstract getRedexes(etaAllowed:boolean, noParens:boolean):Redex[];
  public abstract getTypedRedex(noParens:boolean):Redex;
  public abstract getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex;
  public abstract extractMacros():Expression;
}

// 終端記号（未解析）
export class Symbol extends Expression{
  name: string;

  constructor(name:string, className?:string){
    if (className===undefined) super("Symbol");
    else super(className);
    this.name = name;
  }
  equals(expr: Expression):boolean{
    return (expr instanceof Symbol) &&(expr.className===this.className) && (expr.name===this.name);
  }
  equalsAlpha(expr: Expression):boolean{
    return (expr instanceof Symbol) &&(expr.className===this.className) && (expr.name===this.name);
  }
  public toString(noParens:boolean):string{
    return this.name;
  }
  public toTexString(noParens:boolean):string{
    throw new TexError("class Symbol does not have tex string");
  }
  public getFV():Variable[]{
    return this.freevars;
  }
  public substitute(x:Variable, expr:Expression):Expression{
    throw new SubstitutionError("Undefined Substitution");
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    throw new TypeError("Undefined Type");
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public getTypedRedex(noParens:boolean):Redex{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public extractMacros():Expression{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
}

// 変数 x
export class Variable extends Symbol{
  type:Type;
  constructor(name:string){
    super(name, "Variable");
    this.freevars = [this];
  }

  public substitute(x:Variable, expr:Expression):Expression{
    if (this.equals(x)) return expr;
    else return this;
  }

  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    for (let g of gamma){
      if (g.equals(this)){
        // (var)
        let str = "\\AxiomC{}\n";
        str += "\\RightLabel{\\scriptsize(var)}\n";
        str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.name+" : "+type.toTexString()+" $}\n";
        return new TypeResult([new TypeEquation(g.type,type)],str);
      }
    }
    throw new TypeError("free variable is not allowed: "+this);
  }

  public toTexString(noParens:boolean):string{
    return this.name;
  }

  static union(a:Variable[],b:Variable[],c?:Variable[]):Variable[]{
    if (c === undefined) {
      let ret:Variable[] = [];
      for (let v of a){
        ret.push(v);
      }
      for (let v of Variable.dif(b,a)){
        ret.push(v);
      }
      return ret;
    } else {
      return Variable.union(Variable.union(a,b),c);
    }
  }

  static dif(a:Variable[],b:Variable[]){
    let ret:Variable[] = [];
    for (let ta of a){
      if (!Variable.contains(b,ta)) ret.push(ta);
    }
    return ret;
  }

  static contains(a:Variable[],b:Variable){
    for (let ta of a){
      if (ta.equals(b)){
        return true;
      }
    }
    return false;
  }

  static gammaToTexString(gamma:Variable[]):string{
    if (gamma.length===0) return "";
    let ret = gamma[0].name + " : " + gamma[0].type.toTexString();
    for (let i=1; i<gamma.length; i++){
      ret += ",~" + gamma[i].name + " : " + gamma[i].type.toTexString();
    }
    return ret;
  }

  static getNew(used:Variable[]){
    let alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (let a of alphabet){
      let z = new Variable(a);
      if (!Variable.contains(used,z)){
        return z;
      }
    }
    throw new SubstitutionError("No more Variables available");
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    return [];
  }
  public getTypedRedex(noParens:boolean):Redex{
    return null;
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    return null;
  }
  public extractMacros():Expression{
    return this;
  }
  public toLMNtal():string{
    return "fv("+this.name+")";
  }
  public toSKI():Expression{
    return this;
  }
  public getDeBrujin(vars:Variable[]):deBrujinExpression{
    for (let i=0; i<vars.length; i++){
      if (vars[i].equals(this)){
        return new deBrujinIndex(i);
      }
    }
    return new deBrujinFreeVar(this.name);
  }
}

// 定数 c
export abstract class Const extends Symbol {
  abstract value;
  abstract type:Type;
  constructor(name:string, className:string){
    super(name, className);
    this.freevars = [];
  }
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (con)
    let str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(con)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(this.type,type)], str);
  }
  public toString(noParens:boolean):string{
    return "["+this.name+"]";
  }
  public toTexString(noParens:boolean):string{
    return this.name+"^{"+this.type.toTexString()+"}";
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getTypedRedex(noParens:boolean):Redex{
    return null;
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public extractMacros():Expression{
    return this;
  }
}

// int型定数 c^{int}
export class ConstInt extends Const{
  value:number;
  type:TypeInt;
  constructor(value:number){
    super(value.toString(), "ConstInt");
    this.value = value;
    this.type = new TypeInt();
  }
}

// bool型定数 c^{bool}
export class ConstBool extends Const{
  value:boolean;
  type:TypeBool;
  constructor(value:boolean){
    super(value.toString(), "ConstBool");
    this.value = value;
    this.type = new TypeBool();
  }
}

// 関数型定数 c^{op} （前置記法・2項演算）
export class ConstOp extends Const{
  value: Function;
  type: TypeFunc;
  constructor(funcName:string){
    super(funcName, "ConstOp");
    switch(funcName){
      case "+":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstInt(x.value+y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeInt()));
        break;
      case "-":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstInt(x.value-y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeInt()));
        break;
      case "*":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstInt(x.value*y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeInt()));
        break;
      case "/":
        this.value = (x:ConstInt,y:ConstInt)=>{if (y.value===0) throw new ReductionError("Dividing by '0' is not allowed"); else return new ConstInt(Math.floor(x.value/y.value))};
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeInt()));
        break;
      case "%":
        this.value = (x:ConstInt,y:ConstInt)=>{if (y.value===0) throw new ReductionError("Dividing by '0' is not allowed"); else return new ConstInt(x.value-Math.floor(x.value/y.value)*4)};
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeInt()));
        break;
      case "<":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value<y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case ">":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value>y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "<=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value<=y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case ">=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value>=y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "==":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "!=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value!=y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "eq":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      case "xor":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value!=y.value));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      case "or":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value||y.value));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      case "and":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value&&y.value));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      case "nor":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(!(x.value||y.value)));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      case "nand":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(!(x.value&&y.value)));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
        break;
      default:
        throw new LambdaParseError("Undefined function: "+funcName);
    }
  }
}

// 空リスト nil
export class Nil extends Symbol{
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }
  constructor(){
    super("nil","Nil");
    this.freevars=[];
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (nil)
    let t = TypeVariable.getNew();
    let nType = new TypeList(t);
    let str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(nil)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.name+" : "+nType.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(type,nType)],str);
  }
  public toString(noParens:boolean):string{
    return "["+this.name+"]";
  }
  public toTexString(noParens:boolean):string{
    return "{\\rm "+this.name+"}";
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public extractMacros():Expression{
    return this;
  }
}

// マクロ定義
export class Macro extends Symbol{
  expr:Expression;
  typed: boolean;
  type: Type;
  private static map:{[key: string]:Macro} = {};
  private static mapUntyped:{[key: string]:Macro} = {};
  private constructor(name:string, expr:Expression, typed:boolean, type:Type){
    super(name, "Macro");
    this.freevars = [];
    this.expr = expr;
    this.typed = typed;
    this.type = type;
  }
  public static add(name:string, lf:LambdaFriends, typed:boolean):Macro{
    let expr = lf.expr;
    if (!(/^[a-zA-Z0-9!?]+$/.test(name))){
      throw new MacroError("<"+name+"> cannot be used as a name of macro. Available characters: [a-zA-Z0-9!?]");
    }
    if (name.match(/^\d+$/)!==null){
      throw new MacroError("<"+name+"> is already defined as a built-in macro.");
    }
    const builtins = ["true","false","S","K","I"];
    for (let b of builtins){
      if (b === name){
        throw new MacroError("<"+name+"> is already defined as a built-in macro.");
      }
    }
    let map = (typed?Macro.map:Macro.mapUntyped);
    if (expr.getFV().length !== 0){
      throw new MacroError("<"+name+"> contains free variables: "+expr.getFV());
    }
    let m = new Macro(name, expr, typed, lf.type);
    map[name] = m;
    return map[name];
  }
  public static clear(typed:boolean){
    if (typed){
      Macro.map = {};
    } else {
      Macro.mapUntyped = {};
    }
  }
  public static get(name:string, typed:boolean):Macro{
    let ret:Macro;
    if (typed){
      ret = Macro.map[name];
    } else {
      ret = Macro.mapUntyped[name];
    }
    if (ret === undefined){
      // 組み込みマクロ。typeがundefでいいかは疑問の余地あり
      let f = (term)=>(new Macro(name,Util.makeAST(term,typed),typed,undefined));
      if (name.match(/^\d+$/)!==null) return f(Util.makeChurchNum(parseInt(name)));
      if (name==="true") return f("\\xy.x");
      if (name==="false") return f("\\xy.y");
      if (name==="S") return f("\\fgx.fx(gx)");
      if (name==="K") return f("\\xy.x");
      if (name==="I") return f("\\x.x");

      // 発展の余地あり。typeを指定したundefマクロを許す？
      return new Macro(name,undefined,typed, undefined);
    } else {
      return new Macro(name,ret.expr,typed, ret.type);
    }
  }
  public static getMap(typed:boolean):{[key: string]:Macro}{
    return Object.assign({}, (typed ? Macro.map : Macro.mapUntyped));
  }
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }

  public toString(noParens:boolean):string{
    return "<"+this.name+">";
  }
  public equalsAlpha(expr:Expression):boolean{
    // 再検討の余地あり
    if (this.expr === undefined) return this.equals(expr);
    else return this.expr.equalsAlpha(expr);
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // ????
    if (this.expr === undefined) throw new TypeError(this+" is undefined.")
    else return this.expr.getEquations(gamma,type,noParens);
  }
  public toTexString(noParens:boolean):string{
    return "\\,\\overline{\\bf "+this.name+"}\\,";
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    // let next = Macro.get(this.name,false);
    // if (next.expr === undefined) return [];
    // else return [new MacroRedex(next)];
    if (this.expr === undefined) return [];
    else return [new MacroRedex(this)];
  }
  public getTypedRedex(noParens:boolean):Redex{
    if (this.expr === undefined) return null;
    else return new MacroRedex(this);
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    if (this.expr === undefined) return null;
    else return new MacroRedex(this);
  }
  public extractMacros(){
    if (this.expr === undefined) return this;
    else return this.expr.extractMacros();
  }
  public toLMNtal():string{
    if (this.expr === undefined) return "fv("+this.name+")";
    else return this.expr.toLMNtal();
  }
  public toSKI():Expression{
    if (this.expr === undefined) return this;
    switch (this.name){
      case "S":
      case "K":
      case "I":
        return this;
      default:
        return this.expr.toSKI();
    }
  }
  public getDeBrujin(vars:Variable[]):deBrujinExpression{
    if (this.expr === undefined) return new deBrujinFreeVar(this.name);
    else return this.expr.getDeBrujin(vars);
  }
}

// ラムダ抽象 \x.M
export class LambdaAbstraction extends Expression{
  boundvar: Variable;
  expr: Expression;

  constructor(boundvar:Variable, expr:Expression){
    super("LambdaAbstraction");
    this.freevars = undefined;
    this.boundvar = boundvar;
    this.expr = expr;
  }
  static parse(tokens:Symbol[],typed:boolean):LambdaAbstraction{
    let boundvars:Variable[] = [];
    while (tokens.length>0){
      let t:Symbol = tokens.shift();
      if (t.name==="."){
        if (boundvars.length===0) throw new LambdaParseError("Bound variables are expected.");
        let expr = Util.parseSymbols(tokens,typed);
        while (boundvars.length>0){
          expr = new LambdaAbstraction(boundvars.pop(),expr);
        }
        return <LambdaAbstraction>expr;
      } else if (t.name.match(/^[A-Za-z]$/)===null){
        throw new LambdaParseError("Unexpected token: '"+t+"'");
      } else {
        boundvars.push(new Variable(t.name));
      }
    }
    throw new LambdaParseError("'.' is needed");
  }
  public toString(noParens:boolean):string{
    let boundvars = [this.boundvar];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar);
      expr = expr.expr;
    }
    let str = "\\"+boundvars.join("")+"."+expr.toString(true);
    if (!noParens) str = "("+str+")";
    return str;
  }
  public getFV():Variable[]{
    if (this.freevars !== undefined) return this.freevars;
    this.freevars = [];
    return this.freevars = Variable.dif(this.expr.getFV(),[this.boundvar]);
  }
  public substitute(y:Variable, expr:Expression):Expression{
    if (this.boundvar.equals(y)){
      return this;
    } else if (!Variable.contains(expr.getFV(),this.boundvar)){
      return new LambdaAbstraction(this.boundvar,this.expr.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.expr.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      return new LambdaAbstraction(z,this.expr.substitute(this.boundvar,z)).substitute(y,expr);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof LambdaAbstraction) && (expr.boundvar.equals(this.boundvar)) && (expr.expr.equals(this.expr));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof LambdaAbstraction)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundvar;
    let m = this.expr;
    let y = expr.boundvar;
    let n = expr.expr;
    let v = Variable.getNew(Variable.union(m.getFV(),n.getFV()));
    return m.substitute(x,v).equalsAlpha(n.substitute(y,v));
    // if (Variable.contains(m.getFV(),y)){
    //   return n.equalsAlpha(m);
    // } else {
    //   return n.equalsAlpha(m.substitute(x,y));
    // }
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (abs)
    let t0 = TypeVariable.getNew();
    let t1 = TypeVariable.getNew();
    this.boundvar.type = t1;
    let next = this.expr.getEquations(gamma.concat(this.boundvar),t0,true);
    let str = next.proofTree;
    str += "\\RightLabel{\\scriptsize(abs)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(next.eqs.concat(new TypeEquation(type,new TypeFunc(t1,t0))),str);
  }
  public toTexString(noParens:boolean):string{
    let boundvars = [this.boundvar.toTexString(false)];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar.toTexString(false));
      expr = expr.expr;
    }
    let str = "\\lambda "+boundvars.join("")+"."+expr.toTexString(true);
    if (!noParens) str = "("+str+")";
    return str;
  }
  public isEtaRedex():boolean{
    return (this.expr instanceof Application) && (this.expr.right.equals(this.boundvar)) && (!Variable.contains(this.expr.left.getFV(),this.boundvar));
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    let boundvars = [this.boundvar];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar);
      expr = expr.expr;
    }
    let lParen = "", rParen = "";
    if (!noParens){
      lParen = "(";
      rParen = ")";
    }
    let ret = Redex.makeNext(
      expr.getRedexes(etaAllowed,true),
      lParen+"\\"+boundvars.join("")+".",
      rParen,
      lParen+"\\lambda{"+boundvars.join("")+"}.",
      rParen,
      (prev)=>{
        let bvs:Variable[] = [].concat(boundvars);
        let ret=prev;
        while (bvs.length>0){
          let t = bvs.pop();
          ret = new LambdaAbstraction(t,ret);
        }
        return ret;
      });
    if (etaAllowed===undefined){
      console.error("etaAllowed is undefined.");
      etaAllowed = false;
    }
    if (etaAllowed && this.isEtaRedex()){
      ret.push(new EtaRedex(this));
    }
    return ret;
  }
  public getTypedRedex(noParens:boolean):Redex{
    return null;
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    if (etaAllowed===undefined){
      console.error("etaAllowed is undefined.");
      etaAllowed = false;
    }
    // this is eta-redex
    let thisRedex:Redex = null;
    if (etaAllowed && this.isEtaRedex()){
      thisRedex = new EtaRedex(this);
    }
    if (weak || (thisRedex && !innermost)) return thisRedex;

    let boundvars = [this.boundvar];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar);
      expr = expr.expr;
    }
    let lParen = "", rParen = "";
    if (!noParens){
      lParen = "(";
      rParen = ")";
    }
    // inner-redex
    let ret = expr.getUnTypedRedex(etaAllowed,rightmost,innermost,weak,head,true);
    if (ret === null) return null;

    ret.next = ((prev)=>{
      let bvs:Variable[] = [].concat(boundvars);
      let ret=prev;
      while (bvs.length>0){
        let t = bvs.pop();
        ret = new LambdaAbstraction(t,ret);
      }
      return ret;
    })(ret.next);
    ret.addLeft(lParen+"\\"+boundvars.join("")+".");
    ret.addRight(rParen);
    ret.addTexLeft(lParen+"\\lambda{"+boundvars.join("")+"}.");
    ret.addTexRight(rParen);

    if (thisRedex && ret) return ret;
    return thisRedex || ret;
  }
  public extractMacros():Expression{
    return new LambdaAbstraction(this.boundvar,this.expr.extractMacros());
  }
  public toLMNtal():string{
    let ret = this.expr.toLMNtal().split("fv("+this.boundvar.name+")");
    let str = ret[0];
    let links:string[] = [];
    for (let i=1; i<ret.length; i++){
      let r = LambdaFriends.getNewLink();
      links.push(r);
      str += r + ret[i];
    }

    function connect(links:string[]):string{
      switch (links.length){
        case 0:
          return "rm";
        case 1:
          return links[0];
        case 2:
          return "cp("+links[0]+","+links[1]+")";
        default:{
          let r = links.shift();
          return "cp("+r+","+connect(links)+")";
        }
      }
    }
    return "lambda("+connect(links)+","+str+")";
  }
  public toSKI():Expression{
    if (!Variable.contains(this.expr.getFV(),this.boundvar)){
      return new Application(Macro.get("K",false),this.expr.toSKI());
    }
    if (this.boundvar.equals(this.expr)){
      return Macro.get("I",false);
    }
    if (this.expr instanceof Application){
      let f = (e:Expression)=>new LambdaAbstraction(this.boundvar,e).toSKI();
      return new Application(new Application(Macro.get("S",false),f(this.expr.left)),f(this.expr.right));
    }
    if (this.expr instanceof LambdaAbstraction){
      let inner = this.expr.toSKI();
      return new LambdaAbstraction(this.boundvar,inner).toSKI();
    }
    throw new TranslateError("Unknown kind of expression.");
  }
  public getDeBrujin(vars:Variable[]):deBrujinExpression{
    vars.unshift(this.boundvar);
    let ret = this.expr.getDeBrujin(vars);
    vars.shift();
    return new deBrujinLambda(ret);
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

  isBetaRedex():boolean{
    return (this.left instanceof LambdaAbstraction);
  }

  public toString(noParens:boolean):string{
    let str = this.left.toString(this.left instanceof Application)+this.right.toString(false);
    if (!noParens) str = "("+str+")";
    return str;
  }

  public getFV():Variable[]{
    if (this.freevars===undefined)
      return this.freevars = Variable.union(this.left.getFV(),this.right.getFV());
    else return this.freevars;
  }

  public substitute(y:Variable, expr:Expression):Expression{
    return new Application(this.left.substitute(y,expr),this.right.substitute(y,expr));
  }

  public equals(expr:Expression):boolean{
    return (expr instanceof Application) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof Application) && (expr.left.equalsAlpha(this.left)) && (expr.right.equalsAlpha(this.right));
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (app)
    let t1 = TypeVariable.getNew();
    let nextL = this.left.getEquations(gamma,new TypeFunc(t1,type),false);
    let nextR = this.right.getEquations(gamma,t1,false);
    let str = nextL.proofTree + nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(app)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString(noParens:boolean):string{
    let str = this.left.toTexString(this.left instanceof Application)+this.right.toTexString(false);
    if (!noParens) str = "("+str+")";
    return str;
  }
  public getRedexes(etaAllowed:boolean, noParens:boolean):Redex[]{
    let b = this.left instanceof Application
    let leftRedexes = this.left.getRedexes(etaAllowed,b);
    let left = Redex.makeNext(leftRedexes,"",this.right.toString(false),"",this.right.toTexString(false),(prev)=>new Application(prev,this.right));
    let rightRedexes = this.right.getRedexes(etaAllowed,false);
    let right = Redex.makeNext(rightRedexes,this.left.toString(b),"",this.left.toTexString(b),"",(prev)=>new Application(this.left,prev));
    let ret = left.concat(right);
    if (this.isBetaRedex()){
      ret.push(new BetaRedex(this));
    }
    if (!noParens){
      ret = Redex.makeNext(ret,"(",")","(",")",(prev)=>(prev));
    }
    return ret;
  }
  public getTypedRedex(noParens:boolean):Redex{
    // typed
    let lParen = (noParens ? "" : "(");
    let rParen = (noParens ? "" : ")");
    if (this.left instanceof LambdaAbstraction){
      // (app2)
      return new TypedRedex(this, this.left.expr.substitute(this.left.boundvar,this.right),"app2");
    } else if (this.left instanceof Application 
      && this.left.left instanceof ConstOp
      && this.left.right instanceof Const){
      let op = this.left.left;
      let left = this.left.right;
      let right = this.right;
      if (right instanceof Const){
        // (app5)
        if (op.type.left.equals(left.type) && op.type.right instanceof TypeFunc && op.type.right.left.equals(right.type)){
          return new TypedRedex(this,op.value(left,right),"app5");
        } else {
          throw new ReductionError(op.type+" cannot handle "+left.type+" and "+right.type+" as arguments");
        }
      } else {
        // (app4)
        let ret = right.getTypedRedex(false);
        if (ret === null) return null;
        ret.next = new Application(new Application(op,left),ret.next);
        ret.addLeft(lParen+op.toString(false)+left.toString(false));
        ret.addRight(rParen);
        ret.addTexLeft(lParen+op.toTexString(false)+left.toTexString(false));
        ret.addTexRight(rParen);
        return ret;
      }
    } else if (this.left instanceof ConstOp) {
      // (app3)
      let ret = this.right.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new Application(this.left,ret.next);
      ret.addLeft(lParen+this.left.toString(false));
      ret.addRight(rParen);
      ret.addTexLeft(lParen+this.left.toTexString(false));
      ret.addTexRight(rParen);
      return ret;
    } else {
      // (app1)
      let ret = this.right.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new Application(this.left,ret.next);
      ret.addLeft(lParen);
      ret.addRight(rParen+this.right.toString(false));
      ret.addTexLeft(lParen);
      ret.addTexRight(rParen+this.right.toTexString(false));
      return ret;
    }
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    const b = this.left instanceof Application;
    const p = (r:Redex)=>{
      if (r !== null && !noParens){
        r.addLeft("("); r.addRight(")");
        r.addTexLeft("("); r.addTexRight(")");
      }
      return r;
    };
    const searchL = ()=>{
      let ret = this.left.getUnTypedRedex(etaAllowed,rightmost,innermost,weak,head,b);
      if (ret === null) return null;
      ret.next = new Application(ret.next,this.right);
      ret.addRight(this.right.toString(false));
      ret.addTexRight(this.right.toTexString(false));
      return p(ret);
    };
    const searchR = ()=>{
      let ret = this.right.getUnTypedRedex(etaAllowed,rightmost,innermost,weak,head,false);
      if (ret === null) return null;
      ret.next = new Application(this.left,ret.next);
      ret.addLeft(this.left.toString(b));
      ret.addTexLeft(this.left.toTexString(b));
      return p(ret);
    };
    let ret:Redex = null;
    if (this.isBetaRedex()){
      ret = p(new BetaRedex(this));
      if (head || !innermost) return ret;
    }
    if (head){
      return searchL();
    }
    let res = (rightmost?searchR():searchL());
    if (res !== null) return res;
    res = (rightmost?searchL():searchR());
    if (res !== null) return res;
    return ret;
  }
  public extractMacros():Expression{
    return new Application(this.left.extractMacros(),this.right.extractMacros());
  }
  public toLMNtal():string{
    return "apply("+this.left.toLMNtal()+","+this.right.toLMNtal()+")";
  }
  public toSKI():Expression{
    return new Application(this.left.toSKI(),this.right.toSKI());
  }
  public getDeBrujin(vars:Variable[]):deBrujinExpression{
    return new deBrujinApplication(this.left.getDeBrujin(vars),this.right.getDeBrujin(vars));
  }
}

// リスト M::M
export class List extends Expression{
  head: Expression;
  tail: Expression;

  constructor(head:Expression, tail:Expression){
    super("List");
    this.head = head;
    this.tail = tail;
  }

  public toString(noParens:boolean):string{
    let ret = this.head.toString(false)+"::"+this.tail.toString(true);
    if (!noParens) ret = "("+ret+")"
    return ret;
  }

  public getFV():Variable[]{
    if (this.freevars===undefined)
      return this.freevars = Variable.union(this.head.getFV(),this.tail.getFV());
    else return this.freevars;
  }

  public substitute(y:Variable, expr:Expression):Expression{
    return new List(this.head.substitute(y,expr),this.tail.substitute(y,expr));
  }
  
  public equals(expr:Expression):boolean{
    return (expr instanceof List) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof List) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail));
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (list) 再検討の余地あり？ 新しい型変数要る？
    let t = TypeVariable.getNew();
    let lt = new TypeList(t);
    let nextH = this.head.getEquations(gamma,t,false);
    let nextT = this.tail.getEquations(gamma,lt,false);
    let str = nextH.proofTree + nextT.proofTree;
    str += "\\RightLabel{\\scriptsize(list)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+lt.toTexString()+" $}\n";
    return new TypeResult(nextH.eqs.concat(nextT.eqs, new TypeEquation(lt,type)),str);
  }
  public toTexString(noParens:boolean):string{
    let ret = this.head.toTexString(false)+"::"+this.tail.toTexString(true);
    if (!noParens) ret = "("+ret+")"
    return ret;
  }

  public getRedexes(etaAllowed:boolean,noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public getTypedRedex(noParens:boolean):Redex{
    return null;
  }
  public extractMacros():Expression{
    return new List(this.head.extractMacros(),this.tail.extractMacros());
  }
}

// if
export class If extends Expression{
  state:Expression;
  ifTrue:Expression;
  ifFalse:Expression;
  constructor(state:Expression,ifTrue:Expression,ifFalse:Expression){
    super("If");
    this.state = state;
    this.ifTrue = ifTrue;
    this.ifFalse = ifFalse;
  }
  public getFV():Variable[]{
    return this.freevars = Variable.union(this.state.getFV(),this.ifTrue.getFV(),this.ifFalse.getFV());
  }
  public toString(noParens:boolean):string{
    let ret = "[if]"+this.state.toString(true)+"[then]"+this.ifTrue.toString(true)+"[else]"+this.ifFalse.toString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public substitute(y:Variable, expr:Expression):Expression{
    return new If(this.state.substitute(y,expr),this.ifTrue.substitute(y,expr),this.ifFalse.substitute(y,expr));
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof If) && (expr.state.equals(this.state)) && (expr.ifTrue.equals(this.ifTrue)) && (expr.ifFalse.equals(this.ifFalse));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof If) && (expr.state.equalsAlpha(this.state)) && (expr.ifTrue.equalsAlpha(this.ifTrue)) && (expr.ifFalse.equalsAlpha(this.ifFalse));
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (if)
    let nextS = this.state.getEquations(gamma,new TypeBool(),true);
    let nextT = this.ifTrue.getEquations(gamma,type,true);
    let nextF = this.ifFalse.getEquations(gamma,type,true);
    let str = nextS.proofTree+nextT.proofTree+nextF.proofTree;
    str += "\\RightLabel{\\scriptsize(if)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextT.eqs,nextF.eqs),str);
  }
  public toTexString(noParens:boolean):string{
    let ret = "{\\bf if}~"+this.state.toTexString(true)+"~{\\bf then}~"+this.ifTrue.toTexString(true)+"~{\\bf else}~"+this.ifFalse.toTexString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public getRedexes(etaAllowed:boolean,noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public getTypedRedex(noParens:boolean):Redex{
    if (this.state instanceof ConstBool){
      if (this.state.value){
        // (if2)
        return new TypedRedex(this,this.ifTrue,"if2");
      } else {
        // (if3)
        return new TypedRedex(this,this.ifFalse,"if3");
      }
    } else {
      // (if1)
      let ret = this.state.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new If(ret.next,this.ifTrue,this.ifFalse);
      ret.addLeft("([if]");
      ret.addRight("[then]"+this.ifTrue.toString(true)+"[else]"+this.ifFalse.toString(true)+")");
      ret.addTexLeft("({\\bf if}~");
      ret.addTexRight("~{\\bf then}~"+this.ifTrue.toTexString(true)+"~{\\bf else}~"+this.ifFalse.toTexString(true)+")");
      return ret;
    }
  }
  public static parse(tokens:Symbol[], typed:boolean):If{
    let state:Symbol[] = [];
    let i_num=0, t_num=0, e_num=0;
    while (true){
      if (tokens.length==0) throw new LambdaParseError("Illegal If statement");
      let t = tokens.shift();
      switch (t.name){
        case "if":
          i_num++;
          break;
        case "then":
          t_num++;
          break;
        case "else":
          e_num++;
          break;
      }
      if (i_num===e_num && t_num===i_num+1) break;
      state.push(t);
    }
    let stateExpr = Util.parseSymbols(state,typed);
    let ifTrue:Symbol[] = [];
    i_num=0, t_num=0, e_num=0;
    while (true){
      if (tokens.length==0) throw new LambdaParseError("Illegal If statement");
      let t = tokens.shift();
      switch (t.name){
        case "if":
          i_num++;
          break;
        case "then":
          t_num++;
          break;
        case "else":
          e_num++;
          break;
      }
      if (i_num===t_num && e_num===i_num+1) break;
      ifTrue.push(t);
    }
    let ifTrueExpr = Util.parseSymbols(ifTrue,typed);
    let ifFalseExpr = Util.parseSymbols(tokens,typed);
    return new If(stateExpr,ifTrueExpr,ifFalseExpr);
  }
  public extractMacros():Expression{
    return new If(this.state.extractMacros(),this.ifTrue.extractMacros(),this.ifFalse.extractMacros());
  }
}

// let in
export class Let extends Expression{
  boundvar:Variable;
  left:Expression;
  right:Expression;
  constructor(boundvar:Variable, left:Expression, right:Expression){
    super("Let");
    this.boundvar = boundvar;
    this.left = left;
    this.right = right;
  }
  public getFV():Variable[]{
    if (this.freevars!==undefined) return this.freevars;
    let ret:Variable[] = [];
    for (let fv of this.right.getFV()){
      if (!fv.equals(this.boundvar)){
        ret.push(fv);
      }
    }
    return this.freevars = Variable.union(ret, this.left.getFV());
  }
  public toString(noParens:boolean):string{
    let ret = "[let]"+this.boundvar.toString(true)+"="+this.left.toString(true)+"[in]"+this.right.toString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public substitute(y:Variable, expr:Expression):Expression{
    let left = this.left.substitute(y,expr);
    if (this.boundvar.equals(y)){
      return new Let(this.boundvar,left,this.right);
    } else if (!Variable.contains(expr.getFV(),this.boundvar)){
      return new Let(this.boundvar,left,this.right.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.right.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      if (z.equals(y)){
        return new Let(z,left,this.right.substitute(this.boundvar,z));
      } else {
        return new Let(z,left,this.right.substitute(this.boundvar,z).substitute(y,expr));
      }
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Let) && (expr.boundvar.equals(this.boundvar)) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof Let)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundvar;
    let m = this.right;
    let y = expr.boundvar;
    let n = expr.right;
    return (!Variable.contains(m.getFV(),y) && n.equalsAlpha(m.substitute(x,y)));
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (let)
    let t1 = TypeVariable.getNew();
    this.boundvar.type = t1;
    let nextL = this.left.getEquations(gamma,t1,true);
    let nextR = this.right.getEquations(gamma.concat(this.boundvar),type,true);
    let str = nextL.proofTree+nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(let)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString(noParens:boolean):string{
    let ret = "{\\bf let}~"+this.boundvar.toTexString(false)+" = "+this.left.toTexString(true)+"~{\\bf in}~"+this.right.toTexString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public getRedexes(etaAllowed:boolean,noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getTypedRedex(noParens:boolean):Redex{
    // (let)
    return new TypedRedex(this,this.right.substitute(this.boundvar,this.left),"let");
  }
  public static parse(tokens:Symbol[], typed:boolean):Let{
    let t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let boundvar = new Variable(t.name);
    if (tokens.shift().name!=="=")
      throw new LambdaParseError("'=' is expected");
    let content:Symbol[] = [];
    let i=1;
    while (true){
      // console.log(i);
      if (tokens.length==0) throw new LambdaParseError("Illegal Let statement");
      let t = tokens.shift();
      if (t.name==="let") i++;
      else if (t.name==="in") i--;
      if (i==0) break;
      content.push(t);
    }
    let contentExpr:Expression = Util.parseSymbols(content,typed);
    let restExpr:Expression = Util.parseSymbols(tokens,typed);
    return new Let(boundvar,contentExpr,restExpr);
  }
  public extractMacros():Expression{
    return new Let(this.boundvar,this.left.extractMacros(),this.right.extractMacros());
  }
}

// case文 [case] M [of] [nil] -> M | x::x -> M
export class Case extends Expression{
  state:Expression;
  ifNil:Expression;
  head:Variable;
  tail:Variable;
  ifElse:Expression;
  constructor(state:Expression, ifNil:Expression, head:Variable, tail:Variable, ifElse:Expression){
    super("Case");
    this.state = state;
    this.ifNil = ifNil;
    this.head = head;
    this.tail = tail;
    this.ifElse = ifElse;
  }
  public getFV():Variable[]{
    if (this.freevars!==undefined) return this.freevars;
    else return Variable.union(this.state.getFV(),this.ifNil.getFV(),Variable.dif(this.ifElse.getFV(),[this.head,this.tail]));
  }
  public toString(noParens:boolean):string{
    let ret = "[case]"+this.state.toString(true)+"[of][nil]->"+this.ifNil.toString(true)+"|"+this.head.toString(true)+"::"+this.tail.toString(true)+"->"+this.ifElse.toString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public substitute(y:Variable, expr:Expression):Expression{
    let state = this.state.substitute(y,expr);
    let ifNil = this.ifNil.substitute(y,expr);
    if (this.head.equals(y) || this.tail.equals(y)){
      return new Case(state,ifNil,this.head,this.tail,this.ifElse);
    } else if (!Variable.contains(expr.getFV(),this.head)&&!Variable.contains(expr.getFV(),this.tail)){
      return new Case(state,ifNil,this.head,this.tail,this.ifElse.substitute(y,expr));
    } else {
      let head = this.head;
      let tail = this.tail;
      let ifElse = this.ifElse;
      if (Variable.contains(expr.getFV(),head)){
        let uniFV = Variable.union(this.ifElse.getFV(),expr.getFV());
        let z = Variable.getNew(uniFV);
        if (z.equals(y)){
          ifElse = ifElse.substitute(head,z);
        } else {
          ifElse = ifElse.substitute(head,z).substitute(y,expr);
        }
        head = z;
      }
      if (Variable.contains(expr.getFV(),tail)){
        let uniFV = Variable.union(this.ifElse.getFV(),expr.getFV());
        let z = Variable.getNew(uniFV);
        if (z.equals(y)){
          ifElse = ifElse.substitute(tail,z);
        } else {
          ifElse = ifElse.substitute(tail,z).substitute(y,expr);
        }
        tail = z;
      }
      return new Case(state,ifNil,head,tail,ifElse);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Case) && (expr.state.equals(this.state)) && (expr.ifNil.equals(this.ifNil)) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail)) && (expr.ifElse.equals(this.ifElse));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof Case) && (expr.state.equalsAlpha(this.state)) && (expr.ifNil.equalsAlpha(this.ifNil)) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail)) && (expr.ifElse.equalsAlpha(this.ifElse));
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (case)
    let t1 = TypeVariable.getNew();
    let lt1 = new TypeList(t1);
    this.head.type = t1;
    this.tail.type = lt1;
    let nextS = this.state.getEquations(gamma,lt1,true);
    let nextN = this.ifNil.getEquations(gamma,type,true);
    let nextE = this.ifElse.getEquations(gamma.concat(this.head,this.tail),type,true);
    let str = nextS.proofTree+nextN.proofTree+nextE.proofTree;
    str += "\\RightLabel{\\scriptsize(case)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextN.eqs,nextE.eqs),str);
  }
  public toTexString(noParens:boolean):string{
    let ret = "{\\bf case} "+this.state.toTexString(true)+" {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString(true)+" | "+this.head.toTexString(true)+"::"+this.tail.toTexString(true)+" \\Rightarrow "+this.ifElse.toTexString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public getRedexes(etaAllowed:boolean,noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getTypedRedex(noParens:boolean):Redex{
    if (this.state instanceof Nil){
      // (case2)
      return new TypedRedex(this,this.ifNil,"case2");
    } else if (this.state instanceof List){
      // (case3)
      return new TypedRedex(this,this.ifElse.substitute(this.head,this.state.head).substitute(this.tail,this.state.tail),"case3");
    } else {
      // (case1)
      let ret = this.state.getTypedRedex(true);
      if (ret === null) return null;
      ret.next = new Case(ret.next,this.ifNil,this.head,this.tail,this.ifElse);
      ret.addLeft("([case]");
      ret.addRight("[of][nil]->"+this.ifNil+" | "+this.head+"::"+this.tail+"->"+this.ifElse+")");
      ret.addTexLeft("({\\bf case} ");
      ret.addTexRight(" {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString(true)+" | "+this.head.toTexString(true)+"::"+this.tail.toTexString(true)+" \\Rightarrow "+this.ifElse.toTexString(true)+")");
      return ret;
    }
  }
  public static parse(tokens:Symbol[],typed:boolean):Case{
    let state:Symbol[] = [];
    let i=1;
    while (true){
      if (tokens.length==0) throw new LambdaParseError("Illegal Case statement");
      let t = tokens.shift();
      if (t.name==="case") i++;
      else if (t.name==="of") i--;
      if (i==0) break;
      state.push(t);
    }
    let stateExpr:Expression = Util.parseSymbols(state,typed);
    let t = tokens.shift();
    if (t.name!=="nil")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    t = tokens.shift();
    if (t.name!=="-")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    t = tokens.shift();
    if (t.name!==">")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let ifNil:Symbol[] = [];
    i=1;
    while (true){
      if (tokens.length==0) throw new LambdaParseError("Too many [case]");
      let t = tokens.shift();
      if (t.name==="case") i++;
      else if (t.name==="|") i--;
      if (i==0) break;
      ifNil.push(t);
    }
    let ifNilExpr:Expression = Util.parseSymbols(ifNil,typed);
    let head = new Variable(tokens.shift().name);
    if (head.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+head.name+"'");
    t = tokens.shift();
    if (t.name!==":")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    t = tokens.shift();
    if (t.name!==":")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let tail = new Variable(tokens.shift().name);
    if (tail.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+tail.name+"'");
    t = tokens.shift();
    if (t.name!=="-")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    t = tokens.shift();
    if (t.name!==">")
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let ifElseExpr = Util.parseSymbols(tokens,typed);
    return new Case(stateExpr,ifNilExpr,head,tail,ifElseExpr);
  }
  public extractMacros():Expression{
    return new Case(this.state.extractMacros(),this.ifNil.extractMacros(),this.head,this.tail,this.ifElse.extractMacros());
  }
}

// 不動点演算子 [fix] x.M
export class Fix extends Expression{
  boundvar:Variable;
  expr:Expression;
  constructor(boundvar:Variable, expr:Expression){
    super("Fix");
    this.boundvar = boundvar;
    this.expr = expr;
  }
  public getFV():Variable[]{
    if (this.freevars!==undefined) return this.freevars;
    let ret:Variable[] = [];
    for (let fv of this.expr.getFV()){
      if (!fv.equals(this.boundvar)){
        ret.push(fv);
      }
    }
    return this.freevars = ret;
  }
  public toString(noParens:boolean):string{
    let ret = "[fix]"+this.boundvar.toString(false)+"."+this.expr.toString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public substitute(y:Variable, expr:Expression):Expression{
    if (this.boundvar.equals(y)){
      return this;
    } else if (!Variable.contains(expr.getFV(),this.boundvar)){
      return new Fix(this.boundvar,this.expr.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.expr.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      return new Fix(z,this.expr.substitute(this.boundvar,z)).substitute(y,expr);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Fix) && (expr.boundvar.equals(this.boundvar)) && (expr.expr.equals(this.expr));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof Fix)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundvar;
    let m = this.expr;
    let y = expr.boundvar;
    let n = expr.expr;
    if (Variable.contains(m.getFV(),y)){
      return n.equalsAlpha(m);
    } else {
      return n.equalsAlpha(m.substitute(x,y));
    }
  }
  public getEquations(gamma:Variable[],type:Type,noParens:boolean):TypeResult{
    // (fix)
    this.boundvar.type = type;
    let next = this.expr.getEquations(gamma.concat(this.boundvar),type,true);
    let str = next.proofTree;
    str += "\\RightLabel{\\scriptsize(fix)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString(noParens)+" : "+type.toTexString()+" $}\n";
    return new TypeResult(next.eqs,str);
  }
  public toTexString(noParens:boolean):string{
    let ret = "{\\bf fix}~"+this.boundvar.toTexString(true)+"."+this.expr.toTexString(true);
    if (!noParens) ret = "("+ret+")";
    return ret;
  }
  public getRedexes(etaAllowed:boolean,noParens:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getUnTypedRedex(etaAllowed:boolean,rightmost:boolean,innermost:boolean,weak:boolean,head:boolean,noParens:boolean):Redex{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
  }
  public getTypedRedex(noParens:boolean):Redex{
    // (fix)
    return new TypedRedex(this,this.expr.substitute(this.boundvar, new Fix(new Variable(this.boundvar.name),this.expr)),"fix");
  }
  public static parse(tokens:Symbol[], typed:boolean):Fix{
    let t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let boundvar = new Variable(t.name);
    if (tokens.shift().name!==".")
      throw new LambdaParseError("'.' is expected");

    let contentExpr:Expression = Util.parseSymbols(tokens,typed);
    return new Fix(boundvar,contentExpr);
  }
  public extractMacros():Expression{
    return new Fix(this.boundvar,this.expr.extractMacros());
  }
}
