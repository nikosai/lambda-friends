import { LambdaFriends } from "./lambda-friends";
import { ReductionNode } from "./graph";
declare let cytoscape:any;

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
    {
      selector: '.root',
      style: {
        'background-color': '#407f5d'
      }
    },
    {
      selector: '.goal.root',
      style: {
        'background-color': '#d17200'
      }
    },    
  ]
});
declare let MicroModal:any;
// Initial config for setting up modals
MicroModal.init({
  disableScroll: false,
  awaitCloseAnimation: true
});

const defaultSteps = 100;
let steps:number = defaultSteps;
let typed = true;
let etaAllowed = false;
let allowMultipleEdges = false;
let curlf:LambdaFriends = undefined;

let input = <HTMLInputElement>document.getElementById("input");
let oel = document.getElementById("output");
let settingButton = document.getElementById("settingBtn");
let untypedButton = document.getElementById("untyped");
let typedButton = document.getElementById("typed");
let etaEnableButton = <HTMLButtonElement>document.getElementById("etaEnable");
let etaDisableButton = <HTMLButtonElement>document.getElementById("etaDisable");
let multiEdgeEnableButton = <HTMLButtonElement>document.getElementById("multiEdgeEnable");
let multiEdgeDisableButton = <HTMLButtonElement>document.getElementById("multiEdgeDisable");
let leftmostButton = <HTMLButtonElement>document.getElementById("leftmostBtn");
let rightmostButton = <HTMLButtonElement>document.getElementById("rightmostBtn");
let outermostButton = <HTMLButtonElement>document.getElementById("outermostBtn");
let innermostButton = <HTMLButtonElement>document.getElementById("innermostBtn");
let strongButton = <HTMLButtonElement>document.getElementById("strongBtn");
let weakButton = <HTMLButtonElement>document.getElementById("weakBtn");
let headButton = <HTMLButtonElement>document.getElementById("headBtn");
let nonheadButton = <HTMLButtonElement>document.getElementById("nonheadBtn");
let fileInput = <HTMLInputElement>document.getElementById("fileInput");
let fileReader = new FileReader();
let clearMacroButton = <HTMLButtonElement>document.getElementById("clearMacroBtn");
let translateDiv = document.getElementById("translate");
let tabA = document.getElementById("tabA");
// let macroNameInput = <HTMLInputElement>document.getElementById("macroNameInput");
// let macroInput = <HTMLInputElement>document.getElementById("macroInput");
// let submitMacroBtn = <HTMLButtonElement>document.getElementById("submitMacro");
let outputButtons = document.getElementById("outputBtns");
let stepInput = <HTMLInputElement>document.getElementById("stepInput");
let startGraph = document.getElementById("startGraph");
let stopGraph = document.getElementById("stopGraph");
let imgGraph = document.getElementById("imgGraph");
let maxDepth = <HTMLInputElement>document.getElementById("maxDepth");
let tabAbtn = document.getElementById("tabAbtn");
let tabBbtn = document.getElementById("tabBbtn");
let tabC1btn = document.getElementById("tabC1btn");
let tabC2btn = document.getElementById("tabC2btn");
let tabDbtn = document.getElementById("tabDbtn");
let lmnInput = <HTMLInputElement>document.getElementById("lmnInput");
let lmnSubmitBtn = document.getElementById("lmnSubmit");
let lmnOutput = document.getElementById("lmnOutput");
let deBrujinInput = <HTMLInputElement>document.getElementById("deBrujinInput");
let deBrujinSubmitBtn = document.getElementById("deBrujinSubmit");
let deBrujinOutput = document.getElementById("deBrujinOutput");
let graphInput = <HTMLInputElement>document.getElementById("graphInput");
let graphSubmitBtn = document.getElementById("graphSubmit");
let graphOutput = document.getElementById("graphOutput");

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
  let ret = LambdaFriends.fileInput(<string>fileReader.result,typed);
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
        ret += " = <"+name+">";
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

settingButton.onclick = function(){
  MicroModal.show('modal-2',{
    debugMode: true,
    disableScroll: true,
    awaitCloseAnimation: true
  });
}

untypedButton.onclick = function(){
  untypedButton.className = "btn btn-primary";
  typedButton.className = "btn btn-default";
  typed = false;
  etaEnableButton.disabled = false;
  etaDisableButton.disabled = false;
  multiEdgeEnableButton.disabled = false;
  multiEdgeDisableButton.disabled = false;
  refreshMacroList();
};

