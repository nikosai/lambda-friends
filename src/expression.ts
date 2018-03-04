import { Type, TypeFunc, typeInt, TypeInt, typeBool, TypeBool, TypeEquation, TypeList, TypeVariable } from "./type";
import { LambdaParseError, SubstitutionError, ReductionError, MacroError, TypeError, TexError } from "./error";

export function parseConst(str: string):Symbol{
  switch (str){
    case "nil":
      return nil;
    case "false":
    case "true":
      return new ConstBool(str==="true");
    case "if":
    case "then":
    case "else":
    case "let":
    case "in":
    case "case":
    case "of":
      return new Symbol(str);
  }
  if (str.match(/^\d+$|^-\d+$/)!==null){
    return new ConstInt(parseInt(str));
  } else {
    return new ConstOp(str); // fail -> null
  }
}

export function makeUntypedAST(str: string):Expression{
  var strs:string[] = str.split(/\s*/).join("").split("");
  var tokens:Symbol[] = [];
  while (strs.length>0){
    var c = strs.shift();
    switch (c){
      case "<":
        var content = "";
        while (true){
          if (strs.length==0) throw new LambdaParseError("Too many LANGLE '<'");
          c = strs.shift();
          if (c===">") break;
          else content += c;
        }
        tokens.push(Macro.get(content,false));
        break;
      case "=":
        // Macro definition
        var cmds = str.split("=");
        var name = cmds.shift().trim();
        var s = cmds.join("=");
        return Macro.add(name,s,false);
      default:
        tokens.push(new Symbol(c));
    }
  }
  // console.log(tokens);
  var ret = makeUntypedASTfromSymbols(tokens);
  ret.isTopLevel = true;
  return ret;
}

export function makeUntypedASTfromSymbols(tokens: Symbol[]):Expression{
  var left:Expression = null;
  while (tokens.length>0){
    // 最初のSymbol
    var first:Symbol = tokens.shift();
    if (first instanceof Macro){
      if (left===null) left = first;
      else left = new Application(left, first);
      continue;
    }
    switch(first.name){
      case "\\":
      case "\u00a5":
      case "λ":
        // abst
        if (left===null) return LambdaAbstraction.parse(tokens);
        else return new Application(left, LambdaAbstraction.parse(tokens));
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
        var contentExpr:Expression = makeUntypedASTfromSymbols(content);
        if (left===null) left = contentExpr;
        else left = new Application(left, contentExpr);
        break;
      default:
        if (first.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+first+"'");
        // variable
        if (left===null) left = new Variable(first.name);
        else left = new Application(left, new Variable(first.name));
    }
  }
  if (left===null) throw new LambdaParseError("No contents in Expression");
  return left;
}

export function makeAST(str: string):Expression{
  var strs:string[] = str.split(/\s*/).join("").split("");
  var tokens:Symbol[] = [];
  while (strs.length>0){
    var c = strs.shift();
    switch (c){
      case "<":
        var content = "";
        while (true){
          if (strs.length==0) throw new LambdaParseError("Too many LANGLE '<'");
          c = strs.shift();
          if (c===">") break;
          else content += c;
        }
        tokens.push(Macro.get(content,true));
        break;
      case "[":
        var content = "";
        while (true){
          if (strs.length==0) throw new LambdaParseError("Too many LBRACKET '['");
          c = strs.shift();
          if (c==="]") break;
          else content += c;
        }
        var result = parseConst(content);
        if (result===null)
          throw new LambdaParseError("Unknown Const: ["+content+"]");
        tokens.push(result);
        break;
      case "=":
        // Macro definition
        var cmds = str.split("=");
        var name = cmds.shift().trim();
        var s = cmds.join("=");
        return Macro.add(name,s,true);
      default:
        tokens.push(new Symbol(c));
    }
  }
  // console.log(tokens);
  var ret = makeASTfromSymbols(tokens);
  ret.getType();
  ret.isTopLevel = true;
  return ret;
}

