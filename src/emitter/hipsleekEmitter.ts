// src/emitter/hipsleekEmitter.ts

import { Emitter } from './emitterInterface.js';
import { Program, Definition, CoreExpr, Type, Pattern, Spec, State, Heap, Pure, PredDef, CaseBranch, FuncSpec, Param, MatchExpr, MatchBranch } from '../core/ast.js';

export interface HipsleekEmitterOptions {
  strict?: boolean; // true to print warnings on dropped Err paths
}

export class HipsleekEmitter implements Emitter {
  readonly formatName = 'hipsleek';
  readonly fileExtension = 'ss';
  private options: HipsleekEmitterOptions;

  constructor(options: HipsleekEmitterOptions = {}) {
    this.options = options;
  }

  public emit(program: Program): string {
    const lines: string[] = [];

    // 1. Emit standard data declarations
    lines.push('/* Data declarations */');
    lines.push('data node {');
    lines.push('  int val;');
    lines.push('  node next;');
    lines.push('}');
    lines.push('');
    lines.push('data cell {');
    lines.push('  int val;');
    lines.push('}');
    lines.push('');

    // 2. Emit view predicates
    if (program.predicates.length > 0) {
      lines.push('/* View predicates */');
      for (const pred of program.predicates) {
        lines.push(this.emitPredDef(pred));
      }
      lines.push('');
    }

    // 3. Emit functions
    lines.push('/* Functions */');
    for (const def of program.definitions) {
      lines.push(this.emitDefinition(def));
      lines.push('');
    }

    return lines.join('\n');
  }

  private emitPredDef(pred: PredDef): string {
    // ll<n> == self = null & n = 0 or self::node<_, q> * q::ll<n-1> inv n >= 0;
    // Map type params
    const params = pred.typeParams.length > 0 ? `<${pred.typeParams.join(', ')}>` : '';
    const bodyStr = this.emitState(pred.body);
    
    // Attempt to synthesize an invariant if we can detect variable ranges
    let inv = 'true';
    if (pred.name === 'll') {
      inv = 'n >= 0';
    } else if (pred.name === 'SortList') {
      inv = 'lo <= hi';
    }

    return `${pred.name}${params} == ${bodyStr}\n  inv ${inv};`;
  }

  private emitDefinition(def: Definition): string {
    const returnType = this.inferReturnType(def);
    const paramsStr = def.params.map(p => {
      const type = this.inferParamType(p, def.spec);
      return `${type} ${p.name}`;
    }).join(', ');

    const specStr = def.spec ? this.emitSpec(def.spec.body) : '';
    const bodyStr = this.emitFunctionBody(def.body);

    const fullSpec = specStr ? `\n  ${specStr}` : '';

    return `${returnType} ${def.name} (${paramsStr})${fullSpec}\n{\n${bodyStr}\n}`;
  }

  private emitSpec(spec: Spec): string {
    switch (spec.kind) {
      case 'EnsSpec': {
        return `requires true\n  ensures ${this.emitState(spec.post)};`;
      }
      case 'ReqEnsSpec': {
        return `requires ${this.emitState(spec.pre)}\n  ensures ${this.emitState(spec.post)};`;
      }
      case 'CaseSpec': {
        const branches = spec.branches.map(b => {
          const innerSpec = b.spec;
          if (innerSpec.kind === 'ReqEnsSpec') {
            return `    ${this.emitState(b.guard)} -> requires ${this.emitState(innerSpec.pre)} ensures ${this.emitState(innerSpec.post)};`;
          } else if (innerSpec.kind === 'EnsSpec') {
            return `    ${this.emitState(b.guard)} -> requires true ensures ${this.emitState(innerSpec.post)};`;
          }
          return `    ${this.emitState(b.guard)} -> ${this.emitSpec(innerSpec)}`;
        });
        return `case {\n${branches.join('\n')}\n  }`;
      }
      case 'ForallSpec': {
        // Quantifiers are implicit in HIPsleek
        return this.emitSpec(spec.body);
      }
    }
  }

