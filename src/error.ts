// 例外の抽象クラス
export class LambdaFriendsError implements Error{
  stack:any;
  public name:string;
  public message:string;
  constructor(name:string, message?:string){
    // if (typeof Error.captureStackTrace === "function"){
    //   Error.captureStackTrace(this,this.constructor);
    // }
    if (message===undefined){
      this.name = "LambdaFriendsError";
      this.message = name;
    } else {
      this.name = name;
      this.message = message;
    }
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

// GraphをParseする際の例外
export class GraphParseError extends LambdaFriendsError{
  constructor(message: string){
    super("GraphParseError",message);
  }
}
