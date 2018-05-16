import { Type, TypeFunc, TypeInt, TypeBool, TypeEquation, TypeList, TypeVariable, TypeUntyped } from "./type";
import { LambdaParseError, SubstitutionError, ReductionError, MacroError, TypeError, TexError } from "./error";
import { LambdaFriends } from "./lambda-friends";

// 字句解析
function tokenize(str:string, typed:boolean):Symbol[]{
  let strs:string[] = str.split(/\s*/).join("").split("");
  let tokens:Symbol[] = [];
  while (strs.length>0){
    let c = strs.shift();
    if (c === "<") {
      // <macro>
      let content = "";
      while (true){
        if (strs.length==0) throw new LambdaParseError("Too many LANGLE '<'");
        c = strs.shift();
        if (c===">") break;
        else content += c;
      }
      tokens.push(Macro.get(content,typed));
    } else if (typed && c === "["){
      // [const]
      let content = "";
      while (true){
        if (strs.length==0) throw new LambdaParseError("Too many LBRACKET '['");
        c = strs.shift();
        if (c==="]") break;
        else content += c;
      }
      let result:Symbol = null;
      switch (content){
        case "nil":
          result = new Nil();
          break;
        case "false":
        case "true":
          result = new ConstBool(content==="true");
          break;
        case "if":
        case "then":
        case "else":
        case "let":
        case "in":
        case "case":
        case "of":
        case "fix":
          result = new Symbol(content);
          break;
        default:
          if (content.match(/^\d+$|^-\d+$/)!==null){
            result = new ConstInt(parseInt(content));
          } else {
            result = new ConstOp(content); // fail -> null
          }
      }
      if (result===null)
        throw new LambdaParseError("Unknown Const: ["+content+"]");
      tokens.push(result);
    } else {
      tokens.push(new Symbol(c));
    }
  }
  return tokens;
}

// 構文解析
function parseSymbols(tokens: Symbol[], typed:boolean):Expression{
  let left:Expression = null;
  while (tokens.length>0){
    // 最初のSymbol
    let first:Symbol = tokens.shift();
    if (first instanceof Const || first instanceof Nil || first instanceof Macro){
      if (left===null) left = first;
      else left = new Application(left, first);
      continue;
    }

    switch(first.name){
      case "\\":
      case "\u00a5":
      case "λ":{
        // abst
        if (left===null) return LambdaAbstraction.parse(tokens,typed);
        else return new Application(left, LambdaAbstraction.parse(tokens,typed));
      }
      case "(":{
        // application
        let content:Symbol[] = [];
        let i=1;
        while (true){
          if (tokens.length==0) throw new LambdaParseError("Too many LPAREN '('");
          let t = tokens.shift();
          if (t.name==="(") i++;
          else if (t.name===")") i--;
          if (i==0) break;
          content.push(t);
        }
        let contentExpr:Expression = parseSymbols(content,typed);
        if (left===null) left = contentExpr;
        else left = new Application(left, contentExpr);
        break;
      }
      default:{
        if (typed) {
          switch (first.name){
            case "if": {
              // if statement
              return If.parse(tokens,typed);
            }
            case "let": {
              // let statement
              return Let.parse(tokens,typed);
            }
            case "case": {
              // case statement: [case] M [of] [nil] -> M | x::x -> M
              return Case.parse(tokens,typed);
            }
            case "fix": {
              // fixed-point: [fix] x.M
              return Fix.parse(tokens,typed);
            }
            case ":": {
              // list
              let t = tokens.shift();
              if (t.name!==":")
                throw new LambdaParseError("Unexpected token: '"+t+"'");
              return new List(left,parseSymbols(tokens,typed));
            }
          }
        }
        if (first.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+first+"'");
        // variable
        if (left===null) left = new Variable(first.name);
        else left = new Application(left, new Variable(first.name));
      }
    }
  }
  if (left===null) throw new LambdaParseError("No contents in Expression");
  return left;
}

// 字句解析と構文解析 return: root node
export function makeAST(str:string, typed:boolean):Expression{
  let t = parseSymbols(tokenize(str,typed),typed);
  t.setRoot();
  return t;
}

// チャーチ数を表すExpressionの生成
function makeChurchNum(n:number,typed:boolean):Expression{
  let str = "\\sz.";
  let content = (n===0?"z":"sz");
  for (let i=1; i<n; i++){
    content = "s("+content+")";
  }
  return makeAST(str+content,typed);
}

function htmlEscape(str:string):string{
  return str.replace(/[&'`"<>]/g, function(match) {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    }[match]
  });
}

