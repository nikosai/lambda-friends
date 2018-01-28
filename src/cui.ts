import { makeAST, ReductionResult, Macro } from "./expression";
import * as fs from "fs";

export class CUI{
  mainFunc: Function;
  stdin: any;
  prompt: string;
  steps: number;
  result: ReductionResult;

  constructor(){
    this.stdin = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.prompt = "input> ";
    this.stdin.setPrompt(this.prompt);
    this.steps = 100;
    this.result = undefined;

    this.mainFunc = (line:string)=>{
      line = line.trim();
      if (this.result !== undefined && line!=="n"){
        try{
          this.result = this.result.expr.continualReduction(this.steps);
          process.stdout.write(this.result.str);
          if (!this.result.hasNext) this.result = undefined;
          else {
            process.stdout.write("\n"+this.steps+" Steps Done. Continue? (Y/n)> ");
            return;
          }
        }catch(e){
          console.log(e.toString());
        }
      }
      if (line===""){}
      else if (line.startsWith(":")){
        var cmds = line.replace(":","").trim().split(/\s+/g);
        switch (cmds[0]){
          case "q":
            process.exit(0);
            return;
          case "?":
            CUI.fileMes("mes/help.txt");
            break;
          case "m":
            cmds.shift();
            var cmds = cmds.join("").split("=");
            var name = cmds.shift();
            var str = cmds.join("=");
            try{
              Macro.add(name,str);
              console.log("<"+name+"> is defined as "+Macro.get(name).expr);
            }catch(e){
              console.log(e.toString());
            }
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
          if (expr instanceof Macro){
            console.log("<"+expr.name+"> is defined as "+expr.expr);
            process.stdout.write("\n"+this.prompt);
            return;
          }
          this.result = expr.continualReduction(this.steps);
          process.stdout.write(this.result.str);
          if (!this.result.hasNext) this.result = undefined;
          else {
            process.stdout.write("\n"+this.steps+" Steps Done. Continue? (Y/n)> ");
            return;
          }
        }catch(e){
          console.log(e.toString());
        }
      }
      process.stdout.write("\n"+this.prompt);
    };
  }

  start(){
    CUI.fileMes("mes/title.txt");
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

new CUI().start();