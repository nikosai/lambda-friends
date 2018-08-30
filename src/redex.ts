import { Expression, Macro, Application, LambdaAbstraction } from "./expression";
import * as Util from "./util";

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
    if (ap===bp) {
      const f = (r:Redex)=>{
        if (r instanceof BetaRedex) return 0;
        if (r instanceof EtaRedex) return 1;
        if (r instanceof MacroRedex) return 2;
        if (r instanceof TypedRedex) return 3;
      };
      return f(a)-f(b);
    } else return ap-bp;
  }
}

// β基 : (\x.M)N
export class BetaRedex extends Redex{
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
    return Util.htmlEscape(this.left)+'(\\<span class="lf-beta lf-boundvar">'+Util.htmlEscape(this.la.boundvar.toString(false))+'</span>'+Util.htmlEscape(str)+')<span class="lf-beta lf-arg">'+Util.htmlEscape(this.arg.toString(false))+'</span>'+Util.htmlEscape(this.right);
  }
  public getTexRule():string{
    return "\\beta";
  }
}

// η基 : (\x.Mx)
export class EtaRedex extends Redex{
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
    return Util.htmlEscape(this.left)+'<span class="lf-eta">'+Util.htmlEscape(this.content.toString(this.left+this.right===""))+'</span>'+Util.htmlEscape(this.right);
  }
  public getTexRule():string{
    return "\\eta";
  }
}

// マクロ : <macro>
export class MacroRedex extends Redex{
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
    return Util.htmlEscape(this.left)+'<span class="lf-macro">&lt;'+Util.htmlEscape(this.content.name)+'&gt;</span>'+Util.htmlEscape(this.right);
  }
  public getTexRule():string{
    return "{\\rm m}";
  }
}

// 型付きの簡約基（マクロ以外）
export class TypedRedex extends Redex{
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
    return Util.htmlEscape(this.left)+'<span class="lf-typed">'+Util.htmlEscape(this.content.toString(this.left+this.right===""))+'</span>'+Util.htmlEscape(this.right);
  }
  public getTexRule():string{
    return "{\\rm ("+this.rule+")}";
  }
}