// src/emitter/heiferEmitter.ts

import { Emitter } from './emitterInterface.js';
import {
  Program, Definition, CoreExpr, Type, Pattern, Spec, State,
  Heap, Pure, PredDef, FuncSpec, MatchBranch, QuantVar
} from '../core/ast.js';

export class HeiferEmitter implements Emitter {
  readonly formatName = 'heifer';
  readonly fileExtension = 'ml';

  public emit(program: Program): string {
    const parts: string[] = [];

    if (program.predicates.length > 0) {
      for (const pred of program.predicates) {
        parts.push(this.emitPredComment(pred));
      }
      parts.push('');
    }

    for (const def of program.definitions) {
      parts.push(this.emitDefinition(def));
    }

    return parts.join('\n');
  }

  // Predicate definitions have no direct OCaml equivalent; emit as doc comment
  private emitPredComment(pred: PredDef): string {
    const params = pred.typeParams.length > 0 ? `(${pred.typeParams.join(', ')})` : '';
    const sep = pred.isSeparation ? '|->' : ':';
    return `(* pred ${pred.selfVar}${sep}${pred.name}${params} = ${this.emitState(pred.body)} *)`;
  }

  private emitDefinition(def: Definition): string {
    const isRec = this.bodyContainsRecursiveCall(def.body, def.name);
    const letKw = isRec ? 'let rec' : 'let';
    const params = def.params.map(p => p.name).join(' ');
    const paramsStr = params ? ` ${params}` : ' ()';

    // Spec block: prefer rawSpec passthrough, then synthesise from AST
    let specBlock = '';
    if (def.rawSpec) {
      specBlock = `\n(*@ ${def.rawSpec} @*)`;
    } else if (def.spec) {
      specBlock = this.emitSpecBlock(def.spec);
    }

    const bodyStr = this.emitExpr(def.body, 0);
    return `${letKw} ${def.name}${paramsStr}${specBlock}\n= ${bodyStr}`;
  }

  // ─── Spec emission ───────────────────────────────────────────────────

  private emitSpecBlock(funcSpec: FuncSpec): string {
    const inner = this.emitSpec(funcSpec.body, funcSpec.result);
    return `\n(*@ ${inner} @*)`;
  }

  private emitSpec(spec: Spec, resultVar: string): string {
    switch (spec.kind) {
      case 'EnsSpec':
        return this.emitEnsClause(spec.result, spec.post);

      case 'ReqEnsSpec': {
        const existsPrefix = this.collectExistentials(spec.pre);
        const reqStr = `req ${this.emitState(spec.pre)}`;
        const ensStr = this.emitEnsClause(spec.result, spec.post);
        return existsPrefix ? `${existsPrefix} ${reqStr}; ${ensStr}` : `${reqStr}; ${ensStr}`;
      }

      case 'CaseSpec': {
        // Disjunctive spec: each branch's guard folds into req/ens
        const branches = spec.branches.map(b => {
          if (b.isOtherwise) return null;
          const merged = this.mergeBranchSpec(b.guard, b.spec, resultVar);
          return merged;
        }).filter((s): s is string => s !== null);
        return branches.join('\n\\/ ');
      }

      case 'ForallSpec':
        // Quantifiers are universally implicit in Heifer; emit body only
        return this.emitSpec(spec.body, resultVar);
    }
  }

  private emitEnsClause(resultVar: string, post: State): string {
    const existsPrefix = this.collectExistentials(post);
    const stateStr = this.emitState(post);
    if (existsPrefix) {
      return `${existsPrefix} ens ${stateStr}`;
    }
    return `ens ${stateStr}`;
  }

  // Merge a case branch guard + inner spec into a req/ens clause
  private mergeBranchSpec(guard: State, spec: Spec, resultVar: string): string {
    switch (spec.kind) {
      case 'ReqEnsSpec': {
        const pre = this.mergeStates(guard, spec.pre);
        const exists = this.collectExistentials(pre);
        const reqStr = `req ${this.emitState(pre)}`;
        const ensStr = `ens ${this.emitState(spec.post)}`;
        return exists ? `${exists} ${reqStr}; ${ensStr}` : `${reqStr}; ${ensStr}`;
      }
      case 'EnsSpec': {
        const exists = this.collectExistentials(guard);
        const reqStr = `req ${this.emitState(guard)}`;
        const ensStr = `ens ${this.emitState(spec.post)}`;
        return exists ? `${exists} ${reqStr}; ${ensStr}` : `${reqStr}; ${ensStr}`;
      }
      default:
        return this.emitSpec(spec, resultVar);
    }
  }

