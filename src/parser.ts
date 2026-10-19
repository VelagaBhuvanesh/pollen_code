import { Token, TokenType } from './lexer.ts';
import type {
  Program, Statement, Expression, Block, IfBranch,
  VarDecl, Assign, FuncDecl, IfStatement, RepeatStatement,
  WhileStatement, OnEvent, ReturnStatement, ExprStatement,
  NumberLiteral, StringLiteral, BoolLiteral, Identifier,
  BinaryExpr, UnaryExpr, CallExpr, BinaryOp, UnaryOp, EventKind,
  ClassDecl, GetExpr, NewExpr // <-- ADDED OOP TYPES
} from './ast.ts';

export class ParseError extends Error {
  constructor(message: string, public token: Token) {
    super(message);
  }
}

export class Parser {
  private current = 0;

  constructor(private tokens: Token[]) {}

  public parse(): Program {
    const body: Statement[] = [];
    while (!this.isAtEnd()) {
      body.push(this.statement());
    }
    return { kind: 'Program', body, line: 1, column: 1 };
  }

  // --- Statements ---

  private statement(): Statement {
    const t = this.peek();

    if (this.match(TokenType.Let) || this.match(TokenType.Const)) {
      return this.varDecl(t);
    }
    if (this.match(TokenType.Func)) return this.funcDecl(t);
    if (this.match(TokenType.Class)) return this.classDecl(t); // <-- ADDED
    if (this.match(TokenType.If)) return this.ifStatement(t);
    if (this.match(TokenType.Repeat)) return this.repeatStatement(t);
    if (this.match(TokenType.While)) return this.whileStatement(t);
    if (this.match(TokenType.On)) return this.onEvent(t);
    if (this.match(TokenType.Return)) return this.returnStatement(t);
    if (this.check(TokenType.LeftBrace)) return this.block(t);
    
    
    // If it's an identifier (or dot expression), it could be an assignment or a function call
    if (this.check(TokenType.Identifier) || this.check(TokenType.New) || this.check(TokenType.Self)) {
      const expr = this.expression(); // Parse the full left side (e.g., player.x)
      
      if (this.match(TokenType.Equals)) {
        const value = this.expression();
        return { kind: 'Assign', target: expr, value, line: t.line, column: t.column };
      }
      
      return { kind: 'ExprStatement', expr, line: t.line, column: t.column };
    }

    throw this.error(this.peek(), "Expected a statement.");
  }

  private classDecl(startToken: Token): ClassDecl {
    const name = this.consume(TokenType.Identifier, "Expected class name.").lexeme;
    this.consume(TokenType.LeftBrace, "Expected '{' after class name.");
    
    const methods: FuncDecl[] = [];
    const properties: VarDecl[] = [];

    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      if (this.match(TokenType.Func)) {
        methods.push(this.funcDecl(this.previous()));
      } else if (this.match(TokenType.Let) || this.match(TokenType.Const)) {
        properties.push(this.varDecl(this.previous()));
      } else {
        throw this.error(this.peek(), "Expected 'func' or 'let' inside class.");
      }
    }
    
