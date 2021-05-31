import {
  Type,
  TypeFunc,
  TypeInt,
  TypeBool,
  TypeEquation,
  TypeList,
  TypeVariable,
} from './type';
import {
  LambdaParseError,
  SubstitutionError,
  ReductionError,
  MacroError,
  TypeError,
  TexError,
  TranslateError,
} from './error';
import { LambdaFriends } from './lambda-friends';
import { Redex, MacroRedex, EtaRedex, TypedRedex, BetaRedex } from './redex';
import * as Util from './util';
import {
  deBrujinExpression,
  deBrujinLambda,
  deBrujinIndex,
  deBrujinApplication,
  deBrujinFreeVar,
} from './deBrujin';

// 型の連立方程式と証明木の組
class TypeResult {
  eqs: TypeEquation[];
  proofTree: string;
  constructor(eqs: TypeEquation[], proofTree: string) {
    this.eqs = eqs;
    this.proofTree = proofTree;
  }
}

// ラムダ項（抽象クラス）
export abstract class Expression {
  className: string;
  freevars: Variable[];
  // type: Type;

  constructor(className: string) {
    this.className = className;
  }

  public parseChurchNum(): number {
    if (!(this instanceof LambdaAbstraction)) return null;
    const f = this.boundvar;
    let e = this.expr;
    let n = 0;
    if (!(e instanceof LambdaAbstraction)) return null;
    const x = e.boundvar;
    if (f.equals(x)) return null;
    e = e.expr;
    while (e instanceof Application) {
      n++;
      if (!e.left.equals(f)) return null;
      e = e.right;
    }
    if (e.equals(x)) return n;
    else return null;
  }

  public parseChurchBool(): boolean {
    const t = new LambdaAbstraction(
      new Variable('x'),
      new LambdaAbstraction(new Variable('y'), new Variable('x'))
    );
    const f = new LambdaAbstraction(
      new Variable('x'),
      new LambdaAbstraction(new Variable('y'), new Variable('y'))
    );
    if (this.equalsAlpha(t)) return true;
    else if (this.equalsAlpha(f)) return false;
    else return null;
  }

  public toLMNtal(): string {
    throw new TypeError(
      "Expression '" +
        this +
        "' cannot be converted into LMNtal (untyped only)."
    );
  }

  public toSKI(): Expression {
    throw new TypeError(
      "Expression '" +
        this +
        "' cannot be converted to SKI combinators (untyped only)."
    );
  }

  public getDeBrujin(_vars: Variable[]): deBrujinExpression {
    throw new TypeError(
      "Expression '" +
        this +
        "' cannot be converted to de Brujin indexes (untyped only)."
    );
  }

  public toDeBrujin(): deBrujinExpression {
    return this.getDeBrujin([]);
  }

  public abstract toString(noParens: boolean): string;
  public abstract toTexString(noParens: boolean): string;
  public abstract getFV(): Variable[];
  public abstract substitute(x: Variable, expr: Expression): Expression;
  public abstract equals(expr: Expression): boolean;
  public abstract equalsAlpha(expr: Expression): boolean;
  public abstract getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult;
  public abstract getRedexes(etaAllowed: boolean, noParens: boolean): Redex[];
  public abstract getTypedRedex(noParens: boolean): Redex;
  public abstract getUnTypedRedex(
    etaAllowed: boolean,
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean,
    noParens: boolean
  ): Redex;
  public abstract extractMacros(): Expression;
}

// 終端記号（未解析）
export class Token extends Expression {
  name: string;

  constructor(name: string, className?: string) {
    if (className === undefined) super('Token');
    else super(className);
    this.name = name;
  }
  equals(expr: Expression): boolean {
    return (
      expr instanceof Token &&
      expr.className === this.className &&
      expr.name === this.name
    );
  }
  equalsAlpha(expr: Expression): boolean {
    return (
      expr instanceof Token &&
      expr.className === this.className &&
      expr.name === this.name
    );
  }
  public toString(_noParens: boolean): string {
    return this.name;
  }
  public toTexString(_noParens: boolean): string {
    throw new TexError('class Token does not have tex string');
  }
  public getFV(): Variable[] {
    return this.freevars;
  }
  public substitute(_x: Variable, _expr: Expression): Expression {
    throw new SubstitutionError('Undefined Substitution');
  }
  public getEquations(
    _gamma: Variable[],
    _type: Type,
    _noParens: boolean
  ): TypeResult {
    throw new TypeError('Undefined Type');
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError('Symbols must not appear in parsed Expression');
  }
  public getTypedRedex(_noParens: boolean): Redex {
    throw new ReductionError('Symbols must not appear in parsed Expression');
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError('Symbols must not appear in parsed Expression');
  }
  public extractMacros(): Expression {
    throw new ReductionError('Symbols must not appear in parsed Expression');
  }
}

// 変数 x
export class Variable extends Token {
  type: Type;
  constructor(name: string) {
    super(name, 'Variable');
    this.freevars = [this];
  }

  public substitute(x: Variable, expr: Expression): Expression {
    if (this.equals(x)) return expr;
    else return this;
  }

  public getEquations(
    gamma: Variable[],
    type: Type,
    _noParens: boolean
  ): TypeResult {
    for (const g of gamma) {
      if (g.equals(this)) {
        // (var)
        let str = '\\AxiomC{}\n';
        str += '\\RightLabel{\\scriptsize(var)}\n';
        str +=
          '\\UnaryInfC{$' +
          Variable.gammaToTexString(gamma) +
          ' \\vdash ' +
          this.name +
          ' : ' +
          type.toTexString() +
          ' $}\n';
        return new TypeResult([new TypeEquation(g.type, type)], str);
      }
    }
    throw new TypeError('free variable is not allowed: ' + this);
  }

  public toTexString(_noParens: boolean): string {
    return this.name;
  }

  static union(a: Variable[], b: Variable[], c?: Variable[]): Variable[] {
    if (c === undefined) {
      const ret: Variable[] = [];
      for (const v of a) {
        ret.push(v);
      }
      for (const v of Variable.dif(b, a)) {
        ret.push(v);
      }
      return ret;
    } else {
      return Variable.union(Variable.union(a, b), c);
    }
  }

  static dif(a: Variable[], b: Variable[]): Variable[] {
    const ret: Variable[] = [];
    for (const ta of a) {
      if (!Variable.contains(b, ta)) ret.push(ta);
    }
    return ret;
  }

  static contains(a: Variable[], b: Variable): boolean {
    for (const ta of a) {
      if (ta.equals(b)) {
        return true;
      }
    }
    return false;
  }

  static gammaToTexString(gamma: Variable[]): string {
    if (gamma.length === 0) return '';
    let ret = gamma[0].name + ' : ' + gamma[0].type.toTexString();
    for (let i = 1; i < gamma.length; i++) {
      ret += ',~' + gamma[i].name + ' : ' + gamma[i].type.toTexString();
    }
    return ret;
  }