  // Merge two states into one (flatten existentials/conjunctions)
  private mergeStates(guard: State, pre: State): State {
    if (guard.kind === 'TrueState') return pre;
    if (pre.kind === 'TrueState') return guard;
    // Both are concrete — wrap in a disjunction of guards or combine as heap conjunction
    // For simplicity, prefer keeping guard as the state and ignoring empty pre
    return guard;
  }

  // Extract and format existential vars from a state (for `ex a b;` prefix)
  private collectExistentials(state: State): string {
    const vars: string[] = [];
    this.gatherExistsFromState(state, vars);
    if (vars.length === 0) return '';
    return `ex ${vars.join(' ')};`;
  }

  private gatherExistsFromState(state: State, acc: string[]) {
    if (state.kind === 'HeapPure') {
      acc.push(...state.exists);
    } else if (state.kind === 'DisjState') {
      this.gatherExistsFromState(state.left, acc);
      this.gatherExistsFromState(state.right, acc);
    }
  }

  // ─── State / Heap / Pure ─────────────────────────────────────────────

  private emitState(state: State): string {
    switch (state.kind) {
      case 'TrueState':
        return 'emp';
      case 'HeapPure': {
        const heapStr = this.emitHeap(state.heap);
        const pureStr = this.emitPure(state.pure);
        if (heapStr === 'emp' && pureStr === 'true') return 'emp';
        if (heapStr === 'emp') return pureStr;
        if (pureStr === 'true') return heapStr;
        return `${heapStr}/\\${pureStr}`;
      }
      case 'DisjState':
        return `${this.emitState(state.left)} \\/ ${this.emitState(state.right)}`;
    }
  }

  private emitHeap(heap: Heap): string {
    switch (heap.kind) {
      case 'Emp': return 'emp';
      case 'PointsTo': return `${heap.variable}->${this.emitTypeInSpec(heap.type)}`;
      case 'SepConj': return `${this.emitHeap(heap.left)}*${this.emitHeap(heap.right)}`;
    }
  }

  private emitPure(pure: Pure): string {
    switch (pure.kind) {
      case 'PureTrue': return 'true';
      case 'TypeAssert': return `${pure.variable}:#${this.emitType(pure.type)}`;
      case 'Eq': return `${pure.left}=${pure.right}`;
      case 'Neq': return `${pure.left}!=${pure.right}`;
      case 'PureAnd': return `${this.emitPure(pure.left)}/\\${this.emitPure(pure.right)}`;
      case 'PureOr': return `${this.emitPure(pure.left)}\\/`+ `${this.emitPure(pure.right)}`;
      case 'PureNot': return `not(${this.emitPure(pure.inner)})`;
      case 'PureExists': return `ex ${pure.vars.join(' ')}. ${this.emitPure(pure.body)}`;
      case 'Constraint': return `${pure.left}${pure.op}${pure.right}`;
    }
  }

  // Types inside specs use # prefix convention in Heifer
  private emitTypeInSpec(type: Type): string {
    switch (type.kind) {
      case 'Prim': return `#${type.name.toLowerCase()}`;
      case 'RefType': return `#${this.emitType(type.inner)} ref`;
      case 'TypeVar': return type.name;
      case 'AnyType': return '#top';
      case 'TopType': return '#top';
      case 'BotType': return '#bot';
      case 'SingletonVar': return type.name;
      case 'SingletonConst': return String(type.value);
      case 'ConstrType': {
        const args = type.args.length > 0 ? `(${type.args.map(a => this.emitTypeInSpec(a)).join(', ')})` : '';
        return `${type.name}${args}`;
      }
      case 'RecordType': {
        const fs = type.fields.map(f => `${f.name}:${this.emitTypeInSpec(f.type)}`).join(', ');
        return `Rec(${fs})`;
      }
      default: return this.emitType(type);
    }
  }

  // ─── OCaml types ─────────────────────────────────────────────────────