    this.consume(TokenType.RightBrace, "Expected '}' after class body.");
    return { kind: 'ClassDecl', name, methods, properties, line: startToken.line, column: startToken.column };
  }

  private varDecl(startToken: Token): VarDecl {
    const isConst = startToken.type === TokenType.Const;
    const name = this.consume(TokenType.Identifier, "Expected variable name.").lexeme;
    this.consume(TokenType.Equals, "Expected '=' after variable name.");
    const init = this.expression();
    return { kind: 'VarDecl', constant: isConst, name, init, line: startToken.line, column: startToken.column };
  }

  private funcDecl(startToken: Token): FuncDecl {
    const name = this.consume(TokenType.Identifier, "Expected function name.").lexeme;
    this.consume(TokenType.LeftParen, "Expected '(' after function name.");
    const params: string[] = [];
    if (!this.check(TokenType.RightParen)) {
      do {
        params.push(this.consume(TokenType.Identifier, "Expected parameter name.").lexeme);
      } while (this.match(TokenType.Comma));
    }
    this.consume(TokenType.RightParen, "Expected ')' after parameters.");
    const body = this.block(this.peek());
    return { kind: 'FuncDecl', name, params, body, line: startToken.line, column: startToken.column };
  }

  private ifStatement(startToken: Token): IfStatement {
    const branches: IfBranch[] = [];
    
    // First branch (if)
    this.consume(TokenType.LeftParen, "Expected '(' after 'if'.");
    let condition = this.expression();
    this.consume(TokenType.RightParen, "Expected ')' after condition.");
    let body = this.block(this.peek());
    branches.push({ kind: 'IfBranch', condition, body, line: startToken.line, column: startToken.column });

    // ElseIf branches
    while (this.match(TokenType.Elseif)) {
      const elseifToken = this.previous();
      this.consume(TokenType.LeftParen, "Expected '(' after 'elseif'.");
      condition = this.expression();
      this.consume(TokenType.RightParen, "Expected ')' after condition.");
      body = this.block(this.peek());
      branches.push({ kind: 'IfBranch', condition, body, line: elseifToken.line, column: elseifToken.column });
    }

    // Else branch
    let elseBody: Block | null = null;
    if (this.match(TokenType.Else)) {
      elseBody = this.block(this.peek());
    }

    return { kind: 'If', branches, elseBody, line: startToken.line, column: startToken.column };
  }

  private repeatStatement(startToken: Token): RepeatStatement {
    const count = this.expression();
    this.consume(TokenType.Times, "Expected 'times' after repeat count.");
    const body = this.block(this.peek());
    return { kind: 'Repeat', count, body, line: startToken.line, column: startToken.column };
  }

  private whileStatement(startToken: Token): WhileStatement {
    this.consume(TokenType.LeftParen, "Expected '(' after 'while'.");
    const condition = this.expression();
    this.consume(TokenType.RightParen, "Expected ')' after condition.");
    const body = this.block(this.peek());
    return { kind: 'While', condition, body, line: startToken.line, column: startToken.column };
  }

  private onEvent(startToken: Token): OnEvent {
    let event: EventKind;
    if (this.match(TokenType.Start)) event = 'start';
    else if (this.match(TokenType.Update)) event = 'update';
    else if (this.match(TokenType.Collision)) event = 'collision';
    else throw this.error(this.peek(), "Expected 'start', 'update', or 'collision'.");

    let arg: string | null = null;
    if (event === 'collision') {
      this.consume(TokenType.LeftParen, "Expected '(' after 'collision'.");
      arg = this.consume(TokenType.String, "Expected collision target string (e.g., \"coin\").").value as string;
      this.consume(TokenType.RightParen, "Expected ')' after collision target.");
    }

    const body = this.block(this.peek());
    return { kind: 'OnEvent', event, arg, body, line: startToken.line, column: startToken.column };
  }

  private returnStatement(startToken: Token): ReturnStatement {
    let value: Expression | null = null;
    if (!this.check(TokenType.RightBrace) && !this.isAtEnd() && this.peek().line === startToken.line) {
      value = this.expression();
    }
    return { kind: 'Return', value, line: startToken.line, column: startToken.column };
  }

  private block(startToken: Token): Block {
    this.consume(TokenType.LeftBrace, "Expected '{' to start block.");
    const statements: Statement[] = [];
    while (!this.check(TokenType.RightBrace) && !this.isAtEnd()) {
      statements.push(this.statement());
    }
    this.consume(TokenType.RightBrace, "Expected '}' to end block.");
    return { kind: 'Block', statements, line: startToken.line, column: startToken.column };
  }

  // --- Expressions ---

  private expression(): Expression {
    return this.or();
  }

  private or(): Expression {
    let expr = this.and();
    while (this.match(TokenType.Or)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.and();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private and(): Expression {
    let expr = this.equality();
    while (this.match(TokenType.And)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.equality();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private equality(): Expression {
    let expr = this.comparison();
    while (this.match(TokenType.EqualEqual, TokenType.BangEqual)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.comparison();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private comparison(): Expression {
    let expr = this.term();
    while (this.match(TokenType.Less, TokenType.LessEqual, TokenType.Greater, TokenType.GreaterEqual)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.term();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private term(): Expression {
    let expr = this.factor();
    while (this.match(TokenType.Plus, TokenType.Minus)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.factor();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private factor(): Expression {
    let expr = this.unary();
    while (this.match(TokenType.Star, TokenType.Slash)) {
      const op = this.previous().lexeme as BinaryOp;
      const right = this.unary();
      expr = { kind: 'Binary', op, left: expr, right, line: expr.line, column: expr.column };
    }
    return expr;
  }

  private unary(): Expression {
    if (this.match(TokenType.Minus, TokenType.Not)) {
      const op = this.previous().lexeme as UnaryOp;
      const operand = this.unary();
      return { kind: 'Unary', op, operand, line: this.previous().line, column: this.previous().column };
    }
    return this.call();
  }

  private call(): Expression {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.LeftParen)) {
        const args: Expression[] = [];
        if (!this.check(TokenType.RightParen)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.Comma));
        }
        this.consume(TokenType.RightParen, "Expected ')' after arguments.");
        
        // Changed to allow any expression to be called (e.g., player.shoot())
        expr = { kind: 'Call', callee: expr, args, line: expr.line, column: expr.column };
      } else if (this.match(TokenType.Dot)) {
        // Handle dot notation (e.g., player.x)
        const name = this.consume(TokenType.Identifier, "Expected property name after '.'.").lexeme;
        expr = { kind: 'Get', object: expr, name, line: expr.line, column: expr.column };
      } else {
        break;
      }
    }

    return expr;
  }

  private primary(): Expression {
    const t = this.peek();

    if (this.match(TokenType.New)) {
      const className = this.consume(TokenType.Identifier, "Expected class name after 'new'.").lexeme;
      this.consume(TokenType.LeftParen, "Expected '(' after class name.");
      const args: Expression[] = [];
      if (!this.check(TokenType.RightParen)) {
        do {
          args.push(this.expression());
        } while (this.match(TokenType.Comma));
      }
      this.consume(TokenType.RightParen, "Expected ')' after arguments.");
      return { kind: 'New', className, args, line: t.line, column: t.column };
    }
    if (this.match(TokenType.Number)) {
      return { kind: 'Number', value: t.value as number, line: t.line, column: t.column };
    }
    if (this.match(TokenType.String)) {
      return { kind: 'String', value: t.value as string, line: t.line, column: t.column };
    }
    if (this.match(TokenType.True)) {
      return { kind: 'Bool', value: true, line: t.line, column: t.column };
    }
    if (this.match(TokenType.False)) {
      return { kind: 'Bool', value: false, line: t.line, column: t.column };
    }
    if (this.match(TokenType.Identifier) || this.match(TokenType.Self)) {
      return { kind: 'Identifier', name: t.lexeme, line: t.line, column: t.column };
    }
    if (this.match(TokenType.LeftParen)) {
      const expr = this.expression();
      this.consume(TokenType.RightParen, "Expected ')' after expression.");
      return expr;
    }

    throw this.error(t, "Expected an expression.");
  }

  // --- Helpers ---

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private error(token: Token, message: string): ParseError {
    return new ParseError(message, token);
  }
}