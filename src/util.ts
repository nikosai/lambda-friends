import { LambdaParseError } from './error';
import {
  Macro,
  Token,
  Expression,
  Nil,
  ConstBool,
  ConstInt,
  ConstOp,
  Const,
  Application,
  LambdaAbstraction,
  If,
  Let,
  Case,
  Fix,
  List,
  Variable,
} from './expression';

// 字句解析
function tokenize(str: string, typed: boolean): Token[] {
  const strs: string[] = str.split('');
  const tokens: Token[] = [];
  while (strs.length > 0) {
    let c = strs.shift().trim();
    if (c === '') {
      // do nothing
    } else if (c === '<') {
      // <macro>
      let content = '';
      for (;;) {
        if (strs.length == 0) throw new LambdaParseError("Too many LANGLE '<'");
        c = strs.shift();
        if (c === '>') break;
        else content += c;
      }
      tokens.push(Macro.get(content, typed));
    } else if (typed && c === '[') {
      // [const]
      let content = '';
      for (;;) {
        if (strs.length == 0)
          throw new LambdaParseError("Too many LBRACKET '['");
        c = strs.shift();
        if (c === ']') break;
        else content += c;
      }
      let result: Token = null;
      switch (content) {
        case 'nil':
          result = new Nil();
          break;
        case 'false':
        case 'true':
          result = new ConstBool(content === 'true');
          break;
        case 'if':
        case 'then':
        case 'else':
        case 'let':
        case 'in':
        case 'case':
        case 'of':
        case 'fix':
          result = new Token(content);
          break;
        default:
          if (content.match(/^\d+$|^-\d+$/) !== null) {
            result = new ConstInt(parseInt(content));
          } else {
            result = new ConstOp(content); // fail -> null
          }
      }
      if (result === null)
        throw new LambdaParseError('Unknown Const: [' + content + ']');
      tokens.push(result);
    } else {
      tokens.push(new Token(c));
    }
  }
  return tokens;
}

// 構文解析
export function parseTokens(tokens: Token[], typed: boolean): Expression {
  let left: Expression = null;
  while (tokens.length > 0) {
    // 最初のToken
    const first: Token = tokens.shift();
    if (
      first instanceof Const ||
      first instanceof Nil ||
      first instanceof Macro
    ) {
      if (left === null) left = first;
      else left = new Application(left, first);
      continue;
    }

    switch (first.name) {
      case '\\':
      case '\u00a5':
      case 'λ': {
        // abst
        if (left === null) return LambdaAbstraction.parse(tokens, typed);
        else
          return new Application(left, LambdaAbstraction.parse(tokens, typed));
      }
      case '(': {
        // application
        const content: Token[] = [];
        let i = 1;
        for (;;) {
          if (tokens.length === 0)
            throw new LambdaParseError("Too many LPAREN '('");
          const t = tokens.shift();
          if (t.name === '(') i++;
          else if (t.name === ')') i--;
          if (i === 0) break;
          content.push(t);
        }
        const contentExpr: Expression = parseTokens(content, typed);
        if (left === null) left = contentExpr;
        else left = new Application(left, contentExpr);
        break;
      }
      default: {
        if (typed) {
          switch (first.name) {
            case 'if': {
              // if statement
              return If.parse(tokens, typed);
            }
            case 'let': {
              // let statement
              return Let.parse(tokens, typed);
            }
            case 'case': {
              // case statement: [case] M [of] [nil] -> M | x::x -> M
              return Case.parse(tokens, typed);
            }
            case 'fix': {
              // fixed-point: [fix] x.M
              return Fix.parse(tokens, typed);
            }
            case ':': {
              // list
              const t = tokens.shift();
              if (t.name !== ':')
                throw new LambdaParseError("Unexpected token: '" + t + "'");
              return new List(left, parseTokens(tokens, typed));
            }
          }
        }
        if (first.name.match(/^[A-Za-z]$/) === null)
          throw new LambdaParseError("Unexpected token: '" + first + "'");
        // variable
        if (left === null) left = new Variable(first.name);
        else left = new Application(left, new Variable(first.name));
      }
    }
  }
  if (left === null) throw new LambdaParseError('No contents in Expression');
  return left;
}

// 字句解析と構文解析 return: root node
export function makeAST(str: string, typed: boolean): Expression {
  return parseTokens(tokenize(str, typed), typed);
}