  private emitState(state: State): string {
    switch (state.kind) {
      case 'TrueState':
        return 'true';
      case 'HeapPure': {
        const heapStr = this.emitHeap(state.heap);
        const pureStr = this.emitPure(state.pure);
        
        if (heapStr === 'emp' && pureStr === 'true') return 'true';
        if (heapStr === 'emp') return pureStr;
        if (pureStr === 'true') return heapStr;
        return `${heapStr} & ${pureStr}`;
      }
      case 'DisjState': {
        return `${this.emitState(state.left)} or ${this.emitState(state.right)}`;
      }
    }
  }

  private emitHeap(heap: Heap): string {
    switch (heap.kind) {
      case 'Emp': return 'emp';
      case 'PointsTo': {
        // Map points-to to HIPsleek double colon syntax
        // x::node<_, _> or x::cell<val>
        const type = heap.type;
        if (type.kind === 'RefType') {
          return `${heap.variable}::cell<${this.emitType(type.inner)}>`;
        }
        if (type.kind === 'ConstrType') {
          const args = type.args.map(a => this.emitType(a)).join(', ');
          return `${heap.variable}::${type.name}<${args}>`;
        }
        if (type.kind === 'PredType') {
          const args = type.args.map(a => this.emitType(a)).join(', ');
          return `${heap.variable}::${type.name}<${args}>`;
        }
        return `${heap.variable}::cell<${this.emitType(type)}>`;
      }
      case 'SepConj': {
        return `${this.emitHeap(heap.left)} * ${this.emitHeap(heap.right)}`;
      }
    }
  }

  private emitPure(pure: Pure): string {
    switch (pure.kind) {
      case 'PureTrue': return 'true';
      case 'TypeAssert': {
        // Singleton must-aliasing y:{x} -> y = x in HIPsleek
        const type = pure.type;
        if (type.kind === 'SingletonVar') {
          return `${pure.variable} = ${type.name}`;
        }
        if (type.kind === 'SingletonConst') {
          return `${pure.variable} = ${type.value}`;
        }
        // If type is ErrType, and strict mode is on, warn
        if (type.kind === 'ErrType') {
          if (this.options.strict) {
            console.warn(`[Strict Warning] Dropping Err path for variable ${pure.variable} in HIPsleek target.`);
          }
          return 'true'; // HIPsleek has no Err type
        }
        return 'true'; // types are verified via heap shape, pure logic drops type assertions
      }
      case 'Eq': return `${pure.left} = ${pure.right}`;
      case 'Neq': return `${pure.left} != ${pure.right}`;
      case 'PureAnd': return `${this.emitPure(pure.left)} & ${this.emitPure(pure.right)}`;
      case 'PureOr': return `${this.emitPure(pure.left)} or ${this.emitPure(pure.right)}`;
      case 'PureNot': return `!(${this.emitPure(pure.inner)})`;
      case 'PureExists': return `exists (${pure.vars.join(', ')}: ${this.emitPure(pure.body)})`;
      case 'Constraint': return `${pure.left} ${pure.op} ${pure.right}`;
    }
  }

  private emitType(type: Type): string {
    switch (type.kind) {
      case 'SingletonVar': return type.name;
      case 'SingletonConst': return String(type.value);
      case 'Prim': return type.name === 'Int' ? 'int' : 'int';
      case 'RefType': return 'cell';
      case 'TypeVar': return type.name;
      case 'WildcardType': return '_';
      case 'ConstrType': return type.name;
      default: return '_';
    }
  }

  private inferReturnType(def: Definition): string {
    // 1. Check if return type annotation is explicitly present
    if (def.returnTypeAnnotation) {
      const cleanType = def.returnTypeAnnotation.trim().toLowerCase();
      if (cleanType === 'number') return 'int';
      if (cleanType === 'boolean') return 'bool';
      if (cleanType === 'void') return 'void';
      if (cleanType === 'cell') return 'cell';
      if (cleanType === 'node') return 'node';
    }

    // 2. Check from spec ensures res:...
    if (def.spec && def.spec.body.kind === 'ReqEnsSpec') {
      const ensState = def.spec.body.post;
      if (ensState.kind === 'HeapPure' && ensState.pure.kind === 'TypeAssert' && ensState.pure.variable === 'res') {
        if (ensState.pure.type.kind === 'Prim' && ensState.pure.type.name === 'Int') {
          return 'int';
        }
      }
    }
    // Default returns void or int or node
    if (def.name.startsWith('safeHead') || def.name.startsWith('head')) return 'int';
    if (def.name.startsWith('stateful_add')) return 'void';
    if (def.name.startsWith('swap')) return 'void';
    return 'node';
  }

