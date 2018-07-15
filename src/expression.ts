import { Type, TypeFunc, TypeInt, TypeBool, TypeEquation, TypeList, TypeVariable, TypeUntyped } from "./type";
import { LambdaParseError, SubstitutionError, ReductionError, MacroError, TypeError, TexError } from "./error";
import { LambdaFriends } from "./lambda-friends";

// 字句解析
function tokenize(str:string, typed:boolean):Symbol[]{
  let strs:string[] = str.split("");
  let tokens:Symbol[] = [];
  while (strs.length>0){
    let c = strs.shift().trim();
    if (c === ""){}
    else if (c === "<") {
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
  return parseSymbols(tokenize(str,typed),typed);
}

// Input : lambda(cp(L0,L1),lambda(L2,apply(apply(L1,L0),L2)))
// Now   : lambda([L0,L1], lambda([L2],apply()))
// Output: \xy.xxy
export function parseLMNtal(str:string):Expression{
  return parse(str,[],{});

  function parse(str:string,usedVars:Variable[],map:{[key:string]:string}){
    str = str.trim();
    let res = str.match(/^.+?(?=\()/);
    if (res===null){
      let ret = map[str];
      if (ret === undefined) throw new LambdaParseError("Malformed LMNtal Lambda Term. Unknown Token: "+str);
      return new Variable(ret);
    }

    let atom = res[0].trim();
    let args = parseArg(str.match(/\(.+$/)[0]);

    switch(atom){
      case "lambda":{
        if (args.length!==2) throw new LambdaParseError("Malformed LMNtal Lambda Term. lambda(X,A) should have 2 args.");
        let v = Variable.getNew(usedVars);
        let bvs = parseAbsArg(args[0]);
        for (let bv of bvs) map[bv] = v.name;
        return new LambdaAbstraction(v,parse(args[1],usedVars.concat(v),Object.assign({},map)));
      }
      case "apply":{
        if (args.length!==2) throw new LambdaParseError("Malformed LMNtal Lambda Term. apply(A,B) should have 2 args.");
        return new Application(parse(args[0],[].concat(usedVars),Object.assign({},map)),parse(args[1],[].concat(usedVars),Object.assign({},map)));
      }
      case "fv":{
        if (args.length!==1) throw new LambdaParseError("Malformed LMNtal Lambda Term. fv(X) should have 1 arg.");
        return Macro.get(args[0],false);
      }
      default:
        throw new LambdaParseError("Malformed LMNtal Lambda Term. Unexpected atom name: "+atom);
    }
  }

  // Ex1: (L0,cp(L1,L2)) => ["L0","cp(L1,L2)"]
  // Ex2: (L0) => ["L0"]
  // Ex3: ( ) => []
  function parseArg(str:string):string[]{
    str = str.trim();
    if (str[0]!=="(" || str[str.length-1]!==")")
      throw new LambdaParseError("Malformed LMNtal Lambda Term. Invalid Parentheses.");
    let level = 0;
    let content = "";
    let strs:string[] = [];
    for (let i=1; i<str.length-1; i++){
      let t = str[i];
      if (t==="(") level++;
      else if (t===")") level--;
      if (level===0 && t===",") {
        strs.push(content);
        content = "";
      } else {
        content += t;
      }
    }
    if (level!==0) throw new LambdaParseError("Malformed LMNtal Lambda Term. Invalid Parentheses.");
    strs.push(content);
    if (strs.length === 1){
      let s = strs[0].trim();
      if (s==="") return [];
      else return [s];
    }
    let ret:string[] = [];
    for (let s of strs) ret.push(s.trim());
    return ret;
  }

  // Ex1: cp(L0,cp(L1,L2)) => [L0,L1,L2]
  // Ex2: L0 => [L0]
  // Ex3: rm => []
  function parseAbsArg(str:string):string[]{
    str = str.trim();
    let res = str.match(/^.+?(?=\()/);
    if (res===null){
      if(str === "rm") return [];
      else return [str];
    }
    let atom = res[0].trim();
    let args = parseArg(str.match(/\(.+$/)[0]);
    if (atom==="rm"){
      if (args.length!==0)
        throw new LambdaParseError("Malformed LMNtal Lambda Term. rm() should have 0 args.");
      return [];
    } else if (atom==="cp"){
      if (args.length!==2)
        throw new LambdaParseError("Malformed LMNtal Lambda Term. cp(A,B) should have 2 args.");
      return parseAbsArg(args[0].trim()).concat(parseAbsArg(args[1].trim()));
    } else {
      throw new LambdaParseError("Malformed LMNtal Lambda Term. Unexpected atom name: "+atom);
    }
  }
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

export function makeTerms(depth:number):Expression[]{
  return sub([],depth);
  function sub(vs:Variable[], depth:number):Expression[]{
    let ret:Expression[] = [].concat(vs);
    if (depth === 0) return ret;
    let res = sub(vs,depth-1);
    // Application
    for (let i=0; i<res.length; i++)
      for (let j=0; j<res.length; j++)
        ret.push(new Application(res[i],res[j]));
    // Lambda Abstraction
    let newVar = Variable.getNew(vs);
    let res1 = sub(vs.concat(newVar),depth-1);
    for (let r of res1) ret.push(new LambdaAbstraction(newVar,r));
    return ret;
  }
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
    this.next = this.la.expr.substitute(this.la.boundvar,e.right);
    this.arg = e.right;
    this.rule = "beta";
  }
  public toString():string{
    let boundvars:string[] = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar.toString(false));
      expr = expr.expr;
    }
    let str = boundvars.join("")+"."+expr.toString(true);
    return this.left+"(\\["+this.la.boundvar.toString(false)+"]"+str+")["+this.arg.toString(false)+"]"+this.right;
  }
  public toTexString():string{
    let boundvars:string[] = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar.toTexString(false));
      expr = expr.expr;
    }
    let str = boundvars.join("")+"."+expr.toTexString(true);
    return this.texLeft+"(\\strut \\lambda{\\underline{"+this.la.boundvar.toTexString(false)+"}}"+str+")\\underline{\\strut "+this.arg.toTexString(false)+"}"+this.texRight;
  }
  public toHTMLString():string{
    let boundvars:string[] = [];
    let expr = this.la.expr;
    while(expr instanceof LambdaAbstraction){
      boundvars.push(expr.boundvar.toString(false));
      expr = expr.expr;
    }
    let str = boundvars.join("")+"."+expr.toString(true);
    return htmlEscape(this.left)+'(\\<span class="lf-beta lf-boundvar">'+htmlEscape(this.la.boundvar.toString(false))+'</span>'+htmlEscape(str)+')<span class="lf-beta lf-arg">'+htmlEscape(this.arg.toString(false))+'</span>'+htmlEscape(this.right);
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
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString(this.left+this.right==="")+"}"+this.texRight;
  }
  public toHTMLString():string{
    return htmlEscape(this.left)+'<span class="lf-eta">('+htmlEscape(this.content.toString(this.left+this.right===""))+')</span>'+htmlEscape(this.right);
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
    this.next = e.expr;
    this.rule = "macro";
  }
  public toString():string{
    return this.left+"[<"+this.content.name+">]"+this.right;
  }
  public toTexString():string{
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString(false)+"}"+this.texRight;
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
    return this.left+"["+this.content.toString(this.left+this.right==="")+"]"+this.right;
  }
  public toTexString():string{
    return this.texLeft+"\\underline{\\strut "+this.content.toTexString(false)+"}"+this.texRight;
  }
  public toHTMLString():string{
    return htmlEscape(this.left)+'<span class="lf-typed">'+htmlEscape(this.content.toString(this.left+this.right===""))+'</span>'+htmlEscape(this.right);
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

  public abstract toString(noParens:boolean):string;
  public abstract toTexString(noParens:boolean):string;
  public abstract getFV():Variable[];
  public abstract substitute(x:Variable, expr:Expression):Expression;
  public abstract equals(expr:Expression):boolean;
  public abstract equalsAlpha(expr:Expression):boolean;
  public abstract getEquations(gamma:Variable[], type:Type, noParens:boolean):TypeResult;
  public abstract getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[];
  public abstract getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex;
  public abstract extractMacros():Expression;
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
  public extractMacros():Expression{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
}

// 変数 x
class Variable extends Symbol{
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    return [];
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    return null;
  }
  public extractMacros():Expression{
    return this;
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    if (typed){
      return [];
    } else {
      throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    }
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    if (typed){
      return null;
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
}

// 空リスト nil
class Nil extends Symbol{
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    if (typed){
      return [];
    } else {
      throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    }
  }
  public getLeftMostRedex(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex{
    if (typed){
      return null;
    } else {
      throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    }
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    let next = Macro.get(this.name,typed);
    if (next.expr === undefined) return [];
    else return [new MacroRedex(next)];
  }
  public getLeftMostRedex(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex{
    let next = Macro.get(this.name,typed);
    if (next.expr === undefined) return null;
    else return new MacroRedex(next);
  }
  public extractMacros(){
    if (this.expr === undefined) return this;
    else return this.expr.extractMacros();
  }
  public toLMNtal():string{
    if (this.expr === undefined) return "fv("+this.name+")";
    else return this.expr.toLMNtal();
  }
}

// ラムダ抽象 \x.M
class LambdaAbstraction extends Expression{
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
        let expr = parseSymbols(tokens,typed);
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
    if (Variable.contains(m.getFV(),y)){
      return n.equalsAlpha(m);
    } else {
      return n.equalsAlpha(m.substitute(x,y));
    }
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    if (typed) return [];
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
      expr.getRedexes(false,etaAllowed,true),
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
  public getLeftMostRedex(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex{
    if (typed) return null;
    
    if (etaAllowed===undefined){
      console.error("etaAllowed is undefined.");
      etaAllowed = false;
    }
    if (etaAllowed && this.isEtaRedex()){
      return new EtaRedex(this);
    }
    
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
    let ret = expr.getLeftMostRedex(false,etaAllowed,true);
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
    return ret;
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
  public getRedexes(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex[]{
    if (typed){
      // typed
      let lParen = (noParens ? "" : "(");
      let rParen = (noParens ? "" : ")");
      if (this.left instanceof LambdaAbstraction){
        // (app2)
        return [new TypedRedex(this, this.left.expr.substitute(this.left.boundvar,this.right),"app2")];
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
            lParen+op.toString(false)+left.toString(false),
            rParen,
            lParen+op.toTexString(false)+left.toTexString(false),
            rParen,
            (prev)=>(new Application(new Application(op,left),prev)));
        }
      } else if (this.left instanceof ConstOp) {
        // (app3)
        return Redex.makeNext(
          this.right.getRedexes(true,false,false),
          lParen+this.left.toString(false),
          rParen,
          lParen+this.left.toTexString(false),
          rParen,
          (prev)=>(new Application(this.left,prev)));
      } else {
        // (app1)
        return Redex.makeNext(
          this.left.getRedexes(true,false,false),
          lParen,
          rParen+this.right.toString(false),
          lParen,
          rParen+this.right.toTexString(false),
          (prev)=>(new Application(prev,this.right)));
      }
    } else {
      // untyped
      let apps:Application[] = [this];
      let right:string[] = [""];
      let texRight:string[] = [""];
      while (true){
        let t = apps[apps.length-1];
        right.push(t.right.toString(false)+right[right.length-1]);
        texRight.push(t.right.toTexString(false)+right[texRight.length-1]);
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
          t.right.toString(false),
          "",
          t.right.toTexString(false),
          (prev) => (new Application(prev,t.right)));
        let lstr = t.left.toString(true);
        let ret2 = Redex.makeNext(
          t.right.getRedexes(false,etaAllowed,false),
          lstr,
          "",
          t.left.toTexString(false),
          "",
          (prev) => (new Application(t.left,prev)));
        ret = ret1.concat(ret2);
        right.pop();
        texRight.pop();
        if (t.isBetaRedex()){
          ret.push(new BetaRedex(t));
        }
      }
      if (!noParens){
        ret = Redex.makeNext(ret,"(",")","(",")",(prev)=>(prev));
      }
      return ret;
    }
  }
  public getLeftMostRedex(typed:boolean, etaAllowed:boolean, noParens:boolean):Redex{
    if (typed){
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
          let ret = right.getLeftMostRedex(true,false,false);
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
        let ret = this.right.getLeftMostRedex(true,false,false);
        if (ret === null) return null;
        ret.next = new Application(this.left,ret.next);
        ret.addLeft(lParen+this.left.toString(false));
        ret.addRight(rParen);
        ret.addTexLeft(lParen+this.left.toTexString(false));
        ret.addTexRight(rParen);
        return ret;
      } else {
        // (app1)
        let ret = this.right.getLeftMostRedex(true,false,false);
        if (ret === null) return null;
        ret.next = new Application(this.left,ret.next);
        ret.addLeft(lParen);
        ret.addRight(rParen+this.right.toString(false));
        ret.addTexLeft(lParen);
        ret.addTexRight(rParen+this.right.toTexString(false));
        return ret;
      }
    } else {
      // untyped
      let apps:Application[] = [this];
      let right:string[] = [""];
      let texRight:string[] = [""];
      while (true){
        let t = apps[apps.length-1];
        right.push(t.right.toString(false)+right[right.length-1]);
        texRight.push(t.right.toTexString(false)+right[texRight.length-1]);
        if (!(t.left instanceof Application)) break;
        apps.push(t.left);
      }
      // apps = [abc, ab]
      // right = ["","c","bc"]
      let ret = apps[apps.length-1].left.getLeftMostRedex(false,etaAllowed,false);
      while (apps.length>0) {
        let t = apps.pop();
        if (t.isBetaRedex()){
          ret = new BetaRedex(t);
        } else if (ret === null){
          // 右から次を作る
          ret = t.right.getLeftMostRedex(false,etaAllowed,false);
          if (ret !== null){
            let lstr = t.left.toString(true);
            ret.next = new Application(t.left,ret.next);
            ret.addLeft(lstr);
            ret.addRight("");
            ret.addTexLeft(t.left.toTexString(false));
            ret.addTexRight("");
          }
        } else {
          // 前のから次を作る
          ret.next = new Application(ret.next,t.right);
          ret.addLeft("");
          ret.addRight(t.right.toString(false));
          ret.addTexLeft("");
          ret.addTexRight(t.right.toTexString(false));
        }
        right.pop();
        texRight.pop();
      }
      if (ret === null) return null;
      if (!noParens){
        ret.addLeft("(");
        ret.addRight(")");
        ret.addTexLeft("(");
        ret.addTexRight(")");
      }
      return ret;
    }
  }
  public extractMacros():Expression{
    return new Application(this.left.extractMacros(),this.right.extractMacros());
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

  public getRedexes(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex[]{
    if (typed) return [];
    else throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    if (typed) return null;
    else throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
  public extractMacros():Expression{
    return new List(this.head.extractMacros(),this.tail.extractMacros());
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
  public getRedexes(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex[]{
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
        "[then]"+this.ifTrue.toString(true)+"[else]"+this.ifFalse.toString(true)+")",
        "({\\bf if}~",
        "~{\\bf then}~"+this.ifTrue.toTexString(true)+"~{\\bf else}~"+this.ifFalse.toTexString(true)+")",
        (prev)=>(new If(prev,this.ifTrue,this.ifFalse)));
    }
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

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
      let ret = this.state.getLeftMostRedex(true,false,false);
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
  public extractMacros():Expression{
    return new If(this.state.extractMacros(),this.ifTrue.extractMacros(),this.ifFalse.extractMacros());
  }
}

// let in
class Let extends Expression{
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
  public getRedexes(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

    // (let)
    return [new TypedRedex(this,this.right.substitute(this.boundvar,this.left),"let")];
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

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
    let contentExpr:Expression = parseSymbols(content,typed);
    let restExpr:Expression = parseSymbols(tokens,typed);
    return new Let(boundvar,contentExpr,restExpr);
  }
  public extractMacros():Expression{
    return new Let(this.boundvar,this.left.extractMacros(),this.right.extractMacros());
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
        this.state.getRedexes(true,false,true),
        "([case]",
        "[of][nil]->"+this.ifNil+" | "+this.head+"::"+this.tail+"->"+this.ifElse+")",
        "({\\bf case} ",
        " {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString(true)+" | "+this.head.toTexString(true)+"::"+this.tail.toTexString(true)+" \\Rightarrow "+this.ifElse.toTexString(true)+")",
        (prev)=>(new Case(prev,this.ifNil,this.head,this.tail,this.ifElse)));
    }
  }
  public getLeftMostRedex(typed:boolean,etaAllowed?:boolean):Redex{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);
    if (this.state instanceof Nil){
      // (case2)
      return new TypedRedex(this,this.ifNil,"case2");
    } else if (this.state instanceof List){
      // (case3)
      return new TypedRedex(this,this.ifElse.substitute(this.head,this.state.head).substitute(this.tail,this.state.tail),"case3");
    } else {
      // (case1)
      let ret = this.state.getLeftMostRedex(true,false,true);
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
}

// 不動点演算子 [fix] x.M
class Fix extends Expression{
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
  public getRedexes(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex[]{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

    // (fix)
    return [new TypedRedex(this,this.expr.substitute(this.boundvar, new Fix(new Variable(this.boundvar.name),this.expr)),"fix")];
  }
  public getLeftMostRedex(typed:boolean,etaAllowed:boolean,noParens:boolean):Redex{
    if (!typed) throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className);

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

    let contentExpr:Expression = parseSymbols(tokens,typed);
    return new Fix(boundvar,contentExpr);
  }
  public extractMacros():Expression{
    return new Fix(this.boundvar,this.expr.extractMacros());
  }
}