// 簡約基
export abstract class Redex{
  type: string;
  left: string;
  right: string;
  texLeft: string;
  texRight: string;
  abstract rule: string;
  abstract content: Expression;
  abstract next: Expression;
  constructor(type:string){
    this.left = "";
    this.right = "";
    this.texLeft = "";
    this.texRight = "";
    this.type = type;
  }
  public addLeft(s:string){
    this.left = s + this.left;
  }
  public addRight(s:string){
    this.right += s;
  }
  public addTexLeft(s:string){
    this.texLeft = s + this.texLeft;
  }
  public addTexRight(s:string){
    this.texRight += s;
  }
  public static makeNext(es:Redex[],prefix:string,suffix:string,prefixTex:string,suffixTex:string,func: (prev:Expression)=>Expression):Redex[]{
    let ret:Redex[] = [].concat(es);
    for (let e of ret){
      e.next = func(e.next);
      e.addLeft(prefix);
      e.addRight(suffix);
      e.addTexLeft(prefixTex);
      e.addTexRight(suffixTex);
    }
    return ret;
  }
  public getName():string{
    return this.type;
  }
  public getPos():number{
    return this.left.length;
  }
  public abstract toString():string;
  public abstract toTexString():string;
  public abstract toHTMLString():string;
  public abstract getTexRule():string;
  // aの方が優先度高い → 負, 同等 → 0, bの方が優先度高い → 正
  public static compare(a:Redex, b:Redex):number{
    let ap = a.getPos();
    let bp = b.getPos();
    if (ap===bp) return 0;
    else return ap-bp;
  }
}

// β基 : (\x.M)N
class BetaRedex extends Redex{
  content:Application;
  next:Expression;
  la:LambdaAbstraction;
  arg:Expression;
  rule:string;
  constructor(e:Application){
    super("beta");
    this.content = e;
    this.la = <LambdaAbstraction>e.left;
    this.next = this.la.expr.substitute(this.la.boundval,e.right);
    this.arg = e.right;
    this.rule = "beta";
  }
  public toString():string{
    let boundvals = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval);
      expr = expr.expr;
    }
    let str = boundvals.join("")+".";
    if (expr instanceof Application){
      let expr1 = expr.left;
      let str1 = expr.right.toString();
      while (expr1 instanceof Application){
        str1 = expr1.right+str1;
        expr1 = expr1.left;
      }
      str1 = expr1 + str1;
      str = str+str1;
    } else {
      str = str+expr;
    }
    return this.left+"(\\["+this.la.boundval+"]"+str+")["+this.arg+"]"+this.right;
  }
  public toTexString():string{
    let boundvals:string[] = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval.toTexString());
      expr = expr.expr;
    }
    let str = boundvals.join("")+".";
    if (expr instanceof Application){
      let expr1 = expr.left;
      let str1 = expr.right.toTexString();
      while (expr1 instanceof Application){
        str1 = expr1.right.toTexString()+str1;
        expr1 = expr1.left;
      }
      str1 = expr1.toTexString() + str1;
      str = str+str1;
    } else {
      str = str+expr.toTexString();
    }
    return this.texLeft+"(\\strut \\lambda{\\underline{"+this.la.boundval.toTexString()+"}}"+str+")\\underline{\\strut "+this.arg.toTexString()+"}"+this.texRight;
  }
  public toHTMLString():string{
    let boundvals:string[] = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval.toString());
      expr = expr.expr;
    }
    let str = boundvals.join("")+".";
    if (expr instanceof Application){
      let expr1 = expr.left;
      let str1 = expr.right.toString();
      while (expr1 instanceof Application){
        str1 = expr1.right.toString()+str1;
        expr1 = expr1.left;
      }
      str1 = expr1.toString() + str1;
      str = str+str1;
    } else {
      str = str+expr.toString();
    }
    return htmlEscape(this.left)+'(\\<span class="lf-beta lf-boundval">'+htmlEscape(this.la.boundval.toString())+'</span>'+htmlEscape(str)+')<span class="lf-beta lf-arg">'+htmlEscape(this.arg.toString())+'</span>'+htmlEscape(this.right);
  }
  public getTexRule():string{
    return "\\beta";
  }
}

// η基 : (\x.Mx)
class EtaRedex extends Redex{
  content:LambdaAbstraction;
  next:Expression;
  app:Application;
  rule:string;
  constructor(e:LambdaAbstraction){
    super("eta");
    this.content = e;
    this.app = <Application>e.expr;
    this.next = this.app.left;
    this.rule = "eta";
  }
  public toString():string{
    return this.left+"["+this.content+"]"+this.right;
  }
  public toTexString():string{
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString()+"}"+this.texRight;
  }
  public toHTMLString():string{
    return htmlEscape(this.left)+'<span class="lf-eta">('+htmlEscape(this.content.toString())+')</span>'+htmlEscape(this.right);
  }
  public getTexRule():string{
    return "\\eta";
  }
}

// マクロ : <macro>
class MacroRedex extends Redex{
  next:Expression;
  content:Macro;
  rule:string;
  constructor(e:Macro){
    super("macro");
    this.content = e;
    this.next = e.expr.copy();
    this.rule = "macro";
  }
  public toString():string{
    return this.left+"[<"+this.content.name+">]"+this.right;
  }
  public toTexString():string{
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString()+"}"+this.texRight;
  }
  public toHTMLString():string{
    return htmlEscape(this.left)+'<span class="lf-macro">&lt;'+htmlEscape(this.content.name)+'&gt;</span>'+htmlEscape(this.right);
  }
  public getTexRule():string{
    return "{\\rm m}";
  }
}

