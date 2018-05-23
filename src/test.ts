import * as fs from "fs";
import { LambdaFriends } from "./lambda-friends";
import { makeTerms } from "./expression";
import { GraphNode } from "./graph";
declare let require: any;

function graphParseTest(){
  let file = "in.txt";
  if (file.match(/^".+"$/)!==null) file = file.slice(1,-1);
  try{
    fs.statSync(file);
  }catch(e){
    console.log("File Not Found: "+file);
    return;
  }
  let input = fs.readFileSync(file,"utf8");
  console.dir(GraphNode.parse(input));

  for (let i=0; i<10; i++){
    let res = makeTerms([],i);
    console.log(i+": "+res.length);
  }
}

function outputInfo(){
  let res = makeTerms([],5);
  let lfs:LambdaFriends[] = [];
  let timeout_count = 0;
  
  for (let r of res){
    let lf = new LambdaFriends(r.toString(true),false,false);
    for (let i=0; i<100; i++){
      if (lf.deepen(100)===null) break;
    }
    if (lf.hasNodes()) timeout_count++;
    else lfs.push(lf);
  }
  console.log("Timeout: "+timeout_count);

  for (let i=0; i<lfs.length; i++){
    let lf = lfs[i];
    let c = 1;
    
    for (let j=i+1; j<lfs.length; j++){
      let lf1 = lfs[j];
      if (lf.root.equalsShape(lf1.root)) {
        // ret.push(lf1.expr.toString(true));
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
  let res = makeTerms([],5);
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