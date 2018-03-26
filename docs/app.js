(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 例外の抽象クラス
class LambdaFriendsError {
    constructor(name, message) {
        // if (typeof Error.captureStackTrace === "function"){
        //   Error.captureStackTrace(this,this.constructor);
        // }
        if (message === undefined) {
            this.name = "LambdaFriendsError";
            this.message = name;
        }
        else {
            this.name = name;
            this.message = message;
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
// 字句解析
function tokenize(str, typed) {
    let strs = str.split(/\s*/).join("").split("");
    let tokens = [];
    while (strs.length > 0) {
        let c = strs.shift();
        if (c === "<") {
            // <macro>
            let content = "";
            while (true) {
                if (strs.length == 0)
                    throw new error_1.LambdaParseError("Too many LANGLE '<'");
                c = strs.shift();
                if (c === ">")
                    break;
                else
                    content += c;
            }
            tokens.push(Macro.get(content, typed));
        }
        else if (typed && c === "[") {
            // [const]
            let content = "";
            while (true) {
                if (strs.length == 0)
                    throw new error_1.LambdaParseError("Too many LBRACKET '['");
                c = strs.shift();
                if (c === "]")
                    break;
                else
                    content += c;
            }
            let result = null;
            switch (content) {
                case "nil":
                    result = new Nil();
                    break;
                case "false":
                case "true":
                    result = new ConstBool(content === "true");
                    break;
                case "if":
                case "then":
                case "else":
                case "let":
                case "in":
                case "case":
                case "of":
                    result = new Symbol(content);
                    break;
                default:
                    if (str.match(/^\d+$|^-\d+$/) !== null) {
                        result = new ConstInt(parseInt(str));
                    }
                    else {
                        result = new ConstOp(str); // fail -> null
                    }
            }
            if (result === null)
                throw new error_1.LambdaParseError("Unknown Const: [" + content + "]");
            tokens.push(result);
        }
        else {
            tokens.push(new Symbol(c));
        }
    }
    return tokens;
}
// 構文解析
function parseSymbols(tokens, typed) {
    let left = null;
    while (tokens.length > 0) {
        // 最初のSymbol
        let first = tokens.shift();
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
            case "λ": {
                // abst
                if (left === null)
                    return LambdaAbstraction.parse(tokens, typed);
                else
                    return new Application(left, LambdaAbstraction.parse(tokens, typed));
            }
            case "(": {
                // application
                let content = [];
                let i = 1;
                while (true) {
                    if (tokens.length == 0)
                        throw new error_1.LambdaParseError("Too many LPAREN '('");
                    let t = tokens.shift();
                    if (t.name === "(")
                        i++;
                    else if (t.name === ")")
                        i--;
                    if (i == 0)
                        break;
                    content.push(t);
                }
                let contentExpr = parseSymbols(content, typed);
                if (left === null)
                    left = contentExpr;
                else
                    left = new Application(left, contentExpr);
                break;
            }
            default: {
                if (typed) {
                    switch (first.name) {
                        case "if": {
                            // if statement
                            return If.parse(tokens, typed);
                        }
                        case "let": {
                            // let statement
                            return Let.parse(tokens, typed);
                        }
                        case "case": {
                            // case statement: [case] M [of] [nil] -> M | x::x -> M
                            return Case.parse(tokens, typed);
                        }
                        case ":": {
                            // list
                            let t = tokens.shift();
                            if (t.name !== ":")
                                throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
                            return new List(left, parseSymbols(tokens, typed));
                        }
                    }
                }
                if (first.name.match(/^[A-Za-z]$/) === null)
                    throw new error_1.LambdaParseError("Unexpected token: '" + first + "'");
                // variable
                if (left === null)
                    left = new Variable(first.name);
                else
                    left = new Application(left, new Variable(first.name));
            }
        }
    }
    if (left === null)
        throw new error_1.LambdaParseError("No contents in Expression");
    return left;
}
// 字句解析と構文解析 return: root node
function makeAST(str, typed) {
    let t = parseSymbols(tokenize(str, typed), typed);
    t.setRoot();
    return t;
}
exports.makeAST = makeAST;
function htmlEscape(str) {
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
// 簡約基
class Redex {
    constructor(type) {
        this.left = "";
        this.right = "";
        this.texLeft = "";
        this.texRight = "";
        this.type = type;
    }
    addLeft(s) {
        this.left = s + this.left;
    }
    addRight(s) {
        this.right += s;
    }
    addTexLeft(s) {
        this.texLeft = s + this.texLeft;
    }
    addTexRight(s) {
        this.texRight += s;
    }
    static makeNext(es, prefix, suffix, prefixTex, suffixTex, func) {
        let ret = [].concat(es);
        for (let e of ret) {
            e.next = func(e.next);
            e.addLeft(prefix);
            e.addRight(suffix);
            e.addTexLeft(prefixTex);
            e.addTexRight(suffixTex);
        }
        return ret;
    }
    getName() {
        return this.type;
    }
    getPos() {
        return this.left.length;
    }
    // aの方が優先度高い → 負, 同等 → 0, bの方が優先度高い → 正
    static compare(a, b) {
        let map = {
            "beta": 0,
            "eta": 1,
            "typed": 2,
            "macro": 3
        };
        let ac = map[a.type];
        let bc = map[b.type];
        if (ac === bc) {
            let ap = a.getPos();
            let bp = b.getPos();
            if (ap === bp)
                return 0;
            else
                return ap - bp;
        }
        else {
            return ac - bc;
        }
    }
}
exports.Redex = Redex;
// β基 : (\x.M)N
class BetaRedex extends Redex {
    constructor(e) {
        super("beta");
        this.content = e;
        this.la = e.left;
        this.next = this.la.expr.substitute(this.la.boundval, e.right);
        this.arg = e.right;
        this.rule = "beta";
    }
    toString() {
        let boundvals = [];
        let expr = this.la.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval);
            expr = expr.expr;
        }
        let str = boundvals.join("") + ".";
        if (expr instanceof Application) {
            let expr1 = expr.left;
            let str1 = expr.right.toString();
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
        return this.left + "(\\[" + this.la.boundval + "]" + str + ")[" + this.arg + "]" + this.right;
    }
    toTexString() {
        let boundvals = [];
        let expr = this.la.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval.toTexString());
            expr = expr.expr;
        }
        let str = boundvals.join("") + ".";
        if (expr instanceof Application) {
            let expr1 = expr.left;
            let str1 = expr.right.toTexString();
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
        return this.texLeft + "(\\underline{\\strut \\lambda{" + this.la.boundval.toTexString() + "}" + str + ")\\underline{\\strut " + this.arg.toTexString() + "}" + this.texRight;
    }
    toHTMLString() {
        let boundvals = [];
        let expr = this.la.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval.toString());
            expr = expr.expr;
        }
        let str = boundvals.join("") + ".";
        if (expr instanceof Application) {
            let expr1 = expr.left;
            let str1 = expr.right.toString();
            while (expr1 instanceof Application) {
                str1 = expr1.right.toString() + str1;
                expr1 = expr1.left;
            }
            str1 = expr1.toString() + str1;
            str = str + str1;
        }
        else {
            str = str + expr.toString();
        }
        return htmlEscape(this.left) + '(\\<span class="lf-beta lf-boundval">' + htmlEscape(this.la.boundval.toString()) + '</span>' + htmlEscape(str) + ')<span class="lf-beta lf-arg">' + htmlEscape(this.arg.toString()) + '</span>' + htmlEscape(this.right);
    }
    getTexRule() {
        return "\\beta";
    }
}
// η基 : (\x.Mx)
class EtaRedex extends Redex {
    constructor(e) {
        super("eta");
        this.content = e;
        this.app = e.expr;
        this.next = this.app.left;
        this.rule = "eta";
    }
    toString() {
        return this.left + "[" + this.content + "]" + this.right;
    }
    toTexString() {
        return this.texLeft + "\\underline{\\strut " + this.content.toTexString() + "}" + this.texRight;
    }
    toHTMLString() {
        return htmlEscape(this.left) + '<span class="lf-eta">(\\' + htmlEscape(this.content.toString()) + ')</span>' + htmlEscape(this.right);
    }
    getTexRule() {
        return "\\eta";
    }
}
// マクロ : <macro>
class MacroRedex extends Redex {
    constructor(e) {
        super("macro");
        this.content = e;
        this.next = e.expr;
        this.next.isTopLevel = false;
        this.rule = "macro";
    }
    toString() {
        return this.left + "[<" + this.content.name + ">]" + this.right;
    }
    toTexString() {
        return this.texLeft + "\\underline{\\strut " + this.content.toTexString() + "}" + this.texRight;
    }
    toHTMLString() {
        return htmlEscape(this.left) + '<span class="lf-macro">&lt;' + htmlEscape(this.content.name) + '&gt;</span>' + htmlEscape(this.right);
    }
    getTexRule() {
        return "{\\rm macro}";
    }
}
// 型付きの簡約基（マクロ以外）
class TypedRedex extends Redex {
    constructor(e, next, rule) {
        super("typed");
        this.content = e;
        this.next = next;
        this.rule = rule;
    }
    toString() {
        return this.left + "[" + this.content.toString() + "]" + this.right;
    }
    toTexString() {
        return this.texLeft + "\\underline{\\strut " + this.content.toTexString() + "}" + this.texRight;
    }
    toHTMLString() {
        return htmlEscape(this.left) + '<span class="lf-typed">' + htmlEscape(this.content.toString()) + '</span>' + htmlEscape(this.right);
    }
    getTexRule() {
        return "{\\rm (" + this.rule + ")}";
    }
}
// 型の連立方程式と証明木の組
class TypeResult {
    constructor(eqs, proofTree) {
        this.eqs = eqs;
        this.proofTree = proofTree;
    }
}
// ラムダ項（抽象クラス）
class Expression {
    // type: Type;
    constructor(className) {
        this.className = className;
    }
    isNormalForm(type, etaAllowed) {
        return this.getRedexes(type, etaAllowed, true).length === 0;
    }
    setRoot() {
        this.resetTopLevel();
        this.isTopLevel = true;
    }
    parseChurchNum() {
        if (!(this instanceof LambdaAbstraction))
            return null;
        const f = this.boundval;
        let e = this.expr;
        let n = 0;
        if (!(e instanceof LambdaAbstraction))
            return null;
        const x = e.boundval;
        e = e.expr;
        while (e instanceof Application) {
            n++;
            if (!(e.left.equals(f)))
                return null;
            e = e.right;
        }
        if (e.equals(x))
            return n;
        else
            return null;
    }
    parseChurchBool() {
        const t = new LambdaAbstraction(new Variable("x"), new LambdaAbstraction(new Variable("y"), new Variable("x")));
        const f = new LambdaAbstraction(new Variable("x"), new LambdaAbstraction(new Variable("y"), new Variable("y")));
        if (this.equalsAlpha(t))
            return true;
        else if (this.equalsAlpha(f))
            return false;
        else
            return null;
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
    getEquations(gamma, type) {
        throw new error_1.TypeError("Undefined Type");
    }
    getRedexes(typed, etaAllowed, noParen) {
        throw new error_1.ReductionError("Symbols must not appear in parsed Expression");
    }
    resetTopLevel() {
        this.isTopLevel = false;
    }
}
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
        for (let g of gamma) {
            if (g.equals(this)) {
                // (var)
                let str = "\\AxiomC{}\n";
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
            let ret = [];
            for (let v of a) {
                ret.push(v);
            }
            for (let v of Variable.dif(b, a)) {
                ret.push(v);
            }
            return ret;
        }
        else {
            return Variable.union(Variable.union(a, b), c);
        }
    }
    static dif(a, b) {
        let ret = [];
        for (let ta of a) {
            if (!Variable.contains(b, ta))
                ret.push(ta);
        }
        return ret;
    }
    static contains(a, b) {
        for (let ta of a) {
            if (ta.equals(b)) {
                return true;
            }
        }
        return false;
    }
    static gammaToTexString(gamma) {
        if (gamma.length === 0)
            return "";
        let ret = gamma[0].name + " : " + gamma[0].type.toTexString();
        for (let i = 1; i < gamma.length; i++) {
            ret += ",~" + gamma[i].name + " : " + gamma[i].type.toTexString();
        }
        return ret;
    }
    static getNew(used) {
        let alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        for (let a of alphabet) {
            let z = new Variable(a);
            if (!Variable.contains(used, z)) {
                return z;
            }
        }
        throw new error_1.SubstitutionError("No more Variables available");
    }
    getRedexes(typed, etaAllowed, noParen) {
        return [];
    }
}
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
        let str = "\\AxiomC{}\n";
        str += "\\RightLabel{\\scriptsize(con)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult([new type_1.TypeEquation(this.type, type)], str);
    }
    toString() {
        return "[" + this.name + "]";
    }
    toTexString() {
        return this.name + "^{" + this.type.toTexString() + "}";
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (typed) {
            return [];
        }
        else {
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
        }
    }
}
// int型定数 c^{int}
class ConstInt extends Const {
    constructor(value) {
        super(value.toString(), "ConstInt");
        this.value = value;
        this.type = new type_1.TypeInt();
    }
}
// bool型定数 c^{bool}
class ConstBool extends Const {
    constructor(value) {
        super(value.toString(), "ConstBool");
        this.value = value;
        this.type = new type_1.TypeBool();
    }
}
// 関数型定数 c^{op} （前置記法・2項演算）
class ConstOp extends Const {
    constructor(funcName) {
        super(funcName, "ConstOp");
        switch (funcName) {
            case "+":
                this.value = (x, y) => (new ConstInt(x.value + y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeInt()));
                break;
            case "-":
                this.value = (x, y) => (new ConstInt(x.value - y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeInt()));
                break;
            case "*":
                this.value = (x, y) => (new ConstInt(x.value * y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeInt()));
                break;
            case "/":
                this.value = (x, y) => { if (y.value === 0)
                    throw new error_1.ReductionError("Dividing by '0' is not allowed");
                else
                    return new ConstInt(Math.floor(x.value / y.value)); };
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeInt()));
                break;
            case "%":
                this.value = (x, y) => { if (y.value === 0)
                    throw new error_1.ReductionError("Dividing by '0' is not allowed");
                else
                    return new ConstInt(x.value - Math.floor(x.value / y.value) * 4); };
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeInt()));
                break;
            case "<":
                this.value = (x, y) => (new ConstBool(x.value < y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case ">":
                this.value = (x, y) => (new ConstBool(x.value > y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case "<=":
                this.value = (x, y) => (new ConstBool(x.value <= y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case ">=":
                this.value = (x, y) => (new ConstBool(x.value >= y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case "==":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case "!=":
                this.value = (x, y) => (new ConstBool(x.value != y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeFunc(new type_1.TypeInt(), new type_1.TypeBool()));
                break;
            case "eq":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "eq":
                this.value = (x, y) => (new ConstBool(x.value == y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "xor":
                this.value = (x, y) => (new ConstBool(x.value != y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "or":
                this.value = (x, y) => (new ConstBool(x.value || y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "and":
                this.value = (x, y) => (new ConstBool(x.value && y.value));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "nor":
                this.value = (x, y) => (new ConstBool(!(x.value || y.value)));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            case "nand":
                this.value = (x, y) => (new ConstBool(!(x.value && y.value)));
                this.type = new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeFunc(new type_1.TypeBool(), new type_1.TypeBool()));
                break;
            default:
                throw new error_1.LambdaParseError("Undefined function: " + funcName);
        }
    }
}
// 空リスト nil
class Nil extends Symbol {
    substitute(x, expr) {
        return this;
    }
    constructor() {
        super("nil", "Nil");
        this.freevals = [];
    }
    getEquations(gamma, type) {
        // (nil)
        let t = type_1.TypeVariable.getNew();
        let nType = new type_1.TypeList(t);
        let str = "\\AxiomC{}\n";
        str += "\\RightLabel{\\scriptsize(nil)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.name + " : " + nType.toTexString() + " $}\n";
        return new TypeResult([new type_1.TypeEquation(type, nType)], str);
    }
    toTexString() {
        return "{\\rm " + this.name + "}";
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (typed) {
            return [];
        }
        else {
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
        }
    }
}
// マクロ定義
class Macro extends Symbol {
    constructor(name, expr, typed, type) {
        super(name, "Macro");
        this.freevals = [];
        this.expr = expr;
        this.typed = typed;
        this.type = type;
    }
    static add(name, lf, typed) {
        let expr = lf.expr;
        if (!(/^[a-zA-Z0-9!?]+$/.test(name))) {
            throw new error_1.MacroError("<" + name + "> cannot be used as a name of macro. Available characters: [a-zA-Z0-9!?]");
        }
        let map = (typed ? Macro.map : Macro.mapUntyped);
        if (expr.getFV().length !== 0) {
            throw new error_1.MacroError("<" + name + "> contains free variables: " + expr.getFV());
        }
        let m = new Macro(name, expr, typed, lf.type);
        m.isTopLevel = true;
        map[name] = m;
        return map[name];
    }
    static clear(typed) {
        if (typed) {
            Macro.map = {};
        }
        else {
            Macro.mapUntyped = {};
        }
    }
    static get(name, typed) {
        let ret;
        if (typed) {
            ret = Macro.map[name];
        }
        else {
            ret = Macro.mapUntyped[name];
        }
        if (ret === undefined) {
            // 発展の余地あり。typeを指定したundefマクロを許す？
            return new Macro(name, undefined, typed, undefined);
        }
        else {
            return new Macro(name, ret.expr, typed, ret.type);
        }
    }
    static getMap(typed) {
        return Object.assign({}, (typed ? Macro.map : Macro.mapUntyped));
    }
    substitute(x, expr) {
        return this;
    }
    toString() {
        return "<" + this.name + ">";
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
    getRedexes(typed, etaAllowed, noParen) {
        if (this.expr === undefined)
            return [];
        else
            return [new MacroRedex(this)];
    }
    resetTopLevel() {
        this.isTopLevel = false;
        if (this.expr !== undefined)
            this.expr.resetTopLevel();
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
    static parse(tokens, typed) {
        let boundvals = [];
        while (tokens.length > 0) {
            let t = tokens.shift();
            if (t.name === ".") {
                let expr = parseSymbols(tokens, typed);
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
        let boundvals = [this.boundval];
        let expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval);
            expr = expr.expr;
        }
        let str = "\\" + boundvals.join("") + ".";
        if (expr instanceof Application) {
            let expr1 = expr.left;
            let str1 = expr.right.toString();
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
            let uniFV = Variable.union(this.expr.getFV(), expr.getFV());
            let z = Variable.getNew(uniFV);
            return new LambdaAbstraction(z, this.expr.substitute(this.boundval, z)).substitute(y, expr);
        }
    }
    equals(expr) {
        return (expr instanceof LambdaAbstraction) && (expr.boundval.equals(this.boundval)) && (expr.expr.equals(this.expr));
    }
    equalsAlpha(expr) {
        if (!(expr instanceof LambdaAbstraction))
            return false;
        if (this.equals(expr))
            return true;
        let x = this.boundval;
        let m = this.expr;
        let y = expr.boundval;
        let n = expr.expr;
        return (!Variable.contains(m.getFV(), y) && n.equalsAlpha(m.substitute(x, y)));
    }
    getEquations(gamma, type) {
        // (abs)
        let t0 = type_1.TypeVariable.getNew();
        let t1 = type_1.TypeVariable.getNew();
        this.boundval.type = t1;
        let next = this.expr.getEquations(gamma.concat(this.boundval), t0);
        let str = next.proofTree;
        str += "\\RightLabel{\\scriptsize(abs)}\n";
        str += "\\UnaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(next.eqs.concat(new type_1.TypeEquation(type, new type_1.TypeFunc(t1, t0))), str);
    }
    toTexString() {
        let boundvals = [this.boundval.toTexString()];
        let expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval.toTexString());
            expr = expr.expr;
        }
        let str = "\\lambda " + boundvals.join("") + ".";
        if (expr instanceof Application) {
            let expr1 = expr.left;
            let str1 = expr.right.toTexString();
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
    getRedexes(typed, etaAllowed, noParen) {
        if (typed)
            return [];
        let boundvals = [this.boundval];
        let expr = this.expr;
        while (expr instanceof LambdaAbstraction) {
            boundvals.push(expr.boundval);
            expr = expr.expr;
        }
        let lParen = "", rParen = "";
        if (!this.isTopLevel && !noParen) {
            lParen = "(";
            rParen = ")";
        }
        let ret = Redex.makeNext(this.expr.getRedexes(false, etaAllowed, true), lParen + "\\" + boundvals.join("") + ".", rParen, lParen + "\\lambda{" + boundvals.join("") + "}.", rParen, (prev) => (new LambdaAbstraction(this.boundval, prev)));
        if (etaAllowed === undefined) {
            console.error("etaAllowed is undefined.");
            etaAllowed = false;
        }
        if (etaAllowed && this.isEtaRedex()) {
            ret.push(new EtaRedex(this));
        }
        return ret;
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.boundval.resetTopLevel();
        this.expr.resetTopLevel();
    }
}
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
        let expr = this.left;
        let str = this.right.toString();
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
    equals(expr) {
        return (expr instanceof Application) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
    }
    equalsAlpha(expr) {
        return (expr instanceof Application) && (expr.left.equalsAlpha(this.left)) && (expr.right.equalsAlpha(this.right));
    }
    getEquations(gamma, type) {
        // (app)
        let t1 = type_1.TypeVariable.getNew();
        let nextL = this.left.getEquations(gamma, new type_1.TypeFunc(t1, type));
        let nextR = this.right.getEquations(gamma, t1);
        let str = nextL.proofTree + nextR.proofTree;
        str += "\\RightLabel{\\scriptsize(app)}\n";
        str += "\\BinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
    }
    toTexString() {
        let expr = this.left;
        let str = this.right.toTexString();
        while (expr instanceof Application) {
            str = expr.right.toTexString() + str;
            expr = expr.left;
        }
        str = expr.toTexString() + str;
        if (!this.isTopLevel)
            str = "(" + str + ")";
        return str;
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (typed) {
            // typed
            let lParen = (this.isTopLevel ? "" : "(");
            let rParen = (this.isTopLevel ? "" : ")");
            if (this.left instanceof LambdaAbstraction) {
                // (app2)
                return [new TypedRedex(this, this.left.expr.substitute(this.left.boundval, this.right), "app2")];
            }
            else if (this.left instanceof Application
                && this.left.left instanceof ConstOp
                && this.left.right instanceof Const) {
                let op = this.left.left;
                let left = this.left.right;
                let right = this.right;
                if (right instanceof Const) {
                    // (app5)
                    if (op.type.left.equals(left.type) && op.type.right instanceof type_1.TypeFunc && op.type.right.left.equals(right.type)) {
                        return [new TypedRedex(this, op.value(left, right), "app5")];
                    }
                    else {
                        throw new error_1.ReductionError(op.type + " cannot handle " + left.type + " and " + right.type + " as arguments");
                    }
                }
                else {
                    // (app4)
                    return Redex.makeNext(right.getRedexes(true, false, false), lParen + op.toString() + left.toString(), rParen, lParen + op.toTexString() + left.toTexString(), rParen, (prev) => (new Application(new Application(op, left), prev)));
                }
            }
            else if (this.left instanceof ConstOp) {
                // (app3)
                return Redex.makeNext(this.right.getRedexes(true, false, false), lParen + this.left.toString(), rParen, lParen + this.left.toTexString(), rParen, (prev) => (new Application(this.left, prev)));
            }
            else {
                // (app1)
                return Redex.makeNext(this.left.getRedexes(true, false, false), lParen, rParen + this.right.toString(), lParen, rParen + this.right.toTexString(), (prev) => (new Application(prev, this.right)));
            }
        }
        else {
            // untyped
            let apps = [this];
            let right = [""];
            let texRight = [""];
            while (true) {
                let t = apps[apps.length - 1];
                right.push(t.right.toString() + right[right.length - 1]);
                texRight.push(t.right.toTexString() + right[texRight.length - 1]);
                if (!(t.left instanceof Application))
                    break;
                apps.push(t.left);
            }
            // apps = [abc, ab]
            // right = ["","c","bc"]
            let ret = apps[apps.length - 1].left.getRedexes(false, etaAllowed, false);
            while (apps.length > 0) {
                let t = apps.pop();
                let ret1 = Redex.makeNext(ret, "", t.right.toString(), "", t.right.toTexString(), (prev) => (new Application(prev, t.right)));
                let lstr = t.left.toString();
                if (t.left instanceof Application)
                    lstr = lstr.slice(1, -1);
                let ret2 = Redex.makeNext(t.right.getRedexes(false, etaAllowed, false), lstr, "", t.left.toTexString(), "", (prev) => (new Application(t.left, prev)));
                ret = ret1.concat(ret2);
                right.pop();
                texRight.pop();
                if (t.isBetaRedex()) {
                    ret.push(new BetaRedex(t));
                }
            }
            if (!this.isTopLevel && !noParen) {
                ret = Redex.makeNext(ret, "(", ")", "(", ")", (prev) => (prev));
            }
            return ret;
        }
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.left.resetTopLevel();
        this.right.resetTopLevel();
    }
}
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
    equals(expr) {
        return (expr instanceof List) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail));
    }
    equalsAlpha(expr) {
        return (expr instanceof List) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail));
    }
    getEquations(gamma, type) {
        // (list) 再検討の余地あり？ 新しい型変数要る？
        let t = type_1.TypeVariable.getNew();
        let lt = new type_1.TypeList(t);
        let nextH = this.head.getEquations(gamma, t);
        let nextT = this.tail.getEquations(gamma, lt);
        let str = nextH.proofTree + nextT.proofTree;
        str += "\\RightLabel{\\scriptsize(list)}\n";
        str += "\\BinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + lt.toTexString() + " $}\n";
        return new TypeResult(nextH.eqs.concat(nextT.eqs, new type_1.TypeEquation(lt, type)), str);
    }
    toTexString() {
        return this.head.toTexString() + "::" + this.tail.toTexString();
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (typed)
            return [];
        else
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.head.resetTopLevel();
        this.tail.resetTopLevel();
    }
}
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
    equals(expr) {
        return (expr instanceof If) && (expr.state.equals(this.state)) && (expr.ifTrue.equals(this.ifTrue)) && (expr.ifFalse.equals(this.ifFalse));
    }
    equalsAlpha(expr) {
        return (expr instanceof If) && (expr.state.equalsAlpha(this.state)) && (expr.ifTrue.equalsAlpha(this.ifTrue)) && (expr.ifFalse.equalsAlpha(this.ifFalse));
    }
    getEquations(gamma, type) {
        // (if)
        let nextS = this.state.getEquations(gamma, new type_1.TypeBool());
        let nextT = this.ifTrue.getEquations(gamma, type);
        let nextF = this.ifFalse.getEquations(gamma, type);
        let str = nextS.proofTree + nextT.proofTree + nextF.proofTree;
        str += "\\RightLabel{\\scriptsize(if)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextS.eqs.concat(nextT.eqs, nextF.eqs), str);
    }
    toTexString() {
        return "({\\bf if}~" + this.state.toTexString() + "~{\\bf then}~" + this.ifTrue.toTexString() + "~{\\bf else}~" + this.ifFalse.toTexString() + ")";
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (!typed)
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
        if (this.state instanceof ConstBool) {
            if (this.state.value) {
                // (if2)
                return [new TypedRedex(this, this.ifTrue, "if2")];
            }
            else {
                // (if3)
                return [new TypedRedex(this, this.ifFalse, "if3")];
            }
        }
        else {
            // (if1)
            return Redex.makeNext(this.state.getRedexes(true, false, false), "([if]", "[then]" + this.ifTrue + "[else]" + this.ifFalse + ")", "({\\bf if}~", "~{\\bf then}~" + this.ifTrue.toTexString() + "~{\\bf else}~" + this.ifFalse.toTexString() + ")", (prev) => (new If(prev, this.ifTrue, this.ifFalse)));
        }
    }
    static parse(tokens, typed) {
        let state = [];
        let i_num = 0, t_num = 0, e_num = 0;
        while (true) {
            if (tokens.length == 0)
                throw new error_1.LambdaParseError("Illegal If statement");
            let t = tokens.shift();
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
        let stateExpr = parseSymbols(state, typed);
        let ifTrue = [];
        i_num = 0, t_num = 0, e_num = 0;
        while (true) {
            if (tokens.length == 0)
                throw new error_1.LambdaParseError("Illegal If statement");
            let t = tokens.shift();
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
        let ifTrueExpr = parseSymbols(ifTrue, typed);
        let ifFalseExpr = parseSymbols(tokens, typed);
        return new If(stateExpr, ifTrueExpr, ifFalseExpr);
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.state.resetTopLevel();
        this.ifTrue.resetTopLevel();
        this.ifFalse.resetTopLevel();
    }
}
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
        let ret = [];
        for (let fv of this.right.getFV()) {
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
        let left = this.left.substitute(y, expr);
        if (this.boundVal.equals(y)) {
            return new Let(this.boundVal, left, this.right);
        }
        else if (!Variable.contains(expr.getFV(), this.boundVal)) {
            return new Let(this.boundVal, left, this.right.substitute(y, expr));
        }
        else {
            let uniFV = Variable.union(this.right.getFV(), expr.getFV());
            let z = Variable.getNew(uniFV);
            if (z.equals(y)) {
                return new Let(z, left, this.right.substitute(this.boundVal, z));
            }
            else {
                return new Let(z, left, this.right.substitute(this.boundVal, z).substitute(y, expr));
            }
        }
    }
    equals(expr) {
        return (expr instanceof Let) && (expr.boundVal.equals(this.boundVal)) && (expr.left.equals(this.left)) && (expr.right.equals(this.right));
    }
    equalsAlpha(expr) {
        if (!(expr instanceof Let))
            return false;
        if (this.equals(expr))
            return true;
        let x = this.boundVal;
        let m = this.right;
        let y = expr.boundVal;
        let n = expr.right;
        return (!Variable.contains(m.getFV(), y) && n.equalsAlpha(m.substitute(x, y)));
    }
    getEquations(gamma, type) {
        // (let)
        let t1 = type_1.TypeVariable.getNew();
        this.boundVal.type = t1;
        let nextL = this.left.getEquations(gamma, t1);
        let nextR = this.right.getEquations(gamma.concat(this.boundVal), type);
        let str = nextL.proofTree + nextR.proofTree;
        str += "\\RightLabel{\\scriptsize(let)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextL.eqs.concat(nextR.eqs), str);
    }
    toTexString() {
        return "({\\bf let}~" + this.boundVal.toTexString() + " = " + this.left.toTexString() + "~{\\bf in}~" + this.right.toTexString() + ")";
    }
    getRedexes(typed, etaAllowed, noParen) {
        if (!typed)
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
        // (let)
        return [new TypedRedex(this, this.right.substitute(this.boundVal, this.left), "let")];
    }
    static parse(tokens, typed) {
        let t = tokens.shift();
        if (t.name.match(/^[A-Za-z]$/) === null)
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        let boundVal = new Variable(t.name);
        if (tokens.shift().name !== "=")
            throw new error_1.LambdaParseError("'=' is expected");
        let content = [];
        let i = 1;
        while (true) {
            // console.log(i);
            if (tokens.length == 0)
                throw new error_1.LambdaParseError("Illegal Let statement");
            let t = tokens.shift();
            if (t.name === "let")
                i++;
            else if (t.name === "in")
                i--;
            if (i == 0)
                break;
            content.push(t);
        }
        let contentExpr = parseSymbols(content, typed);
        let restExpr = parseSymbols(tokens, typed);
        return new Let(boundVal, contentExpr, restExpr);
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.boundVal.resetTopLevel();
        this.left.resetTopLevel();
        this.right.resetTopLevel();
    }
}
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
        let state = this.state.substitute(y, expr);
        let ifNil = this.ifNil.substitute(y, expr);
        if (this.head.equals(y) || this.tail.equals(y)) {
            return new Case(state, ifNil, this.head, this.tail, this.ifElse);
        }
        else if (!Variable.contains(expr.getFV(), this.head) && !Variable.contains(expr.getFV(), this.tail)) {
            return new Case(state, ifNil, this.head, this.tail, this.ifElse.substitute(y, expr));
        }
        else {
            let head = this.head;
            let tail = this.tail;
            let ifElse = this.ifElse;
            if (Variable.contains(expr.getFV(), head)) {
                let uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
                let z = Variable.getNew(uniFV);
                if (z.equals(y)) {
                    ifElse = ifElse.substitute(head, z);
                }
                else {
                    ifElse = ifElse.substitute(head, z).substitute(y, expr);
                }
                head = z;
            }
            if (Variable.contains(expr.getFV(), tail)) {
                let uniFV = Variable.union(this.ifElse.getFV(), expr.getFV());
                let z = Variable.getNew(uniFV);
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
    equals(expr) {
        return (expr instanceof Case) && (expr.state.equals(this.state)) && (expr.ifNil.equals(this.ifNil)) && (expr.head.equals(this.head)) && (expr.tail.equals(this.tail)) && (expr.ifElse.equals(this.ifElse));
    }
    equalsAlpha(expr) {
        return (expr instanceof Case) && (expr.state.equalsAlpha(this.state)) && (expr.ifNil.equalsAlpha(this.ifNil)) && (expr.head.equalsAlpha(this.head)) && (expr.tail.equalsAlpha(this.tail)) && (expr.ifElse.equalsAlpha(this.ifElse));
    }
    getEquations(gamma, type) {
        // (case)
        let t1 = type_1.TypeVariable.getNew();
        let lt1 = new type_1.TypeList(t1);
        this.head.type = t1;
        this.tail.type = lt1;
        let nextS = this.state.getEquations(gamma, lt1);
        let nextN = this.ifNil.getEquations(gamma, type);
        let nextE = this.ifElse.getEquations(gamma.concat(this.head, this.tail), type);
        let str = nextS.proofTree + nextN.proofTree + nextE.proofTree;
        str += "\\RightLabel{\\scriptsize(case)}\n";
        str += "\\TrinaryInfC{$" + Variable.gammaToTexString(gamma) + " \\vdash " + this.toTexString() + " : " + type.toTexString() + " $}\n";
        return new TypeResult(nextS.eqs.concat(nextN.eqs, nextE.eqs), str);
    }
    toTexString() {
        return "({\\bf case} " + this.state + " {\\bf of} {\\rm nil} \\Rightarrow " + this.ifNil.toTexString() + " | " + this.head.toTexString() + "::" + this.tail.toTexString() + " \\Rightarrow " + this.ifElse.toTexString() + ")";
    }
    getRedexes(typed, etaAllowed) {
        if (!typed)
            throw new error_1.ReductionError("Untyped Reduction cannot handle typeof " + this.className);
        if (this.state instanceof Nil) {
            // (case2)
            return [new TypedRedex(this, this.ifNil, "case2")];
        }
        else if (this.state instanceof List) {
            // (case3)
            return [new TypedRedex(this, this.ifElse.substitute(this.head, this.state.head).substitute(this.tail, this.state.tail), "case3")];
        }
        else {
            // (case1)
            return Redex.makeNext(this.state.getRedexes(true, false, false), "([case]", "[of][nil]->" + this.ifNil + " | " + this.head + "::" + this.tail + "->" + this.ifElse + ")", "({\\bf case} ", " {\\bf of} {\\rm nil} \\Rightarrow " + this.ifNil.toTexString() + " | " + this.head.toTexString() + "::" + this.tail.toTexString() + " \\Rightarrow " + this.ifElse.toTexString() + ")", (prev) => (new Case(prev, this.ifNil, this.head, this.tail, this.ifElse)));
        }
    }
    resetTopLevel() {
        this.isTopLevel = false;
        this.state.resetTopLevel();
        this.ifNil.resetTopLevel();
        this.head.resetTopLevel();
        this.tail.resetTopLevel();
        this.ifElse.resetTopLevel();
    }
    static parse(tokens, typed) {
        let state = [];
        let i = 1;
        while (true) {
            if (tokens.length == 0)
                throw new error_1.LambdaParseError("Illegal Case statement");
            let t = tokens.shift();
            if (t.name === "case")
                i++;
            else if (t.name === "of")
                i--;
            if (i == 0)
                break;
            state.push(t);
        }
        let stateExpr = parseSymbols(state, typed);
        let t = tokens.shift();
        if (t.name !== "nil")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        t = tokens.shift();
        if (t.name !== "-")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        t = tokens.shift();
        if (t.name !== ">")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        let ifNil = [];
        i = 1;
        while (true) {
            if (tokens.length == 0)
                throw new error_1.LambdaParseError("Too many [case]");
            let t = tokens.shift();
            if (t.name === "case")
                i++;
            else if (t.name === "|")
                i--;
            if (i == 0)
                break;
            ifNil.push(t);
        }
        let ifNilExpr = parseSymbols(ifNil, typed);
        let head = new Variable(tokens.shift().name);
        if (head.name.match(/^[A-Za-z]$/) === null)
            throw new error_1.LambdaParseError("Unexpected token: '" + head.name + "'");
        t = tokens.shift();
        if (t.name !== ":")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        t = tokens.shift();
        if (t.name !== ":")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        let tail = new Variable(tokens.shift().name);
        if (tail.name.match(/^[A-Za-z]$/) === null)
            throw new error_1.LambdaParseError("Unexpected token: '" + tail.name + "'");
        t = tokens.shift();
        if (t.name !== "-")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        t = tokens.shift();
        if (t.name !== ">")
            throw new error_1.LambdaParseError("Unexpected token: '" + t + "'");
        let ifElseExpr = parseSymbols(tokens, typed);
        return new Case(stateExpr, ifNilExpr, head, tail, ifElseExpr);
    }
}

},{"./error":1,"./type":4}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expression_1 = require("./expression");
const type_1 = require("./type");
class LambdaFriends {
    constructor(str, typed, etaAllowed) {
        let l = str.split("#")[0].trim();
        let names = [];
        while (true) {
            let ts = l.match(/^[^[]+?\s*=\s*/);
            if (ts === null)
                break;
            let t = ts[0];
            ts = l.split(t);
            ts.shift();
            l = ts.join(t);
            names.push(t.split(/\s*=\s*$/)[0]);
        }
        this.expr = expression_1.makeAST(l, typed);
        this.original = this.expr;
        this.type = this.getType(typed);
        for (let name of names) {
            expression_1.Macro.add(name, this, typed);
        }
        this.typed = typed;
        this.etaAllowed = etaAllowed;
        this.processTex = "\\begin{eqnarray*}\n&& ";
        this.curStep = 0;
    }
    getRedexes() {
        return this.expr.getRedexes(this.typed, this.etaAllowed, true).sort(expression_1.Redex.compare);
    }
    reduction(redex) {
        if (redex === undefined) {
            // 簡約基指定のない場合、最左簡約
            let rs = this.getRedexes();
            if (rs.length === 0)
                return null;
            redex = rs[0];
        }
        this.expr = redex.next;
        this.expr.setRoot();
        this.curStep++;
        this.processTex += redex.toTexString() + " \\\\\n&\\longrightarrow_{" + redex.getTexRule() + "}& ";
        let ret = this.curStep + ": (" + redex.rule + ") --> " + this.expr.toString();
        if (!this.hasNext()) {
            ret += "    (normal form)\n";
            let n = this.parseChurchNum();
            if (n !== null)
                ret += "  = " + n + " (as nat)\n";
            let b = this.parseChurchBool();
            if (b !== null)
                ret += "  = " + b + " (as bool)\n";
            ret.slice(0, ret.length - 1);
        }
        return ret;
    }
    // 連続nステップ最左簡約
    continualReduction(step) {
        if (step === undefined)
            step = 100;
        let strs = [];
        for (let i = 0; i < step; i++) {
            let result = this.reduction();
            if (result === null)
                break;
            strs.push(result);
        }
        return strs.join("\n");
    }
    hasNext() {
        return !this.expr.isNormalForm(this.typed, this.etaAllowed);
    }
    getProofTree() {
        return "\\begin{prooftree}\n" + this.proofTree + "\\end{prooftree}";
    }
    getProcessTex() {
        return this.processTex + this.expr.toTexString() + (this.hasNext() ? "" : "\\not\\longrightarrow") + "\n\\end{eqnarray*}";
    }
    getType(typed) {
        if (!typed)
            return new type_1.TypeUntyped();
        type_1.TypeVariable.maxId = undefined;
        let target = type_1.TypeVariable.getNew();
        let typeResult = this.expr.getEquations([], target);
        let eqs = typeResult.eqs;
        this.proofTree = typeResult.proofTree;
        let ret = type_1.TypeEquation.get(target, type_1.TypeEquation.solve(eqs));
        let vs = ret.getVariables();
        // 't0,'t1,'t2,... から 'a,'b,'c,... に変換
        let vars = [];
        for (let v of vs) {
            if (!type_1.TypeVariable.contains(vars, v))
                vars.push(v);
        }
        let i = 0;
        for (let v of vars) {
            ret.replace(v, type_1.TypeVariable.getAlphabet(i));
            i++;
        }
        return ret;
    }
    static parseMacroDef(str, typed) {
        let l = str.split("#")[0].trim();
        let names = [];
        while (true) {
            let ts = l.match(/^[^[]+?\s*=\s*/);
            if (ts === null)
                break;
            let t = ts[0];
            ts = l.split(t);
            ts.shift();
            l = ts.join(t);
            names.push(t.split(/\s*=\s*$/)[0]);
        }
        if (names.length === 0)
            return null;
        let lf = new LambdaFriends(l, typed, undefined); // ???
        for (let name of names) {
            expression_1.Macro.add(name, lf, typed);
        }
        // let name = names.shift();
        // let ret = "<"+name+">"
        // while (names.length>0){
        //   let name = names.shift();
        //   ret += " and <"+name+">";
        // }
        // ret += " is defined as "+lf.expr+" : "+lf.type;
        return { names: names, expr: lf.expr.toString(), type: lf.type.toString() };
    }
    // return: file input log
    static fileInput(textData, typed) {
        let lines = textData.split("\n");
        let errors = [];
        let defs = [];
        for (let l of lines) {
            try {
                let ret = LambdaFriends.parseMacroDef(l, typed);
                if (ret !== null)
                    defs.push(ret);
            }
            catch (e) {
                errors.push(e.toString());
            }
        }
        let indent = "* ";
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
    static getMacroList(typed) {
        let str = "";
        let map = expression_1.Macro.getMap(typed);
        for (let key in map) {
            let e = map[key];
            str += "<" + e.name + "> is defined as " + e.expr + " : " + e.type + "\n";
        }
        return str;
    }
    static getMacroListAsObject(typed) {
        return expression_1.Macro.getMap(typed);
    }
    static clearMacro(typed) {
        return expression_1.Macro.clear(typed);
    }
    toString() {
        let ret = this.expr + " : " + this.type;
        if (!this.hasNext()) {
            ret += "    (normal form)\n";
            let n = this.parseChurchNum();
            if (n !== null)
                ret += "  = " + n + " (as nat)\n";
            let b = this.parseChurchBool();
            if (b !== null)
                ret += "  = " + b + " (as bool)\n";
            ret = ret.slice(0, ret.length - 1);
        }
        return ret;
    }
    getOriginalString() {
        return this.original + " : " + this.type;
    }
    parseChurchNum() {
        return this.expr.parseChurchNum();
    }
    parseChurchBool() {
        return this.expr.parseChurchBool();
    }
}
exports.LambdaFriends = LambdaFriends;

},{"./expression":2,"./type":4}],4:[function(require,module,exports){
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
class TypeBool extends TypeConstructor {
    constructor() {
        super("TypeBool");
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
class TypeUntyped extends Type {
    constructor() {
        super("TypeUntyped");
    }
    toString() {
        return "Untyped";
    }
    toTexString() {
        return "{\\rm Untyped}";
    }
    equals(t) {
        if (t instanceof TypeUntyped)
            return true;
        else
            return false;
    }
    contains(t) {
        return false;
    }
    replace(from, to) { }
    getVariables() {
        return [];
    }
}
exports.TypeUntyped = TypeUntyped;

},{"./error":1}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lambda_friends_1 = require("./lambda-friends");
var MicroModal = require('micromodal');
// Initial config for setting up modals
MicroModal.init({
    openTrigger: 'data-custom-open',
    disableScroll: false,
    awaitCloseAnimation: true
});
var steps = undefined;
var typed = true;
var etaAllowed = false;
var curlf = undefined;
var input = document.getElementById("input");
var oel = document.getElementById("output");
var untypedButton = document.getElementById("untyped");
var typedButton = document.getElementById("typed");
var etaEnableButton = document.getElementById("etaEnable");
var etaDisableButton = document.getElementById("etaDisable");
var fileInput = document.getElementById("fileInput");
var fileReader = new FileReader();
var clearMacroButton = document.getElementById("clearMacroBtn");
var tabC = document.getElementById("tabC");
// var macroNameInput = <HTMLInputElement>document.getElementById("macroNameInput");
// var macroInput = <HTMLInputElement>document.getElementById("macroInput");
// var submitMacroBtn = <HTMLButtonElement>document.getElementById("submitMacro");
var outputButtons = document.getElementById("outputBtns");
var stepInput = document.getElementById("stepInput");
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
    let ret = lambda_friends_1.LambdaFriends.fileInput(fileReader.result, typed);
    refreshMacroList();
    let div = document.getElementById("fileInputLog");
    div.textContent = null;
    if (ret.defs.length > 0) {
        let div1 = document.createElement("div");
        let title1 = document.createElement("p");
        title1.innerText = "Finally, " + ret.defs.length + " macros are successfully added.";
        let list1 = document.createElement("ul");
        list1.className = "code";
        for (let t of ret.defs) {
            let li = document.createElement("li");
            let names = [].concat(t.names);
            let name = names.shift();
            let ret = "<" + name + ">";
            while (names.length > 0) {
                let name = names.shift();
                ret += " and <" + name + ">";
            }
            li.innerText = ret + " is defined as " + t.expr + " : " + t.type;
            list1.appendChild(li);
        }
        div1.appendChild(title1);
        div1.appendChild(list1);
        div.appendChild(div1);
    }
    if (ret.errs.length > 0) {
        let div2 = document.createElement("div");
        let title2 = document.createElement("p");
        title2.innerText = "Unfortunately, " + ret.errs.length + " macros are rejected due to some errors.";
        let list2 = document.createElement("ul");
        list2.className = "code";
        for (let t of ret.errs) {
            let li = document.createElement("li");
            li.innerText = t;
            list2.appendChild(li);
        }
        div2.appendChild(title2);
        div2.appendChild(list2);
        div.appendChild(div2);
    }
    MicroModal.show('modal-1', {
        debugMode: true,
        disableScroll: true,
        awaitCloseAnimation: true
    });
});
untypedButton.onclick = function () {
    untypedButton.className = "btn btn-primary";
    typedButton.className = "btn btn-default";
    typed = false;
    etaEnableButton.disabled = false;
    etaDisableButton.disabled = false;
    refreshMacroList();
};
typedButton.onclick = function () {
    typedButton.className = "btn btn-primary";
    untypedButton.className = "btn btn-default";
    typed = true;
    etaEnableButton.disabled = true;
    etaDisableButton.disabled = true;
    refreshMacroList();
};
etaEnableButton.onclick = function () {
    etaEnableButton.className = "btn btn-primary";
    etaDisableButton.className = "btn btn-default";
    etaAllowed = true;
};
etaDisableButton.onclick = function () {
    etaDisableButton.className = "btn btn-primary";
    etaEnableButton.className = "btn btn-default";
    etaAllowed = false;
};
clearMacroButton.onclick = function () {
    lambda_friends_1.LambdaFriends.clearMacro(typed);
    refreshMacroList();
};
stepInput.addEventListener("change", function () {
    var new_s = parseInt(stepInput.value);
    if (!isNaN(new_s)) {
        steps = new_s;
    }
    else {
        steps = undefined;
    }
});
var history = [];
var historyNum = 0;
var workspace = [""];
var submitInput = function () {
    let line = input.value;
    if (line === "" && curlf !== undefined) {
        doContinual();
    }
    history.unshift(line);
    historyNum = 0;
    workspace = [].concat(history);
    workspace.unshift("");
    line = line.split("#")[0];
    line = line.trim();
    if (line !== "") {
        try {
            let ret = lambda_friends_1.LambdaFriends.parseMacroDef(line, typed);
            if (ret === null) {
                curlf = new lambda_friends_1.LambdaFriends(line, typed, etaAllowed);
                outputLine(curlf.toString());
                if (typed)
                    outputNextLine(curlf.continualReduction(steps));
                showContinueBtn();
            }
            else {
                let names = [].concat(ret.names);
                let name = names.shift();
                let str = "<" + name + ">";
                while (names.length > 0) {
                    let name = names.shift();
                    str += " and <" + name + ">";
                }
                str += " is defined as " + ret.expr + " : " + ret.type;
                outputLine(str);
                outputButtons.textContent = null;
            }
            refreshTex();
        }
        catch (e) {
            outputLine(e.toString());
            console.log(e);
            outputButtons.textContent = null;
        }
        refreshMacroList();
    }
    input.value = "";
};
document.getElementById("submit").onclick = submitInput;
document.getElementById("input").onkeydown = function (e) {
    if (e.keyCode === 13) {
        submitInput();
        e.preventDefault();
    }
    else if (e.keyCode === 38) {
        // up
        if (historyNum < workspace.length - 1) {
            workspace[historyNum] = input.value;
            historyNum++;
            input.value = workspace[historyNum];
        }
        e.preventDefault();
    }
    else if (e.keyCode === 40) {
        // down
        if (historyNum > 0) {
            workspace[historyNum] = input.value;
            historyNum--;
            input.value = workspace[historyNum];
        }
        e.preventDefault();
    }
};
// var submitMacro = function(){
//   LambdaFriends.parseMacroDef()
// }
let outputBuffer = "";
function output(str) {
    outputBuffer = str;
    oel.innerHTML = htmlEscape(outputBuffer);
}
function outputLine(str) {
    outputBuffer = str + "\n";
    oel.innerHTML = htmlEscape(outputBuffer);
}
function outputNext(str) {
    outputBuffer += str;
    oel.innerHTML = htmlEscape(outputBuffer);
}
function outputNextLine(str) {
    outputBuffer += str + "\n";
    oel.innerHTML = htmlEscape(outputBuffer);
}
function outputClear() {
    outputBuffer = "";
    oel.innerHTML = htmlEscape(outputBuffer);
}
function refreshMacroList() {
    var tbody = document.getElementById("macroList");
    tbody.innerHTML = "";
    var ret = lambda_friends_1.LambdaFriends.getMacroListAsObject(typed);
    for (var r in ret) {
        var m = ret[r];
        tbody.innerHTML += "<tr><th>" + htmlEscape(m.name) + "</th><td>" + htmlEscape(m.expr.toString()) + "</td><td>" + htmlEscape(m.type.toString()) + "</td></tr>";
    }
}
function htmlEscape(str) {
    return str.replace(/[&'`"<> \n]/g, function (match) {
        return {
            '&': '&amp;',
            "'": '&#x27;',
            '`': '&#x60;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
            ' ': '&nbsp;',
            '\n': '<br>'
        }[match];
    });
}
function refreshTex() {
    tabC.textContent = null;
    let proc = "";
    let proof = "";
    if (curlf !== undefined)
        proc = curlf.getProcessTex();
    tabC.appendChild(makeTexDiv("これまでの簡約過程", proc));
    if (typed) {
        if (curlf !== undefined)
            proof = curlf.getProofTree();
        tabC.appendChild(makeTexDiv("型付けの証明木", proof));
    }
}
function makeTexDiv(title, content) {
    let p = document.createElement("p");
    let btn = document.createElement("button");
    let span = document.createElement("span");
    let pre = document.createElement("pre");
    let code = document.createElement("code");
    p.appendChild(btn);
    p.appendChild(span);
    code.appendChild(pre);
    pre.innerText = content;
    span.innerText = title;
    btn.type = "button";
    btn.className = "btn btn-default btn-sm";
    btn.innerText = "クリップボードにコピー";
    // btn.setAttribute("data-toggle","popover");
    // btn.setAttribute("data-content","Copied!");
    // $(function(){$('[data-toggle="popover"]').popover();});
    btn.onclick = function () {
        let s = document.getSelection();
        s.selectAllChildren(code);
        document.execCommand('copy');
        s.collapse(document.body, 0);
    };
    let div = document.createElement("div");
    div.appendChild(p);
    div.appendChild(code);
    return div;
}
function doContinual() {
    outputNextLine(curlf.continualReduction(steps));
    showContinueBtn();
    refreshTex();
}
function showContinueBtn() {
    // 「さらに続ける」ボタンを表示
    if (!curlf.hasNext()) {
        outputButtons.textContent = null;
        return;
    }
    let b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-default btn-sm";
    b.innerText = "最左簡約を続ける";
    b.onclick = doContinual;
    outputButtons.textContent = null;
    outputButtons.appendChild(b);
    if (typed)
        return;
    let span = document.createElement("span");
    span.innerText = "または、以下から簡約基を選ぶ：";
    outputButtons.appendChild(span);
    let div = document.createElement("div");
    div.className = "list-group";
    outputButtons.appendChild(div);
    let rs = curlf.getRedexes();
    // console.log(rs);
    for (let r of rs) {
        let b = document.createElement("button");
        b.className = "list-group-item code";
        b.innerHTML = r.toHTMLString();
        b.onclick = function () {
            outputNextLine(curlf.reduction(r));
            showContinueBtn();
            refreshTex();
        };
        div.appendChild(b);
    }
}
// function showLog(str:string){
//   let newWin = window.open('','ログ - らむだフレンズ','width=400,height=300,scrollbars=no,status=no,toolbar=no,location=no,menubar=no,resizable=yes');
//   newWin.focus();
//   let doc = newWin.document;
//   doc.open();
//   doc.write("<!DOCTYPE html>");
//   doc.write('<html lang="ja">');
//   doc.write("<body>");
//   doc.write(htmlEscape(str).replace("\n","<br>"));
//   doc.write("</body>");
//   doc.write("</html>");
//   doc.close();
// }
// ===== initialize =====
untypedButton.onclick(null);
etaDisableButton.onclick(null);
refreshMacroList();
// var cytoscape = require("cytoscape")
// var cy = cytoscape({
//   container: graphDiv
// });

},{"./lambda-friends":3,"micromodal":6}],6:[function(require,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.MicroModal = factory());
}(this, (function () { 'use strict';

var version = "0.3.1";

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









































var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

var MicroModal = function () {
  var FOCUSABLE_ELEMENTS = ['a[href]', 'area[href]', 'input:not([disabled]):not([type="hidden"]):not([aria-hidden])', 'select:not([disabled]):not([aria-hidden])', 'textarea:not([disabled]):not([aria-hidden])', 'button:not([disabled]):not([aria-hidden])', 'iframe', 'object', 'embed', '[contenteditable]', '[tabindex]:not([tabindex^="-"])'];

  var Modal = function () {
    function Modal(_ref) {
      var targetModal = _ref.targetModal,
          _ref$triggers = _ref.triggers,
          triggers = _ref$triggers === undefined ? [] : _ref$triggers,
          _ref$onShow = _ref.onShow,
          onShow = _ref$onShow === undefined ? function () {} : _ref$onShow,
          _ref$onClose = _ref.onClose,
          onClose = _ref$onClose === undefined ? function () {} : _ref$onClose,
          _ref$openTrigger = _ref.openTrigger,
          openTrigger = _ref$openTrigger === undefined ? 'data-micromodal-trigger' : _ref$openTrigger,
          _ref$closeTrigger = _ref.closeTrigger,
          closeTrigger = _ref$closeTrigger === undefined ? 'data-micromodal-close' : _ref$closeTrigger,
          _ref$disableScroll = _ref.disableScroll,
          disableScroll = _ref$disableScroll === undefined ? false : _ref$disableScroll,
          _ref$disableFocus = _ref.disableFocus,
          disableFocus = _ref$disableFocus === undefined ? false : _ref$disableFocus,
          _ref$awaitCloseAnimat = _ref.awaitCloseAnimation,
          awaitCloseAnimation = _ref$awaitCloseAnimat === undefined ? false : _ref$awaitCloseAnimat,
          _ref$debugMode = _ref.debugMode,
          debugMode = _ref$debugMode === undefined ? false : _ref$debugMode;
      classCallCheck(this, Modal);

      // Save a reference of the modal
      this.modal = document.getElementById(targetModal);

      // Save a reference to the passed config
      this.config = { debugMode: debugMode, disableScroll: disableScroll, openTrigger: openTrigger, closeTrigger: closeTrigger, onShow: onShow, onClose: onClose, awaitCloseAnimation: awaitCloseAnimation, disableFocus: disableFocus

        // Register click events only if prebinding eventListeners
      };if (triggers.length > 0) this.registerTriggers.apply(this, toConsumableArray(triggers));

      // prebind functions for event listeners
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
    }

    /**
     * Loops through all openTriggers and binds click event
     * @param  {array} triggers [Array of node elements]
     * @return {void}
     */


    createClass(Modal, [{
      key: 'registerTriggers',
      value: function registerTriggers() {
        var _this = this;

        for (var _len = arguments.length, triggers = Array(_len), _key = 0; _key < _len; _key++) {
          triggers[_key] = arguments[_key];
        }

        triggers.forEach(function (trigger) {
          trigger.addEventListener('click', function () {
            return _this.showModal();
          });
        });
      }
    }, {
      key: 'showModal',
      value: function showModal() {
        this.activeElement = document.activeElement;
        this.modal.setAttribute('aria-hidden', 'false');
        this.modal.classList.add('is-open');
        this.setFocusToFirstNode();
        this.scrollBehaviour('disable');
        this.addEventListeners();
        this.config.onShow(this.modal);
      }
    }, {
      key: 'closeModal',
      value: function closeModal() {
        var modal = this.modal;
        this.modal.setAttribute('aria-hidden', 'true');
        this.removeEventListeners();
        this.scrollBehaviour('enable');
        this.activeElement.focus();
        this.config.onClose(this.modal);

        if (this.config.awaitCloseAnimation) {
          this.modal.addEventListener('animationend', function handler() {
            modal.classList.remove('is-open');
            modal.removeEventListener('animationend', handler, false);
          }, false);
        } else {
          modal.classList.remove('is-open');
        }
      }
    }, {
      key: 'scrollBehaviour',
      value: function scrollBehaviour(toggle) {
        if (!this.config.disableScroll) return;
        var body = document.querySelector('body');
        switch (toggle) {
          case 'enable':
            Object.assign(body.style, { overflow: 'initial', height: 'initial' });
            break;
          case 'disable':
            Object.assign(body.style, { overflow: 'hidden', height: '100vh' });
            break;
          default:
        }
      }
    }, {
      key: 'addEventListeners',
      value: function addEventListeners() {
        this.modal.addEventListener('touchstart', this.onClick);
        this.modal.addEventListener('click', this.onClick);
        document.addEventListener('keydown', this.onKeydown);
      }
    }, {
      key: 'removeEventListeners',
      value: function removeEventListeners() {
        this.modal.removeEventListener('touchstart', this.onClick);
        this.modal.removeEventListener('click', this.onClick);
        document.removeEventListener('keydown', this.onKeydown);
      }
    }, {
      key: 'onClick',
      value: function onClick(event) {
        if (event.target.hasAttribute(this.config.closeTrigger)) {
          this.closeModal();
          event.preventDefault();
        }
      }
    }, {
      key: 'onKeydown',
      value: function onKeydown(event) {
        if (event.keyCode === 27) this.closeModal(event);
        if (event.keyCode === 9) this.maintainFocus(event);
      }
    }, {
      key: 'getFocusableNodes',
      value: function getFocusableNodes() {
        var nodes = this.modal.querySelectorAll(FOCUSABLE_ELEMENTS);
        return Object.keys(nodes).map(function (key) {
          return nodes[key];
        });
      }
    }, {
      key: 'setFocusToFirstNode',
      value: function setFocusToFirstNode() {
        if (this.config.disableFocus) return;
        var focusableNodes = this.getFocusableNodes();
        if (focusableNodes.length) focusableNodes[0].focus();
      }
    }, {
      key: 'maintainFocus',
      value: function maintainFocus(event) {
        var focusableNodes = this.getFocusableNodes();

        // if disableFocus is true
        if (!this.modal.contains(document.activeElement)) {
          focusableNodes[0].focus();
        } else {
          var focusedItemIndex = focusableNodes.indexOf(document.activeElement);

          if (event.shiftKey && focusedItemIndex === 0) {
            focusableNodes[focusableNodes.length - 1].focus();
            event.preventDefault();
          }

          if (!event.shiftKey && focusedItemIndex === focusableNodes.length - 1) {
            focusableNodes[0].focus();
            event.preventDefault();
          }
        }
      }
    }]);
    return Modal;
  }();

  /**
   * Modal prototype ends.
   * Here on code is reposible for detecting and
   * autobinding event handlers on modal triggers
   */

  // Keep a reference to the opened modal


  var activeModal = null;

  /**
   * Generates an associative array of modals and it's
   * respective triggers
   * @param  {array} triggers     An array of all triggers
   * @param  {string} triggerAttr The data-attribute which triggers the module
   * @return {array}
   */
  var generateTriggerMap = function generateTriggerMap(triggers, triggerAttr) {
    var triggerMap = [];

    triggers.forEach(function (trigger) {
      var targetModal = trigger.attributes[triggerAttr].value;
      if (triggerMap[targetModal] === undefined) triggerMap[targetModal] = [];
      triggerMap[targetModal].push(trigger);
    });

    return triggerMap;
  };

  /**
   * Validates whether a modal of the given id exists
   * in the DOM
   * @param  {number} id  The id of the modal
   * @return {boolean}
   */
  var validateModalPresence = function validateModalPresence(id) {
    if (!document.getElementById(id)) {
      console.warn('MicroModal v' + version + ': \u2757Seems like you have missed %c\'' + id + '\'', 'background-color: #f8f9fa;color: #50596c;font-weight: bold;', 'ID somewhere in your code. Refer example below to resolve it.');
      console.warn('%cExample:', 'background-color: #f8f9fa;color: #50596c;font-weight: bold;', '<div class="modal" id="' + id + '"></div>');
      return false;
    }
  };

  /**
   * Validates if there are modal triggers present
   * in the DOM
   * @param  {array} triggers An array of data-triggers
   * @return {boolean}
   */
  var validateTriggerPresence = function validateTriggerPresence(triggers) {
    if (triggers.length <= 0) {
      console.warn('MicroModal v' + version + ': \u2757Please specify at least one %c\'micromodal-trigger\'', 'background-color: #f8f9fa;color: #50596c;font-weight: bold;', 'data attribute.');
      console.warn('%cExample:', 'background-color: #f8f9fa;color: #50596c;font-weight: bold;', '<a href="#" data-micromodal-trigger="my-modal"></a>');
      return false;
    }
  };

  /**
   * Checks if triggers and their corresponding modals
   * are present in the DOM
   * @param  {array} triggers   Array of DOM nodes which have data-triggers
   * @param  {array} triggerMap Associative array of modals and thier triggers
   * @return {boolean}
   */
  var validateArgs = function validateArgs(triggers, triggerMap) {
    validateTriggerPresence(triggers);
    if (!triggerMap) return true;
    for (var id in triggerMap) {
      validateModalPresence(id);
    }return true;
  };

  /**
   * Binds click handlers to all modal triggers
   * @param  {object} config [description]
   * @return void
   */
  var init = function init(config) {
    // Create an config object with default openTrigger
    var options = Object.assign({}, { openTrigger: 'data-micromodal-trigger' }, config);

    // Collects all the nodes with the trigger
    var triggers = [].concat(toConsumableArray(document.querySelectorAll('[' + options.openTrigger + ']')));

    // Makes a mappings of modals with their trigger nodes
    var triggerMap = generateTriggerMap(triggers, options.openTrigger);

    // Checks if modals and triggers exist in dom
    if (options.debugMode === true && validateArgs(triggers, triggerMap) === false) return;

    // For every target modal creates a new instance
    for (var key in triggerMap) {
      var value = triggerMap[key];
      options.targetModal = key;
      options.triggers = [].concat(toConsumableArray(value));
      new Modal(options); // eslint-disable-line no-new
    }
  };

  /**
   * Shows a particular modal
   * @param  {string} targetModal [The id of the modal to display]
   * @param  {object} config [The configuration object to pass]
   * @return {void}
   */
  var show = function show(targetModal, config) {
    var options = config || {};
    options.targetModal = targetModal;

    // Checks if modals and triggers exist in dom
    if (options.debugMode === true && validateModalPresence(targetModal) === false) return;

    // stores reference to active modal
    activeModal = new Modal(options); // eslint-disable-line no-new
    activeModal.showModal();
  };

  /**
   * Closes the active modal
   * @return {void}
   */
  var close = function close() {
    activeModal.closeModal();
  };

  return { init: init, show: show, close: close };
}();

return MicroModal;

})));

},{}]},{},[5]);
