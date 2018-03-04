// 例外の抽象クラス
export abstract class LambdaFriendsError implements Error{
  stack:any;
  constructor(public name:string, public message:string){
    // if (typeof Error.captureStackTrace === "function"){
    //   Error.captureStackTrace(this,this.constructor);
    // }
  }
  public toString():string{
    // return this.stack;
    return this.name + ": " + this.message;
  }
}

// Parse中の例外
export class LambdaParseError extends LambdaFriendsError{
  constructor(message: string){
    super("LambdaParseError",message);
  }
}

// Substitutionの例外
export class SubstitutionError extends LambdaFriendsError{
  constructor(message: string){
    super("SubstitutionError",message);
  }
}

// Reductionの例外
export class ReductionError extends LambdaFriendsError{
  constructor(message: string){
    super("ReductionError",message);
  }
}

// Macroの例外
export class MacroError extends LambdaFriendsError{
  constructor(message: string){
    super("MacroError",message);
  }
}

// Typeの例外
export class TypeError extends LambdaFriendsError{
  constructor(message: string){
    super("TypeError",message);
  }
}

// TexにParseする際の例外
export class TexError extends LambdaFriendsError{
  constructor(message: string){
    super("TexError",message);
  }
}