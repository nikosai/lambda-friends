import { Expression } from './expression';
import { GraphParseError } from './error';
import { LambdaFriends } from './lambda-friends';
import { Redex } from './redex';
import * as fs from 'fs';

export class GraphNode {
  info: Info;
  children: GraphNode[] = [];
  id: number;
  label: string;
  isRoot: boolean;

  constructor(label: string, info: Info, isRoot: boolean) {
    this.label = label;
    this.info = info;
    this.id = info.nextId++;
    this.isRoot = isRoot;
    info.nodes.push(this);
  }

  public toString(): string {
    return this.label;
  }

  // 簡約グラフの同型性判定
  equalsShape(n: GraphNode): boolean {
    if (
      this.info.nodes.length !== n.info.nodes.length ||
      this.info.edges.length !== n.info.edges.length ||
      this.info.allowMultipleEdges !== n.info.allowMultipleEdges
    )
      return false;
    return sub(this, n, []);

    function sub(
      n1: GraphNode,
      n2: GraphNode,
      closed: { n1: GraphNode; n2: GraphNode }[]
    ): boolean {
      if (n1.children.length !== n2.children.length) return false;
      closed.push({ n1: n1, n2: n2 });
      const cs2: GraphNode[] = [].concat(n2.children);
      let ret = true;
      for (const c1 of n1.children) {
        let found = false;
        for (let i = 0; i < cs2.length; i++) {
          const c2 = cs2[i];
          let pair: { n1: GraphNode; n2: GraphNode } = undefined;
          for (const c of closed) {
            if (c.n1.id === c1.id || c.n2.id === c2.id) {
              pair = c;
              break;
            }
          }
          if (
            (pair === undefined && sub(c1, c2, closed)) ||
            (pair !== undefined && pair.n1.id === c1.id && pair.n2.id === c2.id)
          ) {
            cs2.splice(i, 1);
            found = true;
            break;
          }
        }
        if (!found) {
          ret = false;
          break;
        }
      }
      for (let i = 0; i < closed.length; i++) {
        if (closed[i].n1.id === n1.id) {
          closed.splice(i, 1);
          return ret;
        }
      }
      throw new Error('Unexpected Error');
    }
  }

  // input: root -> a,b,c -> d; d -> e
  // 多重辺が入力に存在する場合、自動で多重辺をオンにする
  static parse(str: string): GraphNode {
    const stmts = str.split(';');
    const info = new Info([], [], null, null, 0, false);
    const nodes: { [key: string]: GraphNode } = {};
    for (const stmt of stmts) {
      const strs = stmt.split('->');
      let ps = str2nodes(strs[0]);
      for (let i = 1; i < strs.length; i++) {
        const cs = str2nodes(strs[i]);
        for (const p of ps) {
          for (const c of cs) {
            if (info.hasEdge({ from: p, to: c }))
              info.allowMultipleEdges = true;
            info.edges.push({ from: p, to: c });
            p.children.push(c);
          }
        }
        ps = cs;
      }
    }
    if (nodes['root'] === undefined)
      throw new GraphParseError("there must be a 'root' node.");

    return nodes['root'];

    // input: " a, b, c "
    function str2nodes(str: string): GraphNode[] {
      const strs = str.split(',');
      const rets: GraphNode[] = [];
      for (let t of strs) {
        t = t.trim();
        if (t === '') continue;
        if (!/^[a-z][a-z0-9]*$/.test(t))
          throw new GraphParseError(
            "the name '" +
              t +
              "' cannot be used as node name, must be [a-z][a-z0-9]*"
          );
        let n = nodes[t];
        if (n === undefined) {
          n = nodes[t] = new GraphNode(t, info, t === 'root');
        }
        rets.push(n);
      }
      return rets;
    }
  }