  private emitType(type: Type): string {
    switch (type.kind) {
      case 'Prim':
        switch (type.name) {
          case 'Int':  return 'int';
          case 'Bool': return 'bool';
          case 'Str':  return 'string';
          case 'Unit': return 'unit';
        }
      case 'RefType': return `${this.emitType(type.inner)} ref`;
      case 'ErrType': return 'exn';
      case 'AbrtType': return 'exn';
      case 'AnyType': return "'a";
      case 'AnyPType': return "'a";
      case 'TopType': return "'a";
      case 'BotType': return "'a";
      case 'SingletonVar': return type.name;
      case 'SingletonConst': return String(type.value);
      case 'TypeVar': return `'${type.name.toLowerCase()}`;
      case 'WildcardType': return '_';
      case 'ConstrType': {
        if (type.name === 'List' && type.args.length === 1) {
          return `${this.emitType(type.args[0])} list`;
        }
        const args = type.args.length > 0 ? `(${type.args.map(a => this.emitType(a)).join(', ')}) ` : '';
        return `${args}${type.name.toLowerCase()}`;
      }
      case 'PredType': {
        const args = type.args.length > 0 ? `(${type.args.map(a => this.emitType(a)).join(', ')}) ` : '';
        return `${args}${type.name.toLowerCase()}`;
      }
      case 'SepType': return `${this.emitType(type.inner)} ref`;
      case 'ArrowType': return `(${this.emitType(type.from)} -> ${this.emitType(type.to)})`;
      case 'AndType': return this.emitType(type.left);   // and-types collapse to left in OCaml
      case 'OrType': return "'a";
      case 'NotType': return "'a";
      case 'RecordType': {
        // OCaml inline record type annotation — used in let bindings only
        const fs = type.fields.map(f => `${f.name}: ${this.emitType(f.type)}`).join('; ');
        return `{ ${fs} }`;
      }
    }
  }

  // ─── Expression emission ─────────────────────────────────────────────

  private emitExpr(expr: CoreExpr, depth: number): string {
    const indent = '  '.repeat(depth);
    switch (expr.kind) {
      case 'Var':
        return expr.name;

      case 'Const':
        if (expr.value === 'null') return '[]';
        if (typeof expr.value === 'string') return `"${expr.value}"`;
        if (typeof expr.value === 'boolean') return expr.value ? 'true' : 'false';
        return String(expr.value);

      case 'Err':
        return 'raise (Failure "err")';

      case 'Abrt':
        return 'raise (Failure "abort")';

      case 'Let': {
        const rhs = this.emitExpr(expr.value, depth);
        const rest = this.emitExpr(expr.body, depth);
        if (expr.bind === '_') {
          // Parenthesize rhs so a trailing match arm doesn't absorb the semicolon
          const needsParens = rhs.includes('\n') || rhs.trimStart().startsWith('match ');
          return `${needsParens ? `(${rhs})` : rhs};\n${indent}${rest}`;
        }
        return `let ${expr.bind} = ${rhs} in\n${indent}${rest}`;
      }

      case 'Constr':
        return this.emitConstr(expr.name, expr.args);

      case 'Call':
        return this.emitCall(expr.func, expr.args);

      case 'Cast':
        // Type casts are transparent in OCaml
        return expr.arg;

      case 'Match':
        return this.emitMatch(expr.scrutinee, expr.branches, depth);

      case 'Lambda': {
        const params = expr.params.join(' ');
        const specBlock = expr.spec ? this.emitSpecBlock(expr.spec) : '';
        const body = this.emitExpr(expr.body, depth + 1);
        return `(fun ${params}${specBlock} -> ${body})`;
      }

      case 'Record': {
        const fs = expr.fields.map(f => `${f.name} = ${f.value}`).join('; ');
        return `{ ${fs} }`;
      }
    }
  }

  private emitConstr(name: string, args: string[]): string {
    switch (name) {
      case 'Nil':  return '[]';
      case 'Cons': return args.length >= 2 ? `(${args[0]} :: ${args[1]})` : `[${args.join('; ')}]`;
      case 'None': return 'None';
      case 'Some': return args.length === 1 ? `(Some ${args[0]})` : `(Some (${args.join(', ')}))`;
      case 'True': return 'true';
      case 'False': return 'false';
      default: {
        if (args.length === 0) return name;
        return `(${name} (${args.join(', ')}))`;
      }
    }
  }