  static getNew(used: Variable[]): Variable {
    const alphabet =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    for (const a of alphabet) {
      const z = new Variable(a);
      if (!Variable.contains(used, z)) {
        return z;
      }
    }
    throw new SubstitutionError('No more Variables available');
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    return [];
  }
  public getTypedRedex(_noParens: boolean): Redex {
    return null;
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    return null;
  }
  public extractMacros(): Expression {
    return this;
  }
  public toLMNtal(): string {
    return 'fv(' + this.name + ')';
  }
  public toSKI(): Expression {
    return this;
  }
  public getDeBrujin(vars: Variable[]): deBrujinExpression {
    for (let i = 0; i < vars.length; i++) {
      if (vars[i].equals(this)) {
        return new deBrujinIndex(i);
      }
    }
    return new deBrujinFreeVar(this.name);
  }
}

// 定数 c
export abstract class Const extends Token {
  abstract value;
  abstract type: Type;
  constructor(name: string, className: string) {
    super(name, className);
    this.freevars = [];
  }
  public substitute(_x: Variable, _expr: Expression): Expression {
    return this;
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (con)
    let str = '\\AxiomC{}\n';
    str += '\\RightLabel{\\scriptsize(con)}\n';
    str +=
      '\\UnaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult([new TypeEquation(this.type, type)], str);
  }
  public toString(_noParens: boolean): string {
    return '[' + this.name + ']';
  }
  public toTexString(_noParens: boolean): string {
    return this.name + '^{' + this.type.toTexString() + '}';
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    return null;
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public extractMacros(): Expression {
    return this;
  }
}

// int型定数 c^{int}
export class ConstInt extends Const {
  value: number;
  type: TypeInt;
  constructor(value: number) {
    super(value.toString(), 'ConstInt');
    this.value = value;
    this.type = new TypeInt();
  }
}

// bool型定数 c^{bool}
export class ConstBool extends Const {
  value: boolean;
  type: TypeBool;
  constructor(value: boolean) {
    super(value.toString(), 'ConstBool');
    this.value = value;
    this.type = new TypeBool();
  }
}

// 関数型定数 c^{op} （前置記法・2項演算）
export class ConstOp extends Const {
  value: (x: Const, y: Const) => Const;
  type: TypeFunc;
  constructor(funcName: string) {
    super(funcName, 'ConstOp');
    switch (funcName) {
      case '+':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstInt(x.value + y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeInt())
        );
        break;
      case '-':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstInt(x.value - y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeInt())
        );
        break;
      case '*':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstInt(x.value * y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeInt())
        );
        break;
      case '/':
        this.value = (x: ConstInt, y: ConstInt) => {
          if (y.value === 0)
            throw new ReductionError("Dividing by '0' is not allowed");
          else return new ConstInt(Math.floor(x.value / y.value));
        };
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeInt())
        );
        break;
      case '%':
        this.value = (x: ConstInt, y: ConstInt) => {
          if (y.value === 0)
            throw new ReductionError("Dividing by '0' is not allowed");
          else return new ConstInt(x.value - Math.floor(x.value / y.value) * 4);
        };
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeInt())
        );
        break;
      case '<':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value < y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '>':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value > y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '<=':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value <= y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '>=':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value >= y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '==':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value == y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '=':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value == y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case '!=':
        this.value = (x: ConstInt, y: ConstInt) =>
          new ConstBool(x.value != y.value);
        this.type = new TypeFunc(
          new TypeInt(),
          new TypeFunc(new TypeInt(), new TypeBool())
        );
        break;
      case 'eq':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(x.value == y.value);
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      case 'xor':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(x.value != y.value);
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      case 'or':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(x.value || y.value);
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      case 'and':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(x.value && y.value);
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      case 'nor':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(!(x.value || y.value));
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      case 'nand':
        this.value = (x: ConstBool, y: ConstBool) =>
          new ConstBool(!(x.value && y.value));
        this.type = new TypeFunc(
          new TypeBool(),
          new TypeFunc(new TypeBool(), new TypeBool())
        );
        break;
      default:
        throw new LambdaParseError('Undefined function: ' + funcName);
    }
  }
}

// 空リスト nil
export class Nil extends Token {
  public substitute(_x: Variable, _expr: Expression): Expression {
    return this;
  }
  constructor() {
    super('nil', 'Nil');
    this.freevars = [];
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    _noParens: boolean
  ): TypeResult {
    // (nil)
    const t = TypeVariable.getNew();
    const nType = new TypeList(t);
    let str = '\\AxiomC{}\n';
    str += '\\RightLabel{\\scriptsize(nil)}\n';
    str +=
      '\\UnaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.name +
      ' : ' +
      nType.toTexString() +
      ' $}\n';
    return new TypeResult([new TypeEquation(type, nType)], str);
  }
  public toString(_noParens: boolean): string {
    return '[' + this.name + ']';
  }
  public toTexString(_noParens: boolean): string {
    return '{\\rm ' + this.name + '}';
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public extractMacros(): Expression {
    return this;
  }
}

// マクロ定義
export class Macro extends Token {
  expr: Expression;
  typed: boolean;
  type: Type;
  private static map: { [key: string]: Macro } = {};
  private static mapUntyped: { [key: string]: Macro } = {};
  private constructor(
    name: string,
    expr: Expression,
    typed: boolean,
    type: Type
  ) {
    super(name, 'Macro');
    this.freevars = [];
    this.expr = expr;
    this.typed = typed;
    this.type = type;
  }
  public static add(name: string, lf: LambdaFriends, typed: boolean): Macro {
    const expr = lf.expr;
    if (!/^[a-zA-Z0-9!?]+$/.test(name)) {
      throw new MacroError(
        '<' +
          name +
          '> cannot be used as a name of macro. Available characters: [a-zA-Z0-9!?]'
      );
    }
    if (name.match(/^\d+$/) !== null) {
      throw new MacroError(
        '<' + name + '> is already defined as a built-in macro.'
      );
    }
    const builtins = ['true', 'false', 'S', 'K', 'I'];
    for (const b of builtins) {
      if (b === name) {
        throw new MacroError(
          '<' + name + '> is already defined as a built-in macro.'
        );
      }
    }
    const map = typed ? Macro.map : Macro.mapUntyped;
    if (expr.getFV().length !== 0) {
      throw new MacroError(
        '<' + name + '> contains free variables: ' + expr.getFV()
      );
    }
    const m = new Macro(name, expr, typed, lf.type);
    map[name] = m;
    return map[name];
  }
  public static clear(typed: boolean): void {
    if (typed) {
      Macro.map = {};
    } else {
      Macro.mapUntyped = {};
    }
  }
  public static get(name: string, typed: boolean): Macro {
    let ret: Macro;
    if (typed) {
      ret = Macro.map[name];
    } else {
      ret = Macro.mapUntyped[name];
    }
    if (ret === undefined) {
      // 組み込みマクロ。typeがundefでいいかは疑問の余地あり
      const f = (term) =>
        new Macro(name, Util.makeAST(term, typed), typed, undefined);
      if (name.match(/^\d+$/) !== null)
        return f(Util.makeChurchNum(parseInt(name)));
      if (name === 'true') return f('\\xy.x');
      if (name === 'false') return f('\\xy.y');
      if (name === 'S') return f('\\fgx.fx(gx)');
      if (name === 'K') return f('\\xy.x');
      if (name === 'I') return f('\\x.x');

      // 発展の余地あり。typeを指定したundefマクロを許す？
      return new Macro(name, undefined, typed, undefined);
    } else {
      return new Macro(name, ret.expr, typed, ret.type);
    }
  }
  public static getMap(typed: boolean): { [key: string]: Macro } {
    return Object.assign({}, typed ? Macro.map : Macro.mapUntyped);
  }
  public substitute(_x: Variable, _expr: Expression): Expression {
    return this;
  }

