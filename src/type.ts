import { TypeError } from './error';

export abstract class Type {
  className: string;

  constructor(className: string) {
    this.className = className;
  }

  public abstract toString(): string;
  public abstract equals(t: Type): boolean;
  public abstract contains(t: TypeVariable): boolean;
  public abstract replace(from: TypeVariable, to: Type): void;
  public abstract getVariables(): TypeVariable[];
  public abstract toTexString(): string;
}

export class TypeEquation {
  left: Type;
  right: Type;
  constructor(left: Type, right: Type) {
    this.left = left;
    this.right = right;
  }
  public transform(eqs: TypeEquation[], next: TypeEquation[]): TypeEquation[] {
    if (
      this.left instanceof TypeConstructor &&
      this.right instanceof TypeConstructor
    ) {
      // (a),(b)
      return this.left.match(this.right);
    }
    if (this.left.equals(this.right)) {
      // (c)
      return [];
    }
    if (!(this.left instanceof TypeVariable)) {
      // (d)
      return [new TypeEquation(this.right, this.left)];
    }
    if (this.right.contains(this.left)) {
      // (e)
      throw new TypeError(
        'Illegal type (' +
          this.right +
          ' contains ' +
          this.left +
          '. Self-application?)'
      );
    }
    // (f)
    for (const e of eqs) {
      e.replace(this.left, this.right);
    }
    for (const e of next) {
      e.replace(this.left, this.right);
    }
    return [this];
  }
  public static isEqual(a: TypeEquation[], b: TypeEquation[]): boolean {
    if (a.length !== b.length) return false;
    for (const ai of a) {
      if (!TypeEquation.contains(ai, b)) return false;
    }
    return true;
  }
  public static contains(a: TypeEquation, b: TypeEquation[]): boolean {
    for (const bi of b) {
      if (a.equals(bi)) return true;
    }
    return false;
  }
  public equals(e: TypeEquation): boolean {
    return e.left.equals(this.left) && e.right.equals(this.right);
  }
  public static get(t: TypeVariable, eqs: TypeEquation[]): Type {
    for (const eq of eqs) {
      if (eq.left.equals(t)) return eq.right;
    }
    throw new TypeError('Undefined TypeVariable: ' + t);
  }
  public toString(): string {
    return this.left + ' = ' + this.right;
  }
  public replace(from: TypeVariable, to: Type): void {
    if (this.left.equals(from)) {
      this.left = to;
    } else {
      this.left.replace(from, to);
    }
    if (this.right.equals(from)) {
      this.right = to;
    } else {
      this.right.replace(from, to);
    }
  }
  public static solve(eqs: TypeEquation[]): TypeEquation[] {
    for (;;) {
      const prev: TypeEquation[] = [].concat(eqs);
      let next: TypeEquation[] = [];
      while (eqs.length > 0) {
        const e = eqs.shift();
        const ans = e.transform(eqs, next);
        next = next.concat(ans);
      }
      eqs = [].concat(next);
      if (TypeEquation.isEqual(prev, next)) break;
    }
    return eqs;
  }
}

export abstract class TypeConstructor extends Type {
  public abstract match(t: Type): TypeEquation[];
}

export class TypeInt extends TypeConstructor {
  constructor() {
    super('TypeInt');
  }
  public toString(): string {
    return 'int';
  }
  public toTexString(): string {
    return '{\\rm int}';
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeInt) return true;
    else return false;
  }
  public match(t: Type): TypeEquation[] {
    if (t instanceof TypeInt) {
      return [];
    } else {
      throw new TypeError(this + ' and ' + t + ' are not compatible.');
    }
  }
  public contains(_t: TypeVariable): boolean {
    return false;
  }
  public replace(_from: TypeVariable, _to: Type): void {
    // do nothing
  }
  public getVariables(): TypeVariable[] {
    return [];
  }
}

export class TypeBool extends TypeConstructor {
  constructor() {
    super('TypeBool');
  }
  public toString(): string {
    return 'bool';
  }
  public toTexString(): string {
    return '{\\rm bool}';
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeBool) return true;
    else return false;
  }
  public match(t: Type): TypeEquation[] {
    if (t instanceof TypeBool) {
      return [];
    } else {
      throw new TypeError(this + ' and ' + t + ' are not compatible.');
    }
  }
  public contains(_t: TypeVariable): boolean {
    return false;
  }
  public replace(_from: TypeVariable, _to: Type): void {
    // do nothing
  }
  public getVariables(): TypeVariable[] {
    return [];
  }
}

