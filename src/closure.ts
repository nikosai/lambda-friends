import { LambdaFriends } from './lambda-friends';
import { makeTerms } from './util';

outputInfo(5, 100, true);

function outputInfo(
  termDepth: number,
  graphDepth: number,
  allowMultiEdges: boolean
) {
  const res = makeTerms(termDepth);
  // let lfs:LambdaFriends[] = [];
  let timeout_count = 0;
  const len = res.length;
  console.error('====== Running outputInfo() ======');
  console.error('max term depth  : ' + termDepth);
  console.error('max graph depth : ' + graphDepth);
  console.error('makeTerms()     : Done!');
  console.error('Result Length   : ' + len);
  let cnt = 0;

  const results: { lf: LambdaFriends; c: number }[] = [];
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
    cnt++;
    const lf = new LambdaFriends(
      r.toString(true),
      false,
      false,
      allowMultiEdges
    );
    for (let i = 0; i < graphDepth; i++) {
      if (lf.deepen() === null) break;
    }
    if (lf.hasNodes()) {
      timeout_count++;
      continue;
    }
    const lflen = lf.expr.toString(true).length;
    let flag = false;
    for (const r of results) {
      if (lf.root.equalsShape(r.lf.root)) {
        const rlen = r.lf.expr.toString(true).length;
        if (rlen > lflen) r.lf = lf;
        r.c++;
        flag = true;
        break;
      }
    }
    if (!flag) results.push({ lf: lf, c: 1 });
  }
  console.error('Timeout: ' + timeout_count);
  results.sort((a, b) => {
    if (a.lf.root.info.nodes.length !== b.lf.root.info.nodes.length)
      return a.lf.root.info.nodes.length - b.lf.root.info.nodes.length;
    if (a.lf.root.info.edges.length !== b.lf.root.info.edges.length)
      return a.lf.root.info.edges.length - b.lf.root.info.edges.length;
    if (a.c !== b.c) return b.c - a.c;
    return 0;
  });
  for (const r of results)
    console.log(
      r.lf.expr.toString(true) +
        ',' +
        r.c +
        ',' +
        r.lf.root.info.nodes.length +
        ',' +
        r.lf.root.info.edges.length
    );
}
