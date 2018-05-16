import { LambdaFriends } from "./lambda-friends";
import { ReductionNode } from "./graph";
declare let require: any;
declare let cytoscape: any;
let cy = cytoscape({
  container: document.getElementById('graph'),

  boxSelectionEnabled: false,
  autounselectify: true,

  style: [
    {
      selector: 'node',
      style: {
        // 'content': 'data(label)',  /* must be specified if you want to display the node text */
        /**
        'text-opacity': 0.5,
        'text-valign': 'center',
        'text-halign': 'right',
        */
        "label": "data(label)",
        'background-color': '#11479e'
      }
    },
    {
      selector: 'edge',
      style: {
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'target-arrow-color': '#9dbaea',
        'width': 3,
        'line-color': '#9dbaea',
      }
    },
    {
      selector: '.goal',
      style: {
        'background-color': '#b3424a'
      }
    },
  ]
});
let MicroModal = require('micromodal');
// Initial config for setting up modals
MicroModal.init({
  disableScroll: false,
  awaitCloseAnimation: true
});

let steps:number = undefined;
let typed = true;
let etaAllowed = false;
let curlf:LambdaFriends = undefined;

let input = <HTMLInputElement>document.getElementById("input");
let oel = document.getElementById("output");
let untypedButton = document.getElementById("untyped");
let typedButton = document.getElementById("typed");
let etaEnableButton = <HTMLButtonElement>document.getElementById("etaEnable");
let etaDisableButton = <HTMLButtonElement>document.getElementById("etaDisable");
let fileInput = <HTMLInputElement>document.getElementById("fileInput");
let fileReader = new FileReader();
let clearMacroButton = <HTMLButtonElement>document.getElementById("clearMacroBtn");
let tabC = document.getElementById("tabC");
// let macroNameInput = <HTMLInputElement>document.getElementById("macroNameInput");
// let macroInput = <HTMLInputElement>document.getElementById("macroInput");
// let submitMacroBtn = <HTMLButtonElement>document.getElementById("submitMacro");
let outputButtons = document.getElementById("outputBtns");
let stepInput = <HTMLInputElement>document.getElementById("stepInput");
let graphDiv = document.getElementById("graph");
let startGraph = document.getElementById("startGraph");
let stopGraph = document.getElementById("stopGraph");
let maxDepth = <HTMLInputElement>document.getElementById("maxDepth");
let tabDbtn = document.getElementById("tabDbtn");

fileInput.addEventListener("change",function (ev){
  let target:any = ev.target;
  let file = target.files[0];
  let type = file.type; // MIMEタイプ
  // let size = file.size; // ファイル容量（byte）
  if (type !== "text/plain"){
    alert("プレーンテキストを選択してください");
    fileInput.value = ""; 
    return;
  }
  fileReader.readAsText(file);
});

fileReader.addEventListener("load", function (){
  let ret = LambdaFriends.fileInput(fileReader.result,typed);
  refreshMacroList();
  let div = document.getElementById("fileInputLog");
  div.textContent = null;

  if (ret.defs.length>0){
    let div1 = document.createElement("div");
    let title1 = document.createElement("p");
    title1.innerText = "Finally, "+ret.defs.length+" macros are successfully added.";
    let list1 = document.createElement("ul");
    list1.className = "code";
    for (let t of ret.defs){
      let li = document.createElement("li");
      let names = [].concat(t.names);
      let name = names.shift();
      let ret = "<"+name+">"
      while (names.length>0){
        let name = names.shift();
        ret += " and <"+name+">";
      }
      li.innerText = ret + " is defined as "+t.expr+" : "+t.type;
      list1.appendChild(li);
    }
    div1.appendChild(title1);
    div1.appendChild(list1);
    div.appendChild(div1);
  }

  if (ret.errs.length>0){
    let div2 = document.createElement("div");
    let title2 = document.createElement("p");
    title2.innerText = "Unfortunately, "+ret.errs.length+" macros are rejected due to some errors.";
    let list2 = document.createElement("ul");
    list2.className = "code";
    for (let t of ret.errs){
      let li = document.createElement("li");
      li.innerText = t;
      list2.appendChild(li);
    }
    div2.appendChild(title2);
    div2.appendChild(list2);
    div.appendChild(div2);
  }

  MicroModal.show('modal-1',{
    debugMode: true,
    disableScroll: true,
    awaitCloseAnimation: true
  });
});

