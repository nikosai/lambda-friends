import * as fs from "fs";
import { LambdaFriends } from "./lambda-friends";

export class CUI{
  mainFunc: Function;
  stdin: any;
  prompt: string;
  steps: number;
  typed: boolean;
  etaAllowed: boolean;
  lf: LambdaFriends;

  constructor(){
    this.stdin = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.prompt = "input> ";
    this.stdin.setPrompt(this.prompt);
    this.steps = 100;
    this.typed = false;
    this.etaAllowed = false;
    LambdaFriends.output = function (line:string){
      process.stdout.write(line);
    }
    this.mainFunc = (line:string)=>{
      line = line.split("#")[0];
      line = line.trim();
      if (this.lf !== undefined && line!=="n"){
        try{
          process.stdout.write(this.lf.continualReduction(this.steps));
          if (!this.lf.hasNext(this.etaAllowed)) this.lf = undefined;
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
          case "t":
            if (cmds[1]==="y") this.typed = true;
            else if (cmds[1]==="n") this.typed = false;
            console.log("Current setting: "+(this.typed?"Typed":"Untyped"));
            break;
          case "e":
            if (cmds[1]==="y") this.etaAllowed = true;
            else if (cmds[1]==="n") this.etaAllowed = false;
            console.log("Eta-Reduction is now "+(this.etaAllowed?"allowed":"not allowed"));
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
              console.log("Command Usage = :l <filename>");
              break;
            }
            if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
            try{
              fs.statSync(file);
            }catch(e){
              console.log("File Not Found: "+file);
              break;
            }
            LambdaFriends.fileInput(fs.readFileSync(file,"utf8"),this.typed);
            break;
          case "m":
            process.stdout.write(LambdaFriends.getMacroList(this.typed));
            break;
          default:
            console.log("Undefined command: "+line);
        }
      } else {
        try{
          var lf = new LambdaFriends(line,this.typed);
          if (lf.isMacro()){
            process.stdout.write("\n"+this.prompt);
            return;
          }
          process.stdout.write(lf.continualReduction(this.steps));
          if (lf.hasNext(this.etaAllowed)){
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