(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 例外の抽象クラス
class LambdaFriendsError {
    constructor(name, message) {
        this.name = name;
        this.message = message;
        // if (typeof Error.captureStackTrace === "function"){
        //   Error.captureStackTrace(this,this.constructor);
        // }
    }
    toString() {
        // return this.stack;
        return this.name + ": " + this.message;
    }
}
exports.LambdaFriendsError = LambdaFriendsError;
// Parse中の例外
class LambdaParseError extends LambdaFriendsError {
    constructor(message) {
        super("LambdaParseError", message);
    }
}
exports.LambdaParseError = LambdaParseError;
// Substitutionの例外
class SubstitutionError extends LambdaFriendsError {
    constructor(message) {
        super("SubstitutionError", message);
    }
}
exports.SubstitutionError = SubstitutionError;
// Reductionの例外
class ReductionError extends LambdaFriendsError {
    constructor(message) {
        super("ReductionError", message);
    }
}
exports.ReductionError = ReductionError;
// Macroの例外
class MacroError extends LambdaFriendsError {
    constructor(message) {
        super("MacroError", message);
    }
}
exports.MacroError = MacroError;
// Typeの例外
class TypeError extends LambdaFriendsError {
    constructor(message) {
        super("TypeError", message);
    }
}
exports.TypeError = TypeError;
// TexにParseする際の例外
class TexError extends LambdaFriendsError {
    constructor(message) {
        super("TexError", message);
    }
}
exports.TexError = TexError;

},{}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const type_1 = require("./type");
const error_1 = require("./error");
function parseConst(str) {
    switch (str) {
        case "nil":
            return exports.nil;
        case "false":
        case "true":
            return new ConstBool(str === "true");
        case "if":
        case "then":
        case "else":
        case "let":
        case "in":
        case "case":
        case "of":
            return new Symbol(str);
    }
    if (str.match(/^\d+$|^-\d+$/) !== null) {
        return new ConstInt(parseInt(str));
    }
    else {
        return new ConstOp(str); // fail -> null
    }
}
exports.parseConst = parseConst;
function makeUntypedAST(str) {
    var strs = str.split(/\s*/).join("").split("");
    var tokens = [];
    while (strs.length > 0) {
        var c = strs.shift();
        switch (c) {
            case "<":
                var content = "";
                while (true) {
                    if (strs.length == 0)
                        throw new error_1.LambdaParseError("Too many LANGLE '<'");
                    c = strs.shift();
                    if (c === ">")
                        break;
                    else
                        content += c;
                }
                tokens.push(Macro.get(content, false));
                break;
            case "=":
                // Macro definition
                var cmds = str.split("=");
                var name = cmds.shift().trim();
                var s = cmds.join("=");
                return Macro.add(name, s, false);
            default:
                tokens.push(new Symbol(c));
        }
    }
    // console.log(tokens);
    var ret = makeUntypedASTfromSymbols(tokens);
    ret.isTopLevel = true;
    return ret;
}
exports.makeUntypedAST = makeUntypedAST;
function makeUntypedASTfromSymbols(tokens) {
    var left = null;
    while (tokens.length > 0) {
        // 最初のSymbol
        var first = tokens.shift();
        if (first instanceof Macro) {
            if (left === null)
                left = first;
            else
                left = new Application(left, first);
            continue;
        }
        switch (first.name) {
            case "\\":
            case "\u00a5":
            case "λ":
                // abst
                if (left === null)
                    return LambdaAbstraction.parse(tokens);
                else
                    return new Application(left, LambdaAbstraction.parse(tokens));
            case "(":
                // application
                var content = [];
                var i = 1;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Too many LPAREN '('");
                    var t = tokens.shift();
                    if (t.name === "(")
                        i++;
                    else if (t.name === ")")
                        i--;
                    if (i == 0)
                        break;
                    content.push(t);
                }
                var contentExpr = makeUntypedASTfromSymbols(content);
                if (left === null)
                    left = contentExpr;
                else
                    left = new Application(left, contentExpr);
                break;
            default:
                if (first.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + first + "'");
                // variable
                if (left === null)
                    left = new Variable(first.name);
                else
                    left = new Application(left, new Variable(first.name));
        }
    }
    if (left === null)
        throw new error_1.LambdaParseError("No contents in Expression");
    return left;
}
exports.makeUntypedASTfromSymbols = makeUntypedASTfromSymbols;
function makeAST(str) {
    var strs = str.split(/\s*/).join("").split("");
    var tokens = [];
    while (strs.length > 0) {
        var c = strs.shift();
        switch (c) {
            case "<":
                var content = "";
                while (true) {
                    if (strs.length == 0)
                        throw new error_1.LambdaParseError("Too many LANGLE '<'");
                    c = strs.shift();
                    if (c === ">")
                        break;
                    else
                        content += c;
                }
                tokens.push(Macro.get(content, true));
                break;
            case "[":
                var content = "";
                while (true) {
                    if (strs.length == 0)
                        throw new error_1.LambdaParseError("Too many LBRACKET '['");
                    c = strs.shift();
                    if (c === "]")
                        break;
                    else
                        content += c;
                }
                var result = parseConst(content);
                if (result === null)
                    throw new error_1.LambdaParseError("Unknown Const: [" + content + "]");
                tokens.push(result);
                break;
            case "=":
                // Macro definition
                var cmds = str.split("=");
                var name = cmds.shift().trim();
                var s = cmds.join("=");
                return Macro.add(name, s, true);
            default:
                tokens.push(new Symbol(c));
        }
    }
    // console.log(tokens);
    var ret = makeASTfromSymbols(tokens);
    ret.getType();
    ret.isTopLevel = true;
    return ret;
}
exports.makeAST = makeAST;
function makeASTfromSymbols(tokens) {
    var left = null;
    while (tokens.length > 0) {
        // 最初のSymbol
        var first = tokens.shift();
        if (first instanceof Const || first instanceof Nil || first instanceof Macro) {
            if (left === null)
                left = first;
            else
                left = new Application(left, first);
            continue;
        }
        switch (first.name) {
            case "\\":
            case "\u00a5":
            case "λ":
                // abst
                if (left === null)
                    return LambdaAbstraction.parse(tokens);
                else
                    return new Application(left, LambdaAbstraction.parse(tokens));
            case "(":
                // application
                var content = [];
                var i = 1;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Too many LPAREN '('");
                    var t = tokens.shift();
                    if (t.name === "(")
                        i++;
                    else if (t.name === ")")
                        i--;
                    if (i == 0)
                        break;
                    content.push(t);
                }
                var contentExpr = makeASTfromSymbols(content);
                if (left === null)
                    left = contentExpr;
                else
                    left = new Application(left, contentExpr);
                break;
            case "if":
                // if statement
                var state = [];
                var i_num = 0, t_num = 0, e_num = 0;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Illegal If statement");
                    var t = tokens.shift();
                    switch (t.name) {
                        case "if":
                            i_num++;
                            break;
                        case "then":
                            t_num++;
                            break;
                        case "else":
                            e_num++;
                            break;
                    }
                    if (i_num === e_num && t_num === i_num + 1)
                        break;
                    state.push(t);
                }
                var stateExpr = makeASTfromSymbols(state);
                var ifTrue = [];
                i_num = 0, t_num = 0, e_num = 0;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Illegal If statement");
                    var t = tokens.shift();
                    switch (t.name) {
                        case "if":
                            i_num++;
                            break;
                        case "then":
                            t_num++;
                            break;
                        case "else":
                            e_num++;
                            break;
                    }
                    if (i_num === t_num && e_num === i_num + 1)
                        break;
                    ifTrue.push(t);
                }
                var ifTrueExpr = makeASTfromSymbols(ifTrue);
                var ifFalseExpr = makeASTfromSymbols(tokens);
                return new If(stateExpr, ifTrueExpr, ifFalseExpr);
            case "let":
                // let statement
                var t = tokens.shift();
                if (t.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var boundVal = new Variable(t.name);
                if (tokens.shift().name !== "=")
                    throw new error_1.LambdaParseError("'=' is expected");
                var content = [];
                var i = 1;
                while (true) {
                    // console.log(i);
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Illegal Let statement");
                    var t = tokens.shift();
                    if (t.name === "let")
                        i++;
                    else if (t.name === "in")
                        i--;
                    if (i == 0)
                        break;
                    content.push(t);
                }
                var contentExpr = makeASTfromSymbols(content);
                var restExpr = makeASTfromSymbols(tokens);
                return new Let(boundVal, contentExpr, restExpr);
            case "case":
                // case statement: [case] M [of] [nil] -> M | x::x -> M
                var state = [];
                var i = 1;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Illegal Case statement");
                    var t = tokens.shift();
                    if (t.name === "case")
                        i++;
                    else if (t.name === "of")
                        i--;
                    if (i == 0)
                        break;
                    state.push(t);
                }
                var stateExpr = makeASTfromSymbols(state);
                var t = tokens.shift();
                if (t.name !== "nil")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var t = tokens.shift();
                if (t.name !== "-")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var t = tokens.shift();
                if (t.name !== ">")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var ifNil = [];
                var i = 1;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Too many [case]");
                    var t = tokens.shift();
                    if (t.name === "case")
                        i++;
                    else if (t.name === "|")
                        i--;
                    if (i == 0)
                        break;
                    ifNil.push(t);
                }
                var ifNilExpr = makeASTfromSymbols(ifNil);
                var head = new Variable(tokens.shift().name);
                if (head.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + head.name + "'");
                var t = tokens.shift();
                if (t.name !== ":")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var t = tokens.shift();
                if (t.name !== ":")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var tail = new Variable(tokens.shift().name);
                if (tail.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + tail.name + "'");
                var t = tokens.shift();
                if (t.name !== "-")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var t = tokens.shift();
                if (t.name !== ">")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                var ifElseExpr = makeASTfromSymbols(tokens);
                return new Case(stateExpr, ifNilExpr, head, tail, ifElseExpr);
            case ":":
                // list
                var t = tokens.shift();
                if (t.name !== ":")
                    throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                return new List(left, makeASTfromSymbols(tokens));
            default:
                if (first.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + first + "'");
                // variable
                if (left === null)
                    left = new Variable(first.name);
                else
                    left = new Application(left, new Variable(first.name));
        }
    }
    if (left === null)
        throw new error_1.LambdaParseError("No contents in Expression");
    return left;
}
exports.makeASTfromSymbols = makeASTfromSymbols;
class ReductionResult {
    constructor(expr, str, hasNext) {
        this.expr = expr;
        this.str = str;
        this.hasNext = hasNext;
    }
}
exports.ReductionResult = ReductionResult;
class Redex {
    constructor(type) {
        this.left = "";
        this.right = "";
        this.type = type;
    }
    addLeft(s) {
        this.left = s + this.left;
    }
    addRight(s) {
        this.right += s;
    }
    static makeNext(es, prefix, suffix, func) {
        var ret = [].concat(es);
        for (var e of ret) {
            e.next = func(e.next);
            e.addLeft(prefix);
            e.addRight(suffix);
        }
        return ret;
    }
}
exports.Redex = Redex;
class BetaRedex extends Redex {
    constructor(e) {
        super("beta");
        this.content = e;
        this.la = e.left;
        this.next = this.la.expr.substitute(this.la.boundval, e.right);
        this.arg = e.right;
    }
    toString() {
        return this.left + "(\\[" + this.la.boundval + "]." + this.la.expr + ")[" + this.arg + "]" + this.right;
    }
}
exports.BetaRedex = BetaRedex;
class EtaRedex extends Redex {
    constructor(e) {
        super("eta");
        this.content = e;
        this.app = e.expr;
        this.next = this.app.left;
    }
    toString() {
        return this.left + "[(\\" + this.content.boundval + "." + this.app + ")]" + this.right;
    }
}
exports.EtaRedex = EtaRedex;
class MacroRedex extends Redex {
    constructor(e) {
        super("macro");
        this.content = e;
        this.next = e.expr;
    }
    toString() {
        return this.left + "[<" + this.content.name + ">]" + this.right;
    }
}
exports.MacroRedex = MacroRedex;
class TypeResult {
    constructor(eqs, proofTree) {
        this.eqs = eqs;
        this.proofTree = proofTree;
    }
}
exports.TypeResult = TypeResult;
// ラムダ項（抽象クラス）
class Expression {
    // type: Type;
    constructor(className) {
        this.isTopLevel = false;
        this.className = className;
    }
    continualReduction(n) {
        var cur = this;
        var str = cur.toString() + " : " + cur.getType() + "\n";
        for (var i = 0; i < n; i++) {
            var next = cur.reduction();
            if (cur.equals(next))
                break;
            cur = next;
            str += " ==> " + next.toString() + "\n";
        }
        return new ReductionResult(cur, str, cur.hasNext());
    }
    hasNext() {
        return !this.equals(this.reduction());
    }
    continualUntypedReduction(n, etaAllowed) {
        var cur = this;
        var str = cur.toString() + " : Untyped\n";
        for (var i = 0; i < n; i++) {
            var rs = cur.getRedexes(etaAllowed);
            if (rs.length === 0)
                break;
            cur = rs.pop().next;
            str += " ==> " + cur.toString() + "\n";
        }
        return new ReductionResult(cur, str, cur.isNormalForm(etaAllowed));
    }
    isNormalForm(etaAllowed) {
        return this.getRedexes(etaAllowed).length === 0;
    }
    getType() {
        type_1.TypeVariable.maxId = undefined;
        var target = type_1.TypeVariable.getNew();
        var eqs = this.getEquations([], target).eqs;
        var ret = type_1.TypeEquation.get(target, type_1.TypeEquation.solve(eqs));
        var vs = ret.getVariables();
        // 't0,'t1,'t2,... から 'a,'b,'c,... に変換
        var vars = [];
        for (var v of vs) {
            if (!type_1.TypeVariable.contains(vars, v))
                vars.push(v);
        }
        var i = 0;
        for (var v of vars) {
            ret.replace(v, type_1.TypeVariable.getAlphabet(i));
            i++;
        }
        return ret;
    }
}
exports.Expression = Expression;
// 終端記号（未解析）
class Symbol extends Expression {
    constructor(name, className) {
        if (className === undefined)
            super("Symbol");
        else
            super(className);
        this.name = name;
    }
    equals(expr) {
        return (expr instanceof Symbol) && (expr.className === this.className) && (expr.name === this.name);
    }
    equalsAlpha(expr) {
        return (expr instanceof Symbol) && (expr.className === this.className) && (expr.name === this.name);
    }
    toString() {
        return this.name;
    }
    toTexString() {
        throw new error_1.TexError("class Symbol does not have tex string");
    }
    getFV() {
        return this.freevals;
    }
    substitute(x, expr) {
        throw new error_1.SubstitutionError("Undefined Substitution");
    }
    reduction() {
        return this;
    }
    getEquations(gamma, type) {
        throw new error_1.TypeError("Undefined Type");
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Symbols must not appear in parsed Expression");
    }
}
exports.Symbol = Symbol;
// 変数 x
class Variable extends Symbol {
    constructor(name) {
        super(name, "Variable");
        this.freevals = [this];
    }
    substitute(x, expr) {
        if (this.equals(x))
            return expr;
        else
            return this;
    }
    getEquations(gamma, type) {
        for (var g of gamma) {
            if (g.equals(this)) {
                // (var)
                var str = "\\AxiomC{}\n";
                str += "\\RightLabel{\\scriptsize(var)}\n";
                str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.name + " : " + type.toTexString() + " $}\n";
                return new TypeResult([new type_1.TypeEquation(g.type, type)], str);
            }
        }
        throw new error_1.TypeError("free variable is not allowed: " + this);
    }
    toTexString() {
        return this.name;
    }
    static union(a, b, c) {
        if (c === undefined) {
            var ret = [];
            for (var v of a) {
                ret.push(v);
            }
            for (var v of Variable.dif(b, a)) {
                ret.push(v);
            }
            return ret;
        }
        else {
            return Variable.union(Variable.union(a, b), c);
        }
    }
    static dif(a, b) {
        var ret = [];
        for (var ta of a) {
            if (!Variable.contains(b, ta))
                ret.push(ta);
        }
        return ret;
    }
    static contains(a, b) {
        for (var ta of a) {
            if (ta.equals(b)) {
                return true;
            }
        }
        return false;
    }
    static gammaToTexString(gamma) {
        if (gamma.length === 0)
            return "";
        var ret = gamma[0].name + " : " + gamma[0].type.toTexString();
        for (var i = 1; i < gamma.length; i++) {
            ret += ",~" + gamma[i].name + " : " + gamma[i].type.toTexString();
        }
        return ret;
    }
    static getNew(used) {
        var alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (var a of alphabet) {
            var z = new Variable(a);
            if (!Variable.contains(used, z)) {
                return z;
            }
        }
        throw new error_1.SubstitutionError("No more Variables available");
    }
    getRedexes(etaAllowed) {
        return [];
    }
}
exports.Variable = Variable;
// 定数 c
class Const extends Symbol {
    constructor(name, className) {
        super(name, className);
        this.freevals = [];
    }
    substitute(x, expr) {
        return this;
    }
    getEquations(gamma, type) {
        // (con)
        var str = "\\AxiomC{}\n";
        str += "\\RightLabel{\\scriptsize(con)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult([new type_1.TypeEquation(this.type, type)], str);
    }
    toTexString() {
        return this.name + "^{" + this.type.toTexString() + "}";
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.Const = Const;
// int型定数 c^{int}
class ConstInt extends Const {
    constructor(value) {
        super(value.toString(), "ConstInt");
        this.value = value;
        this.type = type_1.typeInt;
    }
}
exports.ConstInt = ConstInt;
// bool型定数 c^{bool}
class ConstBool extends Const {
    constructor(value) {
        super(value.toString(), "ConstBool");
        this.value = value;
        this.type = type_1.typeBool;
    }
}
exports.ConstBool = ConstBool;
// 関数型定数 c^{op} （前置記法・2項演算）
class ConstOp extends Const {
    constructor(funcName) {
        super(funcName, "ConstOp");
        switch (funcName) {
            case "+":
                this.value = (x, y) => (new ConstInt(x.value + y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeInt));
                break;
            case "-":
                this.value = (x, y) => (new ConstInt(x.value - y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeInt));
                break;
            case "*":
                this.value = (x, y) => (new ConstInt(x.value * y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeInt));
                break;
            case "/":
                this.value = (x, y) => { if (y.value === 0)
                    throw new error_1.ReductionError("Dividing by '0' is not allowed");
                else
                    return new ConstInt(Math.floor(x.value / y.value)); };
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeInt));
                break;
            case "%":
                this.value = (x, y) => { if (y.value === 0)
                    throw new error_1.ReductionError("Dividing by '0' is not allowed");
                else
                    return new ConstInt(x.value - Math.floor(x.value / y.value) * 4); };
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeInt));
                break;
            case "<":
                this.value = (x, y) => (new ConstBool(x.value < y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case ">":
                this.value = (x, y) => (new ConstBool(x.value > y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case "<=":
                this.value = (x, y) => (new ConstBool(x.value <= y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case ">=":
                this.value = (x, y) => (new ConstBool(x.value >= y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case "==":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case "!=":
                this.value = (x, y) => (new ConstBool(x.value != y.value));
                this.type = new type_1.TypeFunc(type_1.typeInt, new type_1.TypeFunc(type_1.typeInt, type_1.typeBool));
                break;
            case "eq":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "eq":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "xor":
                this.value = (x, y) => (new ConstBool(x.value != y.value));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "or":
                this.value = (x, y) => (new ConstBool(x.value || y.value));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "and":
                this.value = (x, y) => (new ConstBool(x.value && y.value));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "nor":
                this.value = (x, y) => (new ConstBool(!(x.value || y.value)));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            case "nand":
                this.value = (x, y) => (new ConstBool(!(x.value && y.value)));
                this.type = new type_1.TypeFunc(type_1.typeBool, new type_1.TypeFunc(type_1.typeBool, type_1.typeBool));
                break;
            default:
                throw new error_1.LambdaParseError("Undefined function: " + funcName);
        }
    }
}
exports.ConstOp = ConstOp;
// 空リスト nil
class Nil extends Symbol {
    substitute(x, expr) {
        return this;
    }
    constructor() {
        super("nil", "Nil");
        this.freevals = [];
    }
    static getInstance() {
        if (Nil.instance === undefined) {
            return Nil.instance = new Nil();
        }
        else
            return Nil.instance;
    }
    getEquations(gamma, type) {
        // (nil)
        var t = type_1.TypeVariable.getNew();
        var nType = new type_1.TypeList(t);
        var str = "\\AxiomC{}\n";
        str += "\\RightLabel{\\scriptsize(nil)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.name + " : " + nType.toTexString() + " $}\n";
        return new TypeResult([new type_1.TypeEquation(type, nType)], str);
    }
    toTexString() {
        return "{\\rm " + this.name + "}";
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.Nil = Nil;
exports.nil = Nil.getInstance();
// マクロ定義
class Macro extends Symbol {
    constructor(name, expr, typed) {
        super(name, "Macro");
        this.freevals = [];
        this.expr = expr;
        this.typed = typed;
    }
    static add(name, str, typed) {
        if (typed) {
            var ret = makeAST(str);
            if (ret.getFV().length !== 0) {
                throw new error_1.MacroError("<" + name + "> contains free variables: " + ret.getFV());
            }
            Macro.map[name] = new Macro(name, ret, typed);
            return Macro.map[name];
        }
        else {
            var ret = makeUntypedAST(str);
            if (ret.getFV().length !== 0) {
                throw new error_1.MacroError("<" + name + "> contains free variables: " + ret.getFV());
            }
            Macro.mapUntyped[name] = new Macro(name, ret, typed);
            return Macro.mapUntyped[name];
        }
    }
    static get(name, typed) {
        var ret;
        if (typed) {
            ret = Macro.map[name];
        }
        else {
            ret = Macro.mapUntyped[name];
        }
        if (ret === undefined) {
            return new Macro(name, undefined, typed);
        }
        else {
            return new Macro(name, ret.expr, typed);
        }
    }
    substitute(x, expr) {
        return this;
    }
    toString() {
        return "<" + this.name + ">";
    }
    reduction() {
        if (this.expr === undefined)
            return this;
        else
            return this.expr;
    }
    equalsAlpha(expr) {
        // 再検討の余地あり
        if (this.expr === undefined)
            return this.equals(expr);
        else
            return this.expr.equalsAlpha(expr);
    }
    getEquations(gamma, type) {
        // ????
        if (this.expr === undefined)
            throw new error_1.TypeError(this + " is undefined.");
        else
            return this.expr.getEquations(gamma, type);
    }
    toTexString() {
        return "\\overline{\\bf " + this.name + "}";
    }
    getRedexes(etaAllowed) {
        if (this.expr === undefined)
            return [];
        else
            return [new MacroRedex(this)];
    }
}
Macro.map = {};
Macro.mapUntyped = {};
exports.Macro = Macro;
// ラムダ抽象 \x.M
class LambdaAbstraction extends Expression {
    constructor(boundval, expr) {
        super("LambdaAbstraction");
        this.freevals = undefined;
        this.boundval = boundval;
        this.expr = expr;
    }
    static parse(tokens) {
        var boundvals = [];
        while (tokens.length > 0) {
            var t = tokens.shift();
            if (t.name === ".") {
                var expr = makeASTfromSymbols(tokens);
                while (boundvals.length > 0) {
                    expr = new LambdaAbstraction(boundvals.pop(), expr);
                }
                return expr;
            }
            else if (t.name.match(/^[A-Za-z]$/) === null) {
                throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
            }
            else {
                boundvals.push(new Variable(t.name));
            }
        }
        throw new error_1.LambdaParseError("'.' is needed");
    }
    toString() {
        var boundvals = [this.boundval];
        var expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval);
            expr = expr.expr;
        }
        var str = "\\" + boundvals.join("") + ".";
        if (expr instanceof Application) {
            var expr1 = expr.left;
            var str1 = expr.right.toString();
            while (expr1 instanceof Application) {
                str1 = expr1.right + str1;
                expr1 = expr1.left;
            }
            str1 = expr1 + str1;
            str = str + str1;
        }
        else {
            str = str + expr;
        }
        if (!this.isTopLevel)
            str = "(" + str + ")";
        return str;
    }
    getFV() {
        if (this.freevals !== undefined)
            return this.freevals;
        this.freevals = [];
        return this.freevals = Variable.dif(this.expr.getFV(), [this.boundval]);
    }
    substitute(y, expr) {
        if (this.boundval.equals(y)) {
            return this;
        }
        else if (!Variable.contains(expr.getFV(), this.boundval)) {
            return new LambdaAbstraction(this.boundval, this.expr.substitute(y, expr));
        }
        else {
            var uniFV = Variable.union(this.expr.getFV(), expr.getFV());
            var z = Variable.getNew(uniFV);
            return new LambdaAbstraction(z, this.expr.substitute(this.boundval, z)).substitute(y, expr);
        }
    }
    reduction() {
        return this;
    }
    equals(expr) {
        return (expr instanceof LambdaAbstraction) && (expr.boundval.equals(this.boundval)) && (expr.expr.equals(this.expr));
    }
    equalsAlpha(expr) {
        if (!(expr instanceof LambdaAbstraction))
            return false;
        if (this.equals(expr))
            return true;
        var x = this.boundval;
        var m = this.expr;
        var y = expr.boundval;
        var n = expr.expr;
        return (!Variable.contains(m.getFV(), y) && n.equalsAlpha(m.substitute(x, y)));
    }
    getEquations(gamma, type) {
        // (abs)
        var t0 = type_1.TypeVariable.getNew();
        var t1 = type_1.TypeVariable.getNew();
        this.boundval.type = t1;
        var next = this.expr.getEquations(gamma.concat(this.boundval), t0);
        var str = next.proofTree;
        str += "\\RightLabel{\\scriptsize(abs)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(next.eqs.concat(new type_1.TypeEquation(type, new type_1.TypeFunc(t1, t0))), str);
    }
    toTexString() {
        var boundvals = [this.boundval.toTexString()];
        var expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval.toTexString());
            expr = expr.expr;
        }
        var str = "(\\lambda " + boundvals.join("") + ".";
        if (expr instanceof Application) {
            var expr1 = expr.left;
            var str1 = expr.right.toTexString();
            while (expr1 instanceof Application) {
                str1 = expr1.right.toTexString() + str1;
                expr1 = expr1.left;
            }
            str1 = expr1.toTexString() + str1;
            str = str + str1;
        }
        else {
            str = str + expr.toTexString();
        }
        if (!this.isTopLevel)
            str = "(" + str + ")";
        return str;
    }
    isEtaRedex() {
        return (this.expr instanceof Application) && (this.expr.right.equals(this.boundval)) && (!Variable.contains(this.expr.left.getFV(), this.boundval));
    }
    getRedexes(etaAllowed) {
        var boundvals = [this.boundval];
        var expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval);
            expr = expr.expr;
        }
        var ret = Redex.makeNext(this.expr.getRedexes(etaAllowed), "(\\" + boundvals.join("") + ".", ")", (prev) => (new LambdaAbstraction(this.boundval, prev)));
        if (etaAllowed && this.isEtaRedex()) {
            ret.push(new EtaRedex(this));
        }
        return ret;
    }
}
exports.LambdaAbstraction = LambdaAbstraction;
// 関数適用 MN
class Application extends Expression {
    constructor(left, right) {
        super("Application");
        this.left = left;
        this.right = right;
    }
    isBetaRedex() {
        return (this.left instanceof LambdaAbstraction);
    }
    toString() {
        var expr = this.left;
        var str = this.right.toString();
        while (expr instanceof Application) {
            str = expr.right + str;
            expr = expr.left;
        }
        str = expr + str;
        if (!this.isTopLevel)
            str = "(" + str + ")";
        return str;
    }
    getFV() {
        if (this.freevals === undefined)
            return this.freevals = Variable.union(this.left.getFV(), this.right.getFV());
        else
            return this.freevals;
    }
    substitute(y, expr) {
        return new Application(this.left.substitute(y, expr), this.right.substitute(y, expr));
    }
    reduction() {
        if (this.left instanceof LambdaAbstraction) {
            // (app2)
            return this.left.expr.substitute(this.left.boundval, this.right);
        }
        else if (this.left instanceof Application
            && this.left.left instanceof ConstOp
            && this.left.right instanceof Const) {
            var op = this.left.left;
            var left = this.left.right;
            var right = this.right;
            if (right instanceof Const) {
                // (app5)
                if (op.type.left.equals(left.type) && op.type.right instanceof type_1.TypeFunc && op.type.right.left.equals(right.type)) {
                    return op.value(left, right);
                }
                else {
                    throw new error_1.ReductionError(op.type + " cannot handle " + left.type + " and " + right.type + " as arguments");
                }
            }
            else {
                // (app4)
                return new Application(this.left, right.reduction());
            }
        }
        else if (this.left instanceof ConstOp) {
            // (app3)
            return new Application(this.left, this.right.reduction());
        }
        else {
            // (app1)
            return new Application(this.left.reduction(), this.right);
        }
    }
    equals(expr) {
        return (expr instanceof Application) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
    }
    equalsAlpha(expr) {
        return (expr instanceof Application) && (expr.left.equalsAlpha(this.left)) && (expr.right.equalsAlpha(this.right));
    }
    getEquations(gamma, type) {
        // (app)
        var t1 = type_1.TypeVariable.getNew();
        var nextL = this.left.getEquations(gamma, new type_1.TypeFunc(t1, type));
        var nextR = this.right.getEquations(gamma, t1);
        var str = nextL.proofTree + nextR.proofTree;
        str += "\\RightLabel{\\scriptsize(app)}\n";
        str += "\\BinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
    }
    toTexString() {
        var expr = this.left;
        var str = this.right.toTexString();
        while (expr instanceof Application) {
            str = expr.right.toTexString() + str;
            expr = expr.left;
        }
        str = expr.toTexString() + str;
        if (!this.isTopLevel)
            str = "(" + str + ")";
        return str;
    }
    getRedexes(etaAllowed) {
        var ret = Redex.makeNext(this.left.getRedexes(etaAllowed), "(", ")", (prev) => (new Application(prev, this.right))).concat(Redex.makeNext(this.right.getRedexes(etaAllowed), "(", ")", (prev) => (new Application(this.left, prev))));
        if (this.isBetaRedex()) {
            ret.push(new BetaRedex(this));
        }
        return ret;
    }
}
exports.Application = Application;
// リスト M::M
class List extends Expression {
    constructor(head, tail) {
        super("List");
        this.head = head;
        this.tail = tail;
    }
    toString() {
        return this.head + "::" + this.tail;
    }
    getFV() {
        if (this.freevals === undefined)
            return this.freevals = Variable.union(this.head.getFV(), this.tail.getFV());
        else
            return this.freevals;
    }
    substitute(y, expr) {
        return new List(this.head.substitute(y, expr), this.tail.substitute(y, expr));
    }
    reduction() {
        return this;
    }
    equals(expr) {
        return (expr instanceof List) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail));
    }
    equalsAlpha(expr) {
        return (expr instanceof List) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail));
    }
    getEquations(gamma, type) {
        // (list) 再検討の余地あり？ 新しい型変数要る？
        var t = type_1.TypeVariable.getNew();
        var lt = new type_1.TypeList(t);
        var nextH = this.head.getEquations(gamma, t);
        var nextT = this.tail.getEquations(gamma, lt);
        var str = nextH.proofTree + nextT.proofTree;
        str += "\\RightLabel{\\scriptsize(list)}\n";
        str += "\\BinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + lt.toTexString() + " $}\n";
        return new TypeResult(nextH.eqs.concat(nextT.eqs, new type_1.TypeEquation(lt, type)), str);
    }
    toTexString() {
        return this.head.toTexString() + "::" + this.tail.toTexString();
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.List = List;
// if
class If extends Expression {
    constructor(state, ifTrue, ifFalse) {
        super("If");
        this.state = state;
        this.ifTrue = ifTrue;
        this.ifFalse = ifFalse;
    }
    getFV() {
        return this.freevals = Variable.union(this.state.getFV(), this.ifTrue.getFV(), this.ifFalse.getFV());
    }
    toString() {
        return "([if]" + this.state + "[then]" + this.ifTrue + "[else]" + this.ifFalse + ")";
    }
    substitute(y, expr) {
        return new If(this.state.substitute(y, expr), this.ifTrue.substitute(y, expr), this.ifFalse.substitute(y, expr));
    }
    reduction() {
        if (this.state instanceof ConstBool) {
            if (this.state.value) {
                // (if2)
                return this.ifTrue;
            }
            else {
                // (if3)
                return this.ifFalse;
            }
        }
        else {
            // (if1)
            return new If(this.state.reduction(), this.ifTrue, this.ifFalse);
        }
    }
    equals(expr) {
        return (expr instanceof If) && (expr.state.equals(this.state)) && (expr.ifTrue.equals(this.ifTrue)) && (expr.ifFalse.equals(this.ifFalse));
    }
    equalsAlpha(expr) {
        return (expr instanceof If) && (expr.state.equalsAlpha(this.state)) && (expr.ifTrue.equalsAlpha(this.ifTrue)) && (expr.ifFalse.equalsAlpha(this.ifFalse));
    }
    getEquations(gamma, type) {
        // (if)
        var nextS = this.state.getEquations(gamma, type_1.typeBool);
        var nextT = this.ifTrue.getEquations(gamma, type);
        var nextF = this.ifFalse.getEquations(gamma, type);
        var str = nextS.proofTree + nextT.proofTree + nextF.proofTree;
        str += "\\RightLabel{\\scriptsize(if)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextS.eqs.concat(nextT.eqs, nextF.eqs), str);
    }
    toTexString() {
        return "({\\bf if}~" + this.state.toTexString() + "~{\\bf then}~" + this.ifTrue.toTexString() + "~{\\bf else}~" + this.ifFalse.toTexString() + ")";
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.If = If;
// let in
class Let extends Expression {
    constructor(boundVal, left, right) {
        super("Let");
        this.boundVal = boundVal;
        this.left = left;
        this.right = right;
    }
    getFV() {
        if (this.freevals !== undefined)
            return this.freevals;
        var ret = [];
        for (var fv of this.right.getFV()) {
            if (!fv.equals(this.boundVal)) {
                ret.push(fv);
            }
        }
        return this.freevals = Variable.union(ret, this.left.getFV());
    }
    toString() {
        return "([let]" + this.boundVal + "[=]" + this.left + "[in]" + this.right + ")";
    }
    substitute(y, expr) {
        var left = this.left.substitute(y, expr);
        if (this.boundVal.equals(y)) {
            return new Let(this.boundVal, left, this.right);
        }
        else if (!Variable.contains(expr.getFV(), this.boundVal)) {
            return new Let(this.boundVal, left, this.right.substitute(y, expr));
        }
        else {
            var uniFV = Variable.union(this.right.getFV(), expr.getFV());
            var z = Variable.getNew(uniFV);
            if (z.equals(y)) {
                return new Let(z, left, this.right.substitute(this.boundVal, z));
            }
            else {
                return new Let(z, left, this.right.substitute(this.boundVal, z).substitute(y, expr));
            }
        }
    }
    reduction() {
        // (let)
        return this.right.substitute(this.boundVal, this.left);
    }
    equals(expr) {
        return (expr instanceof Let) && (expr.boundVal.equals(this.boundVal)) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
    }
    equalsAlpha(expr) {
        if (!(expr instanceof Let))
            return false;
        if (this.equals(expr))
            return true;
        var x = this.boundVal;
        var m = this.right;
        var y = expr.boundVal;
        var n = expr.right;
        return (!Variable.contains(m.getFV(), y) && n.equalsAlpha(m.substitute(x, y)));
    }
    getEquations(gamma, type) {
        // (let)
        var t1 = type_1.TypeVariable.getNew();
        this.boundVal.type = t1;
        var nextL = this.left.getEquations(gamma, t1);
        var nextR = this.right.getEquations(gamma.concat(this.boundVal), type);
        var str = nextL.proofTree + nextR.proofTree;
        str += "\\RightLabel{\\scriptsize(let)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
    }
    toTexString() {
        return "({\\bf let}~" + this.boundVal.toTexString() + " = " + this.left.toTexString() + "~{\\bf in}~" + this.right.toTexString() + ")";
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.Let = Let;
// case文 [case] M [of] [nil] -> M | x::x -> M
class Case extends Expression {
    constructor(state, ifNil, head, tail, ifElse) {
        super("Case");
        this.state = state;
        this.ifNil = ifNil;
        this.head = head;
        this.tail = tail;
        this.ifElse = ifElse;
    }
    getFV() {
        if (this.freevals !== undefined)
            return this.freevals;
        else
            return Variable.union(this.state.getFV(), this.ifNil.getFV(), Variable.dif(this.ifElse.getFV(), [this.head, this.tail]));
    }
    toString() {
        return "([case]" + this.state + "[of][nil]->" + this.ifNil + " | " + this.head + "::" + this.tail + "->" + this.ifElse + ")";
    }
    substitute(y, expr) {
        var state = this.state.substitute(y, expr);
        var ifNil = this.ifNil.substitute(y, expr);
        if (this.head.equals(y) || this.tail.equals(y)) {
            return new Case(state, ifNil, this.head, this.tail, this.ifElse);
        }
        else if (!Variable.contains(expr.getFV(), this.head) && !Variable.contains(expr.getFV(), this.tail)) {
            return new Case(state, ifNil, this.head, this.tail, this.ifElse.substitute(y, expr));
        }
        else {
            var head = this.head;
            var tail = this.tail;
            var ifElse = this.ifElse;
            if (Variable.contains(expr.getFV(), head)) {
                var uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
                var z = Variable.getNew(uniFV);
                if (z.equals(y)) {
                    ifElse = ifElse.substitute(head, z);
                }
                else {
                    ifElse = ifElse.substitute(head, z).substitute(y, expr);
                }
                head = z;
            }
            if (Variable.contains(expr.getFV(), tail)) {
                var uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
                var z = Variable.getNew(uniFV);
                if (z.equals(y)) {
                    ifElse = ifElse.substitute(tail, z);
                }
                else {
                    ifElse = ifElse.substitute(tail, z).substitute(y, expr);
                }
                tail = z;
            }
            return new Case(state, ifNil, head, tail, ifElse);
        }
    }
    reduction() {
        if (this.state instanceof Nil) {
            // (case2)
            return this.ifNil;
        }
        else if (this.state instanceof List) {
            // (case3)
            return this.ifElse.substitute(this.head, this.state.head).substitute(this.tail, this.state.tail);
        }
        else {
            // (case1)
            return new Case(this.state.reduction(), this.ifNil, this.head, this.tail, this.ifElse);
        }
    }
    equals(expr) {
        return (expr instanceof Case) && (expr.state.equals(this.state)) && (expr.ifNil.equals(this.ifNil)) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail)) && (expr.ifElse.equals(this.ifElse));
    }
    equalsAlpha(expr) {
        return (expr instanceof Case) && (expr.state.equalsAlpha(this.state)) && (expr.ifNil.equalsAlpha(this.ifNil)) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail)) && (expr.ifElse.equalsAlpha(this.ifElse));
    }
    getEquations(gamma, type) {
        // (case)
        var t1 = type_1.TypeVariable.getNew();
        var lt1 = new type_1.TypeList(t1);
        this.head.type = t1;
        this.tail.type = lt1;
        var nextS = this.state.getEquations(gamma, lt1);
        var nextN = this.ifNil.getEquations(gamma, type);
        var nextE = this.ifElse.getEquations(gamma.concat(this.head, this.tail), type);
        var str = nextS.proofTree + nextN.proofTree + nextE.proofTree;
        str += "\\RightLabel{\\scriptsize(case)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextS.eqs.concat(nextN.eqs, nextE.eqs), str);
    }
    toTexString() {
        return "({\\bf case} " + this.state + " {\\bf of} {\\rm nil} \\Rightarrow " + this.ifNil.toTexString() + " | " + this.head.toTexString() + "::" + this.tail.toTexString() + " \\Rightarrow " + this.ifElse.toTexString() + ")";
    }
    getRedexes(etaAllowed) {
        throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
}
exports.Case = Case;

},{"./error":1,"./type":4}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expression_1 = require("./expression");
class LambdaFriends {
    constructor(str, typed) {
        this.typed = typed;
        if (typed) {
            this.expr = expression_1.makeAST(str);
            this.type = this.expr.getType();
        }
        else {
            this.expr = expression_1.makeUntypedAST(str);
            this.type = undefined;
        }
        if (this.expr instanceof expression_1.Macro) {
            var e = this.expr;
            while (true) {
                LambdaFriends.output("<" + e.name + "> is defined as " + e.expr + " : " + (typed ? this.type : "Untyped") + "\n");
                if (!(e.expr instanceof expression_1.Macro))
                    break;
                else
                    e = e.expr;
            }
        }
    }
    continualReduction(step, etaAllowed) {
        if (step === undefined)
            step = 100;
        if (this.typed) {
            var result = this.expr.continualReduction(step);
            this.expr = result.expr;
            return result.str;
        }
        else {
            if (etaAllowed === undefined)
                etaAllowed = false;
            var result = this.expr.continualUntypedReduction(step, etaAllowed);
            this.expr = result.expr;
            return result.str;
        }
    }
    hasNext(etaAllowed) {
        if (this.typed) {
            return this.expr.hasNext();
        }
        else {
            if (etaAllowed === undefined)
                etaAllowed = false;
            return !this.expr.isNormalForm(etaAllowed);
        }
    }
    static fileInput(textData, typed) {
        var lines = textData.split("\n");
        for (var l of lines) {
            l = l.split("#")[0].trim();
            if (l === "")
                continue;
            try {
                var lf = new LambdaFriends(l, typed);
            }
            catch (e) {
                LambdaFriends.output(e.toString() + "\n");
            }
        }
    }
    isMacro() {
        return this.expr instanceof expression_1.Macro;
    }
    static getMacroList(typed) {
        var str = "";
        if (typed) {
            for (var key in expression_1.Macro.map) {
                var e = expression_1.Macro.map[key];
                str += "<" + e.name + "> is defined as " + e.expr + " : " + e.getType() + "\n";
            }
        }
        else {
            for (var key in expression_1.Macro.mapUntyped) {
                var e = expression_1.Macro.mapUntyped[key];
                str += "<" + e.name + "> is defined as " + e.expr + " : Untyped\n";
            }
        }
        return str;
    }
}
LambdaFriends.output = console.log;
exports.LambdaFriends = LambdaFriends;

},{"./expression":2}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_1 = require("./error");
class Type {
    constructor(className) {
        this.className = className;
    }
}
exports.Type = Type;
class TypeEquation {
    constructor(left, right) {
        this.left = left;
        this.right = right;
    }
    transform(eqs, next) {
        if (this.left instanceof TypeConstructor && this.right instanceof TypeConstructor) {
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
            throw new error_1.TypeError("Illegal type (" + this.right + " contains " + this.left + ". Self-application?)");
        }
        // (f)
        for (var e of eqs) {
            e.replace(this.left, this.right);
        }
        for (var e of next) {
            e.replace(this.left, this.right);
        }
        return [this];
    }
    static isEqual(a, b) {
        if (a.length !== b.length)
            return false;
        for (var ai of a) {
            if (!TypeEquation.contains(ai, b))
                return false;
        }
        return true;
    }
    static contains(a, b) {
        for (var bi of b) {
            if (a.equals(bi))
                return true;
        }
        return false;
    }
    equals(e) {
        return e.left.equals(this.left) && e.right.equals(this.right);
    }
    static get(t, eqs) {
        for (var eq of eqs) {
            if (eq.left.equals(t))
                return eq.right;
        }
        throw new error_1.TypeError("Undefined TypeVariable: " + t);
    }
    toString() {
        return this.left + " = " + this.right;
    }
    replace(from, to) {
        if (this.left.equals(from)) {
            this.left = to;
        }
        else {
            this.left.replace(from, to);
        }
        if (this.right.equals(from)) {
            this.right = to;
        }
        else {
            this.right.replace(from, to);
        }
    }
    static solve(eqs) {
        while (true) {
            var prev = [].concat(eqs);
            var next = [];
            while (eqs.length > 0) {
                var e = eqs.shift();
                var ans = e.transform(eqs, next);
                next = next.concat(ans);
            }
            eqs = [].concat(next);
            if (TypeEquation.isEqual(prev, next))
                break;
        }
        return eqs;
    }
}
exports.TypeEquation = TypeEquation;
class TypeConstructor extends Type {
}
exports.TypeConstructor = TypeConstructor;
class TypeInt extends TypeConstructor {
    constructor() {
        super("TypeInt");
    }
    static getInstance() {
        if (TypeInt.instance === undefined) {
            return TypeInt.instance = new TypeInt();
        }
        else
            return TypeInt.instance;
    }
    toString() {
        return "int";
    }
    toTexString() {
        return "{\\rm int}";
    }
    equals(t) {
        if (t instanceof TypeInt)
            return true;
        else
            return false;
    }
    match(t) {
        if (t instanceof TypeInt) {
            return [];
        }
        else {
            throw new error_1.TypeError(this + " and " + t + " are not compatible.");
        }
    }
    contains(t) {
        return false;
    }
    replace(from, to) { }
    getVariables() {
        return [];
    }
}
exports.TypeInt = TypeInt;
exports.typeInt = TypeInt.getInstance();
class TypeBool extends TypeConstructor {
    constructor() {
        super("TypeBool");
    }
    static getInstance() {
        if (TypeBool.instance === undefined) {
            return TypeBool.instance = new TypeBool();
        }
        else
            return TypeBool.instance;
    }
    toString() {
        return "bool";
    }
    toTexString() {
        return "{\\rm bool}";
    }
    equals(t) {
        if (t instanceof TypeBool)
            return true;
        else
            return false;
    }
    match(t) {
        if (t instanceof TypeBool) {
            return [];
        }
        else {
            throw new error_1.TypeError(this + " and " + t + " are not compatible.");
        }
    }
    contains(t) {
        return false;
    }
    replace(from, to) { }
    getVariables() {
        return [];
    }
}
exports.TypeBool = TypeBool;
exports.typeBool = TypeBool.getInstance();
class TypeList extends TypeConstructor {
    constructor(x) {
        super("TypeList");
        this.content = x;
    }
    toString() {
        return "list(" + this.content + ")";
    }
    toTexString() {
        return "{\\rm list}(" + this.content.toTexString() + ")";
    }
    equals(t) {
        if (t instanceof TypeList)
            return this.content.equals(t.content);
        else
            return false;
    }
    match(t) {
        if (t instanceof TypeList) {
            return [new TypeEquation(this.content, t.content)];
        }
        else {
            throw new error_1.TypeError(this + " and " + t + " are not compatible.");
        }
    }
    contains(t) {
        return this.content.contains(t);
    }
    replace(from, to) {
        if (this.content.equals(from)) {
            this.content = to;
        }
        else {
            this.content.replace(from, to);
        }
    }
    getVariables() {
        return this.content.getVariables();
    }
}
exports.TypeList = TypeList;
class TypeFunc extends TypeConstructor {
    constructor(left, right) {
        super("TypeFunc");
        this.left = left;
        this.right = right;
    }
    toString() {
        var ret;
        if (this.left instanceof TypeFunc)
            ret = "(" + this.left + ")";
        else
            ret = this.left.toString();
        return ret + " -> " + this.right;
    }
    toTexString() {
        var ret;
        if (this.left instanceof TypeFunc)
            ret = "(" + this.left.toTexString() + ")";
        else
            ret = this.left.toTexString();
        return ret + " \\rightarrow " + this.right.toTexString();
    }
    equals(t) {
        if (t instanceof TypeFunc)
            return t.left.equals(this.left) && t.right.equals(this.right);
        else
            return false;
    }
    match(t) {
        if (t instanceof TypeFunc) {
            return [new TypeEquation(this.left, t.left), new TypeEquation(this.right, t.right)];
        }
        else {
            throw new error_1.TypeError(this + " and " + t + " are not compatible.");
        }
    }
    contains(t) {
        return this.left.contains(t) || this.right.contains(t);
    }
    replace(from, to) {
        if (this.left.equals(from)) {
            this.left = to;
        }
        else {
            this.left.replace(from, to);
        }
        if (this.right.equals(from)) {
            this.right = to;
        }
        else {
            this.right.replace(from, to);
        }
    }
    getVariables() {
        return this.left.getVariables().concat(this.right.getVariables());
    }
}
exports.TypeFunc = TypeFunc;
class TypeVariable extends Type {
    constructor(id) {
        super("TypeVariable");
        this.id = id;
    }
    toString() {
        if (this.id < 0)
            return "'" + TypeVariable.alphabet[-this.id - 1];
        return "'t" + this.id;
    }
    toTexString() {
        if (this.id < 0)
            return TypeVariable.texAlphabet[-this.id - 1];
        return "\\tau_{" + this.id + "}";
    }
    equals(t) {
        if (t instanceof TypeVariable)
            return this.id === t.id;
        else
            return false;
    }
    static getNew() {
        if (TypeVariable.maxId === undefined) {
            TypeVariable.maxId = 0;
            return new TypeVariable(0);
        }
        else {
            TypeVariable.maxId++;
            return new TypeVariable(TypeVariable.maxId);
        }
    }
    contains(t) {
        return this.equals(t);
    }
    replace(from, to) { }
    getVariables() {
        return [this];
    }
    static getAlphabet(i) {
        return new TypeVariable(-i - 1);
    }
    static contains(a, b) {
        for (var ta of a) {
            if (ta.equals(b)) {
                return true;
            }
        }
        return false;
    }
}
TypeVariable.alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
TypeVariable.texAlphabet = [
    "\\alpha", "\\beta", "\\gamma", "\\delta", "\\varepsilon", "\\zeta", "\\eta", "\\theta", "\\iota", "\\kappa", "\\mu", "\\nu", "\\xi", "\\pi", "\\rho", "\\sigma", "\\upsilon", "\\phi", "\\chi", "\\psi", "\\omega", "\\Gamma", "\\Delta", "\\Theta", "\\Xi", "\\Pi", "\\Sigma", "\\Phi", "\\Psi", "\\Omega"
].concat(TypeVariable.alphabet);
exports.TypeVariable = TypeVariable;

},{"./error":1}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lambda_friends_1 = require("./lambda-friends");
class WebUI {
    constructor() {
        this.steps = WebUI.defaultSteps;
        this.typed = true;
        this.etaAllowed = false;
        lambda_friends_1.LambdaFriends.output = outputNext;
        this.mainFunc = (line) => {
            line = line.split("#")[0];
            line = line.trim();
            if (line !== "") {
                try {
                    var lf = new lambda_friends_1.LambdaFriends(line, this.typed);
                    output(lf.continualReduction(this.steps, this.etaAllowed));
                }
                catch (e) {
                    output(e.toString());
                }
            }
        };
    }
}
WebUI.defaultSteps = 100;
var webUI = new WebUI();
var input = document.getElementById("input");
var oel = document.getElementById("output");
var untypedButton = document.getElementById("untyped");
var typedButton = document.getElementById("typed");
var etaEnableButton = document.getElementById("etaEnable");
var etaDisableButton = document.getElementById("etaDisable");
var fileInput = document.getElementById("fileInput");
var fileReader = new FileReader();
var stepInput = document.getElementById("stepInput");
// var macroListButton = document.getElementById("macroList");
var graphDiv = document.getElementById("graph");
fileInput.addEventListener("change", function (ev) {
    var target = ev.target;
    var file = target.files[0];
    var type = file.type; // MIMEタイプ
    // var size = file.size; // ファイル容量（byte）
    if (type !== "text/plain") {
        alert("プレーンテキストを選択してください");
        fileInput.value = "";
        return;
    }
    fileReader.readAsText(file);
});
fileReader.addEventListener("load", function () {
    outputClear();
    lambda_friends_1.LambdaFriends.fileInput(fileReader.result, webUI.typed);
});
untypedButton.onclick = function () {
    untypedButton.className = "btn btn-primary";
    typedButton.className = "btn btn-default";
    webUI.typed = false;
    etaEnableButton.disabled = false;
    etaDisableButton.disabled = false;
};
typedButton.onclick = function () {
    typedButton.className = "btn btn-primary";
    untypedButton.className = "btn btn-default";
    webUI.typed = true;
    etaEnableButton.disabled = true;
    etaDisableButton.disabled = true;
};
etaEnableButton.onclick = function () {
    etaEnableButton.className = "btn btn-primary";
    etaDisableButton.className = "btn btn-default";
    webUI.etaAllowed = true;
};
etaDisableButton.onclick = function () {
    etaDisableButton.className = "btn btn-primary";
    etaEnableButton.className = "btn btn-default";
    webUI.etaAllowed = false;
};
// macroListButton.onclick = function(){
//   output(LambdaFriends.getMacroList(webUI.typed));
// }
stepInput.addEventListener("change", function () {
    var new_s = parseInt(stepInput.value);
    if (!isNaN(new_s)) {
        webUI.steps = new_s;
    }
    else {
        webUI.steps = WebUI.defaultSteps;
    }
});
var submitInput = function () {
    webUI.mainFunc(input.value);
    input.value = "";
};
document.getElementById("submit").onclick = submitInput;
document.getElementById("input").onkeydown = function (e) {
    if (e.keyCode === 13) {
        submitInput();
        e.preventDefault();
    }
};
function output(str) {
    oel.innerText = str;
}
function outputNext(str) {
    oel.innerText += str;
}
function outputNextLine(str) {
    oel.innerText += str + "\n";
}
function outputClear() {
    oel.innerText = "";
}
// var cytoscape = require("cytoscape")
// var cy = cytoscape({
//   container: graphDiv
// }); 

},{"./lambda-friends":3}]},{},[5]);