untypedButton.onclick = function(){
  untypedButton.className = "btn btn-primary";
  typedButton.className = "btn btn-default";
  typed = false;
  etaEnableButton.disabled = false;
  etaDisableButton.disabled = false;
  refreshMacroList();
};

typedButton.onclick = function(){
  typedButton.className = "btn btn-primary";
  untypedButton.className = "btn btn-default";
  typed = true;
  etaEnableButton.disabled = true;
  etaDisableButton.disabled = true;
  refreshMacroList();
};

etaEnableButton.onclick = function(){
  etaEnableButton.className = "btn btn-primary";
  etaDisableButton.className = "btn btn-default";
  etaAllowed = true;
}

etaDisableButton.onclick = function(){
  etaDisableButton.className = "btn btn-primary";
  etaEnableButton.className = "btn btn-default";
  etaAllowed = false;
}

clearMacroButton.onclick = function(){
  LambdaFriends.clearMacro(typed);
  refreshMacroList();
}

stepInput.addEventListener("change",function(){
  let new_s = parseInt(stepInput.value);
  if (!isNaN(new_s)){
    steps = new_s;
  } else {
    steps = undefined;
  }
});

let history: string[] = [];
let historyNum:number = 0;
let workspace: string[] = [""];
let submitInput = function(){
  let line = input.value;
  if (line==="" && curlf!==undefined){
    doContinual();
    return;
  }
  history.unshift(line);
  historyNum = 0;
  workspace = [].concat(history);
  workspace.unshift("");
  line = line.split("#")[0];
  line = line.trim();
  try{
    let ret = LambdaFriends.parseMacroDef(line,typed);
    if (ret===null) {
      curlf = new LambdaFriends(line,typed,etaAllowed);
      outputLine(curlf.toString());
      if (typed)
        outputNextLine(curlf.continualReduction(steps));
      showContinueBtn();
    } else {
      let names = [].concat(ret.names);
      let name = names.shift();
      let str = "<"+name+">"
      while (names.length>0){
        let name = names.shift();
        str += " and <"+name+">";
      }
      str += " is defined as "+ret.expr+" : "+ret.type;
      outputLine(str);
      outputButtons.textContent = null;
    }
    refreshTex();
  }catch(e){
    outputLine(e.toString());
    console.log(e);
    outputButtons.textContent = null;
  }
  refreshMacroList();
  input.value = "";
}

document.getElementById("submit").onclick = submitInput;
document.getElementById("input").onkeydown = function(e){
  if (e.keyCode===13){
    submitInput();
    e.preventDefault();
  } else if (e.keyCode===38){
    // up
    if (historyNum<workspace.length-1){
      workspace[historyNum] = input.value;
      historyNum++;
      input.value = workspace[historyNum];
    }
    e.preventDefault();
  } else if (e.keyCode===40){
    // down
    if (historyNum>0) {
      workspace[historyNum] = input.value;
      historyNum--;
      input.value = workspace[historyNum];
    }
    e.preventDefault();
  }
}
let curNodes:ReductionNode[] = [];
let graphStop:boolean = false;
let graphDepth:number;
startGraph.onclick = function(){
  cy.resize();
  makeLayout();
  let line = input.value;
  if (line!==""){
    history.unshift(line);
    historyNum = 0;
    workspace = [].concat(history);
    workspace.unshift("");
    line = line.split("#")[0];
    line = line.trim();
    input.value = "";
    let root:ReductionNode;
    try{
      if (LambdaFriends.parseMacroDef(line,typed)!==null) return;
      graphClear();
      ReductionNode.init(typed,etaAllowed);
      root = new ReductionNode(new LambdaFriends(line,typed,etaAllowed).expr,null);
    }catch(e){
      alert(e.toString());
      console.log(e);
      return;
    }
    cy.add({group: "nodes", data: {id: ""+root.id, label:root.toString()}, classes:(root.isNormalForm?"goal":"")});
    makeLayout();
    curNodes = [root];
  }
  graphStop = false;
  let f = () => setTimeout(()=>{
    if (graphStop || curNodes.length===0){
      makeLayout();
      return;
    }
    let t = curNodes.shift();
    if (t.depth>=(graphDepth===undefined?10:graphDepth)){
      curNodes.push(t);
      makeLayout();
      return;
    }
    let ret = t.visit();
    if (ret===null) {
      f();
      makeLayout();
      return;
    }
    let ans:any[] = [];
    for (let n of ret.nodes){
      ans.push({group: "nodes", data: {id: ""+n.id, label:n.toString()}, classes:(n.isNormalForm?"goal":"")});
      curNodes.push(n);
    }
    for (let e of ret.edges){
      ans.push({group: "edges", data: {source:e.from.id.toString(),target:e.to.id.toString()}});
    }
    makeLayout();
    cy.add(ans);
    f();
    makeLayout();
  },1);
  f();
}
stopGraph.onclick = function(){
  graphStop = true;
}