export function makeASTfromSymbols(tokens: Symbol[]):Expression{
  var left:Expression = null;
  while (tokens.length>0){
    // 最初のSymbol
    var first:Symbol = tokens.shift();
    if (first instanceof Const || first instanceof Nil || first instanceof Macro){
      if (left===null) left = first;
      else left = new Application(left, first);
      continue;
    }
    
    switch(first.name){
      case "\\":
      case "\u00a5":
      case "λ":
        // abst
        if (left===null) return LambdaAbstraction.parse(tokens);
        else return new Application(left, LambdaAbstraction.parse(tokens));
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
        var contentExpr:Expression = makeASTfromSymbols(content);
        if (left===null) left = contentExpr;
        else left = new Application(left, contentExpr);
        break;
      case "if":
        // if statement
        var state:Symbol[] = [];
        var i_num=0, t_num=0, e_num=0;
        while (true){
          if (tokens.length==0) throw new LambdaParseError("Illegal If statement");
          var t = tokens.shift();
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
        var stateExpr = makeASTfromSymbols(state);
        var ifTrue:Symbol[] = [];
        i_num=0, t_num=0, e_num=0;
        while (true){
          if (tokens.length==0) throw new LambdaParseError("Illegal If statement");
          var t = tokens.shift();
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
        var ifTrueExpr = makeASTfromSymbols(ifTrue);
        var ifFalseExpr = makeASTfromSymbols(tokens);
        return new If(stateExpr,ifTrueExpr,ifFalseExpr);
      case "let":
        // let statement
        var t = tokens.shift();
        if (t.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var boundVal = new Variable(t.name);
        if (tokens.shift().name!=="=")
          throw new LambdaParseError("'=' is expected");
        var content:Symbol[] = [];
        var i=1;
        while (true){
          // console.log(i);
          if (tokens.length==0) throw new LambdaParseError("Illegal Let statement");
          var t = tokens.shift();
          if (t.name==="let") i++;
          else if (t.name==="in") i--;
          if (i==0) break;
          content.push(t);
        }
        var contentExpr:Expression = makeASTfromSymbols(content);
        var restExpr:Expression = makeASTfromSymbols(tokens);
        return new Let(boundVal,contentExpr,restExpr);
      case "case":
        // case statement: [case] M [of] [nil] -> M | x::x -> M
        var state:Symbol[] = [];
        var i=1;
        while (true){
          if (tokens.length==0) throw new LambdaParseError("Illegal Case statement");
          var t = tokens.shift();
          if (t.name==="case") i++;
          else if (t.name==="of") i--;
          if (i==0) break;
          state.push(t);
        }
        var stateExpr:Expression = makeASTfromSymbols(state);
        var t = tokens.shift();
        if (t.name!=="nil")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var t = tokens.shift();
        if (t.name!=="-")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var t = tokens.shift();
        if (t.name!==">")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var ifNil:Symbol[] = [];
        var i=1;
        while (true){
          if (tokens.length==0) throw new LambdaParseError("Too many [case]");
          var t = tokens.shift();
          if (t.name==="case") i++;
          else if (t.name==="|") i--;
          if (i==0) break;
          ifNil.push(t);
        }
        var ifNilExpr:Expression = makeASTfromSymbols(ifNil);
        var head = new Variable(tokens.shift().name);
        if (head.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+head.name+"'");
        var t = tokens.shift();
        if (t.name!==":")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var t = tokens.shift();
        if (t.name!==":")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var tail = new Variable(tokens.shift().name);
        if (tail.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+tail.name+"'");
        var t = tokens.shift();
        if (t.name!=="-")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var t = tokens.shift();
        if (t.name!==">")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        var ifElseExpr = makeASTfromSymbols(tokens);
        return new Case(stateExpr,ifNilExpr,head,tail,ifElseExpr);
      case ":":
        // list
        var t = tokens.shift();
        if (t.name!==":")
          throw new LambdaParseError("Unexpected token: '"+t+"'");
        return new List(left,makeASTfromSymbols(tokens));
      default:
        if (first.name.match(/^[A-Za-z]$/)===null)
          throw new LambdaParseError("Unexpected token: '"+first+"'");
        // variable
        if (left===null) left = new Variable(first.name);
        else left = new Application(left, new Variable(first.name));
    }
  }
  if (left===null) throw new LambdaParseError("No contents in Expression");
  return left;
}

export class ReductionResult{
  constructor(public expr: Expression, public str: string, public hasNext:boolean){}
}

export abstract class Redex{
  type: string;
  left: string;
  right: string;
  abstract content: Expression;
  abstract next: Expression;
  constructor(type:string){
    this.left = "";
    this.right = "";
    this.type = type;
  }
  public addLeft(s:string){
    this.left = s + this.left;
  }
  public addRight(s:string){
    this.right += s;
  }
  public static makeNext(es:Redex[],prefix:string,suffix:string,func: (prev:Expression)=>Expression):Redex[]{
    var ret:Redex[] = [].concat(es);
    for (var e of ret){
      e.next = func(e.next);
      e.addLeft(prefix);
      e.addRight(suffix);
    }
    return ret;
  }
  public abstract toString():string;
}

export class BetaRedex extends Redex{
  content:Application;
  next:Expression;
  la:LambdaAbstraction;
  arg:Expression;
  constructor(e:Application){
    super("beta");
    this.content = e;
    this.la = <LambdaAbstraction>e.left;
    this.next = this.la.expr.substitute(this.la.boundval,e.right);
    this.arg = e.right;
  }
  public toString():string{
    return this.left+"(\\["+this.la.boundval+"]."+this.la.expr+")["+this.arg+"]"+this.right;
  }
}

export class EtaRedex extends Redex{
  content:LambdaAbstraction;
  next:Expression;
  app:Application;
  constructor(e:LambdaAbstraction){
    super("eta");
    this.content = e;
    this.app = <Application>e.expr;
    this.next = this.app.left;
  }
  public toString():string{
    return this.left+"[(\\"+this.content.boundval+"."+this.app+")]"+this.right;
  }
}

export class MacroRedex extends Redex{
  next:Expression;
  content:Macro;
  constructor(e:Macro){
    super("macro");
    this.content = e;
    this.next = e.expr;
  }
  public toString():string{
    return this.left+"[<"+this.content.name+">]"+this.right;
  }
}

export class TypeResult{
  constructor(public eqs:TypeEquation[], public proofTree:string){}
}

// ラムダ項（抽象クラス）
export abstract class Expression{
  className: string;
  freevals: Variable[];
  public isTopLevel = false; 
  // type: Type;

  constructor(className:string){
    this.className = className;
  }

  public continualReduction(n:number):ReductionResult{
    var cur:Expression = this;
    var str = cur.toString()+" : "+cur.getType()+"\n";
    for (var i=0; i<n; i++){
      var next = cur.reduction();
      if (cur.equals(next)) break;
      cur = next;
      str += " ==> " + next.toString() + "\n";
    }
    return new ReductionResult(cur,str,cur.hasNext());
  }

  public hasNext():boolean{
    return !this.equals(this.reduction());
  }

  public continualUntypedReduction(n:number, etaAllowed:boolean):ReductionResult{
    var cur:Expression = this;
    var str = cur.toString()+" : Untyped\n";
    for (var i=0; i<n; i++){
      var rs = cur.getRedexes(etaAllowed);
      if (rs.length===0) break;
      cur = rs.pop().next;
      str += " ==> " + cur.toString() + "\n";
    }
    return new ReductionResult(cur,str,cur.isNormalForm(etaAllowed));
  }

  public isNormalForm(etaAllowed:boolean):boolean{
    return this.getRedexes(etaAllowed).length===0;
  }

  public getType():Type{
    TypeVariable.maxId=undefined;
    var target = TypeVariable.getNew()
    var eqs = this.getEquations([],target).eqs;
    var ret = TypeEquation.get(target, TypeEquation.solve(eqs));
    var vs = ret.getVariables();
    // 't0,'t1,'t2,... から 'a,'b,'c,... に変換
    var vars:TypeVariable[] = [];
    for (var v of vs){
      if (!TypeVariable.contains(vars,v)) vars.push(v);
    }
    var i=0;
    for (var v of vars){
      ret.replace(v, TypeVariable.getAlphabet(i));
      i++;
    }
    return ret;
  }

  public abstract toString():string;
  public abstract toTexString():string;
  public abstract getFV():Variable[];
  public abstract substitute(x:Variable, expr:Expression):Expression;
  public abstract reduction():Expression;
  public abstract equals(expr:Expression):boolean;
  public abstract equalsAlpha(expr:Expression):boolean;
  public abstract getEquations(gamma:Variable[], type:Type):TypeResult;
  public abstract getRedexes(etaAllowed:boolean):Redex[];
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
  public reduction():Expression{
    return this;
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    throw new TypeError("Undefined Type");
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Symbols must not appear in parsed Expression")
  }
}

// 変数 x
export class Variable extends Symbol{
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
    for (var g of gamma){
      if (g.equals(this)){
        // (var)
        var str = "\\AxiomC{}\n";
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
      var ret:Variable[] = [];
      for (var v of a){
        ret.push(v);
      }
      for (var v of Variable.dif(b,a)){
        ret.push(v);
      }
      return ret;
    } else {
      return Variable.union(Variable.union(a,b),c);
    }
  }

  static dif(a:Variable[],b:Variable[]){
    var ret:Variable[] = [];
    for (var ta of a){
      if (!Variable.contains(b,ta)) ret.push(ta);
    }
    return ret;
  }

  static contains(a:Variable[],b:Variable){
    for (var ta of a){
      if (ta.equals(b)){
        return true;
      }
    }
    return false;
  }

  static gammaToTexString(gamma:Variable[]):string{
    if (gamma.length===0) return "";
    var ret = gamma[0].name + " : " + gamma[0].type.toTexString();
    for (var i=1; i<gamma.length; i++){
      ret += ",~" + gamma[i].name + " : " + gamma[i].type.toTexString();
    }
    return ret;
  }

  static getNew(used:Variable[]){
    var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    for (var a of alphabet){
      var z = new Variable(a);
      if (!Variable.contains(used,z)){
        return z;
      }
    }
    throw new SubstitutionError("No more Variables available");
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    return [];
  }
}

// 定数 c
export abstract class Const extends Symbol {
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
    var str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(con)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(this.type,type)], str);
  }
  public toTexString():string{
    return this.name+"^{"+this.type.toTexString()+"}";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
}

// int型定数 c^{int}
export class ConstInt extends Const{
  value:number;
  type:TypeInt;
  constructor(value:number){
    super(value.toString(), "ConstInt");
    this.value = value;
    this.type = typeInt;
  }
}

// bool型定数 c^{bool}
export class ConstBool extends Const{
  value:boolean;
  type:TypeBool;
  constructor(value:boolean){
    super(value.toString(), "ConstBool");
    this.value = value;
    this.type = typeBool;
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
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeInt));
        break;
      case "-":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstInt(x.value-y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeInt));
        break;
      case "*":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstInt(x.value*y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeInt));
        break;
      case "/":
        this.value = (x:ConstInt,y:ConstInt)=>{if (y.value===0) throw new ReductionError("Dividing by '0' is not allowed"); else return new ConstInt(Math.floor(x.value/y.value))};
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeInt));
        break;
      case "%":
        this.value = (x:ConstInt,y:ConstInt)=>{if (y.value===0) throw new ReductionError("Dividing by '0' is not allowed"); else return new ConstInt(x.value-Math.floor(x.value/y.value)*4)};
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeInt));
        break;
      case "<":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value<y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case ">":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value>y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case "<=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value<=y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case ">=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value>=y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case "==":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case "!=":
        this.value = (x:ConstInt,y:ConstInt)=>(new ConstBool(x.value!=y.value));
        this.type = new TypeFunc(typeInt,new TypeFunc(typeInt,typeBool));
        break;
      case "eq":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "eq":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value==y.value));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "xor":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value!=y.value));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "or":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value||y.value));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "and":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(x.value&&y.value));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "nor":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(!(x.value||y.value)));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      case "nand":
        this.value = (x:ConstBool,y:ConstBool)=>(new ConstBool(!(x.value&&y.value)));
        this.type = new TypeFunc(typeBool,new TypeFunc(typeBool,typeBool));
        break;
      default:
        throw new LambdaParseError("Undefined function: "+funcName);
    }
  }
}

