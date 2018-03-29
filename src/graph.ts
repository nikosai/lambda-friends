import { Redex, Expression } from "./expression";

export class ReductionNode{
  private expr: Expression;
  children:ReductionNode[] = [];
  parent:ReductionNode;
  id:number;
  isNormalForm:boolean;
  depth:number;
  static nodes:ReductionNode[];
  static edges:{from:ReductionNode,to:ReductionNode}[];
  static typed:boolean;
  static etaAllowed:boolean;
  static nextId:number;
  constructor(expr:Expression, parent:ReductionNode){
    this.expr = expr;
    this.expr.isTopLevel = true;
    this.parent = parent;
    this.id = ReductionNode.nextId;
    if (parent===null) this.depth = 0;
    else this.depth = parent.depth + 1;
    ReductionNode.nextId++;
    ReductionNode.nodes.push(this);
    this.isNormalForm = expr.isNormalForm(ReductionNode.typed,ReductionNode.etaAllowed);
  }

  static init(typed:boolean,etaAllowed:boolean){
    ReductionNode.typed = typed;
    ReductionNode.etaAllowed = etaAllowed;
    ReductionNode.nodes = [];
    ReductionNode.edges = [];
    ReductionNode.nextId = 0;
  }
  
  visit():{nodes:ReductionNode[],edges:{from:ReductionNode,to:ReductionNode}[]}{
    if (this.isNormalForm) return null;
    let rs = this.expr.getRedexes(ReductionNode.typed,ReductionNode.etaAllowed,true).sort(Redex.compare);
    let ans:{nodes:ReductionNode[],edges:{from:ReductionNode,to:ReductionNode}[]};
    ans = {nodes:[],edges:[]};
    for (let r of rs){
      let ret = ReductionNode.find(r.next);
      if (ret===null) {
        let n = new ReductionNode(r.next,this);
        this.children.push(n);
        ans.nodes.push(n);
        ans.edges.push({from:this,to:n});
        ReductionNode.edges.push({from:this,to:n});
      }
      else {
        this.children.push(ret);
        ans.edges.push({from:this,to:ret});
        ReductionNode.edges.push({from:this,to:ret});
      }
    }
    return ans;
  }

  public toString():string{
    return this.expr.toString();
  }

  static find(expr:Expression):ReductionNode{
    for (let n of ReductionNode.nodes){
      if (n.expr.equalsAlpha(expr)){
        return n;
      }
    }
    return null;
  }
}