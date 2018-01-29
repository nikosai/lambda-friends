import { Expression, makeAST, makeUntypedAST, Macro } from "./expression";
import { Type } from "./type";

export class LambdaFriends{
  static output:Function = console.log;
  private expr:Expression;
  private typed:boolean;
  private type:Type;
  constructor(str:string,typed:boolean){
    this.typed = typed;
    if (typed){
      this.expr = makeAST(str);
      this.type = this.expr.getType();
    } else {
      this.expr = makeUntypedAST(str);
      this.type = undefined;
    }
    if (this.expr instanceof Macro){
      var e:Macro = this.expr;
      while (true){
        LambdaFriends.output("<"+e.name+"> is defined as "+e.expr+" : "+(typed?this.type:"Untyped")+"\n");
        if (!(e.expr instanceof Macro)) break;
        else e = e.expr;
      }
    }
  }

  public continualReduction(step?:number,etaAllowed?:boolean):string{
    if (step === undefined) step = 100;
    if (this.typed){
      var result = this.expr.continualReduction(step);
      this.expr = result.expr;
      return result.str;
    } else {
      if (etaAllowed===undefined) etaAllowed = false;
      var result = this.expr.continualUntypedReduction(step,etaAllowed);
      this.expr = result.expr;
      return result.str;
    }
  }

  public hasNext(etaAllowed?:boolean):boolean{
    if (this.typed){
      return this.expr.hasNext();
    } else {
      if (etaAllowed===undefined) etaAllowed = false;
      return !this.expr.isNormalForm(etaAllowed);
    }
  }

  public static fileInput(textData:string,typed:boolean){
    var lines = textData.split("\n");
    for (var l of lines){
      l = l.split("#")[0].trim();
      if (l==="") continue;
      try{
        var lf = new LambdaFriends(l,typed);
      }catch(e){
        LambdaFriends.output(e.toString());
      }
    }
  }

  public isMacro():boolean{
    return this.expr instanceof Macro;
  }
}