  public toString(_noParens: boolean): string {
    return '<' + this.name + '>';
  }
  public equalsAlpha(expr: Expression): boolean {
    // 再検討の余地あり
    if (this.expr === undefined) return this.equals(expr);
    else return this.expr.equalsAlpha(expr);
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // ????
    if (this.expr === undefined) throw new TypeError(this + ' is undefined.');
    else return this.expr.getEquations(gamma, type, noParens);
  }
  public toTexString(_noParens: boolean): string {
    return '\\,\\overline{\\bf ' + this.name + '}\\,';
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    // let next = Macro.get(this.name,false);
    // if (next.expr === undefined) return [];
    // else return [new MacroRedex(next)];
    if (this.expr === undefined) return [];
    else return [new MacroRedex(this)];
  }
  public getTypedRedex(_noParens: boolean): Redex {
    if (this.expr === undefined) return null;
    else return new MacroRedex(this);
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    if (this.expr === undefined) return null;
    else return new MacroRedex(this);
  }
  public extractMacros(): Expression {
    if (this.expr === undefined) return this;
    else return this.expr.extractMacros();
  }
  public toLMNtal(): string {
    if (this.expr === undefined) return 'fv(' + this.name + ')';
    else return this.expr.toLMNtal();
  }
  public toSKI(): Expression {
    if (this.expr === undefined) return this;
    switch (this.name) {
      case 'S':
      case 'K':
      case 'I':
        return this;
      default:
        return this.expr.toSKI();
    }
  }
  public getDeBrujin(vars: Variable[]): deBrujinExpression {
    if (this.expr === undefined) return new deBrujinFreeVar(this.name);
    else return this.expr.getDeBrujin(vars);
  }
}

// ラムダ抽象 \x.M
export class LambdaAbstraction extends Expression {
  boundvar: Variable;
  expr: Expression;