// 空リスト nil
export class Nil extends Symbol{
  static instance:Nil;
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }
  private constructor(){
    super("nil","Nil");
    this.freevals=[];
  }
  static getInstance():Nil{
    if (Nil.instance === undefined){
      return Nil.instance = new Nil();
    } else return Nil.instance;
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (nil)
    var t = TypeVariable.getNew();
    var nType = new TypeList(t);
    var str = "\\AxiomC{}\n";
    str += "\\RightLabel{\\scriptsize(nil)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.name+" : "+nType.toTexString()+" $}\n";
    return new TypeResult([new TypeEquation(type,nType)],str);
  }
  public toTexString():string{
    return "{\\rm "+this.name+"}";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
}
export var nil:Nil = Nil.getInstance();

// マクロ定義
export class Macro extends Symbol{
  expr:Expression;
  typed: boolean;
  static map:{[key: string]:Macro} = {};
  static mapUntyped:{[key: string]:Macro} = {};
  private constructor(name:string, expr:Expression, typed:boolean){
    super(name, "Macro");
    this.freevals = [];
    this.expr = expr;
    this.typed = typed;
  }
  public static add(name:string, str:string, typed:boolean):Macro{
    if (typed){
      var ret = makeAST(str);
      if (ret.getFV().length !== 0){
        throw new MacroError("<"+name+"> contains free variables: "+ret.getFV());
      }
      Macro.map[name] = new Macro(name, ret, typed);
      return Macro.map[name];
    } else {
      var ret = makeUntypedAST(str);
      if (ret.getFV().length !== 0){
        throw new MacroError("<"+name+"> contains free variables: "+ret.getFV());
      }
      Macro.mapUntyped[name] = new Macro(name, ret, typed);
      return Macro.mapUntyped[name];
    }
  }
  public static get(name:string, typed:boolean):Macro{
    var ret:Macro;
    if (typed){
      ret = Macro.map[name];
    } else {
      ret = Macro.mapUntyped[name];
    }
    if (ret === undefined){
      return new Macro(name,undefined,typed);
    } else {
      return new Macro(name,ret.expr,typed);
    }
  }
  public substitute(x:Variable, expr:Expression):Expression{
    return this;
  }