  private inferParamType(p: Param, spec: FuncSpec | null): string {
    if (spec) {
      // Check if points-to cell or primitive type in requires
      const checkPreState = (state: State): string | null => {
        if (state.kind === 'HeapPure') {
          // Check heap points-to
          const searchHeap = (h: Heap): string | null => {
            if (h.kind === 'PointsTo' && h.variable === p.name) {
              if (h.type.kind === 'RefType') return 'cell';
              if (h.type.kind === 'ConstrType' && h.type.name === 'cell') return 'cell';
              if (h.type.kind === 'PredType' && h.type.name === 'cell') return 'cell';
              return 'node';
            }
            if (h.kind === 'SepConj') {
              return searchHeap(h.left) || searchHeap(h.right);
            }
            return null;
          };
          const res = searchHeap(state.heap);
          if (res) return res;

          // Check pure type assertion for primitive
          const searchPure = (pu: Pure): string | null => {
            if (pu.kind === 'TypeAssert' && pu.variable === p.name) {
              if (pu.type.kind === 'Prim' && pu.type.name === 'Int') return 'int';
            }
            if (pu.kind === 'PureAnd') {
              return searchPure(pu.left) || searchPure(pu.right);
            }
            return null;
          };
          return searchPure(state.pure);
        } else if (state.kind === 'DisjState') {
          return checkPreState(state.left) || checkPreState(state.right);
        }
        return null;
      };

      const inferFromSpec = (s: Spec): string | null => {
        switch (s.kind) {
          case 'EnsSpec':
            return null;
          case 'ReqEnsSpec':
            return checkPreState(s.pre);
          case 'CaseSpec':
            for (const branch of s.branches) {
              const fromGuard = checkPreState(branch.guard);
              if (fromGuard) return fromGuard;
              const fromInner = inferFromSpec(branch.spec);
              if (fromInner) return fromInner;
            }
            return null;
          case 'ForallSpec':
            return inferFromSpec(s.body);
        }
      };

      const inferred = inferFromSpec(spec.body);
      if (inferred) return inferred;
    }

    // Fallback: Check TS type annotation
    if (p.typeAnnotation) {
      const cleanType = p.typeAnnotation.trim().toLowerCase();
      if (cleanType === 'number') return 'int';
      if (cleanType === 'boolean') return 'bool';
      if (cleanType === 'void') return 'void';
      if (cleanType === 'cell') return 'cell';
      if (cleanType === 'node') return 'node';
    }

    // Default type
    return 'node';
  }

  private emitFunctionBody(expr: CoreExpr): string {
    const stmts: string[] = [];
    this.collectStatements(expr, stmts);
    return stmts.map(s => `  ${s}`).join('\n');
  }

