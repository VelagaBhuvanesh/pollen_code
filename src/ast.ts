// ============================================================
// Pollen AST — the tree the parser produces from tokens.
//
// Every node carries `line` and `column` so the interpreter and
// editor can point at the exact source location of a bug.
//
// The `kind` field is a TypeScript discriminated union tag:
// switch on `node.kind` and the compiler knows the exact shape.
// ============================================================

export interface Node {
  line: number;
  column: number;
}

// ============================================================
// Program — the root node
// ============================================================

export interface Program extends Node {
  kind: 'Program';
  body: Statement[];
}

// ============================================================
// Statements — things that do something (no value returned)
// ============================================================

export type Statement =
  | VarDecl
  | Assign
  | FuncDecl
  | ClassDecl // <-- ADDED
  | IfStatement
  | RepeatStatement
  | WhileStatement
  | OnEvent
  | ReturnStatement
  | ExprStatement
  | Block;

/** `let x = 5` or `const x = 5` */
export interface VarDecl extends Node {
  kind: 'VarDecl';
  constant: boolean;    // true for `const`, false for `let`
  name: string;
  init: Expression;
}

/** `x = 5` or `player.x = 5` (reassignment — different from VarDecl) */
export interface Assign extends Node {
  kind: 'Assign';
  target: Expression; // <-- CHANGED: Was `name: string`, now an Expression for OOP
  value: Expression;
}

/** `func damage(amount) { ... }` */
export interface FuncDecl extends Node {
  kind: 'FuncDecl';
  name: string;
  params: string[];     // parameter names only — no types in v1
  body: Block;
}

/** `class Player { let x = 0 ... }` */
export interface ClassDecl extends Node {
  kind: 'ClassDecl';
  name: string;
  methods: FuncDecl[];
  properties: VarDecl[];
} // <-- ADDED

/** `if (c1) { } elseif (c2) { } else { }` */
export interface IfStatement extends Node {
  kind: 'If';
  branches: IfBranch[]; // first is `if`, rest are `elseif` (at least one)
  elseBody: Block | null;
}

export interface IfBranch extends Node {
  kind: 'IfBranch';
  condition: Expression;
  body: Block;
}

/** `repeat N times { }` */
export interface RepeatStatement extends Node {
  kind: 'Repeat';
  count: Expression;
  body: Block;
}

/** `while (cond) { }` */
export interface WhileStatement extends Node {
  kind: 'While';
  condition: Expression;
  body: Block;
}

/** `on start { }`, `on update { }`, `on collision("coin") { }` */
export interface OnEvent extends Node {
  kind: 'OnEvent';
  event: EventKind;
  arg: string | null;   // "coin" for on collision("coin"), null otherwise
  body: Block;
}

export type EventKind = 'start' | 'update' | 'collision';

/** `return` or `return expr` */
export interface ReturnStatement extends Node {
  kind: 'Return';
  value: Expression | null;
}

/** A bare expression used as a statement — e.g. `damage(10)` */
export interface ExprStatement extends Node {
  kind: 'ExprStatement';
  expr: Expression;
}

/** `{ ... }` — the body of if/func/loops/events */
export interface Block extends Node {
  kind: 'Block';
  statements: Statement[];
}

// ============================================================
// Expressions — things that produce a value
// ============================================================

export type Expression =
  | NumberLiteral
  | StringLiteral
  | BoolLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | GetExpr  // <-- ADDED
  | NewExpr; // <-- ADDED

export interface NumberLiteral extends Node {
  kind: 'Number';
  value: number;
}

export interface StringLiteral extends Node {
  kind: 'String';
  value: string;
}

export interface BoolLiteral extends Node {
  kind: 'Bool';
  value: boolean;
}

export interface Identifier extends Node {
  kind: 'Identifier';
  name: string;
}

export type BinaryOp =
  | '+' | '-' | '*' | '/'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'and' | 'or';

export interface BinaryExpr extends Node {
  kind: 'Binary';
  op: BinaryOp;
  left: Expression;
  right: Expression;
}

export type UnaryOp = '-' | 'not';

export interface UnaryExpr extends Node {
  kind: 'Unary';
  op: UnaryOp;
  operand: Expression;
}

export interface CallExpr extends Node {
  kind: 'Call';
  callee: Expression; // <-- CHANGED: Was `string`, now an Expression for OOP methods
  args: Expression[];
}

/** `player.x` */
export interface GetExpr extends Node {
  kind: 'Get';
  object: Expression;
  name: string;
} // <-- ADDED

/** `new Player()` */
export interface NewExpr extends Node {
  kind: 'New';
  className: string;
  args: Expression[];
} // <-- ADDED