  public toString():string{
    return "<"+this.name+">";
  }

  public reduction():Expression{
    if (this.expr === undefined) return this;
    else return this.expr;
  }
  public equalsAlpha(expr:Expression):boolean{
    // 再検討の余地あり
    if (this.expr === undefined) return this.equals(expr)
    else return this.expr.equalsAlpha(expr);
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // ????
    if (this.expr === undefined) throw new TypeError(this+" is undefined.")
    else return this.expr.getEquations(gamma,type);
  }
  public toTexString():string{
    return "\\overline{\\bf "+this.name+"}";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    if (this.expr === undefined) return [];
    else return [new MacroRedex(this)];
  }
}

// ラムダ抽象 \x.M
export class LambdaAbstraction extends Expression{
  boundval: Variable;
  expr: Expression;

  constructor(boundval:Variable, expr:Expression){
    super("LambdaAbstraction");
    this.freevals = undefined;
    this.boundval = boundval;
    this.expr = expr;
  }
  static parse(tokens:Symbol[]):LambdaAbstraction{
    var boundvals:Variable[] = [];
    while (tokens.length>0){
      var t:Symbol = tokens.shift();
      if (t.name==="."){
        var expr = makeASTfromSymbols(tokens);
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
    var boundvals = [this.boundval];
    var expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval);
      expr = expr.expr;
    }
    var str = "\\"+boundvals.join("")+".";
    if (expr instanceof Application){
      var expr1 = expr.left;
      var str1 = expr.right.toString();
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
      var uniFV = Variable.union(this.expr.getFV(),expr.getFV());
      var z = Variable.getNew(uniFV);
      return new LambdaAbstraction(z,this.expr.substitute(this.boundval,z)).substitute(y,expr);
    }
  }
  public reduction():Expression{
    return this;
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof LambdaAbstraction) && (expr.boundval.equals(this.boundval)) && (expr.expr.equals(this.expr));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof LambdaAbstraction)) return false;
    if (this.equals(expr)) return true;
    var x = this.boundval;
    var m = this.expr;
    var y = expr.boundval;
    var n = expr.expr;
    return (!Variable.contains(m.getFV(),y) && n.equalsAlpha(m.substitute(x,y)));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (abs)
    var t0 = TypeVariable.getNew();
    var t1 = TypeVariable.getNew();
    this.boundval.type = t1;
    var next = this.expr.getEquations(gamma.concat(this.boundval),t0);
    var str = next.proofTree;
    str += "\\RightLabel{\\scriptsize(abs)}\n";
    str += "\\UnaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(next.eqs.concat(new TypeEquation(type,new TypeFunc(t1,t0))),str);
  }
  public toTexString():string{
    var boundvals = [this.boundval.toTexString()];
    var expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval.toTexString());
      expr = expr.expr;
    }
    var str = "(\\lambda "+boundvals.join("")+".";
    if (expr instanceof Application){
      var expr1 = expr.left;
      var str1 = expr.right.toTexString();
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
  public getRedexes(etaAllowed:boolean):Redex[]{
    var boundvals = [this.boundval];
    var expr = this.expr;
    while(expr instanceof LambdaAbstraction){
      boundvals.push(expr.boundval);
      expr = expr.expr;
    }
    var ret = Redex.makeNext(this.expr.getRedexes(etaAllowed),"(\\"+boundvals.join("")+".",")",(prev)=>(new LambdaAbstraction(this.boundval,prev)));
    if (etaAllowed && this.isEtaRedex()){
      ret.push(new EtaRedex(this));
    }
    return ret;
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

  public toString():string{
    var expr = this.left;
    var str = this.right.toString();
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

  public reduction():Expression{
    if (this.left instanceof LambdaAbstraction){
      // (app2)
      return this.left.expr.substitute(this.left.boundval,this.right);
    } else if (this.left instanceof Application 
      && this.left.left instanceof ConstOp
      && this.left.right instanceof Const){
      var op = this.left.left;
      var left = this.left.right;
      var right = this.right;
      if (right instanceof Const){
        // (app5)
        if (op.type.left.equals(left.type) && op.type.right instanceof TypeFunc && op.type.right.left.equals(right.type)){
          return op.value(left,right);
        } else {
          throw new ReductionError(op.type+" cannot handle "+left.type+" and "+right.type+" as arguments");
        }
      } else {
        // (app4)
        return new Application(this.left,right.reduction());
      }
    } else if (this.left instanceof ConstOp) {
      // (app3)
      return new Application(this.left, this.right.reduction());
    } else {
      // (app1)
      return new Application(this.left.reduction(),this.right);
    }
  }

  public equals(expr:Expression):boolean{
    return (expr instanceof Application) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof Application) && (expr.left.equalsAlpha(this.left)) && (expr.right.equalsAlpha(this.right));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (app)
    var t1 = TypeVariable.getNew();
    var nextL = this.left.getEquations(gamma,new TypeFunc(t1,type));
    var nextR = this.right.getEquations(gamma,t1);
    var str = nextL.proofTree + nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(app)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString():string{
    var expr = this.left;
    var str = this.right.toTexString();
    while (expr instanceof Application){
      str = expr.right.toTexString()+str;
      expr = expr.left;
    }
    str = expr.toTexString()+str;
    if (!this.isTopLevel) str = "("+str+")";
    return str;
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    var ret = Redex.makeNext(this.left.getRedexes(etaAllowed),"(",")",(prev)=>(new Application(prev,this.right))).concat(Redex.makeNext(this.right.getRedexes(etaAllowed),"(",")",(prev)=>(new Application(this.left,prev))));
    if (this.isBetaRedex()){
      ret.push(new BetaRedex(this));
    }
    return ret;
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

  public reduction():Expression{
    return this;
  }
  
  public equals(expr:Expression):boolean{
    return (expr instanceof List) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof List) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (list) 再検討の余地あり？ 新しい型変数要る？
    var t = TypeVariable.getNew();
    var lt = new TypeList(t);
    var nextH = this.head.getEquations(gamma,t);
    var nextT = this.tail.getEquations(gamma,lt);
    var str = nextH.proofTree + nextT.proofTree;
    str += "\\RightLabel{\\scriptsize(list)}\n";
    str += "\\BinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+lt.toTexString()+" $}\n";
    return new TypeResult(nextH.eqs.concat(nextT.eqs, new TypeEquation(lt,type)),str);
  }
  public toTexString():string{
    return this.head.toTexString()+"::"+this.tail.toTexString();
  }

  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
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
    return this.freevals = Variable.union(this.state.getFV(),this.ifTrue.getFV(),this.ifFalse.getFV());
  }
  public toString():string{
    return "([if]"+this.state+"[then]"+this.ifTrue+"[else]"+this.ifFalse+")";
  }
  public substitute(y:Variable, expr:Expression):Expression{
    return new If(this.state.substitute(y,expr),this.ifTrue.substitute(y,expr),this.ifFalse.substitute(y,expr));
  }
  public reduction():Expression{
    if (this.state instanceof ConstBool){
      if (this.state.value){
        // (if2)
        return this.ifTrue;
      } else {
        // (if3)
        return this.ifFalse;
      }
    } else {
      // (if1)
      return new If(this.state.reduction(),this.ifTrue,this.ifFalse);
    }
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof If) && (expr.state.equals(this.state)) && (expr.ifTrue.equals(this.ifTrue)) && (expr.ifFalse.equals(this.ifFalse));
  }
  public equalsAlpha(expr:Expression):boolean{
    return (expr instanceof If) && (expr.state.equalsAlpha(this.state)) && (expr.ifTrue.equalsAlpha(this.ifTrue)) && (expr.ifFalse.equalsAlpha(this.ifFalse));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (if)
    var nextS = this.state.getEquations(gamma,typeBool);
    var nextT = this.ifTrue.getEquations(gamma,type);
    var nextF = this.ifFalse.getEquations(gamma,type);
    var str = nextS.proofTree+nextT.proofTree+nextF.proofTree;
    str += "\\RightLabel{\\scriptsize(if)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextT.eqs,nextF.eqs),str);
  }
  public toTexString():string{
    return "({\\bf if}~"+this.state.toTexString()+"~{\\bf then}~"+this.ifTrue.toTexString()+"~{\\bf else}~"+this.ifFalse.toTexString()+")";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
}