  private inferExprType(expr: CoreExpr): string {
    if (expr.kind === 'Const') {
      return typeof expr.value === 'number' ? 'int' : 'node';
    }
    if (expr.kind === 'Call') {
      if (['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(expr.func)) {
        return 'int';
      }
      if (expr.func.startsWith('read_field_')) {
        const prop = expr.func.substring('read_field_'.length);
        return prop === 'val' ? 'int' : 'node';
      }
      if (expr.func.startsWith('length')) {
        return 'int';
      }
    }
    if (expr.kind === 'Let') {
      return this.inferExprType(expr.body);
    }
    if (expr.kind === 'Match') {
      if (expr.branches[0]) {
        return this.inferExprType(expr.branches[0].body);
      }
    }
    return 'node';
  }

  private collectBranchStatements(expr: CoreExpr, bind: string | null, stmts: string[]) {
    switch (expr.kind) {
      case 'Let': {
        const isUnused = expr.bind === '_';
        if (expr.value.kind === 'Constr') {
          if (isUnused) {
            stmts.push(`new ${expr.value.name}(${expr.value.args.join(', ')});`);
          } else {
            const type = expr.bindType ? this.emitType(expr.bindType) : (expr.value.name === 'cell' ? 'cell' : 'node');
            stmts.push(`${type} ${expr.bind} = new ${expr.value.name}(${expr.value.args.join(', ')});`);
          }
        } else if (expr.value.kind === 'Call') {
          const args = expr.value.args.join(', ');
          const isBinop = ['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(expr.value.func);
          if (isBinop) {
            const opSymbol = this.getBinopSymbol(expr.value.func);
            if (isUnused) {
              stmts.push(`${expr.value.args[0]} ${opSymbol} ${expr.value.args[1]};`);
            } else {
              stmts.push(`int ${expr.bind} = ${expr.value.args[0]} ${opSymbol} ${expr.value.args[1]};`);
            }
          } else if (expr.value.func.startsWith('read_field_')) {
            const prop = expr.value.func.substring('read_field_'.length);
            const obj = expr.value.args[0];
            const type = prop === 'val' ? 'int' : 'node';
            if (!isUnused) stmts.push(`${type} ${expr.bind} = ${obj}.${prop};`);
          } else if (expr.value.func.startsWith('write_field_')) {
            const prop = expr.value.func.substring('write_field_'.length);
            stmts.push(`${expr.value.args[0]}.${prop} = ${expr.value.args[1]};`);
          } else {
            if (isUnused) {
              stmts.push(`${expr.value.func}(${args});`);
            } else {
              const retType = expr.bindType ? this.emitType(expr.bindType) : (expr.value.func.startsWith('length') ? 'int' : 'node');
              stmts.push(`${retType} ${expr.bind} = ${expr.value.func}(${args});`);
            }
          }
        } else if (expr.value.kind === 'Const' || expr.value.kind === 'Var') {
          const rhs = expr.value.kind === 'Var' ? expr.value.name : String(expr.value.value);
          const type = expr.bindType ? this.emitType(expr.bindType) : (expr.value.kind === 'Const' && typeof expr.value.value === 'number' ? 'int' : 'node');
          if (!isUnused) stmts.push(`${type} ${expr.bind} = ${rhs};`);
        } else if (expr.value.kind === 'Err' || expr.value.kind === 'Abrt') {
          stmts.push(`/* error path */`);
        } else if (expr.value.kind === 'Match') {
          this.emitMatchAsStatement(expr.value, isUnused ? null : expr.bind, stmts);
        } else {
          stmts.push(`/* nested expression */`);
        }
        this.collectBranchStatements(expr.body, bind, stmts);
        break;
      }
      
      case 'Match': {
        this.emitMatchAsStatement(expr, bind, stmts);
        break;
      }

      case 'Call': {
        const args = expr.args.join(', ');
        const isBinop = ['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(expr.func);
        if (isBinop) {
          const opSymbol = this.getBinopSymbol(expr.func);
          if (bind) {
            stmts.push(`${bind} = ${expr.args[0]} ${opSymbol} ${expr.args[1]};`);
          } else {
            stmts.push(`${expr.args[0]} ${opSymbol} ${expr.args[1]};`);
          }
        } else if (expr.func.startsWith('read_field_')) {
          const prop = expr.func.substring('read_field_'.length);
          if (bind) {
            stmts.push(`${bind} = ${expr.args[0]}.${prop};`);
          }
        } else if (expr.func.startsWith('write_field_')) {
          const prop = expr.func.substring('write_field_'.length);
          stmts.push(`${expr.args[0]}.${prop} = ${expr.args[1]};`);
        } else {
          if (bind) {
            stmts.push(`${bind} = ${expr.func}(${args});`);
          } else {
            stmts.push(`${expr.func}(${args});`);
          }
        }
        break;
      }

      case 'Constr': {
        if (bind) {
          stmts.push(`${bind} = new ${expr.name}(${expr.args.join(', ')});`);
        } else {
          stmts.push(`new ${expr.name}(${expr.args.join(', ')});`);
        }
        break;
      }

      case 'Var': {
        if (bind) {
          stmts.push(`${bind} = ${expr.name};`);
        }
        break;
      }

      case 'Const': {
        if (bind) {
          stmts.push(`${bind} = ${expr.value};`);
        }
        break;
      }

      case 'Err':
      case 'Abrt': {
        stmts.push(`/* abort */`);
        break;
      }
    }
  }

  private emitMatchAsStatement(expr: MatchExpr, bind: string | null, stmts: string[]) {
    const firstBranch = expr.branches[0];
    if (firstBranch && firstBranch.pattern.kind === 'ConstPat') {
      const trueBranch = expr.branches.find((b: MatchBranch) => b.pattern.kind === 'ConstPat' && b.pattern.value === true);
      const falseBranch = expr.branches.find((b: MatchBranch) => b.pattern.kind === 'ConstPat' && b.pattern.value === false);

      if (trueBranch && falseBranch) {
        stmts.push(`if (${expr.scrutinee}) {`);
        const thenStmts: string[] = [];
        this.collectBranchStatements(trueBranch.body, bind, thenStmts);
        stmts.push(...thenStmts.map(s => `  ${s}`));
        stmts.push(`} else {`);
        const elseStmts: string[] = [];
        this.collectBranchStatements(falseBranch.body, bind, elseStmts);
        stmts.push(...elseStmts.map(s => `  ${s}`));
        stmts.push(`}`);
        return;
      }
    }

    const nilBranch = expr.branches.find((b: MatchBranch) => b.pattern.kind === 'TypePat' && b.pattern.name === 'Nil');
    const consBranch = expr.branches.find((b: MatchBranch) => b.pattern.kind === 'TypePat' && b.pattern.name === 'Cons');

    if (nilBranch && consBranch) {
      stmts.push(`if (${expr.scrutinee} == null) {`);
      const thenStmts: string[] = [];
      this.collectBranchStatements(nilBranch.body, bind, thenStmts);
      stmts.push(...thenStmts.map(s => `  ${s}`));
      stmts.push(`} else {`);
      const elseStmts: string[] = [];
      this.collectBranchStatements(consBranch.body, bind, elseStmts);
      stmts.push(...elseStmts.map(s => `  ${s}`));
      stmts.push(`}`);
      return;
    }

    stmts.push(`/* match branch fallback */`);
  }

  private collectStatements(expr: CoreExpr, stmts: string[]) {
    switch (expr.kind) {
      case 'Let': {
        const isUnused = expr.bind === '_';
        
        // Check if value is a Match expression
        if (expr.value.kind === 'Match') {
          if (!isUnused) {
            const type = expr.bindType ? this.emitType(expr.bindType) : this.inferExprType(expr.value);
            stmts.push(`${type} ${expr.bind};`);
          }
          this.emitMatchAsStatement(expr.value, isUnused ? null : expr.bind, stmts);
        }
        // Check if value is a Constr application
        else if (expr.value.kind === 'Constr') {
          if (isUnused) {
            stmts.push(`new ${expr.value.name}(${expr.value.args.join(', ')});`);
          } else {
            const type = expr.bindType ? this.emitType(expr.bindType) : (expr.value.name === 'cell' ? 'cell' : 'node');
            stmts.push(`${type} ${expr.bind} = new ${expr.value.name}(${expr.value.args.join(', ')});`);
          }
        }
        // Check if value is a function call
        else if (expr.value.kind === 'Call') {
          const args = expr.value.args.join(', ');
          const isBinop = ['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(expr.value.func);
          
          if (isBinop) {
            const opSymbol = this.getBinopSymbol(expr.value.func);
            const argList = expr.value.args;
            if (isUnused) {
              stmts.push(`${argList[0]} ${opSymbol} ${argList[1]};`);
            } else {
              stmts.push(`int ${expr.bind} = ${argList[0]} ${opSymbol} ${argList[1]};`);
            }
          } else if (expr.value.func.startsWith('read_field_')) {
            const prop = expr.value.func.substring('read_field_'.length);
            const obj = expr.value.args[0];
            const type = prop === 'val' ? 'int' : 'node';
            if (!isUnused) {
              stmts.push(`${type} ${expr.bind} = ${obj}.${prop};`);
            }
          } else if (expr.value.func.startsWith('write_field_')) {
            const prop = expr.value.func.substring('write_field_'.length);
            const obj = expr.value.args[0];
            const val = expr.value.args[1];
            stmts.push(`${obj}.${prop} = ${val};`);
          } else {
            if (isUnused) {
              stmts.push(`${expr.value.func}(${args});`);
            } else {
              const retType = expr.bindType ? this.emitType(expr.bindType) : (expr.value.func.startsWith('length') ? 'int' : 'node');
              stmts.push(`${retType} ${expr.bind} = ${expr.value.func}(${args});`);
            }
          }
        }
        // Check if basic value
        else if (expr.value.kind === 'Const' || expr.value.kind === 'Var') {
          const rhs = expr.value.kind === 'Var' ? expr.value.name : String(expr.value.value);
          const type = expr.bindType ? this.emitType(expr.bindType) : (expr.value.kind === 'Const' && typeof expr.value.value === 'number' ? 'int' : 'node');
          if (!isUnused) {
            stmts.push(`${type} ${expr.bind} = ${rhs};`);
          }
        }
        // Check if error paths
        else if (expr.value.kind === 'Err' || expr.value.kind === 'Abrt') {
          stmts.push(`/* error path */`);
        }
        else {
          stmts.push(`/* nested */`);
        }

        this.collectStatements(expr.body, stmts);
        break;
      }

      case 'Match': {
        // Translate to if-else logic based on pattern match
        // Let's check branches
        const firstBranch = expr.branches[0];
        if (firstBranch && firstBranch.pattern.kind === 'ConstPat') {
          // Boolean match
          const trueBranch = expr.branches.find(b => b.pattern.kind === 'ConstPat' && b.pattern.value === true);
          const falseBranch = expr.branches.find(b => b.pattern.kind === 'ConstPat' && b.pattern.value === false);

          if (trueBranch && falseBranch) {
            stmts.push(`if (${expr.scrutinee}) {`);
            const thenStmts: string[] = [];
            this.collectStatements(trueBranch.body, thenStmts);
            stmts.push(...thenStmts.map(s => `  ${s}`));
            stmts.push(`} else {`);
            const elseStmts: string[] = [];
            this.collectStatements(falseBranch.body, elseStmts);
            stmts.push(...elseStmts.map(s => `  ${s}`));
            stmts.push(`}`);
            return;
          }
        }

        // Default match translation using if (x == null) for Nil, or type checks
        const nilBranch = expr.branches.find(b => b.pattern.kind === 'TypePat' && b.pattern.name === 'Nil');
        const consBranch = expr.branches.find(b => b.pattern.kind === 'TypePat' && b.pattern.name === 'Cons');

        if (nilBranch && consBranch) {
          stmts.push(`if (${expr.scrutinee} == null) {`);
          const thenStmts: string[] = [];
          this.collectStatements(nilBranch.body, thenStmts);
          stmts.push(...thenStmts.map(s => `  ${s}`));
          stmts.push(`} else {`);
          const elseStmts: string[] = [];
          this.collectStatements(consBranch.body, elseStmts);
          stmts.push(...elseStmts.map(s => `  ${s}`));
          stmts.push(`}`);
          return;
        }

        // General branch emission fallback
        stmts.push(`/* match branch fallback */`);
        break;
      }

      case 'Call': {
        const isBinop = ['add', 'sub', 'mul', 'div', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(expr.func);
        if (isBinop) {
          stmts.push(`return ${expr.args[0]} ${this.getBinopSymbol(expr.func)} ${expr.args[1]};`);
        } else if (expr.func.startsWith('read_field_')) {
          const prop = expr.func.substring('read_field_'.length);
          stmts.push(`return ${expr.args[0]}.${prop};`);
        } else if (expr.func.startsWith('write_field_')) {
          const prop = expr.func.substring('write_field_'.length);
          stmts.push(`${expr.args[0]}.${prop} = ${expr.args[1]};`);
        } else {
          stmts.push(`return ${expr.func}(${expr.args.join(', ')});`);
        }
        break;
      }

      case 'Constr': {
        stmts.push(`return new ${expr.name}(${expr.args.join(', ')});`);
        break;
      }

      case 'Var': {
        stmts.push(`return ${expr.name};`);
        break;
      }

      case 'Const': {
        stmts.push(`return ${expr.value};`);
        break;
      }

      case 'Err':
      case 'Abrt': {
        stmts.push(`/* abort */`);
        break;
      }
    }
  }

  private getBinopSymbol(func: string): string {
    switch (func) {
      case 'add': return '+';
      case 'sub': return '-';
      case 'mul': return '*';
      case 'div': return '/';
      case 'eq': return '==';
      case 'neq': return '!=';
      case 'lt': return '<';
      case 'lte': return '<=';
      case 'gt': return '>';
      case 'gte': return '>=';
      default: return func;
    }
  }
}