// 型付きの簡約基（マクロ以外）
class TypedRedex extends Redex{
  content:Expression;
  next:Expression;
  rule:string;
  constructor(e:Expression, next:Expression, rule:string){
    super("typed");
    this.content = e;
    this.next = next;
    this.rule = rule;
  }
  public toString():string{
    return this.left+"["+this.content.toString()+"]"+this.right;
  }
  public toTexString():string{
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString()+"}"+this.texRight;
  }
  public toHTMLString():string{
    return htmlEscape(this.left)+'<span class="lf-typed">'+htmlEscape(this.content.toString())+'</span>'+htmlEscape(this.right);
  }
  public getTexRule():string{
    return "{\\rm ("+this.rule+")}";
  }
}

// 型の連立方程式と証明木の組
class TypeResult{
  constructor(public eqs:TypeEquation[], public proofTree:string){}
}

// ラムダ項（抽象クラス）
export abstract class Expression{
  className: string;
  freevals: Variable[];
  public isTopLevel:boolean; 
  // type: Type;

  constructor(className:string){
    this.className = className;
  }

  public isNormalForm(type:boolean,etaAllowed:boolean):boolean{
    return this.getRedexes(type,etaAllowed,true).length===0;
  }

  public setRoot(){
    this.resetTopLevel();
    this.isTopLevel = true;
  }

  public parseChurchNum():number{
    if (!(this instanceof LambdaAbstraction)) return null;
    const f = this.boundval;
    let e = this.expr;
    let n = 0;
    if (!(e instanceof LambdaAbstraction)) return null;
    const x = e.boundval;
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

  public abstract toString():string;
  public abstract toTexString():string;
  public abstract getFV():Variable[];
  public abstract substitute(x:Variable, expr:Expression):Expression;
  public abstract equals(expr:Expression):boolean;
  public abstract equalsAlpha(expr:Expression):boolean;
  public abstract getEquations(gamma:Variable[], type:Type):TypeResult;
  public abstract getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[];
  public abstract resetTopLevel();
  public abstract extractMacros():Expression;
  public abstract copy():Expression;
}

// 終端記号（未解析）
class Symbol extends Expression{
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
  public toString():string{
    return this.name;
  }
  public toTexString():string{
    throw new TexError("class Symbol does not have tex string");
  }
  public getFV():Variable[]{
    return this.freevals;
  }
  public substitute(x:Variable, expr:Expression):Expression{
    throw new SubstitutionError("Undefined Substitution");
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    throw new TypeError("Undefined Type");
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public resetTopLevel(){
    this.isTopLevel = false;
  }
  public extractMacros():Expression{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public copy():Symbol{
    return new Symbol(this.name,this.className);
  }
}

// 変数 x
class Variable extends Symbol{
  type:Type;
  constructor(name:string){
    super(name, "Variable");
    this.freevals = [this];
  }

  public substitute(x:Variable, expr:Expression):Expression{
    if (this.equals(x)) return expr;
    else return this;
  }

  public getEquations(gamma:Variable[],type:Type):TypeResult{
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

  public toTexString():string{
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    return [];
  }
  public extractMacros():Expression{
    return this;
  }
  public copy():Variable{
    return new Variable(this.name);
  }
  public toLMNtal():string{
    return "fv("+this.name+")";
  }
}

// 定数 c
abstract class Const extends Symbol {
  abstract value;
  abstract type:Type;
  constructor(name:string, className:string){
    super(name, className);
    this.freevals = [];
  }
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (con)
    let str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(con)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(this.type,type)], str);
  }
  public toString():string{
    return "["+this.name+"]";
  }
  public toTexString():string{
    return this.name+"^{"+this.type.toTexString()+"}";
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    if (typed){
      return [];
    } else {
      throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    }
  }
  public extractMacros():Expression{
    return this;
  }
}

// int型定数 c^{int}
class ConstInt extends Const{
  value:number;
  type:TypeInt;
  constructor(value:number){
    super(value.toString(), "ConstInt");
    this.value = value;
    this.type = new TypeInt();
  }
  public copy():Const{
    return new ConstInt(this.value);
  }
}

// bool型定数 c^{bool}
class ConstBool extends Const{
  value:boolean;
  type:TypeBool;
  constructor(value:boolean){
    super(value.toString(), "ConstBool");
    this.value = value;
    this.type = new TypeBool();
  }
  public copy():ConstBool{
    return new ConstBool(this.value);
  }
}

// 関数型定数 c^{op} （前置記法・2項演算）
class ConstOp extends Const{
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
      case "!=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value!=y.value));
        this.type = new TypeFunc(new TypeInt(),new TypeFunc(new TypeInt(),new TypeBool()));
        break;
      case "eq":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(new TypeBool(),new TypeFunc(new TypeBool(),new TypeBool()));
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
  public copy():ConstOp{
    return new ConstOp(this.name);
  }
}

// 空リスト nil
class Nil extends Symbol{
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }
  constructor(){
    super("nil","Nil");
    this.freevals=[];
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (nil)
    let t = TypeVariable.getNew();
    let nType = new TypeList(t);
    let str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(nil)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.name+" : "+nType.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(type,nType)],str);
  }
  public toTexString():string{
    return "{\\rm "+this.name+"}";
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    if (typed){
      return [];
    } else {
      throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    }
  }
  public extractMacros():Expression{
    return this;
  }
  public copy():Nil{
    return new Nil();
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
    this.freevals = [];
    this.expr = expr;
    this.typed = typed;
    this.type = type;
  }
  public static add(name:string, lf:LambdaFriends, typed:boolean):Macro{
    let expr = lf.expr;
    if (!(/^[a-zA-Z0-9!?]+$/.test(name))){
      throw new MacroError("<"+name+"> cannot be used as a name of macro. Available characters: [a-zA-Z0-9!?]");
    }
    let map = (typed?Macro.map:Macro.mapUntyped);
    if (expr.getFV().length !== 0){
      throw new MacroError("<"+name+"> contains free variables: "+expr.getFV());
    }
    expr.isTopLevel = true;
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
      if (name.match(/^\d+$/)!==null){
        return new Macro(name,makeChurchNum(parseInt(name),typed),typed,undefined);
      } else if (name=="true"){
        return new Macro(name,makeAST("\\xy.x",typed),typed,undefined);
      } else if (name=="false"){
        return new Macro(name,makeAST("\\xy.y",typed),typed,undefined);
      }

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

  public toString():string{
    return "<"+this.name+">";
  }
  public equalsAlpha(expr:Expression):boolean{
    // 再検討の余地あり
    if (this.expr === undefined) return this.equals(expr);
    else return this.expr.equalsAlpha(expr);
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // ????
    if (this.expr === undefined) throw new TypeError(this+" is undefined.")
    else return this.expr.getEquations(gamma,type);
  }
  public toTexString():string{
    return "\\,\\overline{\\bf "+this.name+"}\\,";
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    let next = Macro.get(this.name,typed);
    if (next.expr === undefined) return [];
    else return [new MacroRedex(next)];
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    if (this.expr !== undefined) this.expr.setRoot();
  }
  public extractMacros(){
    if (this.expr === undefined) return this;
    else return this.expr.extractMacros().copy();
  }
  public copy():Macro{
    if (this.expr === undefined) return new Macro(this.name,undefined,this.typed,this.type);
    else return new Macro(this.name,this.expr.copy(),this.typed,this.type);
  }
  public toLMNtal():string{
    if (this.expr === undefined) return "fv("+this.name+")";
    else return this.expr.toLMNtal();
  }
}

