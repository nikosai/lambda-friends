import { makeAST } from "./expression";
import * as fs from "fs";

export class LambdaFriends{
  mainFunc: Function;
  stdin: any;
  prompt: string;
  steps: number;

  constructor(){
    this.stdin = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.prompt = "input> ";
    this.stdin.setPrompt(this.prompt);
    this.steps = 100;

    this.mainFunc = (line:string)=>{
      line = line.trim();
      if (line===""){}
      else if (line.startsWith(":")){
        var cmds = line.replace(":","").trim().split(/\s+/g);
        switch (cmds[0]){
          case "q":
            process.exit(0);
            return;
          case "?":
            LambdaFriends.fileMes("mes/help.txt");
            break;
          case "s":
            var new_s = parseInt(cmds[1]);
            if (!isNaN(new_s)){
              this.steps = new_s;
            }
            console.log("Continuation steps: "+this.steps);
            break;
          case "l":
            var file = cmds[1];
            if (file === undefined){
              console.log("Command Usage = :q <filename>");
              break;
            }
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
          expr = expr.continualReduction(this.steps);
        }catch(e){
          console.log(e.toString());
        }
      }
      console.log();
      process.stdout.write(this.prompt);
    };
  }

  start(){
    LambdaFriends.fileMes("mes/title.txt");
    process.stdout.write("\n"+this.prompt);
    this.stdin.on("line", this.mainFunc);
  }

  static fileMes(file:string){
    if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
    try{
      fs.statSync(file);
      var lines = fs.readFileSync(file,"utf8");
      console.log(lines);
    }catch(e){
      console.log("File Not Found: "+file);
    }
  }
}

new LambdaFriends().start();