// let in
export class Let extends Expression{
  boundVal:Variable;
  left:Expression;
  right:Expression;
  constructor(boundVal:Variable, left:Expression, right:Expression){
    super("Let");
    this.boundVal = boundVal;
    this.left = left;
    this.right = right;
  }
  public getFV():Variable[]{
    if (this.freevals!==undefined) return this.freevals;
    var ret:Variable[] = [];
    for (var fv of this.right.getFV()){
      if (!fv.equals(this.boundVal)){
        ret.push(fv);
      }
    }
    return this.freevals = Variable.union(ret, this.left.getFV());
  }
  public toString():string{
    return "([let]"+this.boundVal+"[=]"+this.left+"[in]"+this.right+")";
  }
  public substitute(y:Variable, expr:Expression):Expression{
    var left = this.left.substitute(y,expr);
    if (this.boundVal.equals(y)){
      return new Let(this.boundVal,left,this.right);
    } else if (!Variable.contains(expr.getFV(),this.boundVal)){
      return new Let(this.boundVal,left,this.right.substitute(y,expr));
    } else {
      var uniFV = Variable.union(this.right.getFV(),expr.getFV());
      var z = Variable.getNew(uniFV);
      if (z.equals(y)){
        return new Let(z,left,this.right.substitute(this.boundVal,z));
      } else {
        return new Let(z,left,this.right.substitute(this.boundVal,z).substitute(y,expr));
      }
    }
  }
  public reduction():Expression{
    // (let)
    return this.right.substitute(this.boundVal,this.left);
  }
  public equals(expr:Expression):boolean{
    return (expr instanceof Let) && (expr.boundVal.equals(this.boundVal)) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
  }
  public equalsAlpha(expr:Expression):boolean{
    if (!(expr instanceof Let)) return false;
    if (this.equals(expr)) return true;
    var x = this.boundVal;
    var m = this.right;
    var y = expr.boundVal;
    var n = expr.right;
    return (!Variable.contains(m.getFV(),y) && n.equalsAlpha(m.substitute(x,y)));
  }
  public getEquations(gamma:Variable[],type:Type):TypeResult{
    // (let)
    var t1 = TypeVariable.getNew();
    this.boundVal.type = t1;
    var nextL = this.left.getEquations(gamma,t1);
    var nextR = this.right.getEquations(gamma.concat(this.boundVal),type);
    var str = nextL.proofTree+nextR.proofTree;
    str += "\\RightLabel{\\scriptsize(let)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextL.eqs.concat(nextR.eqs),str);
  }
  public toTexString():string{
    return "({\\bf let}~"+this.boundVal.toTexString()+" = "+this.left.toTexString()+"~{\\bf in}~"+this.right.toTexString()+")";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
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
    if (this.freevals!==undefined) return this.freevals;
    else return Variable.union(this.state.getFV(),this.ifNil.getFV(),Variable.dif(this.ifElse.getFV(),[this.head,this.tail]));
  }
  public toString():string{
    return "([case]"+this.state+"[of][nil]->"+this.ifNil+" | "+this.head+"::"+this.tail+"->"+this.ifElse+")";
  }
  public substitute(y:Variable, expr:Expression):Expression{
    var state = this.state.substitute(y,expr);
    var ifNil = this.ifNil.substitute(y,expr);
    if (this.head.equals(y) || this.tail.equals(y)){
      return new Case(state,ifNil,this.head,this.tail,this.ifElse);
    } else if (!Variable.contains(expr.getFV(),this.head)&&!Variable.contains(expr.getFV(),this.tail)){
      return new Case(state,ifNil,this.head,this.tail,this.ifElse.substitute(y,expr));
    } else {
      var head = this.head;
      var tail = this.tail;
      var ifElse = this.ifElse;
      if (Variable.contains(expr.getFV(),head)){
        var uniFV = Variable.union(this.ifElse.getFV(),expr.getFV());
        var z = Variable.getNew(uniFV);
        if (z.equals(y)){
          ifElse = ifElse.substitute(head,z);
        } else {
          ifElse = ifElse.substitute(head,z).substitute(y,expr);
        }
        head = z;
      }
      if (Variable.contains(expr.getFV(),tail)){
        var uniFV = Variable.union(this.ifElse.getFV(),expr.getFV());
        var z = Variable.getNew(uniFV);
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
  public reduction():Expression{
    if (this.state instanceof Nil){
      // (case2)
      return this.ifNil;
    } else if (this.state instanceof List){
      // (case3)
      return this.ifElse.substitute(this.head,this.state.head).substitute(this.tail,this.state.tail);
    } else {
      // (case1)
      return new Case(this.state.reduction(),this.ifNil,this.head,this.tail,this.ifElse);
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
    var t1 = TypeVariable.getNew();
    var lt1 = new TypeList(t1);
    this.head.type = t1;
    this.tail.type = lt1;
    var nextS = this.state.getEquations(gamma,lt1);
    var nextN = this.ifNil.getEquations(gamma,type);
    var nextE = this.ifElse.getEquations(gamma.concat(this.head,this.tail),type);
    var str = nextS.proofTree+nextN.proofTree+nextE.proofTree;
    str += "\\RightLabel{\\scriptsize(case)}\n";
    str += "\\TrinaryInfC{$"+Variable.gammaToTexString(gamma)+" \\vdash "+this.toTexString()+" : "+type.toTexString()+" $}\n";
    return new TypeResult(nextS.eqs.concat(nextN.eqs,nextE.eqs),str);
  }
  public toTexString():string{
    return "({\\bf case} "+this.state+" {\\bf of} {\\rm nil} \\Rightarrow "+this.ifNil.toTexString()+" | "+this.head.toTexString()+"::"+this.tail.toTexString()+" \\Rightarrow "+this.ifElse.toTexString()+")";
  }
  public getRedexes(etaAllowed:boolean):Redex[]{
    throw new ReductionError("Untyped Reduction cannot handle typeof "+this.className)
  }
}