// ラムダ抽象 \x.M
class LambdaAbstraction extends Expression{
  boundval: Variable;
  expr: Expression;

  constructor(boundval:Variable, expr:Expression){
    super("LambdaAbstraction");
    this.freevals = undefined;
    this.boundval = boundval;
    this.expr = expr;
  }
  static parse(tokens:Symbol[],typed:boolean):LambdaAbstraction{
    let boundvals:Variable[] = [];
    while (tokens.length>0){
      let t:Symbol = tokens.shift();
      if (t.name==="."){
        let expr = parseSymbols(tokens,typed);
        while (boundvals.length>0){
          expr = new LambdaAbstraction(boundvals.pop(),expr);
        }
        return <LambdaAbstraction>expr;
      } else if (t.name.match(/^[A-Za-z]$/)===null){
        throw new LambdaParseError("Unexpected token: '"+t+"'");
      } else {
        boundvals.push(new Variable(t.name));
      }
    }
    throw new LambdaParseError("'.' is needed");
  }
  public toString():string{
    let boundvals = [this.boundval];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval);
      expr = expr.expr;
    }
    let str = "\\"+boundvals.join("")+".";
    if (expr instanceof Application){
      let expr1 = expr.left;
      let str1 = expr.right.toString();
      while (expr1 instanceof Application){
        str1 = expr1.right+str1;
        expr1 = expr1.left;
      }
      str1 = expr1 + str1;
      str = str+str1;
    } else {
      str = str+expr;
    }
    if (!this.isTopLevel) str = "("+str+")";
    return str;
  }
  public getFV():Variable[]{
    if (this.freevals !== undefined) return this.freevals;
    this.freevals = [];
    return this.freevals = Variable.dif(this.expr.getFV(),[this.boundval]);
  }
  public substitute(y:Variable, expr:Expression):Expression{
    if (this.boundval.equals(y)){
      return this;
    } else if (!Variable.contains(expr.getFV(),this.boundval)){
      return new LambdaAbstraction(this.boundval,this.expr.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.expr.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      return new LambdaAbstraction(z,this.expr.substitute(this.boundval,z)).substitute(y,expr);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof LambdaAbstraction) && (expr.boundval.equals(this.boundval)) && (expr.expr.equals(this.expr));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof LambdaAbstraction)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundval;
    let m = this.expr;
    let y = expr.boundval;
    let n = expr.expr;
    if (Variable.contains(m.getFV(),y)){
      return n.equalsAlpha(m);
    } else {
      return n.equalsAlpha(m.substitute(x,y));
    }
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (abs)
    let t0 = TypeVariable.getNew();
    let t1 = TypeVariable.getNew();
    this.boundval.type = t1;
    let next = this.expr.getEquations(gamma.concat(this.boundval),t0);
    let str = next.proofTree;
    str += "\\RightLabel{\\scriptsize(abs)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(next.eqs.concat(new TypeEquation(type,new TypeFunc(t1,t0))),str);
  }
  public toTexString():string{
    let boundvals = [this.boundval.toTexString()];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval.toTexString());
      expr = expr.expr;
    }
    let str = "\\lambda "+boundvals.join("")+".";
    if (expr instanceof Application){
      let expr1 = expr.left;
      let str1 = expr.right.toTexString();
      while (expr1 instanceof Application){
        str1 = expr1.right.toTexString()+str1;
        expr1 = expr1.left;
      }
      str1 = expr1.toTexString() + str1;
      str = str+str1;
    } else {
      str = str+expr.toTexString();
    }
    if (!this.isTopLevel) str = "("+str+")";
    return str;
  }
  public isEtaRedex():boolean{
    return (this.expr instanceof Application) && (this.expr.right.equals(this.boundval)) && (!Variable.contains(this.expr.left.getFV(),this.boundval));
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    if (typed) return [];
    let boundvals = [this.boundval];
    let expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval);
      expr = expr.expr;
    }
    let lParen = "", rParen = "";
    if (!this.isTopLevel && !noParen){
      lParen = "(";
      rParen = ")";
    }
    let ret = Redex.makeNext(
      expr.getRedexes(false,etaAllowed,true),
      lParen+"\\"+boundvals.join("")+".",
      rParen,
      lParen+"\\lambda{"+boundvals.join("")+"}.",
      rParen,
      (prev)=>{
        let bvs:Variable[] = [].concat(boundvals);
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
  public resetTopLevel(){
    this.isTopLevel = false;
    this.boundval.resetTopLevel();
    this.expr.resetTopLevel();
  }
  public extractMacros():Expression{
    return new LambdaAbstraction(this.boundval,this.expr.extractMacros());
  }
  public copy():LambdaAbstraction{
    return new LambdaAbstraction(this.boundval.copy(),this.expr.copy());
  }
  public toLMNtal():string{
    let ret = this.expr.toLMNtal().split("fv("+this.boundval.name+")");
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
}

// 関数適用 MN
class Application extends Expression{
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

  public toString():string{
    let expr = this.left;
    let str = this.right.toString();
    while (expr instanceof Application){
      str = expr.right+str;
      expr = expr.left;
    }
    str = expr+str;
    if (!this.isTopLevel) str = "("+str+")";
    return str;
  }

  public getFV():Variable[]{
    if (this.freevals===undefined)
      return this.freevals = Variable.union(this.left.getFV(),this.right.getFV());
    else return this.freevals;
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
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (app)
    let t1 = TypeVariable.getNew();
    let nextL = this.left.getEquations(gamma,new TypeFunc(t1,type));
    let nextR = this.right.getEquations(gamma,t1);
    let str = nextL.proofTree + nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(app)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString():string{
    let expr = this.left;
    let str = this.right.toTexString();
    while (expr instanceof Application){
      str = expr.right.toTexString()+str;
      expr = expr.left;
    }
    str = expr.toTexString()+str;
    if (!this.isTopLevel) str = "("+str+")";
    return str;
  }
  public getRedexes(typed:boolean, etaAllowed:boolean, noParen:boolean):Redex[]{
    if (typed){
      // typed
      let lParen = (this.isTopLevel ? "" : "(");
      let rParen = (this.isTopLevel ? "" : ")");
      if (this.left instanceof LambdaAbstraction){
        // (app2)
        return [new TypedRedex(this, this.left.expr.substitute(this.left.boundval,this.right),"app2")];
      } else if (this.left instanceof Application 
        && this.left.left instanceof ConstOp
        && this.left.right instanceof Const){
        let op = this.left.left;
        let left = this.left.right;
        let right = this.right;
        if (right instanceof Const){
          // (app5)
          if (op.type.left.equals(left.type) && op.type.right instanceof TypeFunc && op.type.right.left.equals(right.type)){
            return [new TypedRedex(this,op.value(left,right),"app5")];
          } else {
            throw new ReductionError(op.type+" cannot handle "+left.type+" and "+right.type+" as arguments");
          }
        } else {
          // (app4)
          return Redex.makeNext(
            right.getRedexes(true,false,false),
            lParen+op.toString()+left.toString(),
            rParen,
            lParen+op.toTexString()+left.toTexString(),
            rParen,
            (prev)=>(new Application(new Application(op,left),prev)));
        }
      } else if (this.left instanceof ConstOp) {
        // (app3)
        return Redex.makeNext(
          this.right.getRedexes(true,false,false),
          lParen+this.left.toString(),
          rParen,
          lParen+this.left.toTexString(),
          rParen,
          (prev)=>(new Application(this.left,prev)));
      } else {
        // (app1)
        return Redex.makeNext(
          this.left.getRedexes(true,false,false),
          lParen,
          rParen+this.right.toString(),
          lParen,
          rParen+this.right.toTexString(),
          (prev)=>(new Application(prev,this.right)));
      }
    } else {
      // untyped
      let apps:Application[] = [this];
      let right:string[] = [""];
      let texRight:string[] = [""];
      while (true){
        let t = apps[apps.length-1];
        right.push(t.right.toString()+right[right.length-1]);
        texRight.push(t.right.toTexString()+right[texRight.length-1]);
        if (!(t.left instanceof Application)) break;
        apps.push(t.left);
      }
      // apps = [abc, ab]
      // right = ["","c","bc"]
      let ret = apps[apps.length-1].left.getRedexes(false,etaAllowed,false);
      while (apps.length>0) {
        let t = apps.pop();
        let ret1 = Redex.makeNext(
          ret,
          "",
          t.right.toString(),
          "",
          t.right.toTexString(),
          (prev) => (new Application(prev,t.right)));
        let lstr = t.left.toString();
        if (t.left instanceof Application) lstr = lstr.slice(1,-1);
        let ret2 = Redex.makeNext(
          t.right.getRedexes(false,etaAllowed,false),
          lstr,
          "",
          t.left.toTexString(),
          "",
          (prev) => (new Application(t.left,prev)));
        ret = ret1.concat(ret2);
        right.pop();
        texRight.pop();
        if (t.isBetaRedex()){
          ret.push(new BetaRedex(t));
        }
      }
      if (!this.isTopLevel && !noParen){
        ret = Redex.makeNext(ret,"(",")","(",")",(prev)=>(prev));
      }
      return ret;
    }
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.left.resetTopLevel();
    this.right.resetTopLevel();
  }
  public extractMacros():Expression{
    return new Application(this.left.extractMacros(),this.right.extractMacros());
  }
  public copy():Application{
    return new Application(this.left.copy(),this.right.copy());
  }
  public toLMNtal():string{
    return "apply("+this.left.toLMNtal()+","+this.right.toLMNtal()+")";
  }
}

// リスト M::M
class List extends Expression{
  head: Expression;
  tail: Expression;

  constructor(head:Expression, tail:Expression){
    super("List");
    this.head = head;
    this.tail = tail;
  }

  public toString():string{
    return this.head+"::"+this.tail;
  }

  public getFV():Variable[]{
    if (this.freevals===undefined)
      return this.freevals = Variable.union(this.head.getFV(),this.tail.getFV());
    else return this.freevals;
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
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (list) 再検討の余地あり？ 新しい型変数要る？
    let t = TypeVariable.getNew();
    let lt = new TypeList(t);
    let nextH = this.head.getEquations(gamma,t);
    let nextT = this.tail.getEquations(gamma,lt);
    let str = nextH.proofTree + nextT.proofTree;
    str += "\\RightLabel{\\scriptsize(list)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+lt.toTexString()+" $}\n";
    return new TypeResult(nextH.eqs.concat(nextT.eqs, new TypeEquation(lt,type)),str);
  }
  public toTexString():string{
    return this.head.toTexString()+"::"+this.tail.toTexString();
  }

  public getRedexes(typed:boolean,etaAllowed:boolean,noParen:boolean):Redex[]{
    if (typed) return [];
    else throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.head.resetTopLevel();
    this.tail.resetTopLevel();
  }
  public extractMacros():Expression{
    return new List(this.head.extractMacros(),this.tail.extractMacros());
  }
  public copy():Expression{
    return new List(this.head.copy(),this.tail.copy());
  }
}

// if
class If extends Expression{
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
    return this.freevals = Variable.union(this.state.getFV(),this.ifTrue.getFV(),this.ifFalse.getFV());
  }
  public toString():string{
    return "([if]"+this.state+"[then]"+this.ifTrue+"[else]"+this.ifFalse+")";
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
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (if)
    let nextS = this.state.getEquations(gamma,new TypeBool());
    let nextT = this.ifTrue.getEquations(gamma,type);
    let nextF = this.ifFalse.getEquations(gamma,type);
    let str = nextS.proofTree+nextT.proofTree+nextF.proofTree;
    str += "\\RightLabel{\\scriptsize(if)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextT.eqs,nextF.eqs),str);
  }
  public toTexString():string{
    return "({\\bf if}~"+this.state.toTexString()+"~{\\bf then}~"+this.ifTrue.toTexString()+"~{\\bf else}~"+this.ifFalse.toTexString()+")";
  }
  public getRedexes(typed:boolean,etaAllowed:boolean,noParen:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

    if (this.state instanceof ConstBool){
      if (this.state.value){
        // (if2)
        return [new TypedRedex(this,this.ifTrue,"if2")];
      } else {
        // (if3)
        return [new TypedRedex(this,this.ifFalse,"if3")];
      }
    } else {
      // (if1)
      return Redex.makeNext(
        this.state.getRedexes(true,false,false),
        "([if]",
        "[then]"+this.ifTrue+"[else]"+this.ifFalse+")",
        "({\\bf if}~",
        "~{\\bf then}~"+this.ifTrue.toTexString()+"~{\\bf else}~"+this.ifFalse.toTexString()+")",
        (prev)=>(new If(prev,this.ifTrue,this.ifFalse)));
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
    let stateExpr = parseSymbols(state,typed);
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
    let ifTrueExpr = parseSymbols(ifTrue,typed);
    let ifFalseExpr = parseSymbols(tokens,typed);
    return new If(stateExpr,ifTrueExpr,ifFalseExpr);
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.state.resetTopLevel();
    this.ifTrue.resetTopLevel();
    this.ifFalse.resetTopLevel();
  }
  public extractMacros():Expression{
    return new If(this.state.extractMacros(),this.ifTrue.extractMacros(),this.ifFalse.extractMacros());
  }
  public copy():Expression{
    return new If(this.state.copy(),this.ifTrue.copy(),this.ifFalse.copy());
  }
}

// let in
class Let extends Expression{
  boundval:Variable;
  left:Expression;
  right:Expression;
  constructor(boundval:Variable, left:Expression, right:Expression){
    super("Let");
    this.boundval = boundval;
    this.left = left;
    this.right = right;
  }
  public getFV():Variable[]{
    if (this.freevals!==undefined) return this.freevals;
    let ret:Variable[] = [];
    for (let fv of this.right.getFV()){
      if (!fv.equals(this.boundval)){
        ret.push(fv);
      }
    }
    return this.freevals = Variable.union(ret, this.left.getFV());
  }
  public toString():string{
    return "([let]"+this.boundval+"[=]"+this.left+"[in]"+this.right+")";
  }
  public substitute(y:Variable, expr:Expression):Expression{
    let left = this.left.substitute(y,expr);
    if (this.boundval.equals(y)){
      return new Let(this.boundval,left,this.right);
    } else if (!Variable.contains(expr.getFV(),this.boundval)){
      return new Let(this.boundval,left,this.right.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.right.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      if (z.equals(y)){
        return new Let(z,left,this.right.substitute(this.boundval,z));
      } else {
        return new Let(z,left,this.right.substitute(this.boundval,z).substitute(y,expr));
      }
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Let) && (expr.boundval.equals(this.boundval)) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof Let)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundval;
    let m = this.right;
    let y = expr.boundval;
    let n = expr.right;
    return (!Variable.contains(m.getFV(),y) && n.equalsAlpha(m.substitute(x,y)));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (let)
    let t1 = TypeVariable.getNew();
    this.boundval.type = t1;
    let nextL = this.left.getEquations(gamma,t1);
    let nextR = this.right.getEquations(gamma.concat(this.boundval),type);
    let str = nextL.proofTree+nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(let)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString():string{
    return "({\\bf let}~"+this.boundval.toTexString()+" = "+this.left.toTexString()+"~{\\bf in}~"+this.right.toTexString()+")";
  }
  public getRedexes(typed:boolean,etaAllowed:boolean,noParen:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

    // (let)
    return [new TypedRedex(this,this.right.substitute(this.boundval,this.left),"let")];
  }
  public static parse(tokens:Symbol[], typed:boolean):Let{
    let t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let boundval = new Variable(t.name);
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
    let contentExpr:Expression = parseSymbols(content,typed);
    let restExpr:Expression = parseSymbols(tokens,typed);
    return new Let(boundval,contentExpr,restExpr);
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.boundval.resetTopLevel();
    this.left.resetTopLevel();
    this.right.resetTopLevel();
  }
  public extractMacros():Expression{
    return new Let(this.boundval,this.left.extractMacros(),this.right.extractMacros());
  }
  public copy():Expression{
    return new Let(this.boundval.copy(),this.left.copy(),this.right.copy());
  }
}

// case文 [case] M [of] [nil] -> M | x::x -> M
class Case extends Expression{
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
    if (this.freevals!==undefined) return this.freevals;
    else return Variable.union(this.state.getFV(),this.ifNil.getFV(),Variable.dif(this.ifElse.getFV(),[this.head,this.tail]));
  }
  public toString():string{
    return "([case]"+this.state+"[of][nil]->"+this.ifNil+" | "+this.head+"::"+this.tail+"->"+this.ifElse+")";
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
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (case)
    let t1 = TypeVariable.getNew();
    let lt1 = new TypeList(t1);
    this.head.type = t1;
    this.tail.type = lt1;
    let nextS = this.state.getEquations(gamma,lt1);
    let nextN = this.ifNil.getEquations(gamma,type);
    let nextE = this.ifElse.getEquations(gamma.concat(this.head,this.tail),type);
    let str = nextS.proofTree+nextN.proofTree+nextE.proofTree;
    str += "\\RightLabel{\\scriptsize(case)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextN.eqs,nextE.eqs),str);
  }
  public toTexString():string{
    return "({\\bf case} "+this.state+" {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString()+" | "+this.head.toTexString()+"::"+this.tail.toTexString()+" \\Rightarrow "+this.ifElse.toTexString()+")";
  }
  public getRedexes(typed:boolean,etaAllowed?:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    if (this.state instanceof Nil){
      // (case2)
      return [new TypedRedex(this,this.ifNil,"case2")];
    } else if (this.state instanceof List){
      // (case3)
      return [new TypedRedex(this,this.ifElse.substitute(this.head,this.state.head).substitute(this.tail,this.state.tail),"case3")];
    } else {
      // (case1)
      return Redex.makeNext(
        this.state.getRedexes(true,false,false),
        "([case]",
        "[of][nil]->"+this.ifNil+" | "+this.head+"::"+this.tail+"->"+this.ifElse+")",
        "({\\bf case} ",
        " {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString()+" | "+this.head.toTexString()+"::"+this.tail.toTexString()+" \\Rightarrow "+this.ifElse.toTexString()+")",
        (prev)=>(new Case(prev,this.ifNil,this.head,this.tail,this.ifElse)));
    }
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.state.resetTopLevel();
    this.ifNil.resetTopLevel();
    this.head.resetTopLevel();
    this.tail.resetTopLevel();
    this.ifElse.resetTopLevel();
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
    let stateExpr:Expression = parseSymbols(state,typed);
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
    let ifNilExpr:Expression = parseSymbols(ifNil,typed);
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
    let ifElseExpr = parseSymbols(tokens,typed);
    return new Case(stateExpr,ifNilExpr,head,tail,ifElseExpr);
  }
  public extractMacros():Expression{
    return new Case(this.state.extractMacros(),this.ifNil.extractMacros(),this.head,this.tail,this.ifElse.extractMacros());
  }
  public copy():Expression{
    return new Case(this.state.copy(),this.ifNil.copy(),this.head.copy(),this.tail.copy(),this.ifElse.copy());
  }
}

