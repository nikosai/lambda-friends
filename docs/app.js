(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 例外の抽象クラス
class LambdaFriendsError {
    constructor(name, message) {
        this.name = name;
        this.message = message;
        if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, this.constructor);
        }
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
                tokens.push(Macro.get(content));
                break;
            default:
                tokens.push(new Symbol(c));
        }
    }
    // console.log(tokens);
    return makeUntypedASTfromSymbols(tokens);
}
exports.makeUntypedAST = makeUntypedAST;
function makeUntypedASTfromSymbols(tokens) {
    var left = null;
    while (tokens.length > 0) {
        // 最初のSymbol
        var first = tokens.shift();
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
                tokens.push(Macro.get(content));
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
                return Macro.add(name, s);
            default:
                tokens.push(new Symbol(c));
        }
    }
    // console.log(tokens);
    return makeASTfromSymbols(tokens);
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
// ラムダ項（抽象クラス）
class Expression {
    constructor(className) {
        this.className = className;
    }
    continualReduction(n) {
        var cur = this;
        var str = cur.toString() + "\n";
        for (var i = 0; i < n; i++) {
            var next = cur.reduction();
            if (cur.equals(next))
                break;
            cur = next;
            str += " ==> " + next.toString() + "\n";
        }
        return new ReductionResult(cur, str, !cur.equals(cur.reduction()));
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
    getFV() {
        return this.freevals;
    }
    substitute(x, expr) {
        throw new error_1.SubstitutionError("Undefined Substitution");
    }
    reduction() {
        return this;
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
}
exports.Nil = Nil;
exports.nil = Nil.getInstance();
class Macro extends Symbol {
    constructor(name, expr) {
        super(name, "Macro");
        this.freevals = [];
        this.expr = expr;
    }
    static add(name, str) {
        var ret = makeAST(str);
        if (ret.getFV().length !== 0) {
            throw new error_1.MacroError("<" + name + "> contains free variables: " + ret.getFV());
        }
        else if (ret instanceof Macro) {
            throw new error_1.MacroError("<" + name + "> contains Macro definition");
        }
        Macro.map[name] = new Macro(name, ret);
        return Macro.map[name];
    }
    static get(name) {
        var ret = Macro.map[name];
        if (ret === undefined) {
            return new Macro(name, undefined);
        }
        else {
            return new Macro(name, ret.expr);
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
        return this.expr.equalsAlpha(expr);
    }
}
Macro.map = {};
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
        return "(\\" + boundvals.join("") + "." + expr + ")";
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
}
exports.LambdaAbstraction = LambdaAbstraction;
// 関数適用 MN
class Application extends Expression {
    constructor(left, right) {
        super("Application");
        this.left = left;
        this.right = right;
    }
    toString() {
        return "(" + this.left + this.right + ")";
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
        return "(if " + this.state + " then " + this.ifTrue + " else " + this.ifFalse + ")";
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
        return "(let " + this.boundVal + " = " + this.left + " in " + this.right + ")";
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
        return "(case " + this.state + " of nil->" + this.ifNil + " | " + this.head + "::" + this.tail + "->" + this.ifElse + ")";
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
}
exports.Case = Case;

},{"./error":1,"./type":3}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Type {
    constructor(className) {
        this.className = className;
    }
}
exports.Type = Type;
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
    equals(t) {
        if (t instanceof TypeInt)
            return true;
        else
            return false;
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
    equals(t) {
        if (t instanceof TypeBool)
            return true;
        else
            return false;
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
    equals(t) {
        if (t instanceof TypeList)
            return this.content.equals(t.content);
        else
            return false;
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
    equals(t) {
        if (t instanceof TypeFunc)
            return t.left.equals(this.left) && t.right.equals(this.right);
        else
            return false;
    }
}
exports.TypeFunc = TypeFunc;
class TypeVariable extends Type {
    constructor(id) {
        super("TypeVariable");
        this.id = id;
    }
    toString() {
        return "'t" + this.id;
    }
    equals(t) {
        if (t instanceof TypeVariable)
            return this.id === t.id;
        else
            return false;
    }
}
exports.TypeVariable = TypeVariable;

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expression_1 = require("./expression");
class WebUI {
    constructor() {
        this.steps = 100;
        this.mainFunc = (line) => {
            line = line.trim();
            if (line === "") { }
            else if (line.startsWith(":")) {
                var cmds = line.replace(":", "").trim().split(/\s+/g);
                switch (cmds[0]) {
                    case "q":
                        // process.exit(0);
                        return;
                    case "?":
                        // CUI.fileMes("mes/help.txt");
                        break;
                    case "s":
                        var new_s = parseInt(cmds[1]);
                        if (!isNaN(new_s)) {
                            this.steps = new_s;
                        }
                        output("Continuation steps: " + this.steps);
                        break;
                    case "l":
                        // var file = cmds[1];
                        // if (file === undefined){
                        //   console.log("Command Usage = :q <filename>");
                        //   break;
                        // }
                        // if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
                        // try{
                        //   fs.statSync(file);
                        //   var lines = fs.readFileSync(file,"utf8").split("\n");
                        //   process.stdout.write(this.prompt);
                        //   for (var l of lines){
                        //     console.log(l);
                        //     this.mainFunc(l);
                        //   }
                        //   return;
                        // }catch(e){
                        //   console.log("File Not Found: "+file);
                        // }
                        break;
                    default:
                        output("Undefined command: " + line);
                        return;
                }
            }
            else {
                try {
                    var expr = expression_1.makeAST(line);
                    var result = expr.continualReduction(this.steps);
                    output(result.str);
                }
                catch (e) {
                    output(e.toString());
                }
            }
        };
    }
}
var webUI = new WebUI();
var input = document.getElementById("input");
var oel = document.getElementById("output");
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

},{"./expression":2}]},{},[4]);
