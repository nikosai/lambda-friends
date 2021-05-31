import * as fs from 'fs';
import { LambdaFriends } from './lambda-friends';
import * as readline from 'readline';

export class REPL {
  mainFunc: (line: string) => void;
  stdin: readline.Interface;
  prompt: string;
  steps: number;
  typed: boolean;
  etaAllowed: boolean;
  allowMultipleEdges: boolean;
  lf: LambdaFriends;

  constructor(
    steps: number,
    typed: boolean,
    etaAllowed: boolean,
    allowMultipleEdges: boolean
  ) {
    this.stdin = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.prompt = 'input> ';
    this.stdin.setPrompt(this.prompt);
    this.steps = steps;
    this.typed = typed;
    this.etaAllowed = etaAllowed;
    this.allowMultipleEdges = allowMultipleEdges;
    this.mainFunc = (line: string) => {
      line = line.split('#')[0];
      line = line.trim();
      if (this.lf !== undefined) {
        if (line.toLowerCase() === 'n') {
          this.lf = undefined;
          console.log();
          process.stdout.write(this.prompt);
          return;
        }
        try {
          for (let i = 0; i < this.steps; i++) {
            const res = this.lf.reduction();
            if (res === null) break;
            console.log(res);
          }
          if (!this.lf.hasNext()) this.lf = undefined;
          else {
            process.stdout.write(this.steps + ' Steps Done. Continue? (Y/n)> ');
            return;
          }
        } catch (e) {
          console.log(e.toString());
          return;
        }
      }
      if (line === '') {
        // do nothing
      } else if (line.startsWith(':')) {
        const cmd = line.match(/^:\s*.*?(?=\s|$)/)[0].replace(/^:\s*/, '');
        const arg = line.replace(/^:\s*.*?(\s|$)/, '').trim();
        switch (cmd) {
          case 'q': {
            process.exit(0);
            return;
          }
          case '?':
          case 'help':
          case 'h': {
            REPL.fileMes('mes/help.txt');
            break;
          }
          case 't': {
            if (arg === 'y') this.typed = true;
            else if (arg === 'n') this.typed = false;
            console.log(
              'Current setting: ' + (this.typed ? 'Typed' : 'Untyped')
            );
            break;
          }
          case 'e': {
            if (arg === 'y') this.etaAllowed = true;
            else if (arg === 'n') this.etaAllowed = false;
            console.log(
              'Eta-Reduction is now ' +
                (this.etaAllowed ? 'allowed' : 'not allowed')
            );
            break;
          }
          case 's': {
            const new_s = parseInt(arg);
            if (!isNaN(new_s)) {
              this.steps = new_s;
            }
            console.log('Continuation steps: ' + this.steps);
            break;
          }
          case 'l': {
            let file = arg;
            if (file === undefined) {
              console.log('Command Usage = :l <filename>');
              break;
            }
            if (file.match(/^".+"$/) !== null) file = file.slice(1, -1);
            try {
              fs.statSync(file);
            } catch (e) {
              console.log('File Not Found: ' + file);
              break;
            }
            const ret = LambdaFriends.fileInput(
              fs.readFileSync(file, 'utf8'),
              this.typed
            );
            console.log('File input completed.');
            if (ret.defs.length !== 0) {
              console.log(
                '\nFinally, ' +
                  ret.defs.length +
                  ' macros are successfully added.'
              );
              for (const r of ret.defs) {
                const names = r.names;
                const name = names.shift();
                let ret = '<' + name + '>';
                while (names.length > 0) {
                  const name = names.shift();
                  ret += ' and <' + name + '>';
                }
                ret += ' is defined as ' + r.expr + ' : ' + r.type;
                console.log('  * ' + ret);
              }
            }
            if (ret.errs.length !== 0) {
              console.log(
                '\nUnfortunately, ' +
                  ret.errs.length +
                  ' macros are rejected due to some errors'
              );
              for (const r of ret.errs) {
                console.log('  * ' + r);
              }
            }
            console.log();
            break;
          }
          case 'g': {
            try {
              const ret = LambdaFriends.graph2LF(arg, this.allowMultipleEdges);
              if (ret === null) console.log('not found');
              else console.log('Found: ' + ret.expr.toString(true));
            } catch (e) {
              console.log(e.toString());
            }
            break;
          }
          case 'lmn': {
            try {
              const ret = LambdaFriends.lmntal2LF(arg);
              console.log('Found: ' + ret.expr.toString(true));
            } catch (e) {
              console.log(e.toString());
            }
            break;
          }
          case 'me': {
            if (arg === 'y') this.allowMultipleEdges = true;
            else if (arg === 'n') this.allowMultipleEdges = false;
            console.log(
              'Multiple-Edges are now ' +
                (this.allowMultipleEdges ? 'allowed' : 'not allowed')
            );
            break;
          }
          case 'm': {
            console.log(LambdaFriends.getMacroList(this.typed));
            break;
          }
          default: {
            console.log('Undefined command: ' + line);
          }
        }
      } else {
        try {
          const lf = new LambdaFriends(
            line,
            this.typed,
            this.etaAllowed,
            this.allowMultipleEdges
          );
          console.log(lf.toString());
          for (let i = 0; i < this.steps; i++) {
            const res = lf.reduction();
            if (res === null) break;
            console.log(res);
          }
          if (lf.hasNext()) {
            this.lf = lf;
            process.stdout.write(this.steps + ' Steps Done. Continue? (Y/n)> ');
            return;
          } else {
            this.lf = undefined;
          }
        } catch (e) {
          console.log(e.toString() + '\n');
        }
      }
      process.stdout.write(this.prompt);
    };
  }

  start(): void {
    REPL.fileMes('mes/title.txt');
    process.stdout.write(this.prompt);
    this.stdin.on('line', this.mainFunc);
  }

  static fileMes(file: string): void {
    if (file.match(/^".+"$/) !== null) file = file.slice(1, -1);
    try {
      fs.statSync(file);
      const lines = fs.readFileSync(file, 'utf8');
      console.log(lines);
    } catch (e) {
      console.log('File Not Found: ' + file);
    }
  }
}