typedButton.onclick = function(){
  typedButton.className = "btn btn-primary";
  untypedButton.className = "btn btn-default";
  typed = true;
  etaEnableButton.disabled = true;
  etaDisableButton.disabled = true;
  multiEdgeEnableButton.disabled = true;
  multiEdgeDisableButton.disabled = true;
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

multiEdgeEnableButton.onclick = function(){
  multiEdgeEnableButton.className = "btn btn-primary";
  multiEdgeDisableButton.className = "btn btn-default";
  allowMultipleEdges = true;
}

multiEdgeDisableButton.onclick = function(){
  multiEdgeDisableButton.className = "btn btn-primary";
  multiEdgeEnableButton.className = "btn btn-default";
  allowMultipleEdges = false;
}

let rightmost = false;
leftmostButton.onclick = function(){
  leftmostButton.className = "btn btn-primary";
  rightmostButton.className = "btn btn-default";
  rightmost = false;
}

rightmostButton.onclick = function(){
  rightmostButton.className = "btn btn-primary";
  leftmostButton.className = "btn btn-default";
  rightmost = true;
}

let innermost = false;
outermostButton.onclick = function(){
  outermostButton.className = "btn btn-primary";
  innermostButton.className = "btn btn-default";
  innermost = false;
}

innermostButton.onclick = function(){
  innermostButton.className = "btn btn-primary";
  outermostButton.className = "btn btn-default";
  innermost = true;
}

let weak = false;
strongButton.onclick = function(){
  strongButton.className = "btn btn-primary";
  weakButton.className = "btn btn-default";
  weak = false;
}

weakButton.onclick = function(){
  weakButton.className = "btn btn-primary";
  strongButton.className = "btn btn-default";
  weak = true;
}

let head = false;
headButton.onclick = function(){
  headButton.className = "btn btn-primary";
  nonheadButton.className = "btn btn-default";
  head = true;
}

nonheadButton.onclick = function(){
  nonheadButton.className = "btn btn-primary";
  headButton.className = "btn btn-default";
  head = false;
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
    steps = defaultSteps;
  }
});