  static search(n: GraphNode, allowMultipleEdges: boolean): LambdaFriends {
    let input: string;
    const filename = 'graph_closure.csv';
    try {
      const request = new XMLHttpRequest();
      request.open('GET', filename, false);
      request.send(null);
      input = request.responseText;
    } catch (e) {
      if (!require) {
        console.error('require is not defined');
        return;
      }
      try {
        fs.statSync(filename);
      } catch (e) {
        console.error('File Not Found: ' + filename);
        return;
      }
      input = fs.readFileSync(filename, 'utf8');
    }
    const lines = input.split('\n');
    for (const line of lines) {
      const strs = line.split(',');
      if (
        parseInt(strs[2]) === n.info.nodes.length &&
        parseInt(strs[3]) === n.info.edges.length
      ) {
        const lf = new LambdaFriends(strs[0], false, false, allowMultipleEdges);
        // csvに書いてあるものは止まることを保証しておこう
        for (;;) if (lf.deepen() === null) break;
        if (lf.root.equalsShape(n)) {
          return lf;
        }
      }
    }
    return null;
  }
}

class Info {
  constructor(
    public nodes: GraphNode[],
    public edges: { from: GraphNode; to: GraphNode }[],
    public typed: boolean,
    public etaAllowed: boolean,
    public nextId: number,
    public allowMultipleEdges: boolean
  ) {}
  public hasEdge(edge: { from: GraphNode; to: GraphNode }): boolean {
    for (const e of this.edges) {
      if (e.from.id === edge.from.id && e.to.id === edge.to.id) {
        return true;
      }
    }
    return false;
  }
}

export class ReductionNode extends GraphNode {
  private expr: Expression;
  nextrs: Redex[];
  depth: number;
  parent: ReductionNode;
  isNormalForm: boolean;
  constructor(
    expr: Expression,
    parent: ReductionNode,
    info: Info,
    isRoot: boolean
  ) {
    super((expr = expr.extractMacros()).toString(true), info, isRoot);
    this.expr = expr;
    this.parent = parent;
    if (parent === null) this.depth = 0;
    else this.depth = parent.depth + 1;
    if (info.typed) {
      const r = this.expr.getTypedRedex(true);
      this.nextrs = r ? [r] : [];
    } else {
      this.nextrs = this.expr.getRedexes(info.etaAllowed, true);
    }
    this.isNormalForm = this.nextrs.length === 0;
  }

  static makeRoot(
    expr: Expression,
    typed: boolean,
    etaAllowed: boolean,
    allowMultipleEdges: boolean
  ): ReductionNode {
    return new ReductionNode(
      expr,
      null,
      new Info([], [], typed, etaAllowed, 0, allowMultipleEdges),
      true
    );
  }

  visit(): {
    nodes: ReductionNode[];
    edges: { from: ReductionNode; to: ReductionNode }[];
  } {
    const ans: {
      nodes: ReductionNode[];
      edges: { from: ReductionNode; to: ReductionNode }[];
    } = { nodes: [], edges: [] };
    for (const r of this.nextrs) {
      const ret = this.find(r.next);
      if (ret === null) {
        const n = new ReductionNode(r.next, this, this.info, false);
        this.children.push(n);
        ans.nodes.push(n);
        if (
          this.info.allowMultipleEdges ||
          !this.info.hasEdge({ from: this, to: n })
        ) {
          ans.edges.push({ from: this, to: n });
          this.info.edges.push({ from: this, to: n });
        }
      } else {
        this.children.push(ret);
        if (
          this.info.allowMultipleEdges ||
          !this.info.hasEdge({ from: this, to: ret })
        ) {
          ans.edges.push({ from: this, to: ret });
          this.info.edges.push({ from: this, to: ret });
        }
      }
    }
    return ans;
  }

  find(expr: Expression): ReductionNode {
    for (const n of <ReductionNode[]>this.info.nodes) {
      if (n.expr.equalsAlpha(expr)) {
        return n;
      }
    }
    return null;
  }
}
