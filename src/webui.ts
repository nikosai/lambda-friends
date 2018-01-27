import { makeAST } from "./expression";

class WebUI{
  public mainFunc: Function;
  steps: number;

  constructor(){
    this.steps = 100;

    this.mainFunc = (line:string)=>{
      line = line.trim();
      if (line===""){}
      else if (line.startsWith(":")){
        var cmds = line.replace(":","").trim().split(/\s+/g);
        switch (cmds[0]){
          case "q":
            // process.exit(0);
            return;
          case "?":
            // CUI.fileMes("mes/help.txt");
            break;
          case "s":
            var new_s = parseInt(cmds[1]);
            if (!isNaN(new_s)){
              this.steps = new_s;
            }
            output("Continuation steps: "+this.steps);
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
            output("Undefined command: "+line);
            return;
        }
      } else {
        try{
          var expr = makeAST(line);
          var result = expr.continualReduction(this.steps);
          output(result.str);
        }catch(e){
          output(e.toString());
        }
      }
    };
  }
}

var webUI = new WebUI();
var input = <HTMLInputElement>document.getElementById("input");
var oel = document.getElementById("output");

var submitInput = function(){
  webUI.mainFunc(input.value);
  input.value = "";
}

document.getElementById("submit").onclick = submitInput;
document.getElementById("input").onkeydown = function(e){
  if (e.keyCode===13){
    submitInput();
  }
}

function output(str:string){
  oel.innerText = str;
}