// 不動点演算子 [fix] x.M
class Fix extends Expression{
  boundval:Variable;
  expr:Expression;
  constructor(boundval:Variable, expr:Expression){
    super("Fix");
    this.boundval = boundval;
    this.expr = expr;
  }
  public getFV():Variable[]{
    if (this.freevals!==undefined) return this.freevals;
    let ret:Variable[] = [];
    for (let fv of this.expr.getFV()){
      if (!fv.equals(this.boundval)){
        ret.push(fv);
      }
    }
    return this.freevals = ret;
  }
  public toString():string{
    return "([fix]"+this.boundval+"."+this.expr+")";
  }
  public substitute(y:Variable, expr:Expression):Expression{
    if (this.boundval.equals(y)){
      return this;
    } else if (!Variable.contains(expr.getFV(),this.boundval)){
      return new Fix(this.boundval,this.expr.substitute(y,expr));
    } else {
      let uniFV = Variable.union(this.expr.getFV(),expr.getFV());
      let z = Variable.getNew(uniFV);
      return new Fix(z,this.expr.substitute(this.boundval,z)).substitute(y,expr);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Fix) && (expr.boundval.equals(this.boundval)) && (expr.expr.equals(this.expr));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof Fix)) return false;
    if (this.equals(expr)) return true;
    let x = this.boundval;
    let m = this.expr;
    let y = expr.boundval;
    let n = expr.expr;
    if (Variable.contains(m.getFV(),y)){
      return n.equalsAlpha(m);
    } else {
      return n.equalsAlpha(m.substitute(x,y));
    }
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (fix)
    this.boundval.type = type;
    let next = this.expr.getEquations(gamma.concat(this.boundval),type);
    let str = next.proofTree;
    str += "\\RightLabel{\\scriptsize(fix)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(next.eqs,str);
  }
  public toTexString():string{
    return "({\\bf fix}~"+this.boundval.toTexString()+"."+this.expr.toTexString()+")";
  }
  public getRedexes(typed:boolean,etaAllowed:boolean,noParen:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

    // (fix)
    return [new TypedRedex(this,this.expr.substitute(this.boundval, new Fix(new Variable(this.boundval.name),this.expr)),"fix")];
  }
  public static parse(tokens:Symbol[], typed:boolean):Fix{
    let t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/)===null)
      throw new LambdaParseError("Unexpected token: '"+t+"'");
    let boundval = new Variable(t.name);
    if (tokens.shift().name!==".")
      throw new LambdaParseError("'.' is expected");

    let contentExpr:Expression = parseSymbols(tokens,typed);
    return new Fix(boundval,contentExpr);
  }
  public resetTopLevel(){
    this.isTopLevel = false;
    this.boundval.resetTopLevel();
    this.expr.resetTopLevel();
  }
  public extractMacros():Expression{
    return new Fix(this.boundval,this.expr.extractMacros());
  }
  public copy():Expression{
    return new Fix(this.boundval.copy(),this.expr.copy());
  }
}