  constructor(boundvar: Variable, expr: Expression) {
    super('LambdaAbstraction');
    this.freevars = undefined;
    this.boundvar = boundvar;
    this.expr = expr;
  }
  static parse(tokens: Token[], typed: boolean): LambdaAbstraction {
    const boundvars: Variable[] = [];
    while (tokens.length > 0) {
      const t: Token = tokens.shift();
      if (t.name === '.') {
        if (boundvars.length === 0)
          throw new LambdaParseError('Bound variables are expected.');
        let expr = Util.parseTokens(tokens, typed);
        while (boundvars.length > 0) {
          expr = new LambdaAbstraction(boundvars.pop(), expr);
        }
        return <LambdaAbstraction>expr;
      } else if (t.name.match(/^[A-Za-z]$/) === null) {
        throw new LambdaParseError("Unexpected token: '" + t + "'");
      } else {
        boundvars.push(new Variable(t.name));
      }
    }
    throw new LambdaParseError("'.' is needed");
  }
  public toString(noParens: boolean): string {
    const boundvars = [this.boundvar];
    let expr = this.expr;
    while (expr instanceof LambdaAbstraction) {
      boundvars.push(expr.boundvar);
      expr = expr.expr;
    }
    let str = '\\' + boundvars.join('') + '.' + expr.toString(true);
    if (!noParens) str = '(' + str + ')';
    return str;
  }
  public getFV(): Variable[] {
    if (this.freevars !== undefined) return this.freevars;
    this.freevars = [];
    return (this.freevars = Variable.dif(this.expr.getFV(), [this.boundvar]));
  }
  public substitute(y: Variable, expr: Expression): Expression {
    if (this.boundvar.equals(y)) {
      return this;
    } else if (!Variable.contains(expr.getFV(), this.boundvar)) {
      return new LambdaAbstraction(
        this.boundvar,
        this.expr.substitute(y, expr)
      );
    } else {
      const uniFV = Variable.union(this.expr.getFV(), expr.getFV());
      const z = Variable.getNew(uniFV);
      return new LambdaAbstraction(
        z,
        this.expr.substitute(this.boundvar, z)
      ).substitute(y, expr);
    }
  }
  public equals(expr: Expression): boolean {
    return (
      expr instanceof LambdaAbstraction &&
      expr.boundvar.equals(this.boundvar) &&
      expr.expr.equals(this.expr)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    if (!(expr instanceof LambdaAbstraction)) return false;
    if (this.equals(expr)) return true;
    const x = this.boundvar;
    const m = this.expr;
    const y = expr.boundvar;
    const n = expr.expr;
    const v = Variable.getNew(Variable.union(m.getFV(), n.getFV()));
    return m.substitute(x, v).equalsAlpha(n.substitute(y, v));
    // if (Variable.contains(m.getFV(),y)){
    //   return n.equalsAlpha(m);
    // } else {
    //   return n.equalsAlpha(m.substitute(x,y));
    // }
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (abs)
    const t0 = TypeVariable.getNew();
    const t1 = TypeVariable.getNew();
    this.boundvar.type = t1;
    const next = this.expr.getEquations(gamma.concat(this.boundvar), t0, true);
    let str = next.proofTree;
    str += '\\RightLabel{\\scriptsize(abs)}\n';
    str +=
      '\\UnaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(
      next.eqs.concat(new TypeEquation(type, new TypeFunc(t1, t0))),
      str
    );
  }
  public toTexString(noParens: boolean): string {
    const boundvars = [this.boundvar.toTexString(false)];
    let expr = this.expr;
    while (expr instanceof LambdaAbstraction) {
      boundvars.push(expr.boundvar.toTexString(false));
      expr = expr.expr;
    }
    let str = '\\lambda ' + boundvars.join('') + '.' + expr.toTexString(true);
    if (!noParens) str = '(' + str + ')';
    return str;
  }
  public isEtaRedex(): boolean {
    return (
      this.expr instanceof Application &&
      this.expr.right.equals(this.boundvar) &&
      !Variable.contains(this.expr.left.getFV(), this.boundvar)
    );
  }
  public getRedexes(etaAllowed: boolean, noParens: boolean): Redex[] {
    let lParen = '',
      rParen = '';
    if (!noParens) {
      lParen = '(';
      rParen = ')';
    }
    const boundvars = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let la: LambdaAbstraction = this;
    while (la.expr instanceof LambdaAbstraction) {
      boundvars.push(la.boundvar);
      la = la.expr;
    }
    if (etaAllowed === undefined) {
      console.error('etaAllowed is undefined.');
      etaAllowed = false;
    }
    let eta: EtaRedex = null;
    if (etaAllowed && la.isEtaRedex()) {
      eta = new EtaRedex(la);

      eta.next = ((prev) => {
        const bvs: Variable[] = [].concat(boundvars);
        let ret = prev;
        while (bvs.length > 0) {
          const t = bvs.pop();
          ret = new LambdaAbstraction(t, ret);
        }
        return ret;
      })(eta.next);
      eta.addLeft(
        lParen + (boundvars.length > 0 ? '\\' + boundvars.join('') + '.' : '')
      );
      eta.addRight(rParen);
      eta.addTexLeft(
        lParen +
          (boundvars.length > 0 ? '\\lambda{' + boundvars.join('') + '}.' : '')
      );
      eta.addTexRight(rParen);
    }

    const expr = la.expr;
    boundvars.push(la.boundvar);

    const ret = Redex.makeNext(
      expr.getRedexes(etaAllowed, true),
      lParen + (boundvars.length > 0 ? '\\' + boundvars.join('') + '.' : ''),
      rParen,
      lParen +
        (boundvars.length > 0 ? '\\lambda{' + boundvars.join('') + '}.' : ''),
      rParen,
      (prev) => {
        const bvs: Variable[] = [].concat(boundvars);
        let ret = prev;
        while (bvs.length > 0) {
          const t = bvs.pop();
          ret = new LambdaAbstraction(t, ret);
        }
        return ret;
      }
    );
    if (eta !== null) ret.push(eta);
    return ret;
  }
  public getTypedRedex(_noParens: boolean): Redex {
    return null;
  }
  public getUnTypedRedex(
    etaAllowed: boolean,
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean,
    noParens: boolean
  ): Redex {
    if (etaAllowed === undefined) {
      console.error('etaAllowed is undefined.');
      etaAllowed = false;
    }
    // this is eta-redex
    if (weak) {
      if (etaAllowed && this.isEtaRedex()) {
        return new EtaRedex(this);
      } else {
        return null;
      }
    }

    const boundvars = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let la: LambdaAbstraction = this;
    while (la.expr instanceof LambdaAbstraction) {
      boundvars.push(la.boundvar);
      la = la.expr;
    }
    let lParen = '',
      rParen = '';
    if (!noParens) {
      lParen = '(';
      rParen = ')';
    }
    // la is eta-redex
    let outerRedex: Redex = null;
    if (etaAllowed && la.isEtaRedex()) {
      outerRedex = new EtaRedex(la);
    }
    // console.log(`outer:${outerRedex}`);
    let innerRedex: Redex = null;
    if (!outerRedex || innermost) {
      const expr = la.expr;

      // inner-redex
      innerRedex = expr.getUnTypedRedex(
        etaAllowed,
        rightmost,
        innermost,
        weak,
        head,
        true
      );
      // console.log(`inner:${innerRedex}`);
      if (innerRedex === null) return outerRedex;
    }
    let ret: Redex = null;
    if (innerRedex && (innermost || !outerRedex)) {
      ret = innerRedex;
      boundvars.push(la.boundvar);
    } else if (outerRedex) {
      ret = outerRedex;
    } // else { ret = null; }

    if (ret === null) return null;

    ret.next = ((prev) => {
      const bvs: Variable[] = [].concat(boundvars);
      let ret = prev;
      while (bvs.length > 0) {
        const t = bvs.pop();
        ret = new LambdaAbstraction(t, ret);
      }
      return ret;
    })(ret.next);
    ret.addLeft(
      lParen + (boundvars.length > 0 ? '\\' + boundvars.join('') + '.' : '')
    );
    ret.addRight(rParen);
    ret.addTexLeft(
      lParen +
        (boundvars.length > 0 ? '\\lambda{' + boundvars.join('') + '}.' : '')
    );
    ret.addTexRight(rParen);

    return ret;
  }
  public extractMacros(): Expression {
    return new LambdaAbstraction(this.boundvar, this.expr.extractMacros());
  }
  public toLMNtal(): string {
    const ret = this.expr.toLMNtal().split('fv(' + this.boundvar.name + ')');
    let str = ret[0];
    const links: string[] = [];
    for (let i = 1; i < ret.length; i++) {
      const r = LambdaFriends.getNewLink();
      links.push(r);
      str += r + ret[i];
    }

    function connect(links: string[]): string {
      switch (links.length) {
        case 0:
          return 'rm';
        case 1:
          return links[0];
        case 2:
          return 'cp(' + links[0] + ',' + links[1] + ')';
        default: {
          const r = links.shift();
          return 'cp(' + r + ',' + connect(links) + ')';
        }
      }
    }
    return 'lambda(' + connect(links) + ',' + str + ')';
  }
  public toSKI(): Expression {
    if (!Variable.contains(this.expr.getFV(), this.boundvar)) {
      return new Application(Macro.get('K', false), this.expr.toSKI());
    }
    if (this.boundvar.equals(this.expr)) {
      return Macro.get('I', false);
    }
    if (this.expr instanceof Application) {
      const f = (e: Expression) =>
        new LambdaAbstraction(this.boundvar, e).toSKI();
      return new Application(
        new Application(Macro.get('S', false), f(this.expr.left)),
        f(this.expr.right)
      );
    }
    if (this.expr instanceof LambdaAbstraction) {
      const inner = this.expr.toSKI();
      return new LambdaAbstraction(this.boundvar, inner).toSKI();
    }
    throw new TranslateError('Unknown kind of expression.');
  }
  public getDeBrujin(vars: Variable[]): deBrujinExpression {
    vars.unshift(this.boundvar);
    const ret = this.expr.getDeBrujin(vars);
    vars.shift();
    return new deBrujinLambda(ret);
  }
}

// 関数適用 MN
export class Application extends Expression {
  left: Expression;
  right: Expression;

  constructor(left: Expression, right: Expression) {
    super('Application');
    this.left = left;
    this.right = right;
  }

  isBetaRedex(): boolean {
    return this.left instanceof LambdaAbstraction;
  }

  public toString(noParens: boolean): string {
    let str =
      this.left.toString(this.left instanceof Application) +
      this.right.toString(false);
    if (!noParens) str = '(' + str + ')';
    return str;
  }

  public getFV(): Variable[] {
    if (this.freevars === undefined)
      return (this.freevars = Variable.union(
        this.left.getFV(),
        this.right.getFV()
      ));
    else return this.freevars;
  }

  public substitute(y: Variable, expr: Expression): Expression {
    return new Application(
      this.left.substitute(y, expr),
      this.right.substitute(y, expr)
    );
  }

