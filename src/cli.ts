import * as fs from "fs";
import { LambdaFriends } from "./lambda-friends";
import * as commander from "commander"
import { REPL } from "./repl";

(()=>{
function getFileInput(file:string):string{
  try{
    fs.statSync(file);
  }catch(e){
    console.error("File Not Found: "+file);
    return undefined;
  }
  return fs.readFileSync(file,"utf8");
}

commander
  .name("lambda-friends")
  .usage("[options] [FILE]")
  .option('-i,--string <input>', 'Read from string <input>')
  .option('-I,--stdin', 'Read from standard input')
  .option('-l,--lmnin','Translate LMNtal code to lambda term')
  .option('-g,--graph','Reverse search from reduction graph (tentative)')
  .option('-t,--trace','Show reduction trace')
  .option('-L,--lmnout','Translate lambda term to LMNtal code')
  .option('-m,--macro <filename>','Load macros from textfile')
  .option('-s,--steps <n>','Set continuation steps',parseInt)
  .option('-t,--typed','Use Typed mode')
  .option('-e,--eta','Enable eta-reduction')
  .option('-M,--multiedge','Enable multiple-edges')
  .parse(process.argv);

// 入力を受け取る
// オプションの優先度はstring, stdinの順
// それらがなければ、FILEを読みに行くが、それもなければnull
function getInput(){
  if (commander.string) return commander.string;
  if (commander.stdin) return fs.readFileSync("/dev/stdin", "utf8");
  if (commander.args[0]){
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

if (commander.steps){
  if (isNaN(commander.steps)){
    console.error("-s,--steps <n>: n is not a number")
  } else {
    steps = commander.steps;
  }
}

if (commander.typed) typed = true;
if (commander.eta) etaAllowed = true;
if (commander.multiedge) allowMultipleEdges = true;

// 実行モードを決める。優先順位はlmnin > graph
if (commander.lmnin){
  // Translate LMNtal code to lambda term
  try {
    if (!input) input = fs.readFileSync("/dev/stdin", "utf8");
    let ret = LambdaFriends.lmntal2LF(input);
    console.log(ret.expr.toString(true));
  } catch (e){
    console.error(e.toString());
  }
} else if (commander.graph){
  // Reverse search from reduction graph (tentative)
  try {
    if (!input) input = fs.readFileSync("/dev/stdin", "utf8");
    let ret = LambdaFriends.graph2LF(input,allowMultipleEdges);
    if (ret===null) console.log("");
    else console.log(ret.expr.toString(true));
  } catch (e){
    console.error(e.toString());
  }
} else {
  // normal mode
  if (commander.macro){
    let macro = getFileInput(commander.macro);
    if (macro){
      LambdaFriends.fileInput(macro,typed);
    }
  }
  if (!input) {
    new REPL(steps,typed,etaAllowed,allowMultipleEdges).start();
    return;
  }
  try{
    if (commander.lmnout){
      console.log(new LambdaFriends(input,false,etaAllowed,allowMultipleEdges).toLMNtal());
      return;
    }
    let lf = new LambdaFriends(input,typed,etaAllowed,allowMultipleEdges);
    for (let i=0; i<steps; i++){
      let res = lf.reduction();
      if (res === null) break;
      if (commander.trace) console.log(res);
    }
    if (!commander.trace) console.log(lf.toString());
  } catch (e) {
    console.error(e.toString());
  }
}
})();
