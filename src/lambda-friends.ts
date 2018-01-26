import { makeAST } from "./expression";
import * as fs from "fs";

export class LambdaFriends{
  mainFunc: Function;
  stdin: any;
  prompt: string;

  constructor(){
    this.stdin = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.prompt = "input> ";
    this.stdin.setPrompt(this.prompt);

    this.mainFunc = (line:string)=>{
      if (line.match(/^\s*$/)!==null){}
      else if (line.startsWith(".")){
        var cmds = line.replace(".","").split(/\s+/g);
        switch (cmds[0]){
          case "quit":
          case "exit":
            process.exit(0);
            return;
          case "input":
            var file = cmds[1];
            if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
            try{
              fs.statSync(file);
              var lines = fs.readFileSync(file,"utf8").split("\n");
              process.stdout.write(this.prompt);
              for (var l of lines){
                console.log(l);
                this.mainFunc(l);
              }
              return;
            }catch(e){
              console.log("File Not Found: "+file);
            }
            break;
          default:
            console.log("Undefined command: "+line);
        }
      } else {
        try{
          var expr = makeAST(line);
          expr = expr.continualReduction(100);
        }catch(e){
          console.log(e.toString());
        }
      }
      console.log();
      process.stdout.write(this.prompt);
    };
  }

  start(){
    console.log('============================================');
    console.log("  Welcome to Lambda-Friends!");
    console.log('  Type ".quit" or ".exit" to close.');
    console.log('  Type ".input <filename>" to open file.');
    console.log('============================================');
    console.log();

    process.stdout.write(this.prompt);

    this.stdin.on("line", this.mainFunc);
  }
}

new LambdaFriends().start();