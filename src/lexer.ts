import type { Diagnostic } from './errors.ts';

// ---------- Token types ----------

export enum TokenType {
  // Literals
  Number,
  String,
  True,
  False,

  // Identifiers (includes built-in function names like `move`, `show`)
  Identifier,

  // Keywords
  Let,
  Const,
  Func,
  If,
  Elseif,
  Else,
  Repeat,
  Times,
  While,
  On,
  Return,
  And,
  Or,
  Not,
  Class, // <-- ADDED
  New,   // <-- ADDED
  Self,  // <-- ADDED

  // Event names
  Start,
  Update,
  Collision,

  // Punctuation
  LeftBrace,
  RightBrace,
  LeftParen,
  RightParen,
  Comma,
  Dot,   // <-- ADDED

  // Operators
  Equals,        // =
  EqualEqual,    // ==
  BangEqual,     // !=
  Less,          // <
  LessEqual,     // <=
  Greater,       // >
  GreaterEqual,  // >=
  Plus,          // +
  Minus,         // -
  Star,          // *
  Slash,         // /

  EOF,
}

export interface Token {
  type: TokenType;
  lexeme: string;
  value?: string | number | boolean;
  line: number;
  column: number;
}

// ---------- Keyword table ----------

const KEYWORDS: Record<string, TokenType> = {
  let: TokenType.Let,
  const: TokenType.Const,
  func: TokenType.Func,
  if: TokenType.If,
  elseif: TokenType.Elseif,
  else: TokenType.Else,
  repeat: TokenType.Repeat,
  times: TokenType.Times,
  while: TokenType.While,
  on: TokenType.On,
  return: TokenType.Return,
  true: TokenType.True,
  false: TokenType.False,
  and: TokenType.And,
  or: TokenType.Or,
  not: TokenType.Not,
  start: TokenType.Start,
  update: TokenType.Update,
  collision: TokenType.Collision,
  class: TokenType.Class, // <-- ADDED
  new: TokenType.New,     // <-- ADDED
  self: TokenType.Self,   // <-- ADDED
};

// ---------- Lexer ----------

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

export class Lexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private readonly diagnostics: Diagnostic[] = [];

  private start = 0;          // start index of current token in source
  private current = 0;        // current scan position
  private line = 1;
  private column = 1;
  private startLine = 1;
  private startColumn = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): LexResult {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.startLine = this.line;
      this.startColumn = this.column;
      this.scanToken();
    }
    this.tokens.push({
      type: TokenType.EOF,
      lexeme: '',
      line: this.line,
      column: this.column,
    });
    return { tokens: this.tokens, diagnostics: this.diagnostics };
  }

  private scanToken(): void {
    const c = this.advance();
    switch (c) {
      case '(': this.addToken(TokenType.LeftParen); return;
      case ')': this.addToken(TokenType.RightParen); return;
      case '{': this.addToken(TokenType.LeftBrace); return;
      case '}': this.addToken(TokenType.RightBrace); return;
      case ',': this.addToken(TokenType.Comma); return;
      case '.': this.addToken(TokenType.Dot); return; // <-- ADDED
      case '+': this.addToken(TokenType.Plus); return;
      case '-': this.addToken(TokenType.Minus); return;
      case '*': this.addToken(TokenType.Star); return;

      case ';':
        // Beginner-friendly: silently accept semicolons.
        return;

      case '/':
        if (this.match('/')) {
          // Single-line comment: skip until newline or EOF.
          while (this.peek() !== '\n' && !this.isAtEnd()) this.advance();
          return;
        }
        this.addToken(TokenType.Slash);
        return;

      case '=':
        this.addToken(this.match('=') ? TokenType.EqualEqual : TokenType.Equals);
        return;

      case '!':
        if (this.match('=')) {
          this.addToken(TokenType.BangEqual);
        } else {
          this.error("Unexpected '!'. Use 'not' for negation.");
        }
        return;

      case '<':
        this.addToken(this.match('=') ? TokenType.LessEqual : TokenType.Less);
        return;

      case '>':
        this.addToken(this.match('=') ? TokenType.GreaterEqual : TokenType.Greater);
        return;

      case '"':
        this.scanString();
        return;

      case ' ':
      case '\t':
      case '\r':
        return; // skip whitespace

      case '\n':
        this.line++;
        this.column = 1;
        return;

      default:
        if (this.isDigit(c)) {
          this.scanNumber();
        } else if (this.isAlpha(c)) {
          this.scanIdentifier();
        } else {
          this.error(`Unexpected character '${c}'`);
        }
        return;
    }
  }

  private scanNumber(): void {
    while (this.isDigit(this.peek())) this.advance();

    // Decimal part: only if `.` is followed by a digit (avoids `1..10` confusion later)
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      this.advance();
      while (this.isDigit(this.peek())) this.advance();
    }

    const text = this.source.slice(this.start, this.current);
    this.addToken(TokenType.Number, parseFloat(text));
  }

  private scanString(): void {
    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.error('Unterminated string (strings cannot span multiple lines)');
        return;
      }
      if (this.peek() === '\\') {
        this.advance();
        if (this.isAtEnd()) {
          this.error('Unterminated string');
          return;
        }
      }
      this.advance();
    }

    if (this.isAtEnd()) {
      this.error('Unterminated string');
      return;
    }

    this.advance(); // consume closing quote

    const raw = this.source.slice(this.start + 1, this.current - 1);
    this.addToken(TokenType.String, this.unescape(raw));
  }

  private unescape(raw: string): string {
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] === '\\' && i + 1 < raw.length) {
        const next = raw[i + 1];
        switch (next) {
          case 'n': result += '\n'; break;
          case 't': result += '\t'; break;
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          default: result += '\\' + next;
        }
        i++;
      } else {
        result += raw[i];
      }
    }
    return result;
  }

  private scanIdentifier(): void {
    while (this.isAlphaNumeric(this.peek())) this.advance();
    const text = this.source.slice(this.start, this.current);
    const type = KEYWORDS[text] ?? TokenType.Identifier;
    this.addToken(type, text);
  }

  // ---------- Character helpers ----------

  private advance(): string {
    const c = this.source.charAt(this.current);
    this.current++;
    this.column++;
    return c;
  }

  private peek(): string {
    return this.isAtEnd() ? '\0' : this.source.charAt(this.current);
  }

  private peekNext(): string {
    return this.current + 1 >= this.source.length
      ? '\0'
      : this.source.charAt(this.current + 1);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;
    this.current++;
    this.column++;
    return true;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  // ---------- Token & error emission ----------

  private addToken(type: TokenType, value?: string | number | boolean): void {
    const lexeme = this.source.slice(this.start, this.current);
    this.tokens.push({
      type,
      lexeme,
      value,
      line: this.startLine,
      column: this.startColumn,
    });
  }

  private error(message: string): void {
    this.diagnostics.push({
      severity: 'error',
      message,
      line: this.startLine,
      column: this.startColumn,
    });
  }
}

// ---------- Convenience ----------

export function tokenize(source: string): LexResult {
  return new Lexer(source).tokenize();
}

// Debug helper — prints a table of tokens.
export function describeTokens(tokens: Token[]): string {
  return tokens
    .map((t) => {
      const value = t.value !== undefined ? ` (${JSON.stringify(t.value)})` : '';
      const pos = `L${t.line}:C${t.column}`;
      return `${pos.padEnd(9)} ${TokenType[t.type].padEnd(14)} '${t.lexeme}'${value}`;
    })
    .join('\n');
}