  public equals(expr: Expression): boolean {
    return (
      expr instanceof Application &&
      expr.left.equals(this.left) &&
      expr.right.equals(this.right)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    return (
      expr instanceof Application &&
      expr.left.equalsAlpha(this.left) &&
      expr.right.equalsAlpha(this.right)
    );
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (app)
    const t1 = TypeVariable.getNew();
    const nextL = this.left.getEquations(gamma, new TypeFunc(t1, type), false);
    const nextR = this.right.getEquations(gamma, t1, false);
    let str = nextL.proofTree + nextR.proofTree;
    str += '\\RightLabel{\\scriptsize(app)}\n';
    str +=
      '\\BinaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
  }
  public toTexString(noParens: boolean): string {
    let str =
      this.left.toTexString(this.left instanceof Application) +
      this.right.toTexString(false);
    if (!noParens) str = '(' + str + ')';
    return str;
  }
  public getRedexes(etaAllowed: boolean, noParens: boolean): Redex[] {
    const b = this.left instanceof Application;
    const leftRedexes = this.left.getRedexes(etaAllowed, b);
    const left = Redex.makeNext(
      leftRedexes,
      '',
      this.right.toString(false),
      '',
      this.right.toTexString(false),
      (prev) => new Application(prev, this.right)
    );
    const rightRedexes = this.right.getRedexes(etaAllowed, false);
    const right = Redex.makeNext(
      rightRedexes,
      this.left.toString(b),
      '',
      this.left.toTexString(b),
      '',
      (prev) => new Application(this.left, prev)
    );
    let ret = left.concat(right);
    if (this.isBetaRedex()) {
      ret.push(new BetaRedex(this));
    }
    if (!noParens) {
      ret = Redex.makeNext(ret, '(', ')', '(', ')', (prev) => prev);
    }
    return ret;
  }
  public getTypedRedex(noParens: boolean): Redex {
    // typed
    const lParen = noParens ? '' : '(';
    const rParen = noParens ? '' : ')';
    if (this.left instanceof LambdaAbstraction) {
      // (app2)
      return new TypedRedex(
        this,
        this.left.expr.substitute(this.left.boundvar, this.right),
        'app2'
      );
    } else if (
      this.left instanceof Application &&
      this.left.left instanceof ConstOp &&
      this.left.right instanceof Const
    ) {
      const op = this.left.left;
      const left = this.left.right;
      const right = this.right;
      if (right instanceof Const) {
        // (app5)
        if (
          op.type.left.equals(left.type) &&
          op.type.right instanceof TypeFunc &&
          op.type.right.left.equals(right.type)
        ) {
          return new TypedRedex(this, op.value(left, right), 'app5');
        } else {
          throw new ReductionError(
            op.type +
              ' cannot handle ' +
              left.type +
              ' and ' +
              right.type +
              ' as arguments'
          );
        }
      } else {
        // (app4)
        const ret = right.getTypedRedex(false);
        if (ret === null) return null;
        ret.next = new Application(new Application(op, left), ret.next);
        ret.addLeft(lParen + op.toString(false) + left.toString(false));
        ret.addRight(rParen);
        ret.addTexLeft(
          lParen + op.toTexString(false) + left.toTexString(false)
        );
        ret.addTexRight(rParen);
        return ret;
      }
    } else if (this.left instanceof ConstOp) {
      // (app3)
      const ret = this.right.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new Application(this.left, ret.next);
      ret.addLeft(lParen + this.left.toString(false));
      ret.addRight(rParen);
      ret.addTexLeft(lParen + this.left.toTexString(false));
      ret.addTexRight(rParen);
      return ret;
    } else {
      // (app1)
      const ret = this.left.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new Application(ret.next, this.right);
      ret.addLeft(lParen);
      ret.addRight(rParen + this.right.toString(false));
      ret.addTexLeft(lParen);
      ret.addTexRight(rParen + this.right.toTexString(false));
      return ret;
    }
  }
  public getUnTypedRedex(
    etaAllowed: boolean,
    rightmost: boolean,
    innermost: boolean,
    weak: boolean,
    head: boolean,
    noParens: boolean
  ): Redex {
    const b = this.left instanceof Application;
    const p = (r: Redex) => {
      if (r !== null && !noParens) {
        r.addLeft('(');
        r.addRight(')');
        r.addTexLeft('(');
        r.addTexRight(')');
      }
      return r;
    };
    const searchL = () => {
      const ret = this.left.getUnTypedRedex(
        etaAllowed,
        rightmost,
        innermost,
        weak,
        head,
        b
      );
      if (ret === null) return null;
      ret.next = new Application(ret.next, this.right);
      ret.addRight(this.right.toString(false));
      ret.addTexRight(this.right.toTexString(false));
      return p(ret);
    };
    const searchR = () => {
      const ret = this.right.getUnTypedRedex(
        etaAllowed,
        rightmost,
        innermost,
        weak,
        head,
        false
      );
      if (ret === null) return null;
      ret.next = new Application(this.left, ret.next);
      ret.addLeft(this.left.toString(b));
      ret.addTexLeft(this.left.toTexString(b));
      return p(ret);
    };
    let ret: Redex = null;
    if (this.isBetaRedex()) {
      ret = p(new BetaRedex(this));
      if (head || !innermost) return ret;
    }
    if (head) {
      return searchL();
    }
    let res = rightmost ? searchR() : searchL();
    if (res !== null) return res;
    res = rightmost ? searchL() : searchR();
    if (res !== null) return res;
    return ret;
  }
  public extractMacros(): Expression {
    return new Application(
      this.left.extractMacros(),
      this.right.extractMacros()
    );
  }
  public toLMNtal(): string {
    return 'apply(' + this.left.toLMNtal() + ',' + this.right.toLMNtal() + ')';
  }
  public toSKI(): Expression {
    return new Application(this.left.toSKI(), this.right.toSKI());
  }
  public getDeBrujin(vars: Variable[]): deBrujinExpression {
    return new deBrujinApplication(
      this.left.getDeBrujin(vars),
      this.right.getDeBrujin(vars)
    );
  }
}

// リスト M::M
export class List extends Expression {
  head: Expression;
  tail: Expression;

  constructor(head: Expression, tail: Expression) {
    super('List');
    this.head = head;
    this.tail = tail;
  }

  public toString(noParens: boolean): string {
    let ret = this.head.toString(false) + '::' + this.tail.toString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }

  public getFV(): Variable[] {
    if (this.freevars === undefined)
      return (this.freevars = Variable.union(
        this.head.getFV(),
        this.tail.getFV()
      ));
    else return this.freevars;
  }

  public substitute(y: Variable, expr: Expression): Expression {
    return new List(
      this.head.substitute(y, expr),
      this.tail.substitute(y, expr)
    );
  }