// Input : lambda(cp(L0,L1),lambda(L2,apply(apply(L1,L0),L2)))
// Now   : lambda([L0,L1], lambda([L2],apply()))
// Output: \xy.xxy
export function parseLMNtal(str: string): Expression {
  return parse(str, [], {});

  function parse(
    str: string,
    usedVars: Variable[],
    map: { [key: string]: string }
  ) {
    str = str.trim();
    const res = str.match(/^.+?(?=\()/);
    if (res === null) {
      const ret = map[str];
      if (ret === undefined)
        throw new LambdaParseError(
          'Malformed LMNtal Lambda Term. Unknown Token: ' + str
        );
      return new Variable(ret);
    }

    const atom = res[0].trim();
    const args = parseArg(str.match(/\(.+$/)[0]);

    switch (atom) {
      case 'lambda': {
        if (args.length !== 2)
          throw new LambdaParseError(
            'Malformed LMNtal Lambda Term. lambda(X,A) should have 2 args.'
          );
        const v = Variable.getNew(usedVars);
        const bvs = parseAbsArg(args[0]);
        for (const bv of bvs) map[bv] = v.name;
        return new LambdaAbstraction(
          v,
          parse(args[1], usedVars.concat(v), Object.assign({}, map))
        );
      }
      case 'apply': {
        if (args.length !== 2)
          throw new LambdaParseError(
            'Malformed LMNtal Lambda Term. apply(A,B) should have 2 args.'
          );
        return new Application(
          parse(args[0], [].concat(usedVars), Object.assign({}, map)),
          parse(args[1], [].concat(usedVars), Object.assign({}, map))
        );
      }
      case 'fv': {
        if (args.length !== 1)
          throw new LambdaParseError(
            'Malformed LMNtal Lambda Term. fv(X) should have 1 arg.'
          );
        if (args[0].length !== 1 || !args[0].match(/[a-z]/))
          return Macro.get(args[0], false);
        // throw new LambdaParseError("too long free variable name: "+ args[0]);
        return new Variable(args[0]);
      }
      default:
        throw new LambdaParseError(
          'Malformed LMNtal Lambda Term. Unexpected atom name: ' + atom
        );
    }
  }

  // Ex1: (L0,cp(L1,L2)) => ["L0","cp(L1,L2)"]
  // Ex2: (L0) => ["L0"]
  // Ex3: ( ) => []
  function parseArg(str: string): string[] {
    str = str.trim();
    if (str[0] !== '(' || str[str.length - 1] !== ')')
      throw new LambdaParseError(
        'Malformed LMNtal Lambda Term. Invalid Parentheses.'
      );
    let level = 0;
    let content = '';
    const strs: string[] = [];
    for (let i = 1; i < str.length - 1; i++) {
      const t = str[i];
      if (t === '(') level++;
      else if (t === ')') level--;
      if (level === 0 && t === ',') {
        strs.push(content);
        content = '';
      } else {
        content += t;
      }
    }
    if (level !== 0)
      throw new LambdaParseError(
        'Malformed LMNtal Lambda Term. Invalid Parentheses.'
      );
    strs.push(content);
    if (strs.length === 1) {
      const s = strs[0].trim();
      if (s === '') return [];
      else return [s];
    }
    const ret: string[] = [];
    for (const s of strs) ret.push(s.trim());
    return ret;
  }

  // Ex1: cp(L0,cp(L1,L2)) => [L0,L1,L2]
  // Ex2: L0 => [L0]
  // Ex3: rm => []
  function parseAbsArg(str: string): string[] {
    str = str.trim();
    const res = str.match(/^.+?(?=\()/);
    if (res === null) {
      if (str === 'rm') return [];
      else return [str];
    }
    const atom = res[0].trim();
    const args = parseArg(str.match(/\(.+$/)[0]);
    if (atom === 'rm') {
      if (args.length !== 0)
        throw new LambdaParseError(
          'Malformed LMNtal Lambda Term. rm() should have 0 args.'
        );
      return [];
    } else if (atom === 'cp') {
      if (args.length !== 2)
        throw new LambdaParseError(
          'Malformed LMNtal Lambda Term. cp(A,B) should have 2 args.'
        );
      return parseAbsArg(args[0].trim()).concat(parseAbsArg(args[1].trim()));
    } else {
      throw new LambdaParseError(
        'Malformed LMNtal Lambda Term. Unexpected atom name: ' + atom
      );
    }
  }
}

// チャーチ数を表すExpression (string)の生成
export function makeChurchNum(n: number): string {
  const str = '\\sz.';
  let content = n === 0 ? 'z' : 'sz';
  for (let i = 1; i < n; i++) {
    content = 's(' + content + ')';
  }
  return str + content;
}

export function makeTerms(depth: number): Expression[] {
  return sub([], depth);
  function sub(vs: Variable[], depth: number): Expression[] {
    const ret: Expression[] = [].concat(vs);
    if (depth === 0) return ret;
    const res = sub(vs, depth - 1);
    // Application
    for (let i = 0; i < res.length; i++)
      for (let j = 0; j < res.length; j++)
        ret.push(new Application(res[i], res[j]));
    // Lambda Abstraction
    const newVar = Variable.getNew(vs);
    const res1 = sub(vs.concat(newVar), depth - 1);
    for (const r of res1) ret.push(new LambdaAbstraction(newVar, r));
    return ret;
  }
}

export function htmlEscape(str: string): string {
  return str.replace(/[&'`"<>]/g, function (match) {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    }[match];
  });
}

export function putParens(str: string, noParens?: boolean): string {
  if (noParens) return str;
  else return `(${str})`;
}
