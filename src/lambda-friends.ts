import { Expression, Macro, makeAST, Redex, parseLMNtal } from "./expression";
import { Type, TypeUntyped, TypeVariable, TypeEquation } from "./type";
import { ReductionNode, GraphNode } from "./graph";

export class LambdaFriends{
  expr:Expression;
  typed:boolean;
  curStep: number;
  type:Type;
  allowMultipleEdges:boolean;
  proofTree:string;
  processTex:string;
  original:Expression;
  etaAllowed:boolean;
  root:ReductionNode;
  curNodes:ReductionNode[];
  nextRedexes:Redex[];
  nextLeftMostRedex:Redex;
  static nextLinkID:number;
  constructor(str:string,typed:boolean,etaAllowed:boolean,allowMultipleEdges:boolean){
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
    this.allowMultipleEdges = allowMultipleEdges;
    this.processTex = "\\begin{eqnarray*}\n&& ";
    this.curStep = 0;
    this.root = ReductionNode.makeRoot(this.expr,this.typed,this.etaAllowed,this.allowMultipleEdges);
    this.curNodes = [this.root];
    this.nextRedexes = undefined;
  }

  public getRedexes(){
    if (this.nextRedexes) return this.nextRedexes;
    return this.nextRedexes = this.expr.getRedexes(this.typed,this.etaAllowed, true).sort(Redex.compare);
  }
  
  public getLeftMostRedex(){
    if (this.typed) return (this.getRedexes()[0] || null);
    if (this.nextLeftMostRedex) return this.nextLeftMostRedex;
    return this.nextLeftMostRedex = this.expr.getLeftMostRedex(this.typed,this.etaAllowed,true);
  }

  public reduction(redex?:Redex):string{
    if (redex === undefined){
      // 簡約基指定のない場合、最左簡約
      redex = this.getLeftMostRedex();
      if (!redex) return null;
    }
    this.expr = redex.next;
    this.nextRedexes = undefined;
    this.nextLeftMostRedex = undefined;
    this.processTex += redex.toTexString();
    let ret:string;
    if (redex.type === "macro"){
      this.processTex += " \\\\\n&\\equiv& ";
      ret = "-: (macro) = " + this.expr.toString(true);
    } else {
      this.processTex += " \\\\\n&\\longrightarrow_{"+redex.getTexRule()+"}& ";
      ret = ++this.curStep+": ("+redex.rule+") --> " + this.expr.toString(true);
    }
    if (!this.hasNext()){
      ret += "    (normal form)\n";
      let n = this.parseChurchNum();
      if (n!==null) ret += "  = "+n+" (as nat)\n";
      let b = this.parseChurchBool();
      if (b!==null) ret += "  = "+b+" (as bool)\n";
      ret = ret.slice(0,-1);
    }
    return ret;
  }

  // グラフのノードを新たに1つ展開する（限界深度を指定してもよい）
  public deepen(maxDepth?:number):{nodes:ReductionNode[],edges:{from:ReductionNode,to:ReductionNode}[]}{
    if (this.curNodes.length===0){
      // 展開完了
      return null;
    }
    let t = this.curNodes.shift();
    if (maxDepth!==undefined && t.depth>=maxDepth){
      // 限界深度に到達
      this.curNodes.push(t);
      return null;
    }
    let ret = t.visit();
    for (let n of ret.nodes){
      this.curNodes.push(n);
    }
    return ret;
  }

  public hasNext():boolean{
    return this.getLeftMostRedex() !== null;
  }

  // 未展開のノードがまだあるか
  public hasNodes():boolean{
    return this.curNodes.length>0;
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
    let lf = new LambdaFriends(l,typed,false,false); // ????
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

  public static graph2LF(str:string,allowMultipleEdges:boolean){
    return GraphNode.search(GraphNode.parse(str),allowMultipleEdges);
  }

  public static lmntal2LF(str:string){
    return new LambdaFriends(parseLMNtal(str).toString(true),false,false,false);
  }

  // typedだったらとりあえずnullを返すことにする
  public toLMNtal():string{
    LambdaFriends.nextLinkID = 0;
    if (this.typed) return null;
    else return this.original.toLMNtal();
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
