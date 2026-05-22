// src/parser/specParser.ts

import { Token, TokenType, SpecLexer } from './specLexer.js';
import { State, Heap, Pure, Spec, Type, BaseType, QuantVar, PredDef, CaseBranch, AST, ConstraintOp } from '../core/ast.js';

export class SpecParser {
  private tokens: Token[];
  private pos = 0;
  private currentSelfVar = 'self';

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  public static parseStateStr(input: string, selfVar = 'self'): State {
    const lexer = new SpecLexer(input);
    const tokens = lexer.tokenize();
    const parser = new SpecParser(tokens);
    parser.currentSelfVar = selfVar;
    const state = parser.parseState();
    parser.expect('EOF');
    return state;
  }

  public static parseTypeStr(input: string): Type {
    const lexer = new SpecLexer(input);
    const tokens = lexer.tokenize();
    const parser = new SpecParser(tokens);
    const type = parser.parseType();
    parser.expect('EOF');
    return type;
  }

  public static parsePredDefStr(input: string): PredDef {
    const lexer = new SpecLexer(input);
    const tokens = lexer.tokenize();
    const parser = new SpecParser(tokens);
    const pred = parser.parsePredDef();
    parser.expect('EOF');
    return pred;
  }

  public static parseSpecStr(input: string, selfVar = 'self'): Spec {
    const lexer = new SpecLexer(input);
    const tokens = lexer.tokenize();
    const parser = new SpecParser(tokens);
    parser.currentSelfVar = selfVar;
    const spec = parser.parseSpec();
    parser.expect('EOF');
    return spec;
  }

