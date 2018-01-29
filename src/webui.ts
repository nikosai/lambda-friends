import { LambdaFriends } from "./lambda-friends";

class WebUI{
  public mainFunc: Function;
  steps: number;
  static defaultSteps: number = 100;
  typed: boolean;
  etaAllowed: boolean;

  constructor(){
    this.steps = WebUI.defaultSteps;
    this.typed = true;
    this.etaAllowed = false;
    LambdaFriends.output = outputNext;

    this.mainFunc = (line:string)=>{
      line = line.split("#")[0];
      line = line.trim();
      if (line!==""){
        try{
          var lf = new LambdaFriends(line,this.typed);
          output(lf.continualReduction(this.steps,this.etaAllowed));
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
var untypedButton = document.getElementById("untyped");
var typedButton = document.getElementById("typed");
var etaEnableButton = <HTMLButtonElement>document.getElementById("etaEnable");
var etaDisableButton = <HTMLButtonElement>document.getElementById("etaDisable");
var fileInput = <HTMLInputElement>document.getElementById("fileInput");
var fileReader = new FileReader();
var stepInput = <HTMLInputElement>document.getElementById("stepInput");
var graphDiv = document.getElementById("graph")

fileInput.addEventListener("change",function (ev){
  var target:any = ev.target;
  var file = target.files[0];
  var type = file.type; // MIMEタイプ
  // var size = file.size; // ファイル容量（byte）
  if (type !== "text/plain"){
    alert("プレーンテキストを選択してください");
    fileInput.value = ""; 
    return;
  }
  fileReader.readAsText(file);
});

fileReader.addEventListener("load", function (){
  outputClear();
  LambdaFriends.fileInput(fileReader.result,webUI.typed);
});

untypedButton.onclick = function(){
  untypedButton.className = "btn btn-primary";
  typedButton.className = "btn btn-default";
  webUI.typed = false;
  etaEnableButton.disabled = false;
  etaDisableButton.disabled = false;
};

typedButton.onclick = function(){
  typedButton.className = "btn btn-primary";
  untypedButton.className = "btn btn-default";
  webUI.typed = true;
  etaEnableButton.disabled = true;
  etaDisableButton.disabled = true;
};

etaEnableButton.onclick = function(){
  etaEnableButton.className = "btn btn-primary";
  etaDisableButton.className = "btn btn-default";
  webUI.etaAllowed = true;
}

etaDisableButton.onclick = function(){
  etaDisableButton.className = "btn btn-primary";
  etaEnableButton.className = "btn btn-default";
  webUI.etaAllowed = false;
}

stepInput.addEventListener("change",function(){
  var new_s = parseInt(stepInput.value);
  if (!isNaN(new_s)){
    webUI.steps = new_s;
  } else {
    webUI.steps = WebUI.defaultSteps;
  }
});

var submitInput = function(){
  webUI.mainFunc(input.value);
  input.value = "";
}

document.getElementById("submit").onclick = submitInput;
document.getElementById("input").onkeydown = function(e){
  if (e.keyCode===13){
    submitInput();
    e.preventDefault();
  }
}

function output(str:string){
  oel.innerText = str;
}
function outputNext(str:string){
  oel.innerText += str;
}
function outputNextLine(str:string){
  oel.innerText += str+"\n";
}
function outputClear(){
  oel.innerText = "";
}

var cytoscape = require("cytoscape")
var cy = cytoscape({
  container: graphDiv
});