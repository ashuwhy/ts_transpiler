// src/parser/specLexer.ts

export type TokenType =
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'LPAREN' | 'RPAREN'
  | 'LBRACE' | 'RBRACE'
  | 'LBRACKET' | 'RBRACKET'
  | 'COMMA' | 'COLON' | 'DOT'
  | 'EQ' | 'NEQ' | 'LTE' | 'LT' | 'GTE' | 'GT'
  | 'POINTS_TO' // ↦ or |->
  | 'SEP_CONJ'  // ∗ or *
  | 'PURE_AND'  // & or &&
  | 'PURE_OR'   // | or ||
  | 'TYPE_AND'  // ∧
  | 'TYPE_OR'   // ∨
  | 'NOT'       // ¬ or !
  | 'EXISTS'    // ∃ or exists
  | 'FORALL'    // ∀ or forall
  | 'BOT'       // ⊥ or _|_
  | 'TOP'       // ⊤ or Top
  | 'ARROW'     // ->
  | 'PLUS'      // +
  | 'MINUS'     // -
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export class SpecLexer {
  private input: string;
  private pos = 0;
  private line = 1;
  private col = 1;

  constructor(input: string) {
    this.input = input;
  }

  private peek(): string {
    return this.pos < this.input.length ? this.input[this.pos] : '';
  }

  private next(): string {
    const char = this.peek();
    if (char) {
      this.pos++;
      if (char === '\n') {
        this.line++;
        this.col = 1;
      } else {
        this.col++;
      }
    }
    return char;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const char = this.peek();

      if (/\s/.test(char)) {
        this.next();
        continue;
      }

      const startLine = this.line;
      const startCol = this.col;

      // Handle multi-character operators
      if (this.input.startsWith('|->', this.pos)) {
        this.pos += 3;
        this.col += 3;
        tokens.push({ type: 'POINTS_TO', value: '|->', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('_|_', this.pos)) {
        this.pos += 3;
        this.col += 3;
        tokens.push({ type: 'BOT', value: '_|_', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('->', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'ARROW', value: '->', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('&&', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'PURE_AND', value: '&&', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('||', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'PURE_OR', value: '||', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('!=', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'NEQ', value: '!=', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('<=', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'LTE', value: '<=', line: startLine, col: startCol });
        continue;
      }
      if (this.input.startsWith('>=', this.pos)) {
        this.pos += 2;
        this.col += 2;
        tokens.push({ type: 'GTE', value: '>=', line: startLine, col: startCol });
        continue;
      }

      // Single characters
      if (char === '↦') {
        this.next();
        tokens.push({ type: 'POINTS_TO', value: '↦', line: startLine, col: startCol });
        continue;
      }
      if (char === '∗') {
        this.next();
        tokens.push({ type: 'SEP_CONJ', value: '∗', line: startLine, col: startCol });
        continue;
      }
      if (char === '*') {
        this.next();
        tokens.push({ type: 'SEP_CONJ', value: '*', line: startLine, col: startCol });
        continue;
      }
      if (char === '∧') {
        this.next();
        tokens.push({ type: 'TYPE_AND', value: '∧', line: startLine, col: startCol });
        continue;
      }
      if (char === '∨') {
        this.next();
        tokens.push({ type: 'TYPE_OR', value: '∨', line: startLine, col: startCol });
        continue;
      }
      if (char === '&') {
        this.next();
        tokens.push({ type: 'PURE_AND', value: '&', line: startLine, col: startCol });
        continue;
      }
      if (char === '|') {
        this.next();
        tokens.push({ type: 'PURE_OR', value: '|', line: startLine, col: startCol });
        continue;
      }
      if (char === '¬' || char === '!') {
        this.next();
        tokens.push({ type: 'NOT', value: char, line: startLine, col: startCol });
        continue;
      }
      if (char === '∃') {
        this.next();
        tokens.push({ type: 'EXISTS', value: '∃', line: startLine, col: startCol });
        continue;
      }
      if (char === '∀') {
        this.next();
        tokens.push({ type: 'FORALL', value: '∀', line: startLine, col: startCol });
        continue;
      }
      if (char === '⊥') {
        this.next();
        tokens.push({ type: 'BOT', value: '⊥', line: startLine, col: startCol });
        continue;
      }
      if (char === '⊤') {
        this.next();
        tokens.push({ type: 'TOP', value: '⊤', line: startLine, col: startCol });
        continue;
      }

      if (char === '(') { this.next(); tokens.push({ type: 'LPAREN', value: '(', line: startLine, col: startCol }); continue; }
      if (char === ')') { this.next(); tokens.push({ type: 'RPAREN', value: ')', line: startLine, col: startCol }); continue; }
      if (char === '{') { this.next(); tokens.push({ type: 'LBRACE', value: '{', line: startLine, col: startCol }); continue; }
      if (char === '}') { this.next(); tokens.push({ type: 'RBRACE', value: '}', line: startLine, col: startCol }); continue; }
      if (char === '[') { this.next(); tokens.push({ type: 'LBRACKET', value: '[', line: startLine, col: startCol }); continue; }
      if (char === ']') { this.next(); tokens.push({ type: 'RBRACKET', value: ']', line: startLine, col: startCol }); continue; }
      if (char === ',') { this.next(); tokens.push({ type: 'COMMA', value: ',', line: startLine, col: startCol }); continue; }
      if (char === ':') { this.next(); tokens.push({ type: 'COLON', value: ':', line: startLine, col: startCol }); continue; }
      if (char === '.') { this.next(); tokens.push({ type: 'DOT', value: '.', line: startLine, col: startCol }); continue; }
      if (char === '=') { this.next(); tokens.push({ type: 'EQ', value: '=', line: startLine, col: startCol }); continue; }
      if (char === '<') { this.next(); tokens.push({ type: 'LT', value: '<', line: startLine, col: startCol }); continue; }
      if (char === '>') { this.next(); tokens.push({ type: 'GT', value: '>', line: startLine, col: startCol }); continue; }
      if (char === '+') { this.next(); tokens.push({ type: 'PLUS', value: '+', line: startLine, col: startCol }); continue; }
      if (char === '-') { this.next(); tokens.push({ type: 'MINUS', value: '-', line: startLine, col: startCol }); continue; }

      // Identifiers & keywords
      if (/[a-zA-Z_]/.test(char)) {
        let val = '';
        while (/[a-zA-Z0-9_]/.test(this.peek())) {
          val += this.next();
        }
        if (val === 'exists') {
          tokens.push({ type: 'EXISTS', value: val, line: startLine, col: startCol });
        } else if (val === 'forall') {
          tokens.push({ type: 'FORALL', value: val, line: startLine, col: startCol });
        } else if (val === 'Top') {
          tokens.push({ type: 'TOP', value: val, line: startLine, col: startCol });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: val, line: startLine, col: startCol });
        }
        continue;
      }

      // Numbers
      if (/[0-9]/.test(char)) {
        let val = '';
        while (/[0-9]/.test(this.peek())) {
          val += this.next();
        }
        tokens.push({ type: 'NUMBER', value: val, line: startLine, col: startCol });
        continue;
      }

      throw new Error(`Unexpected character '${char}' at line ${this.line}, col ${this.col}`);
    }

    tokens.push({ type: 'EOF', value: '', line: this.line, col: this.col });
    return tokens;
  }
}
