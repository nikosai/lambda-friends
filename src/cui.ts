import * as fs from "fs";
import { LambdaFriends } from "./lambda-friends";
declare var require: any;

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
    this.mainFunc = (line:string)=>{
      line = line.split("#")[0];
      line = line.trim();
      if (this.lf !== undefined){
        if (line.toLowerCase() === "n"){
          this.lf = undefined;
          console.log();
          process.stdout.write(this.prompt);
          return;
        }
        try{
          console.log(this.lf.continualReduction(this.steps));
          if (!this.lf.hasNext(this.etaAllowed)) this.lf = undefined;
          else {
            process.stdout.write(this.steps+" Steps Done. Continue? (Y/n)> ");
            return;
          }
        }catch(e){
          console.log(e.toString());
          return;
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
            let ret = LambdaFriends.fileInput(fs.readFileSync(file,"utf8"),this.typed);
            console.log("File input completed.");
            if (ret.defs.length!==0){
              console.log("\nFinally, "+ret.defs.length+" macros are successfully added.");
              for (let r of ret.defs){
                let names = r.names;
                let name = names.shift();
                let ret = "<"+name+">";
                while (names.length>0){
                  let name = names.shift();
                  ret += " and <"+name+">";
                }
                ret += " is defined as "+r.expr+" : "+r.type;
                console.log("  * "+ret);
              } 
            }
            if (ret.errs.length!==0){
              console.log("\nUnfortunately, "+ret.errs.length+" macros are rejected due to some errors");
              for (let r of ret.errs){
                console.log("  * "+r);
              }
            }
            console.log();
            break;
          case "m":
            console.log(LambdaFriends.getMacroList(this.typed));
            break;
          default:
            console.log("Undefined command: "+line);
        }
      } else {
        try{
          var lf = new LambdaFriends(line,this.typed);
          console.log(lf.toString());
          console.log(lf.continualReduction(this.steps,this.etaAllowed));
          if (lf.hasNext(this.etaAllowed)){
            this.lf = lf;
            process.stdout.write(this.steps+" Steps Done. Continue? (Y/n)> ");
            return;
          }
        }catch(e){
          console.log(e.toString()+"\n");
        }
      }
      process.stdout.write(this.prompt);
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