let history: string[] = [];
let historyNum:number = 0;
let workspace: string[] = [""];
let submitInput = function(){
  let line = input.value;
  if (line==="" && curlf!==undefined){
    if (graphActive) launchGraph();
    else if (!curlf.isNormalForm(rightmost,innermost,weak,head)) doContinual();
    return;
  }
  if (continualRunning){
    continualStop = true;
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
      curlf = new LambdaFriends(line,typed,etaAllowed,allowMultipleEdges);
      curGraphDepth = 0;
      graphClear();
      cy.add(node2cyObj(curlf.root));
      makeLayout();
      outputLine(curlf.toString());
      if (typed) doContinual();
      showContinueBtn();
    } else {
      let names = [].concat(ret.names);
      let name = names.shift();
      let str = "<"+name+">"
      while (names.length>0){
        let name = names.shift();
        str += " = <"+name+">";
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
let graphStop:boolean = false;
let graphDepth:number;
let curGraphDepth = 0;
let graphRunning = false;
startGraph.onclick = launchGraph;
function launchGraph(){
  if (graphRunning) return;
  makeLayout();
  if (curlf === undefined) return;
  graphStop = false;
  graphRunning = true;
  curGraphDepth += graphDepth || 10;
  let f = () => setTimeout(()=>{
    if (graphStop){
      makeLayout();
      graphRunning = false;
      return;
    }
    let ret = curlf.deepen(curGraphDepth);
    if (ret===null) {
      makeLayout();
      graphRunning = false;
      return;
    }
    let ans:any[] = [];
    for (let n of ret.nodes){
      ans.push(node2cyObj(n));
    }
    for (let e of ret.edges){
      ans.push({group: "edges", data: {source:e.from.id.toString(),target:e.to.id.toString()}});
    }
    makeLayout();
    cy.add(ans);
    f();
    makeLayout();
  },0);
  f();
}
stopGraph.onclick = function(){
  graphStop = true;
}

imgGraph.onclick = function(){
  let a = document.createElement("a");
  a.download = (curlf ? curlf.original.toString(true) :"lambda-friends")+".png";
  console.log(a.download);
  a.href = cy.png({
    full: true
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // console.log(a);
}

maxDepth.addEventListener("change",function(){
  let new_s = parseInt(maxDepth.value);
  if (!isNaN(new_s)){
    graphDepth = new_s;
  } else {
    graphDepth = undefined;
  }
});

let graphActive = false;
tabAbtn.addEventListener("click",()=>{
  graphActive = false;
});

tabBbtn.addEventListener("click",()=>{
  graphActive = false;
});

tabC1btn.addEventListener("click",()=>{
  graphActive = false;
});

tabC2btn.addEventListener("click",()=>{
  graphActive = false;
});

tabDbtn.addEventListener("click",()=>{
  setTimeout(makeLayout,10);
  graphActive = true;
});

lmnInput.onkeydown = function(e){
  if (e.keyCode===13){
    submitLMNtal();
    e.preventDefault();
  }
}
lmnSubmitBtn.onclick = submitLMNtal;
function submitLMNtal(){
  let input = lmnInput.value;
  try {
    let ret = LambdaFriends.lmntal2LF(input);
    lmnOutput.innerText = "Found: "+ret.expr.toString(true);
  } catch (e){
    lmnOutput.innerText = e.toString();
  }
}

deBrujinInput.onkeydown = function(e){
  if (e.keyCode===13){
    submitDeBrujin();
    e.preventDefault();
  }
}
deBrujinSubmitBtn.onclick = submitDeBrujin;
function submitDeBrujin(){
  let input = deBrujinInput.value;
  try {
    let ret = LambdaFriends.deBrujin2LF(input);
    deBrujinOutput.innerText = "Found: "+ret.expr.toString(true);
  } catch (e){
    deBrujinOutput.innerText = e.toString();
  }
}

graphInput.onkeydown = function(e){
  if (e.keyCode===13){
    submitGraph();
    e.preventDefault();
  }
}
graphSubmitBtn.onclick = submitGraph;
function submitGraph(){
  let input = graphInput.value;
  try {
    let ret = LambdaFriends.graph2LF(input,allowMultipleEdges);
    if (ret===null) graphOutput.innerText = "Not Found";
    else graphOutput.innerText = "Found: "+ret.expr.toString(true);
  } catch (e){
    graphOutput.innerText = e.toString();
  }
}

function output(str:string){
  oel.innerText = str;
}
function outputLine(str:string){
  oel.innerText = str + "\n";
}
function outputNext(str:string){
  oel.insertAdjacentHTML('beforeend',htmlEscape(str));
}
function outputNextLine(str:string){
  oel.insertAdjacentHTML('beforeend',htmlEscape(str + "\n"));
}
function outputClear(){
  oel.innerText = "";
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
  translateDiv.textContent = null;
  if (curlf === undefined) return;

  let header = document.createElement("h4");
  header.innerText = curlf.getOriginalString();
  translateDiv.appendChild(header);

  translateDiv.appendChild(makeTexDiv("これまでの簡約過程", curlf.getProcessTex()));
  if (typed) translateDiv.appendChild(makeTexDiv("型付けの証明木", curlf.getProofTree()));
  else {
    translateDiv.appendChild(makeTexDiv("LMNtalコード", curlf.toLMNtal()));
    translateDiv.appendChild(makeTexDiv("SKIコンビネータ", curlf.toSKI()));
    translateDiv.appendChild(makeTexDiv("de Brujin Index", curlf.toDeBrujin()));
  }
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
let continualRunning = false;
let continualStop = false;
function doContinual(){
  if (continualRunning) return;
  continualRunning = true;
  continualStop = false;
  outputButtons.textContent = null;
  let start = performance.now();
  let f = (n:number)=>setTimeout(() => {
    if (n===0 || curlf.isNormalForm(rightmost,innermost,weak,head) || continualStop) {
      showContinueBtn();
      tabA.scrollTop = oel.offsetHeight-15;
      continualRunning = false;
      console.log(`Elapsed Time (Wall Clock): ${performance.now()-start} [ms]`);
      refreshTex();
      return;
    }
    let res = curlf.reductionByStrategy(rightmost,innermost,weak,head);
    outputNextLine(res);
    tabA.scrollTop = oel.offsetHeight-15;
    // refreshTex();
    f(n-1);
  }, 0);
  f(steps);
}
function showContinueBtn(){
  outputButtons.textContent = null;

  // 「さらに続ける」ボタンを表示
  if (!curlf.hasNext()) return;
  if (curlf.isNormalForm(rightmost,innermost,weak,head)){
    let s = document.createElement("span");
    s.innerText = "指定の評価戦略ではこれが正規形です。";
    outputButtons.appendChild(s);
  } else {
    let b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-default btn-sm";
    b.innerText = steps+"ステップ簡約する";
    b.onclick = doContinual;
    outputButtons.textContent = null;
    outputButtons.appendChild(b);
  }
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
      tabA.scrollTop = oel.offsetHeight-15;
      refreshTex();
    }
    div.appendChild(b);
  }
}
function graphClear(){
  cy.remove("*");
}
function node2cyObj(n:ReductionNode){
  return {
    group: "nodes",
    data: {id: ""+n.id, label:""+n.toString()},
    classes:(n.isNormalForm?"goal ":"")+(n.isRoot?"root":"")
  }
}
function makeLayout(){
  cy.resize();
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
multiEdgeDisableButton.onclick(null);
leftmostButton.onclick(null);
outermostButton.onclick(null);
strongButton.onclick(null);
nonheadButton.onclick(null);
refreshMacroList();
