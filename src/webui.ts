import { LambdaFriends } from "./lambda-friends";
declare let require: any;
let MicroModal = require('micromodal');
// Initial config for setting up modals
MicroModal.init({
  openTrigger: 'data-custom-open',
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
  }
  history.unshift(line);
  historyNum = 0;
  workspace = [].concat(history);
  workspace.unshift("");
  line = line.split("#")[0];
  line = line.trim();
  if (line!==""){
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
  }
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
    tbody.innerHTML += "<tr><th>"+htmlEscape(m.name)+"</th><td>"+htmlEscape(m.expr.toString())+"</td><td>"+htmlEscape(m.type.toString())+"</td></tr>";
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
  let proc = "";
  let proof = "";
  if (curlf !== undefined) proc = curlf.getProcessTex();
  tabC.appendChild(makeTexDiv("これまでの簡約過程", proc));
  if (typed){
    if (curlf !== undefined) proof = curlf.getProofTree();
    tabC.appendChild(makeTexDiv("型付けの証明木", proof));
  }
}
function makeTexDiv(title:string, content:string){
  let p = document.createElement("p");
  let btn = document.createElement("button");
  let span = document.createElement("span");
  let pre = document.createElement("pre");
  let code = document.createElement("code");
  p.appendChild(btn);
  p.appendChild(span);
  code.appendChild(pre);
  pre.innerText=content;
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
// function showLog(str:string){
//   let newWin = window.open('','ログ - らむだフレンズ','width=400,height=300,scrollbars=no,status=no,toolbar=no,location=no,menubar=no,resizable=yes');
//   newWin.focus();
//   let doc = newWin.document;
//   doc.open();
//   doc.write("<!DOCTYPE html>");
//   doc.write('<html lang="ja">');
//   doc.write("<body>");
//   doc.write(htmlEscape(str).replace("\n","<br>"));
//   doc.write("</body>");
//   doc.write("</html>");
//   doc.close();
// }

// ===== initialize =====
untypedButton.onclick(null);
etaDisableButton.onclick(null);
refreshMacroList();

// let cytoscape = require("cytoscape")
// let cy = cytoscape({
//   container: graphDiv
// });