import { Redex, Expression } from "./expression";
import { LambdaParseError, GraphParseError } from "./error";

export class GraphNode{
  info:Info;
  children:GraphNode[] = [];
  id:number;
  label:string;

  constructor(label:string, info:Info){
    this.label = label;
    this.info = info;
    this.id = info.nextId++;
    info.nodes.push(this);
  }

  public toString(){
    return this.label;
  }

  equalsShape(n:GraphNode):boolean{
    if (this.info.nodes.length !== n.info.nodes.length
      || this.info.edges.length !== n.info.edges.length) return false;
    return sub(this,n,[]);

    function sub(n1:GraphNode,n2:GraphNode,closed:{n1:GraphNode,n2:GraphNode}[]):boolean{
      if (n1.children.length !== n2.children.length) return false;
      closed.push({n1:n1,n2:n2});
      let cs2 = [].concat(n2.children);
      let ret = true;
      for (let c1 of n1.children){
        let flag = false;
        for (let i=0; i<cs2.length; i++){
          let c2 = cs2[i];
          for (let c of closed){
            if (c.n1.id === c1.id){
              flag = true;
              if (!(c.n2.id === c2.id)){
                ret = false;
              }
              break;
            }
          }
          if (flag) break;
          if (sub(c1,c2,closed)){
            flag = true;
            cs2.splice(i,1);
            break;
          }
        }
        if (!flag) {
          ret = false;
          break;
        }
      }
      for (let i=0; i<closed.length; i++){
        if (closed[i].n1.id === n1.id){
          closed.splice(i,1);
          return ret;
        }
      }
      throw new Error("Unexpected Error");
    }
  }

  static parse(str:string):GraphNode{
    let stmts = str.split(";");
    let info = new Info([],[],null,null,0);
    let nodes:{[key:string]:GraphNode}={};
    for (let stmt of stmts){
      let strs = stmt.split("->");
      let ps = str2nodes(strs[0]);
      for (let i=1; i<strs.length; i++){
        let cs = str2nodes(strs[i]);
        for (let p of ps){
          for (let c of cs){
            info.edges.push({from:p, to:c});
            p.children.push(c);
          }
        }
          
        ps = cs;
      }
    }
    if (nodes["root"]===undefined)
      throw new GraphParseError("there must be a 'root' node.")
    
    return nodes["root"];

    // input: " a, b, c "
    function str2nodes(str:string):GraphNode[]{
      let strs = str.split(",");
      let rets:GraphNode[] = [];
      for (let t of strs){
        t = t.trim();
        if (t==="") continue;
        if (!(/^[a-z][a-z0-9]*$/.test(t))) throw new GraphParseError("the name '"+t+"' cannot be used as node name, must be [a-z][a-z0-9]*");
        let n = nodes[t];
        if (n===undefined){
          n = nodes[t] = new GraphNode(t,info);
        }
        rets.push(n);
      }
      return rets;
    }
  }
}

class Info{
  constructor(public nodes:GraphNode[],
  public edges:{from:GraphNode,to:GraphNode}[],
  public typed:boolean,
  public etaAllowed:boolean,
  public nextId:number){}
}

export class ReductionNode extends GraphNode{
  private expr: Expression;
  isNormalForm:boolean;
  depth:number;
  parent:ReductionNode;
  constructor(expr:Expression, parent:ReductionNode, info:Info){
    super((expr = expr.extractMacros()).toString(true), info);
    this.expr = expr;
    this.parent = parent;
    if (parent===null) this.depth = 0;
    else this.depth = parent.depth + 1;
    this.isNormalForm = this.expr.isNormalForm(info.typed,info.etaAllowed);
  }

  static makeRoot(expr:Expression, typed:boolean, etaAllowed:boolean){
    return new ReductionNode(expr,null,new Info([],[],typed,etaAllowed,0))
  }
  
  visit():{nodes:ReductionNode[],edges:{from:ReductionNode,to:ReductionNode}[]}{
    if (this.isNormalForm) return {nodes:[],edges:[]};
    let rs = this.expr.getRedexes(this.info.typed,this.info.etaAllowed,true).sort(Redex.compare);
    let ans:{nodes:ReductionNode[],edges:{from:ReductionNode,to:ReductionNode}[]};
    ans = {nodes:[],edges:[]};
    for (let r of rs){
      let ret = this.find(r.next);
      if (ret===null) {
        let n = new ReductionNode(r.next,this,this.info);
        this.children.push(n);
        ans.nodes.push(n);
        ans.edges.push({from:this,to:n});
        this.info.edges.push({from:this,to:n});
      }
      else {
        this.children.push(ret);
        ans.edges.push({from:this,to:ret});
        this.info.edges.push({from:this,to:ret});
      }
    }
    return ans;
  }

  find(expr:Expression):ReductionNode{
    for (let n of <ReductionNode[]>this.info.nodes){
      if (n.expr.equalsAlpha(expr)){
        return n;
      }
    }
    return null;
  }
}