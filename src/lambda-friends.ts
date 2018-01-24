import * as expression from "./expression"
import { Expression } from "./expression";

export class LambdaFriends{
  stdin: any;

  constructor(){

  }

  start(){
    this.stdin = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.stdin.on("line", (line:string) => {
      try{
        var expr = Expression.makeAST(line);
        console.log(expr.toString()+" FV:["+expr.getFV()+"]");
      }catch(e){
        console.log(e.toString());
      }
    });
  }
}

new LambdaFriends().start();