  private peek(): Token {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : this.tokens[this.tokens.length - 1];
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.pos++;
      return true;
    }
    return false;
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new Error(`Expected token ${type}, but got ${tok.type} ('${tok.value}') at line ${tok.line}, col ${tok.col}`);
    }
    this.pos++;
    return tok;
  }

  private next(): Token {
    const tok = this.peek();
    this.pos++;
    return tok;
  }

  // ─── Parsing Spec ──────────────────────────────────────────────────

  public parseSpec(): Spec {
    if (this.match('FORALL')) {
      const vars = this.parseQuantVars();
      this.match('DOT'); // optional
      const body = this.parseSpec();
      return AST.forallSpec(vars, body);
    }

    if (this.check('LBRACE') && this.lookaheadForCase()) {
      return this.parseCaseSpec();
    }

    return this.parseReqEnsSpec();
  }

  private lookaheadForCase(): boolean {
    let depth = 0;
    for (let i = this.pos; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === 'LBRACE') depth++;
      if (t.type === 'RBRACE') {
        depth--;
        if (depth === 0) break;
      }
      if (t.type === 'ARROW' && depth === 1) {
        return true;
      }
    }
    return false;
  }

  private parseQuantVars(): QuantVar[] {
    const vars: QuantVar[] = [];
    do {
      const name = this.expect('IDENTIFIER').value;
      let bound: string | undefined;
      if (this.match('COLON')) {
        bound = this.expect('IDENTIFIER').value;
      }
      vars.push(AST.quantVar(name, bound));
    } while (this.match('COMMA'));
    return vars;
  }

  private parseReqEnsSpec(): Spec {
    const tok = this.peek();
    let pre: State = AST.trueState();
    let params: string[] = [];

    if (tok.type === 'IDENTIFIER' && (tok.value === 'requires' || tok.value === 'req')) {
      this.next();
      if (this.match('LBRACKET')) {
        do {
          params.push(this.expect('IDENTIFIER').value);
        } while (this.match('COMMA'));
        this.expect('RBRACKET');
      }
      pre = this.parseState();
    }

    const nextTok = this.peek();
    if (nextTok.type === 'IDENTIFIER' && (nextTok.value === 'ensures' || nextTok.value === 'ens')) {
      this.next();
      let result = 'res';
      if (this.match('LBRACKET')) {
        result = this.expect('IDENTIFIER').value;
        this.expect('RBRACKET');
      }
      const post = this.parseState();
      return AST.reqEnsSpec(params, pre, result, post);
    }

    if (tok.type === 'IDENTIFIER' && (tok.value === 'ensures' || tok.value === 'ens')) {
      this.next();
      let result = 'res';
      if (this.match('LBRACKET')) {
        result = this.expect('IDENTIFIER').value;
        this.expect('RBRACKET');
      }
      const post = this.parseState();
      return AST.ensSpec(result, post);
    }

    const post = this.parseState();
    return AST.ensSpec('res', post);
  }

  private parseCaseSpec(): Spec {
    this.expect('LBRACE');
    const branches: CaseBranch[] = [];
    let params: string[] = [];
    
    while (!this.check('RBRACE') && !this.check('EOF')) {
      const guard = this.parseState();
      this.expect('ARROW');
      
      const spec = this.parseSpec();
      this.match('COMMA');
      this.match('DOT');
      
      branches.push(AST.caseBranch(guard, spec));
    }
    this.expect('RBRACE');
    return AST.caseSpec(params, branches);
  }

  // ─── Parsing State (Δ) ──────────────────────────────────────────────

  public parseState(): State {
    let state = this.parseHeapPure();
    while (this.match('PURE_OR') || this.match('TYPE_OR')) {
      const right = this.parseHeapPure();
      state = AST.disjState(state, right);
    }
    return state;
  }

  private isPointsToOrBareType(pos: number): boolean {
    if (pos >= this.tokens.length) return false;
    
    // Check if it is a points-to next (e.g. x ↦ ...)
    if (this.tokens[pos].type === 'IDENTIFIER') {
      const nextP = pos + 1;
      if (nextP < this.tokens.length) {
        if (this.tokens[nextP].type === 'POINTS_TO') return true;
        if (this.tokens[nextP].type === 'COLON') {
          if (nextP + 1 < this.tokens.length && this.tokens[nextP + 1].type === 'COLON') {
            return true;
          }
        }
      }
    }
    
    // Check if it is a bare type (like Cons(T, r) or ll<n>)
    const tok = this.tokens[pos];
    if (tok.type === 'IDENTIFIER') {
      // Check if it is a parameterized type (e.g. ll<n> or List(T))
      if (pos + 1 < this.tokens.length) {
        const nextTok = this.tokens[pos + 1];
        if (nextTok.type === 'LT' || nextTok.type === 'LPAREN') {
          return true;
        }
      }
      if (
        tok.value === 'Int' ||
        tok.value === 'Bool' ||
        tok.value === 'Str' ||
        tok.value === 'Unit' ||
        tok.value === 'Err' ||
        tok.value === 'Abrt' ||
        tok.value === 'Any' ||
        tok.value === 'AnyP' ||
        tok.value[0] === tok.value[0].toUpperCase()
      ) {
        return true;
      }
    }
    return false;
  }

  private parseStateConjunct(
    mergeHeap: (h: Heap) => void,
    mergePure: (p: Pure) => void,
    hasSepConj: { value: boolean }
  ): void {
    if (this.peek().type === 'IDENTIFIER' && this.peek().value === 'emp') {
      this.next();
      mergeHeap(AST.emp());
      return;
    }

    if (this.isPointsToNext()) {
      mergeHeap(this.parsePointsTo());
      return;
    }

    if (this.isBareTypeNext()) {
      const type = this.parseType();
      const nextTok = this.peek();
      const isHeap = nextTok.type === 'SEP_CONJ' || hasSepConj.value;
      if (isHeap) {
        mergeHeap(AST.pointsTo(this.currentSelfVar, type));
      } else {
        mergePure(AST.typeAssert(this.currentSelfVar, type));
      }
      return;
    }

    mergePure(this.parsePure());
  }

  private parseHeapPure(): State {
    let exists: string[] = [];
    if (this.match('EXISTS')) {
      do {
        exists.push(this.expect('IDENTIFIER').value);
      } while (this.match('COMMA'));
      this.expect('DOT');
    }

    let heap: Heap = AST.emp();
    let pure: Pure = AST.pureTrue();
    const hasSepConj = { value: false };

    const mergeHeap = (h: Heap) => {
      if (heap.kind === 'Emp') {
        heap = h;
      } else {
        heap = AST.sepConj(heap, h);
      }
    };

    const mergePure = (p: Pure) => {
      if (pure.kind === 'PureTrue') {
        pure = p;
      } else {
        pure = AST.pureAnd(pure, p);
      }
    };

    this.parseStateConjunct(mergeHeap, mergePure, hasSepConj);

    while (true) {
      if (this.match('SEP_CONJ')) {
        hasSepConj.value = true;
        this.parseStateConjunct(mergeHeap, mergePure, hasSepConj);
      } else if (this.match('PURE_AND') || this.match('TYPE_AND')) {
        this.parseStateConjunct(mergeHeap, mergePure, hasSepConj);
      } else {
        break;
      }
    }

    return AST.heapPure(exists, heap, pure);
  }

  private isPureStartFollows(): boolean {
    const tok = this.peek();
    if (tok.type === 'IDENTIFIER') {
      const val = tok.value;
      if (val === 'requires' || val === 'req' || val === 'ensures' || val === 'ens' || val === 'case' || val === 'emp' || val === 'inv') {
        return false;
      }
      if (this.pos + 1 < this.tokens.length) {
        const nextTok = this.tokens[this.pos + 1];
        if (
          nextTok.type === 'EQ' ||
          nextTok.type === 'NEQ' ||
          nextTok.type === 'LT' ||
          nextTok.type === 'LTE' ||
          nextTok.type === 'GT' ||
          nextTok.type === 'GTE' ||
          nextTok.type === 'COLON'
        ) {
          return true;
        }
      }
      return true;
    }
    return tok.type === 'NOT' || tok.type === 'EXISTS' || tok.type === 'LPAREN';
  }

  // ─── Parsing Heap (σ) ──────────────────────────────────────────────

  private parseHeap(): Heap {
    if (this.peek().type === 'IDENTIFIER' && this.peek().value === 'emp') {
      this.next();
      return AST.emp();
    }

    if (!this.isPointsToNext()) {
      return AST.emp();
    }

    let heap = this.parsePointsTo();
    while (this.match('SEP_CONJ')) {
      heap = AST.sepConj(heap, this.parsePointsTo());
    }
    return heap;
  }

  private isPointsToNext(): boolean {
    let p = this.pos;
    if (p < this.tokens.length && this.tokens[p].type === 'IDENTIFIER') {
      p++;
      if (p < this.tokens.length) {
        if (this.tokens[p].type === 'POINTS_TO') return true;
        if (this.tokens[p].type === 'COLON') {
          if (p + 1 < this.tokens.length && this.tokens[p + 1].type === 'COLON') {
            return true;
          }
        }
      }
    }
    return false;
  }

  private parsePointsTo(): Heap {
    if (this.peek().type === 'IDENTIFIER' && this.peek().value === 'emp') {
      this.next();
      return AST.emp();
    }

    const identifierTok = this.expect('IDENTIFIER');
    if (this.match('POINTS_TO')) {
      const type = this.parseType();
      return AST.pointsTo(identifierTok.value, type);
    } else {
      this.expect('COLON');
      this.expect('COLON');
      const type = this.parseType();
      return AST.pointsTo(identifierTok.value, type);
    }
  }

  // ─── Parsing Pure (π) ──────────────────────────────────────────────

  private parsePure(): Pure {
    return this.parsePureOr();
  }

  private parsePureOr(): Pure {
    let pure = this.parsePureAnd();
    while (this.match('PURE_OR')) {
      const right = this.parsePureAnd();
      pure = AST.pureOr(pure, right);
    }
    return pure;
  }

  private parsePureAnd(): Pure {
    let pure = this.parsePureNot();
    while (this.peek().type === 'PURE_AND') {
      if (this.isPointsToOrBareType(this.pos + 1)) {
        break;
      }
      this.next();
      const right = this.parsePureNot();
      pure = AST.pureAnd(pure, right);
    }
    return pure;
  }

  private parsePureNot(): Pure {
    if (this.match('NOT')) {
      return AST.pureNot(this.parsePureNot());
    }
    return this.parsePurePrimary();
  }

  private parsePurePrimary(): Pure {
    if (this.match('LPAREN')) {
      const pure = this.parsePure();
      this.expect('RPAREN');
      return pure;
    }

    if (this.match('EXISTS')) {
      const vars: string[] = [];
      do {
        vars.push(this.expect('IDENTIFIER').value);
      } while (this.match('COMMA'));
      this.expect('DOT');
      const body = this.parsePure();
      return AST.pureExists(vars, body);
    }

    if (this.peek().type === 'IDENTIFIER' && this.peek().value === 'true') {
      this.next();
      return AST.pureTrue();
    }

    if (this.isBareTypeNext()) {
      const type = this.parseType();
      return AST.typeAssert(this.currentSelfVar, type);
    }

    const left = this.expect('IDENTIFIER').value;

    if (this.match('COLON')) {
      const type = this.parseType();
      return AST.typeAssert(left, type);
    }

    if (this.match('EQ')) {
      const nextTok = this.peek();
      let isType = false;
      if (nextTok.type === 'IDENTIFIER') {
        const val = nextTok.value;
        const isUpper = val[0] === val[0].toUpperCase();
        const hasBrackets = this.pos + 1 < this.tokens.length && 
                            (this.tokens[this.pos + 1].type === 'LPAREN' || this.tokens[this.pos + 1].type === 'LT');
        if (isUpper || hasBrackets) {
          isType = true;
        }
      }
      
      if (isType) {
        const type = this.parseType();
        return AST.typeAssert(left, type);
      }

      const rhs = this.parseArithmeticRHS();
      if (rhs.includes('+') || rhs.includes('-')) {
        return AST.constraint(left, '=', rhs);
      }
      return AST.eq(left, rhs);
    }

    let op: ConstraintOp | null = null;
    if (this.match('NEQ')) {
      const right = this.expect('IDENTIFIER').value;
      return AST.neq(left, right);
    }
    else if (this.match('LTE')) op = '<=';
    else if (this.match('LT')) op = '<';
    else if (this.match('GTE')) op = '>=';
    else if (this.match('GT')) op = '>';

    if (op) {
      const rhs = this.parseArithmeticRHS();
      return AST.constraint(left, op, rhs);
    }

    return AST.typeAssert(left, AST.topType());
  }

  private parseArithmeticRHS(): string {
    const keywords = new Set(['requires', 'req', 'ensures', 'ens', 'case', 'inv', 'emp', 'or']);
    let res = '';
    const lead = this.peek();
    if (lead.type === 'PLUS' || lead.type === 'MINUS') {
      res += lead.value;
      this.next();
    }
    
    while (true) {
      const tok = this.peek();
      if (tok.type === 'IDENTIFIER' || tok.type === 'NUMBER') {
        if (tok.type === 'IDENTIFIER' && keywords.has(tok.value)) {
          break;
        }
        const needsSpace = res !== '' && res !== '+' && res !== '-';
        res += (needsSpace ? ' ' : '') + tok.value;
        this.next();
      } else if (tok.type === 'PLUS' || tok.type === 'MINUS') {
        res += ' ' + tok.value;
        this.next();
      } else {
        break;
      }
    }
    if (res === '' || res === '+' || res === '-') {
      const tok = this.peek();
      throw new Error(`Expected identifier, number, or arithmetic expression, got ${tok.type} ('${tok.value}') at line ${tok.line}, col ${tok.col}`);
    }
    return res;
  }

  private isStateStart(pos: number): boolean {
    if (pos >= this.tokens.length) return false;
    const tok = this.tokens[pos];
    if (tok.type === 'EXISTS' || tok.type === 'FORALL') return true;
    if (tok.type === 'IDENTIFIER' && tok.value === 'emp') return true;
    
    if (tok.type === 'IDENTIFIER') {
      const nextP = pos + 1;
      if (nextP < this.tokens.length) {
        const nextTok = this.tokens[nextP];
        if (
          nextTok.type === 'POINTS_TO' ||
          nextTok.type === 'COLON' ||
          nextTok.type === 'EQ' ||
          nextTok.type === 'NEQ' ||
          nextTok.type === 'LTE' ||
          nextTok.type === 'GTE' ||
          nextTok.type === 'GT'
        ) {
          return true;
        }
        if (nextTok.type === 'LT') {
          let hasGt = false;
          for (let i = nextP + 1; i < this.tokens.length && i < nextP + 10; i++) {
            if (this.tokens[i].type === 'GT') {
              hasGt = true;
              break;
            }
          }
          if (!hasGt) return true;
        }
      }
    }
    return false;
  }

  private isBareTypeNext(): boolean {
    const tok = this.peek();
    if (tok.type !== 'IDENTIFIER') return false;
    
    // Check if it is a parameterized type (e.g. ll<n> or List(T))
    if (this.pos + 1 < this.tokens.length) {
      const nextTok = this.tokens[this.pos + 1];
      if (nextTok.type === 'LT' || nextTok.type === 'LPAREN') {
        return true;
      }
    }

    if (
      tok.value === 'Int' ||
      tok.value === 'Bool' ||
      tok.value === 'Str' ||
      tok.value === 'Unit' ||
      tok.value === 'Err' ||
      tok.value === 'Abrt' ||
      tok.value === 'Any' ||
      tok.value === 'AnyP' ||
      tok.value[0] === tok.value[0].toUpperCase()
    ) {
      let p = this.pos + 1;
      if (p < this.tokens.length) {
        const nextTok = this.tokens[p];
        if (
          nextTok.type === 'EQ' ||
          nextTok.type === 'NEQ' ||
          nextTok.type === 'LT' ||
          nextTok.type === 'LTE' ||
          nextTok.type === 'GT' ||
          nextTok.type === 'GTE' ||
          nextTok.type === 'COLON'
        ) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  // ─── Parsing Types (t) ─────────────────────────────────────────────

  public parseType(): Type {
    return this.parseArrowOrLogicalType();
  }

  private parseArrowOrLogicalType(): Type {
    let type = this.parseLogicalType();
    if (this.match('ARROW')) {
      const right = this.parseType();
      type = AST.arrowType(type, right);
    }
    return type;
  }

  private parseLogicalType(): Type {
    let type = this.parseTypePrimary();
    while (true) {
      if (this.check('TYPE_AND')) {
        if (this.isStateStart(this.pos + 1)) {
          break;
        }
        this.match('TYPE_AND');
        type = AST.andType(type, this.parseTypePrimary());
      } else if (this.check('TYPE_OR')) {
        if (this.isStateStart(this.pos + 1)) {
          break;
        }
        this.match('TYPE_OR');
        type = AST.orType(type, this.parseTypePrimary());
      } else {
        break;
      }
    }
    return type;
  }

  private parseTypePrimary(): Type {
    if (this.match('NOT')) {
      return AST.notType(this.parseTypePrimary());
    }

    if (this.match('POINTS_TO')) {
      const base = this.parseBaseType();
      return AST.sepType(base);
    }

    if (this.match('LPAREN')) {
      const type = this.parseType();
      this.expect('RPAREN');
      return type;
    }

    return this.parseBaseType();
  }

  private parseBaseType(): BaseType {
    const tok = this.peek();

    if (tok.type === 'BOT') {
      this.next();
      return AST.botType();
    }
    if (tok.type === 'TOP') {
      this.next();
      return AST.topType();
    }

    if (this.match('LBRACE')) {
      const valTok = this.peek();
      if (valTok.type === 'NUMBER') {
        this.next();
        this.expect('RBRACE');
        return AST.singletonConst(Number(valTok.value));
      }
      if (valTok.type === 'IDENTIFIER') {
        this.next();
        this.expect('RBRACE');
        return AST.singletonVar(valTok.value);
      }
      throw new Error(`Invalid singleton type value: ${valTok.value}`);
    }

    if (tok.type === 'IDENTIFIER') {
      this.next();
      const name = tok.value;

      if (name === 'Int') return AST.primType('Int');
      if (name === 'Bool') return AST.primType('Bool');
      if (name === 'Str') return AST.primType('Str');
      if (name === 'Unit') return AST.primType('Unit');
      if (name === 'Err') return AST.errType();
      if (name === 'Abrt') return AST.abrtType();
      if (name === 'Any') return AST.anyType();
      if (name === 'AnyP') return AST.anyPType();

      if (name === 'Ref' && this.match('LPAREN')) {
        const inner = this.parseType();
        this.expect('RPAREN');
        return AST.refType(inner);
      }

      // Parse either Name(args) or Name<args>
      const hasLparen = this.match('LPAREN');
      const hasLt = !hasLparen && this.match('LT');
      if (hasLparen || hasLt) {
        const endType = hasLparen ? 'RPAREN' : 'GT';
        const args: Type[] = [];
        if (!this.check(endType)) {
          do {
            const nextTok = this.pos < this.tokens.length ? this.tokens[this.pos] : null;
            const nextNextTok = this.pos + 1 < this.tokens.length ? this.tokens[this.pos + 1] : null;
            if (
              nextTok &&
              (nextTok.type === 'IDENTIFIER' || nextTok.type === 'NUMBER') &&
              nextNextTok &&
              (nextNextTok.type === 'PLUS' || nextNextTok.type === 'MINUS')
            ) {
              const expr = this.parseArithmeticRHS();
              args.push(AST.typeVar(expr));
            } else if (nextTok && nextTok.type === 'NUMBER') {
              this.next();
              args.push(AST.typeVar(nextTok.value));
            } else {
              args.push(this.parseType());
            }
          } while (this.match('COMMA'));
        }
        this.expect(endType);
        if (name[0] === name[0].toUpperCase()) {
          return AST.constrType(name, args);
        } else {
          return AST.predType(name, args);
        }
      }

      return AST.typeVar(name);
    }

    throw new Error(`Unexpected token for base type: ${tok.type} ('${tok.value}')`);
  }

  // ─── Parsing Predicate Definitions ─────────────────────────────────

  public parsePredDef(): PredDef {
    const tok1 = this.expect('IDENTIFIER');
    let selfVar = 'self';
    let name = tok1.value;
    
    if (this.match('COLON')) {
      selfVar = name;
      name = this.expect('IDENTIFIER').value;
    }

    this.expect('LPAREN');
    const typeParams: string[] = [];
    if (!this.check('RPAREN')) {
      do {
        typeParams.push(this.expect('IDENTIFIER').value);
      } while (this.match('COMMA'));
    }
    this.expect('RPAREN');

    let isSeparation = false;
    this.expect('EQ');
    
    this.currentSelfVar = selfVar;
    const body = this.parseState();
    return AST.predDef(name, selfVar, typeParams, isSeparation, body);
  }
}
