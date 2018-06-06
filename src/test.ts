import * as fs from "fs";
import { LambdaFriends } from "./lambda-friends";
import { makeTerms, parseLMNtal } from "./expression";
import { GraphNode } from "./graph";
declare let require: any;

// let lf1 = new LambdaFriends("(\\a.aa)(\\a.aa)(\\a.(\\b.a)a)",false,false);
// let lf2 = new LambdaFriends("(\\a.a)((\\a.aa)(\\a.aa))",false,false);

// for (let i=0; i<50; i++){
//   if (lf1.deepen()===null) break;
// }
// for (let i=0; i<50; i++){
//   if (lf2.deepen()===null) break;
// }

// console.log(lf1.root.equalsShape(lf2.root));

graphParseTest();
// outputInfo();
// for (let i=0; i<6; i++) console.log(i+" : "+makeTerms(i).length)

function graphParseTest(){
  let file = "in.txt";
  if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
  try{
    fs.statSync(file);
  }catch(e){
    console.log("File Not Found: "+file);
    return;
  }
  let lines = fs.readFileSync(file,"utf8").split(/\n+/);
  // console.dir(GraphNode.parse(input));

  // for (let i=0; i<10; i++){
  //   let res = makeTerms(i);
  //   console.log(i+": "+res.length);
  // }
  for (let line of lines){
    let lf = new LambdaFriends(line,false,false);
    console.log("Original: "+lf.expr.toString(true));
    line = lf.toLMNtal().slice(5,-1);
    console.log("toLMNtal: "+line);
    lf = new LambdaFriends(parseLMNtal(line).toString(true),false,false);
    console.log("ReParsed: "+lf.expr.toString(true));
    console.log("ReLMNtal: "+lf.toLMNtal().slice(5,-1));
  }
}

function outputInfo(){
  let res = makeTerms(4);
  let lfs:LambdaFriends[] = [];
  let timeout_count = 0;
  let len = res.length;
  console.error("makeTerms() is done!");
  console.error("Result Length: "+len);
  let cnt = 0;
  
  for (let r of res){
    if (cnt%100==0) console.error("processing... : "+cnt+"/"+len+" ("+Math.floor(cnt/len*100)+"%)");
    let lf = new LambdaFriends(r.toString(true),false,false);
    for (let i=0; i<200; i++){
      if (lf.deepen()===null) break;
    }
    if (lf.hasNodes()) timeout_count++;
    else lfs.push(lf);
    cnt++;
  }
  console.log("Timeout: "+timeout_count);

  for (let i=0; i<lfs.length; i++){
    let lf = lfs[i];
    let c = 1;
    let lflen = lf.expr.toString(true).length;
    
    for (let j=i+1; j<lfs.length; j++){
      let lf1 = lfs[j];
      if (lf.root.equalsShape(lf1.root)) {
        // ret.push(lf1.expr.toString(true));
        let lf1len = lf1.expr.toString(true).length;
        if (lf1len < lflen){
          lf = lf1;
          lflen = lf1len;
        }
        lfs.splice(j,1);
        j--;
        c++;
      }
    }
    console.log(lf.expr.toString(true)+","
      +c+","
      +lf.root.info.nodes.length+","
      +lf.root.info.edges.length);
  }
}

function test(){
  let res = makeTerms(4);
  let c1 = 0;
  for (let r of res){
    let lf = new LambdaFriends(r.toString(true),false,false);
    for (let i=0; i<30; i++){
      if (lf.deepen(10)===null) break;
    }
    if (lf.hasNodes()) c1++
    else if (!lf.root.equalsShape(lf.root)) console.log(r.toString(true)+" : false");
  }
  console.log("d>10||s>30 : "+c1);
}