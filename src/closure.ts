import { LambdaFriends } from "./lambda-friends";
import { makeTerms } from "./expression";

outputInfo(4,100);

function outputInfo(termDepth:number, graphDepth:number){
  let res = makeTerms(termDepth);
  let lfs:LambdaFriends[] = [];
  let timeout_count = 0;
  let len = res.length;
  console.error("====== Running outputInfo() ======");
  console.error("max term depth  : "+termDepth);
  console.error("max graph depth : "+graphDepth);
  console.error("makeTerms()     : Done!");
  console.error("Result Length   : "+len);
  let cnt = 0;
  
  for (let r of res){
    if (cnt%100==0) console.error("processing... : "+cnt+"/"+len+" ("+Math.floor(cnt/len*100)+"%)");
    let lf = new LambdaFriends(r.toString(true),false,false);
    for (let i=0; i<graphDepth; i++){
      if (lf.deepen()===null) break;
    }
    if (lf.hasNodes()) timeout_count++;
    else lfs.push(lf);
    cnt++;
  }
  console.error("Timeout: "+timeout_count);

  let results:{expr:string, c:number, nodes:number, edges:number}[] = [];
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
    results.push({expr: lf.expr.toString(true), c: c, nodes: lf.root.info.nodes.length, edges: lf.root.info.edges.length});
  }
  results.sort((a,b)=>{
    if (a.nodes !== b.nodes) return a.nodes - b.nodes;
    if (a.edges !== b.edges) return a.edges - b.edges;
    if (a.c !== b.c) return b.c - a.c;
    return 0;
  });
  for (let r of results) console.log(r.expr+","+r.c+","+r.nodes+","+r.edges);
}
