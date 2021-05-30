import * as fs from "fs";
import * as commander from "commander";
import { LambdaFriends } from "./lambda-friends";
import { REPL } from "./repl";

(() => {
  function getFileInput(file: string): string {
    try {
      fs.statSync(file);
    } catch (e) {
      console.error("File Not Found: " + file);
      return undefined;
    }
    return fs.readFileSync(file, "utf8");
  }

  commander
    .name("lambda-friends")
    .usage("[options] [FILE]")
    .option("-i,--string <input>", "Read from string <input>")
    .option("-I,--stdin", "Read from standard input")
    .option("-l,--lmnin", "Translate LMNtal code to lambda term")
    .option("-g,--graph", "Reverse search from reduction graph (tentative)")
    .option("-t,--trace", "Show reduction trace")
    .option("-L,--lmnout", "Translate lambda term to LMNtal code")
    .option("-c,--skiout", "Translate lambda term to SKI combinators")
    .option("-m,--macro <filename>", "Load macros from textfile")
    .option("-s,--steps <n>", "Set continuation steps", parseInt)
    .option("-T,--typed", "Use Typed mode")
    .option("-E,--eta", "Enable eta-reduction")
    .option("-M,--multiedge", "Enable multiple-edges")
    .parse(process.argv);

  const options = commander.opts();

  // 入力を受け取る
  // オプションの優先度はstring, stdinの順
  // それらがなければ、FILEを読みに行くが、それもなければnull
  function getInput() {
    if (options.string) return options.string;
    if (options.stdin) return fs.readFileSync("/dev/stdin", "utf8");
    if (commander.args[0]) {
      let file = getFileInput(commander.args[0]);
      if (file) return file;
    }
    return null;
  }

  let input = getInput();
  let steps = 100;
  let typed = false;
  let etaAllowed = false;
  let allowMultipleEdges = false;

  if (options.steps) {
    if (isNaN(options.steps)) {
      console.error("-s,--steps <n>: n is not a number");
    } else {
      steps = options.steps;
    }
  }

  if (options.typed) typed = true;
  if (options.eta) etaAllowed = true;
  if (options.multiedge) allowMultipleEdges = true;

  // 実行モードを決める。優先順位はlmnin > graph
  if (options.lmnin) {
    // Translate LMNtal code to lambda term
    try {
      if (!input) input = fs.readFileSync("/dev/stdin", "utf8");
      let ret = LambdaFriends.lmntal2LF(input);
      console.log(ret.expr.toString(true));
    } catch (e) {
      console.error(e.toString());
    }
  } else if (options.graph) {
    // Reverse search from reduction graph (tentative)
    try {
      if (!input) input = fs.readFileSync("/dev/stdin", "utf8");
      let ret = LambdaFriends.graph2LF(input, allowMultipleEdges);
      if (ret === null) console.log("");
      else console.log(ret.expr.toString(true));
    } catch (e) {
      console.error(e.toString());
    }
  } else {
    // normal mode
    if (options.macro) {
      let macro = getFileInput(options.macro);
      if (macro) {
        LambdaFriends.fileInput(macro, typed);
      }
    }
    if (!input) {
      new REPL(steps, typed, etaAllowed, allowMultipleEdges).start();
      return;
    }
    try {
      if (options.lmnout) {
        console.log(
          new LambdaFriends(
            input,
            false,
            etaAllowed,
            allowMultipleEdges
          ).toLMNtal()
        );
        return;
      }
      if (options.skiout) {
        console.log(
          new LambdaFriends(
            input,
            false,
            etaAllowed,
            allowMultipleEdges
          ).toSKI()
        );
        return;
      }
      let lf = new LambdaFriends(input, typed, etaAllowed, allowMultipleEdges);
      if (options.trace) console.log(lf.toString());
      for (let i = 0; i < steps; i++) {
        let res = lf.reduction();
        if (res === null) break;
        if (options.trace) console.log(res);
      }
      if (!options.trace) console.log(lf.toString());
    } catch (e) {
      console.error(e.toString());
    }
  }
})();