export class TypeList extends TypeConstructor {
  content: Type;
  constructor(x: Type) {
    super('TypeList');
    this.content = x;
  }
  public toString(): string {
    return 'list(' + this.content + ')';
  }
  public toTexString(): string {
    return '{\\rm list}(' + this.content.toTexString() + ')';
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeList) return this.content.equals(t.content);
    else return false;
  }
  public match(t: Type): TypeEquation[] {
    if (t instanceof TypeList) {
      return [new TypeEquation(this.content, t.content)];
    } else {
      throw new TypeError(this + ' and ' + t + ' are not compatible.');
    }
  }
  public contains(t: TypeVariable): boolean {
    return this.content.contains(t);
  }
  public replace(from: TypeVariable, to: Type): void {
    if (this.content.equals(from)) {
      this.content = to;
    } else {
      this.content.replace(from, to);
    }
  }
  public getVariables(): TypeVariable[] {
    return this.content.getVariables();
  }
}

export class TypeFunc extends TypeConstructor {
  left: Type;
  right: Type;
  constructor(left: Type, right: Type) {
    super('TypeFunc');
    this.left = left;
    this.right = right;
  }
  public toString(): string {
    let ret: string;
    if (this.left instanceof TypeFunc) ret = '(' + this.left + ')';
    else ret = this.left.toString();
    return ret + ' -> ' + this.right;
  }
  public toTexString(): string {
    let ret: string;
    if (this.left instanceof TypeFunc)
      ret = '(' + this.left.toTexString() + ')';
    else ret = this.left.toTexString();
    return ret + ' \\rightarrow ' + this.right.toTexString();
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeFunc)
      return t.left.equals(this.left) && t.right.equals(this.right);
    else return false;
  }
  public match(t: Type): TypeEquation[] {
    if (t instanceof TypeFunc) {
      return [
        new TypeEquation(this.left, t.left),
        new TypeEquation(this.right, t.right),
      ];
    } else {
      throw new TypeError(this + ' and ' + t + ' are not compatible.');
    }
  }
  public contains(t: TypeVariable): boolean {
    return this.left.contains(t) || this.right.contains(t);
  }
  public replace(from: TypeVariable, to: Type): void {
    if (this.left.equals(from)) {
      this.left = to;
    } else {
      this.left.replace(from, to);
    }
    if (this.right.equals(from)) {
      this.right = to;
    } else {
      this.right.replace(from, to);
    }
  }
  public getVariables(): TypeVariable[] {
    return this.left.getVariables().concat(this.right.getVariables());
  }
}

export class TypeVariable extends Type {
  id: number;
  static maxId: number;
  static alphabet: string[] =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  static texAlphabet: string[] = [
    '\\alpha',
    '\\beta',
    '\\gamma',
    '\\delta',
    '\\varepsilon',
    '\\zeta',
    '\\eta',
    '\\theta',
    '\\iota',
    '\\kappa',
    '\\mu',
    '\\nu',
    '\\xi',
    '\\pi',
    '\\rho',
    '\\sigma',
    '\\upsilon',
    '\\phi',
    '\\chi',
    '\\psi',
    '\\omega',
    '\\Gamma',
    '\\Delta',
    '\\Theta',
    '\\Xi',
    '\\Pi',
    '\\Sigma',
    '\\Phi',
    '\\Psi',
    '\\Omega',
  ].concat(TypeVariable.alphabet);

  private constructor(id: number) {
    super('TypeVariable');
    this.id = id;
  }
  public toString(): string {
    if (this.id < 0) return "'" + TypeVariable.alphabet[-this.id - 1];
    return "'t" + this.id;
  }
  public toTexString(): string {
    if (this.id < 0) return TypeVariable.texAlphabet[-this.id - 1];
    return '\\tau_{' + this.id + '}';
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeVariable) return this.id === t.id;
    else return false;
  }
  public static getNew(): TypeVariable {
    if (TypeVariable.maxId === undefined) {
      TypeVariable.maxId = 0;
      return new TypeVariable(0);
    } else {
      TypeVariable.maxId++;
      return new TypeVariable(TypeVariable.maxId);
    }
  }
  public contains(t: TypeVariable): boolean {
    return this.equals(t);
  }
  public replace(_from: TypeVariable, _to: Type): void {
    // do nothing
  }
  public getVariables(): TypeVariable[] {
    return [this];
  }
  public static getAlphabet(i: number): TypeVariable {
    return new TypeVariable(-i - 1);
  }
  static contains(a: TypeVariable[], b: TypeVariable): boolean {
    for (const ta of a) {
      if (ta.equals(b)) {
        return true;
      }
    }
    return false;
  }
}

export class TypeUntyped extends Type {
  constructor() {
    super('TypeUntyped');
  }
  public toString(): string {
    return 'Untyped';
  }
  public toTexString(): string {
    return '{\\rm Untyped}';
  }
  public equals(t: Type): boolean {
    if (t instanceof TypeUntyped) return true;
    else return false;
  }
  public contains(_t: TypeVariable): boolean {
    return false;
  }
  public replace(_from: TypeVariable, _to: Type): void {
    // do nothing
  }
  public getVariables(): TypeVariable[] {
    return [];
  }
}