  public equals(expr: Expression): boolean {
    return (
      expr instanceof List &&
      expr.head.equals(this.head) &&
      expr.tail.equals(this.tail)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    return (
      expr instanceof List &&
      expr.head.equalsAlpha(this.head) &&
      expr.tail.equalsAlpha(this.tail)
    );
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (list) 再検討の余地あり？ 新しい型変数要る？
    const t = TypeVariable.getNew();
    const lt = new TypeList(t);
    const nextH = this.head.getEquations(gamma, t, false);
    const nextT = this.tail.getEquations(gamma, lt, false);
    let str = nextH.proofTree + nextT.proofTree;
    str += '\\RightLabel{\\scriptsize(list)}\n';
    str +=
      '\\BinaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      lt.toTexString() +
      ' $}\n';
    return new TypeResult(
      nextH.eqs.concat(nextT.eqs, new TypeEquation(lt, type)),
      str
    );
  }
  public toTexString(noParens: boolean): string {
    let ret = this.head.toTexString(false) + '::' + this.tail.toTexString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }

  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    return null;
  }
  public extractMacros(): Expression {
    return new List(this.head.extractMacros(), this.tail.extractMacros());
  }
}

// if
export class If extends Expression {
  state: Expression;
  ifTrue: Expression;
  ifFalse: Expression;
  constructor(state: Expression, ifTrue: Expression, ifFalse: Expression) {
    super('If');
    this.state = state;
    this.ifTrue = ifTrue;
    this.ifFalse = ifFalse;
  }
  public getFV(): Variable[] {
    return (this.freevars = Variable.union(
      this.state.getFV(),
      this.ifTrue.getFV(),
      this.ifFalse.getFV()
    ));
  }
  public toString(noParens: boolean): string {
    let ret =
      '[if]' +
      this.state.toString(true) +
      '[then]' +
      this.ifTrue.toString(true) +
      '[else]' +
      this.ifFalse.toString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public substitute(y: Variable, expr: Expression): Expression {
    return new If(
      this.state.substitute(y, expr),
      this.ifTrue.substitute(y, expr),
      this.ifFalse.substitute(y, expr)
    );
  }
  public equals(expr: Expression): boolean {
    return (
      expr instanceof If &&
      expr.state.equals(this.state) &&
      expr.ifTrue.equals(this.ifTrue) &&
      expr.ifFalse.equals(this.ifFalse)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    return (
      expr instanceof If &&
      expr.state.equalsAlpha(this.state) &&
      expr.ifTrue.equalsAlpha(this.ifTrue) &&
      expr.ifFalse.equalsAlpha(this.ifFalse)
    );
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (if)
    const nextS = this.state.getEquations(gamma, new TypeBool(), true);
    const nextT = this.ifTrue.getEquations(gamma, type, true);
    const nextF = this.ifFalse.getEquations(gamma, type, true);
    let str = nextS.proofTree + nextT.proofTree + nextF.proofTree;
    str += '\\RightLabel{\\scriptsize(if)}\n';
    str +=
      '\\TrinaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(nextS.eqs.concat(nextT.eqs, nextF.eqs), str);
  }
  public toTexString(noParens: boolean): string {
    let ret =
      '{\\bf if}~' +
      this.state.toTexString(true) +
      '~{\\bf then}~' +
      this.ifTrue.toTexString(true) +
      '~{\\bf else}~' +
      this.ifFalse.toTexString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    if (this.state instanceof ConstBool) {
      if (this.state.value) {
        // (if2)
        return new TypedRedex(this, this.ifTrue, 'if2');
      } else {
        // (if3)
        return new TypedRedex(this, this.ifFalse, 'if3');
      }
    } else {
      // (if1)
      const ret = this.state.getTypedRedex(false);
      if (ret === null) return null;
      ret.next = new If(ret.next, this.ifTrue, this.ifFalse);
      ret.addLeft('([if]');
      ret.addRight(
        '[then]' +
          this.ifTrue.toString(true) +
          '[else]' +
          this.ifFalse.toString(true) +
          ')'
      );
      ret.addTexLeft('({\\bf if}~');
      ret.addTexRight(
        '~{\\bf then}~' +
          this.ifTrue.toTexString(true) +
          '~{\\bf else}~' +
          this.ifFalse.toTexString(true) +
          ')'
      );
      return ret;
    }
  }
  public static parse(tokens: Token[], typed: boolean): If {
    const state: Token[] = [];
    let i_num = 0,
      t_num = 0,
      e_num = 0;
    for (;;) {
      if (tokens.length == 0)
        throw new LambdaParseError('Illegal If statement');
      const t = tokens.shift();
      switch (t.name) {
        case 'if':
          i_num++;
          break;
        case 'then':
          t_num++;
          break;
        case 'else':
          e_num++;
          break;
      }
      if (i_num === e_num && t_num === i_num + 1) break;
      state.push(t);
    }
    const stateExpr = Util.parseTokens(state, typed);
    const ifTrue: Token[] = [];
    (i_num = 0), (t_num = 0), (e_num = 0);
    for (;;) {
      if (tokens.length == 0)
        throw new LambdaParseError('Illegal If statement');
      const t = tokens.shift();
      switch (t.name) {
        case 'if':
          i_num++;
          break;
        case 'then':
          t_num++;
          break;
        case 'else':
          e_num++;
          break;
      }
      if (i_num === t_num && e_num === i_num + 1) break;
      ifTrue.push(t);
    }
    const ifTrueExpr = Util.parseTokens(ifTrue, typed);
    const ifFalseExpr = Util.parseTokens(tokens, typed);
    return new If(stateExpr, ifTrueExpr, ifFalseExpr);
  }
  public extractMacros(): Expression {
    return new If(
      this.state.extractMacros(),
      this.ifTrue.extractMacros(),
      this.ifFalse.extractMacros()
    );
  }
}

// let in
export class Let extends Expression {
  boundvar: Variable;
  left: Expression;
  right: Expression;
  constructor(boundvar: Variable, left: Expression, right: Expression) {
    super('Let');
    this.boundvar = boundvar;
    this.left = left;
    this.right = right;
  }
  public getFV(): Variable[] {
    if (this.freevars !== undefined) return this.freevars;
    const ret: Variable[] = [];
    for (const fv of this.right.getFV()) {
      if (!fv.equals(this.boundvar)) {
        ret.push(fv);
      }
    }
    return (this.freevars = Variable.union(ret, this.left.getFV()));
  }
  public toString(noParens: boolean): string {
    let ret =
      '[let]' +
      this.boundvar.toString(true) +
      '=' +
      this.left.toString(true) +
      '[in]' +
      this.right.toString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public substitute(y: Variable, expr: Expression): Expression {
    const left = this.left.substitute(y, expr);
    if (this.boundvar.equals(y)) {
      return new Let(this.boundvar, left, this.right);
    } else if (!Variable.contains(expr.getFV(), this.boundvar)) {
      return new Let(this.boundvar, left, this.right.substitute(y, expr));
    } else {
      const uniFV = Variable.union(this.right.getFV(), expr.getFV());
      const z = Variable.getNew(uniFV);
      if (z.equals(y)) {
        return new Let(z, left, this.right.substitute(this.boundvar, z));
      } else {
        return new Let(
          z,
          left,
          this.right.substitute(this.boundvar, z).substitute(y, expr)
        );
      }
    }
  }
  public equals(expr: Expression): boolean {
    return (
      expr instanceof Let &&
      expr.boundvar.equals(this.boundvar) &&
      expr.left.equals(this.left) &&
      expr.right.equals(this.right)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    if (!(expr instanceof Let)) return false;
    if (this.equals(expr)) return true;
    const x = this.boundvar;
    const m = this.right;
    const y = expr.boundvar;
    const n = expr.right;
    return (
      !Variable.contains(m.getFV(), y) && n.equalsAlpha(m.substitute(x, y))
    );
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (let)
    const t1 = TypeVariable.getNew();
    this.boundvar.type = t1;
    const nextL = this.left.getEquations(gamma, t1, true);
    const nextR = this.right.getEquations(
      gamma.concat(this.boundvar),
      type,
      true
    );
    let str = nextL.proofTree + nextR.proofTree;
    str += '\\RightLabel{\\scriptsize(let)}\n';
    str +=
      '\\TrinaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
  }
  public toTexString(noParens: boolean): string {
    let ret =
      '{\\bf let}~' +
      this.boundvar.toTexString(false) +
      ' = ' +
      this.left.toTexString(true) +
      '~{\\bf in}~' +
      this.right.toTexString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    // (let)
    return new TypedRedex(
      this,
      this.right.substitute(this.boundvar, this.left),
      'let'
    );
  }
  public static parse(tokens: Token[], typed: boolean): Let {
    const t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/) === null)
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    const boundvar = new Variable(t.name);
    if (tokens.shift().name !== '=')
      throw new LambdaParseError("'=' is expected");
    const content: Token[] = [];
    let i = 1;
    for (;;) {
      // console.log(i);
      if (tokens.length == 0)
        throw new LambdaParseError('Illegal Let statement');
      const t = tokens.shift();
      if (t.name === 'let') i++;
      else if (t.name === 'in') i--;
      if (i == 0) break;
      content.push(t);
    }
    const contentExpr: Expression = Util.parseTokens(content, typed);
    const restExpr: Expression = Util.parseTokens(tokens, typed);
    return new Let(boundvar, contentExpr, restExpr);
  }
  public extractMacros(): Expression {
    return new Let(
      this.boundvar,
      this.left.extractMacros(),
      this.right.extractMacros()
    );
  }
}

// case文 [case] M [of] [nil] -> M | x::x -> M
export class Case extends Expression {
  state: Expression;
  ifNil: Expression;
  head: Variable;
  tail: Variable;
  ifElse: Expression;
  constructor(
    state: Expression,
    ifNil: Expression,
    head: Variable,
    tail: Variable,
    ifElse: Expression
  ) {
    super('Case');
    this.state = state;
    this.ifNil = ifNil;
    this.head = head;
    this.tail = tail;
    this.ifElse = ifElse;
  }
  public getFV(): Variable[] {
    if (this.freevars !== undefined) return this.freevars;
    else
      return Variable.union(
        this.state.getFV(),
        this.ifNil.getFV(),
        Variable.dif(this.ifElse.getFV(), [this.head, this.tail])
      );
  }
  public toString(noParens: boolean): string {
    let ret =
      '[case]' +
      this.state.toString(true) +
      '[of][nil]->' +
      this.ifNil.toString(true) +
      '|' +
      this.head.toString(true) +
      '::' +
      this.tail.toString(true) +
      '->' +
      this.ifElse.toString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public substitute(y: Variable, expr: Expression): Expression {
    const state = this.state.substitute(y, expr);
    const ifNil = this.ifNil.substitute(y, expr);
    if (this.head.equals(y) || this.tail.equals(y)) {
      return new Case(state, ifNil, this.head, this.tail, this.ifElse);
    } else if (
      !Variable.contains(expr.getFV(), this.head) &&
      !Variable.contains(expr.getFV(), this.tail)
    ) {
      return new Case(
        state,
        ifNil,
        this.head,
        this.tail,
        this.ifElse.substitute(y, expr)
      );
    } else {
      let head = this.head;
      let tail = this.tail;
      let ifElse = this.ifElse;
      if (Variable.contains(expr.getFV(), head)) {
        const uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
        const z = Variable.getNew(uniFV);
        if (z.equals(y)) {
          ifElse = ifElse.substitute(head, z);
        } else {
          ifElse = ifElse.substitute(head, z).substitute(y, expr);
        }
        head = z;
      }
      if (Variable.contains(expr.getFV(), tail)) {
        const uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
        const z = Variable.getNew(uniFV);
        if (z.equals(y)) {
          ifElse = ifElse.substitute(tail, z);
        } else {
          ifElse = ifElse.substitute(tail, z).substitute(y, expr);
        }
        tail = z;
      }
      return new Case(state, ifNil, head, tail, ifElse);
    }
  }
  public equals(expr: Expression): boolean {
    return (
      expr instanceof Case &&
      expr.state.equals(this.state) &&
      expr.ifNil.equals(this.ifNil) &&
      expr.head.equals(this.head) &&
      expr.tail.equals(this.tail) &&
      expr.ifElse.equals(this.ifElse)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    return (
      expr instanceof Case &&
      expr.state.equalsAlpha(this.state) &&
      expr.ifNil.equalsAlpha(this.ifNil) &&
      expr.head.equalsAlpha(this.head) &&
      expr.tail.equalsAlpha(this.tail) &&
      expr.ifElse.equalsAlpha(this.ifElse)
    );
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (case)
    const t1 = TypeVariable.getNew();
    const lt1 = new TypeList(t1);
    this.head.type = t1;
    this.tail.type = lt1;
    const nextS = this.state.getEquations(gamma, lt1, true);
    const nextN = this.ifNil.getEquations(gamma, type, true);
    const nextE = this.ifElse.getEquations(
      gamma.concat(this.head, this.tail),
      type,
      true
    );
    let str = nextS.proofTree + nextN.proofTree + nextE.proofTree;
    str += '\\RightLabel{\\scriptsize(case)}\n';
    str +=
      '\\TrinaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(nextS.eqs.concat(nextN.eqs, nextE.eqs), str);
  }
  public toTexString(noParens: boolean): string {
    let ret =
      '{\\bf case} ' +
      this.state.toTexString(true) +
      ' {\\bf of} {\\rm nil} \\Rightarrow ' +
      this.ifNil.toTexString(true) +
      ' | ' +
      this.head.toTexString(true) +
      '::' +
      this.tail.toTexString(true) +
      ' \\Rightarrow ' +
      this.ifElse.toTexString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    if (this.state instanceof Nil) {
      // (case2)
      return new TypedRedex(this, this.ifNil, 'case2');
    } else if (this.state instanceof List) {
      // (case3)
      return new TypedRedex(
        this,
        this.ifElse
          .substitute(this.head, this.state.head)
          .substitute(this.tail, this.state.tail),
        'case3'
      );
    } else {
      // (case1)
      const ret = this.state.getTypedRedex(true);
      if (ret === null) return null;
      ret.next = new Case(
        ret.next,
        this.ifNil,
        this.head,
        this.tail,
        this.ifElse
      );
      ret.addLeft('([case]');
      ret.addRight(
        '[of][nil]->' +
          this.ifNil +
          ' | ' +
          this.head +
          '::' +
          this.tail +
          '->' +
          this.ifElse +
          ')'
      );
      ret.addTexLeft('({\\bf case} ');
      ret.addTexRight(
        ' {\\bf of} {\\rm nil} \\Rightarrow ' +
          this.ifNil.toTexString(true) +
          ' | ' +
          this.head.toTexString(true) +
          '::' +
          this.tail.toTexString(true) +
          ' \\Rightarrow ' +
          this.ifElse.toTexString(true) +
          ')'
      );
      return ret;
    }
  }
  public static parse(tokens: Token[], typed: boolean): Case {
    const state: Token[] = [];
    let i = 1;
    for (;;) {
      if (tokens.length == 0)
        throw new LambdaParseError('Illegal Case statement');
      const t = tokens.shift();
      if (t.name === 'case') i++;
      else if (t.name === 'of') i--;
      if (i == 0) break;
      state.push(t);
    }
    const stateExpr: Expression = Util.parseTokens(state, typed);
    let t = tokens.shift();
    if (t.name !== 'nil')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    t = tokens.shift();
    if (t.name !== '-')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    t = tokens.shift();
    if (t.name !== '>')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    const ifNil: Token[] = [];
    i = 1;
    for (;;) {
      if (tokens.length == 0) throw new LambdaParseError('Too many [case]');
      const t = tokens.shift();
      if (t.name === 'case') i++;
      else if (t.name === '|') i--;
      if (i == 0) break;
      ifNil.push(t);
    }
    const ifNilExpr: Expression = Util.parseTokens(ifNil, typed);
    const head = new Variable(tokens.shift().name);
    if (head.name.match(/^[A-Za-z]$/) === null)
      throw new LambdaParseError("Unexpected token: '" + head.name + "'");
    t = tokens.shift();
    if (t.name !== ':')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    t = tokens.shift();
    if (t.name !== ':')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    const tail = new Variable(tokens.shift().name);
    if (tail.name.match(/^[A-Za-z]$/) === null)
      throw new LambdaParseError("Unexpected token: '" + tail.name + "'");
    t = tokens.shift();
    if (t.name !== '-')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    t = tokens.shift();
    if (t.name !== '>')
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    const ifElseExpr = Util.parseTokens(tokens, typed);
    return new Case(stateExpr, ifNilExpr, head, tail, ifElseExpr);
  }
  public extractMacros(): Expression {
    return new Case(
      this.state.extractMacros(),
      this.ifNil.extractMacros(),
      this.head,
      this.tail,
      this.ifElse.extractMacros()
    );
  }
}

// 不動点演算子 [fix] x.M
export class Fix extends Expression {
  boundvar: Variable;
  expr: Expression;
  constructor(boundvar: Variable, expr: Expression) {
    super('Fix');
    this.boundvar = boundvar;
    this.expr = expr;
  }
  public getFV(): Variable[] {
    if (this.freevars !== undefined) return this.freevars;
    const ret: Variable[] = [];
    for (const fv of this.expr.getFV()) {
      if (!fv.equals(this.boundvar)) {
        ret.push(fv);
      }
    }
    return (this.freevars = ret);
  }
  public toString(noParens: boolean): string {
    let ret =
      '[fix]' + this.boundvar.toString(false) + '.' + this.expr.toString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public substitute(y: Variable, expr: Expression): Expression {
    if (this.boundvar.equals(y)) {
      return this;
    } else if (!Variable.contains(expr.getFV(), this.boundvar)) {
      return new Fix(this.boundvar, this.expr.substitute(y, expr));
    } else {
      const uniFV = Variable.union(this.expr.getFV(), expr.getFV());
      const z = Variable.getNew(uniFV);
      return new Fix(z, this.expr.substitute(this.boundvar, z)).substitute(
        y,
        expr
      );
    }
  }
  public equals(expr: Expression): boolean {
    return (
      expr instanceof Fix &&
      expr.boundvar.equals(this.boundvar) &&
      expr.expr.equals(this.expr)
    );
  }
  public equalsAlpha(expr: Expression): boolean {
    if (!(expr instanceof Fix)) return false;
    if (this.equals(expr)) return true;
    const x = this.boundvar;
    const m = this.expr;
    const y = expr.boundvar;
    const n = expr.expr;
    if (Variable.contains(m.getFV(), y)) {
      return n.equalsAlpha(m);
    } else {
      return n.equalsAlpha(m.substitute(x, y));
    }
  }
  public getEquations(
    gamma: Variable[],
    type: Type,
    noParens: boolean
  ): TypeResult {
    // (fix)
    this.boundvar.type = type;
    const next = this.expr.getEquations(
      gamma.concat(this.boundvar),
      type,
      true
    );
    let str = next.proofTree;
    str += '\\RightLabel{\\scriptsize(fix)}\n';
    str +=
      '\\UnaryInfC{$' +
      Variable.gammaToTexString(gamma) +
      ' \\vdash ' +
      this.toTexString(noParens) +
      ' : ' +
      type.toTexString() +
      ' $}\n';
    return new TypeResult(next.eqs, str);
  }
  public toTexString(noParens: boolean): string {
    let ret =
      '{\\bf fix}~' +
      this.boundvar.toTexString(true) +
      '.' +
      this.expr.toTexString(true);
    if (!noParens) ret = '(' + ret + ')';
    return ret;
  }
  public getRedexes(_etaAllowed: boolean, _noParens: boolean): Redex[] {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getUnTypedRedex(
    _etaAllowed: boolean,
    _rightmost: boolean,
    _innermost: boolean,
    _weak: boolean,
    _head: boolean,
    _noParens: boolean
  ): Redex {
    throw new ReductionError(
      'Untyped Reduction cannot handle typeof ' + this.className
    );
  }
  public getTypedRedex(_noParens: boolean): Redex {
    // (fix)
    return new TypedRedex(
      this,
      this.expr.substitute(
        this.boundvar,
        new Fix(new Variable(this.boundvar.name), this.expr)
      ),
      'fix'
    );
  }
  public static parse(tokens: Token[], typed: boolean): Fix {
    const t = tokens.shift();
    if (t.name.match(/^[A-Za-z]$/) === null)
      throw new LambdaParseError("Unexpected token: '" + t + "'");
    const boundvar = new Variable(t.name);
    if (tokens.shift().name !== '.')
      throw new LambdaParseError("'.' is expected");

    const contentExpr: Expression = Util.parseTokens(tokens, typed);
    return new Fix(boundvar, contentExpr);
  }
  public extractMacros(): Expression {
    return new Fix(this.boundvar, this.expr.extractMacros());
  }
}
