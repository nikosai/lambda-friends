import { Expression, Macro } from './expression';
import { Type, TypeUntyped, TypeVariable, TypeEquation } from './type';
import { ReductionNode, GraphNode } from './graph';
import { Redex } from './redex';
import { makeAST, parseLMNtal } from './util';
import { deBrujinExpression } from './deBrujin';

export class LambdaFriends {
  expr: Expression;
  typed: boolean;
  curStep: number;
  type: Type;
  allowMultipleEdges: boolean;
  proofTree: string;
  processTex: string;
  original: Expression;
  etaAllowed: boolean;
  root: ReductionNode;
  curNodes: ReductionNode[];
  nextRedexes: Redex[];
  static nextLinkID: number;
  constructor(
    str: string,
    typed: boolean,
    etaAllowed: boolean,
    allowMultipleEdges: boolean
  ) {
    let l = str.split('#')[0].trim();
    const names = [];
    for (;;) {
      let ts = l.match(/^[^[]+?\s*=\s*/);
      if (ts === null) break;
      const t = ts[0];
      ts = l.split(t);
      ts.shift();
      l = ts.join(t);
      names.push(t.split(/\s*=\s*$/)[0]);
    }
    this.expr = makeAST(l, typed);
    this.original = this.expr;
    this.type = this.getType(typed);
    for (const name of names) {
      Macro.add(name, this, typed);
    }
    this.typed = typed;
    this.etaAllowed = etaAllowed;
    this.allowMultipleEdges = allowMultipleEdges;
    this.processTex = '\\begin{eqnarray*}\n&& ';
    this.curStep = 0;
    this.root = ReductionNode.makeRoot(
      this.expr,
      this.typed,
      this.etaAllowed,
      this.allowMultipleEdges
    );
    this.curNodes = [this.root];
    this.nextRedexes = undefined;
  }

  public getRedexes(): Redex[] {
    if (this.nextRedexes) return this.nextRedexes;
    if (this.typed) {
      const r = this.expr.getTypedRedex(true);
      return (this.nextRedexes = r ? [r] : []);
    }
    return (this.nextRedexes = this.expr
      .getRedexes(this.etaAllowed, true)
      .sort(Redex.compare));
  }

  public getLeftMostRedex(): Redex {
    if (this.typed) return this.expr.getTypedRedex(true);
    return this.expr.getUnTypedRedex(
      this.etaAllowed,
      false,
      false,
      false,
      false,
      true
    );
  }

  public getRedex(
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean
  ): Redex {
    if (this.typed) return this.expr.getTypedRedex(true);
    return this.expr.getUnTypedRedex(
      this.etaAllowed,
      rightmost,
      innermost,
      weak,
      head,
      true
    );
  }

  public reductionByStrategy(
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean
  ): string {
    return this.reduction(this.getRedex(rightmost, innermost, weak, head));
  }

  public reduction(redex?: Redex): string {
    if (redex === undefined) {
      // 簡約基指定のない場合、
      redex = this.getLeftMostRedex();
      if (!redex) return null;
    }
    this.expr = redex.next;
    this.nextRedexes = undefined;
    this.processTex += redex.toTexString();
    let ret: string;
    if (redex.type === 'macro') {
      this.processTex += ' \\\\\n&\\equiv& ';
      ret = '-: (macro) = ' + this.expr.toString(true);
    } else {
      this.processTex +=
        ' \\\\\n&\\longrightarrow_{' + redex.getTexRule() + '}& ';
      ret =
        ++this.curStep +
        ': (' +
        redex.rule +
        ') --> ' +
        this.expr.toString(true);
    }
    if (!this.hasNext()) {
      ret += '    (normal form)\n';
      const n = this.parseChurchNum();
      if (n !== null) ret += '  = ' + n + ' (as nat)\n';
      const b = this.parseChurchBool();
      if (b !== null) ret += '  = ' + b + ' (as bool)\n';
      ret = ret.slice(0, -1);
    }
    return ret;
  }

  // グラフのノードを新たに1つ展開する（限界深度を指定してもよい）
  public deepen(maxDepth?: number): {
    nodes: ReductionNode[];
    edges: { from: ReductionNode; to: ReductionNode }[];
  } {
    if (this.curNodes.length === 0) {
      // 展開完了
      return null;
    }
    const t = this.curNodes.shift();
    if (maxDepth !== undefined && t.depth >= maxDepth) {
      // 限界深度に到達
      this.curNodes.push(t);
      return null;
    }
    const ret = t.visit();
    for (const n of ret.nodes) {
      this.curNodes.push(n);
    }
    return ret;
  }

  public hasNext(): boolean {
    return this.getLeftMostRedex() !== null;
  }

  public isNormalForm(
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean
  ): boolean {
    return this.getRedex(rightmost, innermost, weak, head) === null;
  }

  // 未展開のノードがまだあるか
  public hasNodes(): boolean {
    return this.curNodes.length > 0;
  }

  public getProofTree(): string {
    return '\\begin{prooftree}\n' + this.proofTree + '\\end{prooftree}';
  }

  public getProcessTex(): string {
    return (
      this.processTex +
      this.expr.toTexString(true) +
      (this.hasNext() ? '' : '\\not\\longrightarrow') +
      '\n\\end{eqnarray*}'
    );
  }

  public getType(typed: boolean): Type {
    if (!typed) return new TypeUntyped();
    TypeVariable.maxId = undefined;
    const target = TypeVariable.getNew();
    const typeResult = this.expr.getEquations([], target, true);
    const eqs = typeResult.eqs;
    this.proofTree = typeResult.proofTree;
    const ret = TypeEquation.get(target, TypeEquation.solve(eqs));
    const vs = ret.getVariables();
    // 't0,'t1,'t2,... から 'a,'b,'c,... に変換
    const vars: TypeVariable[] = [];
    for (const v of vs) {
      if (!TypeVariable.contains(vars, v)) vars.push(v);
    }
    let i = 0;
    for (const v of vars) {
      ret.replace(v, TypeVariable.getAlphabet(i));
      i++;
    }
    return ret;
  }

  public static parseMacroDef(
    str: string,
    typed: boolean
  ): { names: string[]; expr: string; type: string } {
    let l = str.split('#')[0].trim();
    const names = [];
    for (;;) {
      let ts = l.match(/^[^[]+?\s*=\s*/);
      if (ts === null) break;
      const t = ts[0];
      ts = l.split(t);
      ts.shift();
      l = ts.join(t);
      names.push(t.split(/\s*=\s*$/)[0]);
    }
    if (names.length === 0) return null;
    const lf = new LambdaFriends(l, typed, false, false); // ????
    for (const name of names) {
      Macro.add(name, lf, typed);
    }
    // let name = names.shift();
    // let ret = "<"+name+">"
    // while (names.length>0){
    //   let name = names.shift();
    //   ret += " and <"+name+">";
    // }
    // ret += " is defined as "+lf.expr+" : "+lf.type;
    return {
      names: names,
      expr: lf.expr.toString(true),
      type: lf.type.toString(),
    };
  }

  // return: file input log
  public static fileInput(
    textData: string,
    typed: boolean
  ): {
    defs: { names: string[]; expr: string; type: string }[];
    errs: string[];
  } {
    const lines = textData.split('\n');
    const errors: string[] = [];
    const defs: { names: string[]; expr: string; type: string }[] = [];
    for (const l of lines) {
      try {
        const ret = LambdaFriends.parseMacroDef(l, typed);
        if (ret !== null) defs.push(ret);
      } catch (e) {
        errors.push(e.toString());
      }
    }
    // const indent = '* ';
    // let ret = "# File input completed.\n";
    // if (defs.length !== 0){
    //   ret += "## Finally, "+defs.length+" macros are successfully added.\n";
    //   ret += indent + defs.join("\n"+indent) + "\n\n";
    // }
    // if (errors.length !== 0){
    //   ret += "## Unfortunately, "+errors.length+" macros are rejected due to some errors\n";
    //   ret += indent + errors.join("\n"+indent) + "\n";
    // }
    return { defs: defs, errs: errors };
  }

  public static getMacroList(typed: boolean): string {
    let str = '';
    const map = Macro.getMap(typed);
    for (const key in map) {
      const e = map[key];
      str +=
        '<' +
        e.name +
        '> is defined as ' +
        e.expr.toString(true) +
        ' : ' +
        e.type +
        '\n';
    }
    return str;
  }

  public static getMacroListAsObject(typed: boolean): { [key: string]: Macro } {
    return Macro.getMap(typed);
  }

  public static clearMacro(typed: boolean): void {
    Macro.clear(typed);
  }

  public static graph2LF(
    str: string,
    allowMultipleEdges: boolean
  ): LambdaFriends {
    return GraphNode.search(GraphNode.parse(str), allowMultipleEdges);
  }

  public static lmntal2LF(str: string): LambdaFriends {
    return new LambdaFriends(
      parseLMNtal(str).toString(true),
      false,
      false,
      false
    );
  }

  public static deBrujin2LF(str: string): LambdaFriends {
    return new LambdaFriends(
      deBrujinExpression.parse(str).toLambda().toString(true),
      false,
      false,
      false
    );
  }

  // typedだったらとりあえずnullを返すことにする
  public toLMNtal(): string {
    LambdaFriends.nextLinkID = 0;
    if (this.typed) return null;
    else return this.original.toLMNtal();
  }

  // typedだったらとりあえずnullを返すことにする
  public toSKI(): string {
    if (this.typed) return null;
    else return this.original.toSKI().toString(true);
  }

  // typedだったらとりあえずnullを返すことにする
  public toDeBrujin(): string {
    if (this.typed) return null;
    else return this.original.toDeBrujin().toString();
  }

  public toString(): string {
    let ret = this.expr.toString(true) + (this.typed ? ' : ' + this.type : '');
    if (!this.hasNext()) {
      ret += '    (normal form)\n';
      const n = this.parseChurchNum();
      if (n !== null) ret += '  = ' + n + ' (as nat)\n';
      const b = this.parseChurchBool();
      if (b !== null) ret += '  = ' + b + ' (as bool)\n';
      ret = ret.slice(0, ret.length - 1);
    }
    return ret;
  }

  public getOriginalString(): string {
    return this.original.toString(true) + (this.typed ? ' : ' + this.type : '');
  }

  public parseChurchNum(): number {
    return this.expr.parseChurchNum();
  }

  public parseChurchBool(): boolean {
    return this.expr.parseChurchBool();
  }

  public static getNewLink(): string {
    return 'R' + LambdaFriends.nextLinkID++;
  }
}
