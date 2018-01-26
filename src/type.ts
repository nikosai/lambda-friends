export abstract class Type{
  className: string;

  constructor(className:string){
    this.className = className;
  }

  public abstract toString():string;
  public abstract equals(t:Type):boolean;
}

export abstract class TypeConstructor extends Type{

}

export class TypeInt extends TypeConstructor{
  static instance:TypeInt;
  
  private constructor(){
    super("TypeInt");
  }
  static getInstance():TypeInt{
    if (TypeInt.instance === undefined){
      return TypeInt.instance = new TypeInt();
    } else return TypeInt.instance;
  }
  public toString():string{
    return "int";
  }
  public equals(t:Type):boolean{
    if (t instanceof TypeInt) return true;
    else return false;
  }
}
export var typeInt:TypeInt = TypeInt.getInstance();

export class TypeBool extends TypeConstructor{
  static instance:TypeBool;
  
  private constructor(){
    super("TypeBool");
  }
  static getInstance():TypeInt{
    if (TypeBool.instance === undefined){
      return TypeBool.instance = new TypeBool();
    } else return TypeBool.instance;
  }
  public toString():string{
    return "bool";
  }
  public equals(t:Type):boolean{
    if (t instanceof TypeBool) return true;
    else return false;
  }
}
export var typeBool:TypeBool = TypeBool.getInstance();

export class TypeList extends TypeConstructor{
  content:Type;
  constructor(x:Type){
    super("TypeList");
    this.content = x;
  }
  public toString():string{
    return "list("+this.content+")";
  }
  public equals(t:Type):boolean{
    if (t instanceof TypeList) return this.content.equals(t.content);
    else return false;
  }
}

export class TypeFunc extends TypeConstructor{
  left:Type;
  right:Type;
  constructor(left:Type, right:Type){
    super("TypeFunc");
    this.left = left;
    this.right = right;
  }
  public toString():string{
    var ret:string;
    if (this.left instanceof TypeFunc) ret = "("+this.left+")";
    else ret = this.left.toString();
    return ret+" -> "+this.right;
  }
  public equals(t:Type):boolean{
    if (t instanceof TypeFunc) return t.left.equals(this.left) && t.right.equals(this.right);
    else return false;
  }
}

export class TypeVariable extends Type{
  id: number;
  constructor(id:number){
    super("TypeVariable");
    this.id = id;
  }
  public toString():string{
    return "'t"+this.id;
  }
  public equals(t:Type):boolean{
    if (t instanceof TypeVariable) return this.id === t.id;
    else return false; 
  }
}