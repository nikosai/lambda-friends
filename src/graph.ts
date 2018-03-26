import { Redex, Expression } from "./expression";

export class ReductionNode{
  private expr: Expression;
  children:ReductionNode[] = [];
  parent:ReductionNode;
  id:number;
  isNormalForm:boolean;
  depth:number;
  static nodes:{[key:string]:ReductionNode};
  static edges:{from:string,to:string}[];
  static typed:boolean;
  static etaAllowed:boolean;
  static nextId:number;
  constructor(expr:Expression, parent:ReductionNode){
    this.expr = expr;
    this.parent = parent;
    this.id = ReductionNode.nextId;
    if (parent===null) this.depth = 0;
    else this.depth = parent.depth + 1;
    ReductionNode.nextId++;
    ReductionNode.nodes[expr.toString()] = this;
    this.isNormalForm = expr.isNormalForm(ReductionNode.typed,ReductionNode.etaAllowed);
  }

  static init(typed:boolean,etaAllowed:boolean){
    ReductionNode.typed = typed;
    ReductionNode.etaAllowed = etaAllowed;
    ReductionNode.nodes = {};
    ReductionNode.edges = [];
    ReductionNode.nextId = 0;
  }
  
  visit():{nodes:ReductionNode[],edges:{from:string,to:string}[]}{
    if (this.isNormalForm) return null;
    let rs = this.expr.getRedexes(ReductionNode.typed,ReductionNode.etaAllowed,true).sort(Redex.compare);
    let ans:{nodes:ReductionNode[],edges:{from:string,to:string}[]};
    ans = {nodes:[],edges:[]};
    for (let r of rs){
      let ret = ReductionNode.find(r.next.toString());
      ReductionNode.edges.push({from:this.expr.toString(),to:r.next.toString()});
      ans.edges.push({from:this.expr.toString(),to:r.next.toString()});
      if (ret===null) {
        let n = new ReductionNode(r.next,this);
        this.children.push(n);
        ans.nodes.push(n);
      }
      else this.children.push(ret);
    }
    return ans;
  }

  public toString():string{
    return this.expr.toString();
  }

  static find(str:string):ReductionNode{
    return ReductionNode.nodes[str] || null;
  }
}