maxDepth.addEventListener("change",function(){
  let new_s = parseInt(maxDepth.value);
  if (!isNaN(new_s)){
    graphDepth = new_s;
  } else {
    graphDepth = undefined;
  }
});

// let submitMacro = function(){
//   LambdaFriends.parseMacroDef()
// }

let outputBuffer = "";
function output(str:string){
  outputBuffer = str;
  oel.innerHTML = htmlEscape(outputBuffer);
}
function outputLine(str:string){
  outputBuffer = str + "\n";
  oel.innerHTML = htmlEscape(outputBuffer);
}
function outputNext(str:string){
  outputBuffer += str;
  oel.innerHTML = htmlEscape(outputBuffer);
}
function outputNextLine(str:string){
  outputBuffer += str + "\n";
  oel.innerHTML = htmlEscape(outputBuffer);
}
function outputClear(){
  outputBuffer = "";
  oel.innerHTML = htmlEscape(outputBuffer);
}
function refreshMacroList(){
  let tbody = document.getElementById("macroList");
  tbody.innerHTML = "";
  let ret = LambdaFriends.getMacroListAsObject(typed);
  for (let r in ret){
    let m = ret[r];
    tbody.innerHTML += "<tr><th>"+htmlEscape(m.name)+"</th><td>"+htmlEscape(m.expr.toString(true))+"</td><td>"+htmlEscape(m.type.toString())+"</td></tr>";
  }
}
function htmlEscape(str:string):string{
  return str.replace(/[&'`"<> \n]/g, function(match) {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
      ' ': '&nbsp;',
      '\n': '<br>'
    }[match]
  });
}
function refreshTex(){
  tabC.textContent = null;
  if (curlf === undefined) return;

  tabC.appendChild(makeTexDiv("これまでの簡約過程", curlf.getProcessTex()));
  if (typed) tabC.appendChild(makeTexDiv("型付けの証明木", curlf.getProofTree()));
  else tabC.appendChild(makeTexDiv("LMNtalコード", curlf.toLMNtal()));
}
function makeTexDiv(title:string, content:string){
  let p = document.createElement("p");
  let btn = document.createElement("button");
  let span = document.createElement("span");
  let code = document.createElement("div");
  let inner = document.createElement("p");
  code.classList.add("code");
  p.appendChild(btn);
  p.appendChild(span);
  code.appendChild(inner);
  inner.innerText=content;
  span.innerText=title;
  btn.type="button";
  btn.className = "btn btn-default btn-sm";
  btn.innerText = "クリップボードにコピー";
  // btn.setAttribute("data-toggle","popover");
  // btn.setAttribute("data-content","Copied!");
  // $(function(){$('[data-toggle="popover"]').popover();});
  btn.onclick = function(){
    let s = document.getSelection();
    s.selectAllChildren(code);
    document.execCommand('copy');
    s.collapse(document.body, 0);
  }
  let div = document.createElement("div");
  div.appendChild(p);
  div.appendChild(code);
  return div;
}
function doContinual(){
  outputNextLine(curlf.continualReduction(steps));
  showContinueBtn();
  refreshTex();
}
function showContinueBtn(){
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
  if (typed) return;
  let span = document.createElement("span");
  span.innerText = "または、以下から簡約基を選ぶ：";
  outputButtons.appendChild(span);
  let div = document.createElement("div");
  div.className = "list-group";
  outputButtons.appendChild(div);
  let rs = curlf.getRedexes();
  // console.log(rs);
  for (let r of rs){
    let b = document.createElement("button");
    b.className = "list-group-item code";
    b.innerHTML = r.toHTMLString();
    b.onclick = function(){
      outputNextLine(curlf.reduction(r));
      showContinueBtn();
      refreshTex();
    }
    div.appendChild(b);
  }
}
function graphClear(){
  cy.remove("*");
}
function makeLayout(){
  cy.elements().makeLayout({
    name: "dagre",
    nodeSpacing: 5,
    animate: true,
    randomize: false,
    maxSimulationTime: 1500
  }).run();
}

// ===== initialize =====
untypedButton.onclick(null);
etaDisableButton.onclick(null);
refreshMacroList();