  private emitCall(func: string, args: string[]): string {
    // Built-in arithmetic/comparison operators
    const binops: Record<string, string> = {
      add: '+', sub: '-', mul: '*', div: '/',
      eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=',
      and: '&&', or: '||',
    };
    if (binops[func] && args.length === 2) {
      return `(${args[0]} ${binops[func]} ${args[1]})`;
    }

    // Ref operations
    if (func === 'ref' && args.length === 1) return `(ref ${args[0]})`;
    if (func === 'deref' && args.length === 1) return `!${args[0]}`;
    if (func === 'assign' && args.length === 2) return `(${args[0]} := ${args[1]})`;

    // String/int conversion
    if (func === 'String' && args.length === 1) return `(string_of_int ${args[0]})`;
    if (func === 'parseInt' && args.length >= 1) return `(int_of_string ${args[0]})`;

    // Truthy negation: !xs in TS → xs = [] (null/empty check for lists)
    if (func === 'not_truthy' && args.length === 1) return `(${args[0]} = [])`;

    // Negation arithmetic
    if (func === 'op_!' && args.length === 1) return `(not ${args[0]})`;

    // Field read/write: .val is OCaml ref dereference/assignment
    if (func === 'read_field_val' && args.length === 1) return `!${args[0]}`;
    if (func === 'write_field_val' && args.length === 2) return `(${args[0]} := ${args[1]})`;

    // List traversal fields
    if (func === 'read_field_next' && args.length === 1) return `(List.tl ${args[0]})`;
    if (func === 'read_field_hd' && args.length === 1) return `(List.hd ${args[0]})`;

    // Other field read/write
    if (func.startsWith('read_field_')) {
      const prop = func.slice('read_field_'.length);
      return args.length === 1 ? `${args[0]}.${prop}` : `(${args[0]}.${prop})`;
    }
    if (func.startsWith('write_field_')) {
      const prop = func.slice('write_field_'.length);
      return `(${args[0]}.${prop} <- ${args[1]})`;
    }

    // List cons cell
    if (func === 'cons_cell' && args.length === 2) return `(${args[0]} :: ${args[1]})`;

    // General function application (curried OCaml style)
    if (args.length === 0) return func;
    return `(${func} ${args.join(' ')})`;
  }

  private emitMatch(scrutinee: string, branches: MatchBranch[], depth: number): string {
    const indent = '  '.repeat(depth);
    const branchLines = branches.map(b => {
      const pat = this.emitPattern(b.pattern);
      const body = this.emitExpr(b.body, depth + 1);
      return `${indent}  | ${pat} -> ${body}`;
    });
    return `match ${scrutinee} with\n${branchLines.join('\n')}`;
  }

  // ─── Pattern emission ────────────────────────────────────────────────

  private emitPattern(pat: Pattern): string {
    switch (pat.kind) {
      case 'ConstPat':
        if (typeof pat.value === 'boolean') return pat.value ? 'true' : 'false';
        if (typeof pat.value === 'string') return `"${pat.value}"`;
        return String(pat.value);

      case 'TypePat':
        switch (pat.name) {
          case 'Nil':  return '[]';
          case 'Cons': return '_ :: _';
          case 'None': return 'None';
          case 'Some': return '(Some _)';
          default:     return pat.name;
        }

      case 'ConstrPat': {
        if (pat.name === 'Nil') return '[]';
        if (pat.name === 'Cons' && pat.bindings.length >= 2) {
          return `(${pat.bindings[0]} :: ${pat.bindings[1]})`;
        }
        if (pat.bindings.length === 0) return pat.name;
        return `(${pat.name} (${pat.bindings.join(', ')}))`;
      }

      case 'PredPat':   return `_`;  // predicate patterns are opaque in OCaml
      case 'ArrowPat':  return `_`;
      case 'WildcardPat': return '_';
      case 'AndPat': return `(${this.emitPattern(pat.left)} as _${this.emitPattern(pat.right)})`;
      case 'OrPat':  return `(${this.emitPattern(pat.left)} | ${this.emitPattern(pat.right)})`;
      case 'NotPat': return '_';  // no negation patterns in OCaml
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  private bodyContainsRecursiveCall(expr: CoreExpr, name: string): boolean {
    switch (expr.kind) {
      case 'Call':   return expr.func === name || expr.args.some(a => a === name);
      case 'Let':    return this.bodyContainsRecursiveCall(expr.value, name) ||
                            this.bodyContainsRecursiveCall(expr.body, name);
      case 'Match':  return expr.branches.some(b => this.bodyContainsRecursiveCall(b.body, name));
      case 'Lambda': return this.bodyContainsRecursiveCall(expr.body, name);
      default:       return false;
    }
  }
}
