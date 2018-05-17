import { Expression, Macro, makeAST, Redex } from "./expression";
import { Type, TypeUntyped, TypeVariable, TypeEquation } from "./type";

export class LambdaFriends{
  expr:Expression;
  typed:boolean;
  curStep: number;
  type:Type;
  proofTree:string;
  processTex:string;
  original:Expression;
  etaAllowed:boolean;
  static nextLinkID:number;
  constructor(str:string,typed:boolean,etaAllowed:boolean){
    let l = str.split("#")[0].trim();
    let names = [];
    while (true) {
      let ts = l.match(/^[^[]+?\s*=\s*/);
      if (ts === null) break;
      let t = ts[0];
      ts = l.split(t);
      ts.shift();
      l = ts.join(t);
      names.push(t.split(/\s*=\s*$/)[0]);
    }
    this.expr = makeAST(l,typed);
    this.original = this.expr;
    this.type = this.getType(typed);
    for (let name of names){
      Macro.add(name, this, typed);
    }
    this.typed = typed;
    this.etaAllowed = etaAllowed;
    this.processTex = "\\begin{eqnarray*}\n&& ";
    this.curStep = 0;
  }

  public getRedexes(){
    return this.expr.getRedexes(this.typed,this.etaAllowed, true).sort(Redex.compare);
  }

  public reduction(redex?:Redex):string{
    if (redex === undefined){
      // 簡約基指定のない場合、最左簡約
      let rs = this.getRedexes();
      if (rs.length===0) return null;
      redex = rs[0];
    }
    this.expr = redex.next;
    this.curStep++;
    this.processTex += redex.toTexString() + " \\\\\n&\\longrightarrow_{"+redex.getTexRule()+"}& ";
    let ret = this.curStep+": ("+redex.rule+") --> " + this.expr.toString(true);
    if (!this.hasNext()){
      ret += "    (normal form)\n";
      let n = this.parseChurchNum();
      if (n!==null) ret += "  = "+n+" (as nat)\n";
      let b = this.parseChurchBool();
      if (b!==null) ret += "  = "+b+" (as bool)\n";
      ret.slice(0,ret.length-1);
    }
    return ret;
  }

  public hasNext():boolean{
    return !this.expr.isNormalForm(this.typed,this.etaAllowed);
  }

  public getProofTree(){
    return "\\begin{prooftree}\n"+this.proofTree+"\\end{prooftree}";
  }

  public getProcessTex(){
    return this.processTex+this.expr.toTexString(true)+(this.hasNext()?"":"\\not\\longrightarrow")+"\n\\end{eqnarray*}";
  }

  public getType(typed:boolean):Type{
    if (!typed) return new TypeUntyped();
    TypeVariable.maxId=undefined;
    let target = TypeVariable.getNew();
    let typeResult = this.expr.getEquations([],target,true);
    let eqs = typeResult.eqs;
    this.proofTree = typeResult.proofTree;
    let ret = TypeEquation.get(target, TypeEquation.solve(eqs));
    let vs = ret.getVariables();
    // 't0,'t1,'t2,... から 'a,'b,'c,... に変換
    let vars:TypeVariable[] = [];
    for (let v of vs){
      if (!TypeVariable.contains(vars,v)) vars.push(v);
    }
    let i=0;
    for (let v of vars){
      ret.replace(v, TypeVariable.getAlphabet(i));
      i++;
    }
    return ret;
  }

  public static parseMacroDef(str:string, typed:boolean):{names:string[],expr:string,type:string}{
    let l = str.split("#")[0].trim();
    let names = [];
    while (true) {
      let ts = l.match(/^[^[]+?\s*=\s*/);
      if (ts === null) break;
      let t = ts[0];
      ts = l.split(t);
      ts.shift();
      l = ts.join(t);
      names.push(t.split(/\s*=\s*$/)[0]);
    }
    if (names.length===0) return null;
    let lf = new LambdaFriends(l,typed,undefined); // ???
    for (let name of names){
      Macro.add(name, lf, typed);
    }
    // let name = names.shift();
    // let ret = "<"+name+">"
    // while (names.length>0){
    //   let name = names.shift();
    //   ret += " and <"+name+">";
    // }
    // ret += " is defined as "+lf.expr+" : "+lf.type;
    return {names:names,expr:lf.expr.toString(true),type:lf.type.toString()};
  }

  // return: file input log
  public static fileInput(textData:string,typed:boolean):{defs:{names:string[],expr:string,type:string}[],errs:string[]}{
    let lines = textData.split("\n");
    let errors:string[] = [];
    let defs:{names:string[],expr:string,type:string}[] = [];
    for (let l of lines){
      try{
        let ret = LambdaFriends.parseMacroDef(l,typed);
        if (ret!==null) defs.push(ret);
      }catch(e){
        errors.push(e.toString());
      }
    }
    let indent = "* ";
    // let ret = "# File input completed.\n";
    // if (defs.length !== 0){
    //   ret += "## Finally, "+defs.length+" macros are successfully added.\n";
    //   ret += indent + defs.join("\n"+indent) + "\n\n";
    // }
    // if (errors.length !== 0){
    //   ret += "## Unfortunately, "+errors.length+" macros are rejected due to some errors\n";
    //   ret += indent + errors.join("\n"+indent) + "\n";
    // }
    return {defs:defs,errs:errors};
  }

  public static getMacroList(typed:boolean):string{
    let str = "";
    let map = Macro.getMap(typed);
    for (let key in map){
      let e = map[key];
      str += "<"+e.name+"> is defined as "+e.expr.toString(true)+" : "+e.type+"\n";
    }
    return str;
  }

  public static getMacroListAsObject(typed:boolean){
    return Macro.getMap(typed);
  }

  public static clearMacro(typed:boolean){
    return Macro.clear(typed);
  }

  // typedだったらとりあえずnullを返すことにする
  public toLMNtal():string{
    LambdaFriends.nextLinkID = 0;
    if (this.typed) return null;
    else return "root="+this.original.toLMNtal()+".";
  }
  
  public toString():string{
    let ret = this.expr.toString(true)+" : "+this.type;
    if (!this.hasNext()){
      ret += "    (normal form)\n";
      let n = this.parseChurchNum();
      if (n!==null) ret += "  = "+n+" (as nat)\n";
      let b = this.parseChurchBool();
      if (b!==null) ret += "  = "+b+" (as bool)\n";
      ret = ret.slice(0,ret.length-1);
    }
    return ret;
  }

  public getOriginalString():string{
    return this.original+" : "+this.type;
  }

  public parseChurchNum():number{
    return this.expr.parseChurchNum();
  }

  public parseChurchBool():boolean{
    return this.expr.parseChurchBool();
  }

  public static getNewLink():string{
    return "R"+(LambdaFriends.nextLinkID++)
  }
}