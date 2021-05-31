/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs';
import { LambdaFriends } from './lambda-friends';
import { makeTerms, parseLMNtal, makeAST } from './util';
import { deBrujinExpression } from './deBrujin';

// console.log(makeAST("\\xx.x",false).equalsAlpha(makeAST("\\xy.x",false)));
// console.log(LambdaFriends.deBrujin2LF("\\ 0 0").toDeBrujin().toString())

// let lf1 = new LambdaFriends("(\\ab.aa)((\\a.a)(\\a.aa))",false,false,true);
// let lf2 = new LambdaFriends("(\\a.a)(\\a.a)(\\a.aa)((\\a.a)(\\a.aa))",false,false,true);

// for (let i=0; i<50; i++){
//   if (lf1.deepen()===null) break;
// }
// for (let i=0; i<50; i++){
//   if (lf2.deepen()===null) break;
// }

// console.log(lf1.root.equalsShape(lf2.root), lf2.root.equalsShape(lf1.root));

// graphParseTest();
// outputInfo();
// for (let i=0; i<6; i++) console.log(i+" : "+makeTerms(i).length)
const terms = makeTerms(3);
for (const t of terms) console.log(t.toString(true));

function graphParseTest() {
  let file = 'in.txt';
  if (file.match(/^".+"$/) !== null) file = file.slice(1, -1);
  try {
    fs.statSync(file);
  } catch (e) {
    console.log('File Not Found: ' + file);
    return;
  }
  const lines = fs.readFileSync(file, 'utf8').split(/\n+/);
  // console.dir(GraphNode.parse(input));

  // for (let i=0; i<10; i++){
  //   let res = makeTerms(i);
  //   console.log(i+": "+res.length);
  // }
  for (let line of lines) {
    let lf = new LambdaFriends(line, false, false, true);
    console.log('Original: ' + lf.expr.toString(true));
    line = lf.toLMNtal().slice(5, -1);
    console.log('toLMNtal: ' + line);
    lf = new LambdaFriends(
      parseLMNtal(line).toString(true),
      false,
      false,
      true
    );
    console.log('ReParsed: ' + lf.expr.toString(true));
    console.log('ReLMNtal: ' + lf.toLMNtal().slice(5, -1));
  }
}

function outputInfo() {
  const res = makeTerms(4);
  const lfs: LambdaFriends[] = [];
  let timeout_count = 0;
  const len = res.length;
  console.error('makeTerms() is done!');
  console.error('Result Length: ' + len);
  let cnt = 0;

  for (const r of res) {
    if (cnt % 100 == 0)
      console.error(
        'processing... : ' +
          cnt +
          '/' +
          len +
          ' (' +
          Math.floor((cnt / len) * 100) +
          '%)'
      );
    const lf = new LambdaFriends(r.toString(true), false, false, true);
    for (let i = 0; i < 200; i++) {
      if (lf.deepen() === null) break;
    }
    if (lf.hasNodes()) timeout_count++;
    else lfs.push(lf);
    cnt++;
  }
  console.log('Timeout: ' + timeout_count);

  for (let i = 0; i < lfs.length; i++) {
    let lf = lfs[i];
    let c = 1;
    let lflen = lf.expr.toString(true).length;

    for (let j = i + 1; j < lfs.length; j++) {
      const lf1 = lfs[j];
      if (lf.root.equalsShape(lf1.root)) {
        // ret.push(lf1.expr.toString(true));
        const lf1len = lf1.expr.toString(true).length;
        if (lf1len < lflen) {
          lf = lf1;
          lflen = lf1len;
        }
        lfs.splice(j, 1);
        j--;
        c++;
      }
    }
    console.log(
      lf.expr.toString(true) +
        ',' +
        c +
        ',' +
        lf.root.info.nodes.length +
        ',' +
        lf.root.info.edges.length
    );
  }
}

function test() {
  const res = makeTerms(4);
  let c1 = 0;
  for (const r of res) {
    const lf = new LambdaFriends(r.toString(true), false, false, true);
    for (let i = 0; i < 30; i++) {
      if (lf.deepen(10) === null) break;
    }
    if (lf.hasNodes()) c1++;
    else if (!lf.root.equalsShape(lf.root))
      console.log(r.toString(true) + ' : false');
  }
  console.log('d>10||s>30 : ' + c1);
}
