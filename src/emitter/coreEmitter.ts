// src/emitter/coreEmitter.ts

import { Emitter } from './emitterInterface.js';
import { Program, Definition, CoreExpr, Type, Pattern, Spec, State, Heap, Pure, PredDef } from '../core/ast.js';

export class CoreEmitter implements Emitter {
  readonly formatName = 'core';
  readonly fileExtension = 'txt';

  public emit(program: Program): string {
    const lines: string[] = [];

    // Predicates first
    for (const pred of program.predicates) {
      lines.push(this.emitPredDef(pred));
    }
    if (program.predicates.length > 0) {
      lines.push('');
    }

    // Definitions
    for (const def of program.definitions) {
      lines.push(this.emitDefinition(def));
      lines.push('');
    }

    return lines.join('\n');
  }

  private emitPredDef(pred: PredDef): string {
    const params = pred.typeParams.length > 0 ? `(${pred.typeParams.join(',')})` : '';
    const sep = pred.isSeparation ? '↦' : ':';
    return `pred ${pred.selfVar}${sep}${pred.name}${params} =\n  ${this.emitState(pred.body)}`;
  }

  private emitDefinition(def: Definition): string {
    const paramList = def.params.map(p => p.name).join(' ');
    const paramsPrefix = paramList ? ` ${paramList}` : '';
    const bodyStr = this.emitExpr(def.body);
    
    let specStr = '';
    if (def.spec) {
      const qStr = def.spec.quantifiers.length > 0
        ? `∀${def.spec.quantifiers.map(q => q.name + (q.bound ? `:${q.bound}` : '')).join(',')}. `
        : '';
      const paramsList = def.spec.params.join(' ');
      specStr = `\n  where ${def.name} ::\n    ${qStr}λ ${paramsList} ${def.spec.result} .\n      ${this.emitSpec(def.spec.body, '      ')}`;
    }

    return `def ${def.name}${paramsPrefix} =\n  ${bodyStr}${specStr}`;
  }

  private emitExpr(expr: CoreExpr): string {
    switch (expr.kind) {
      case 'Var':
        return expr.name;
      case 'Const':
        return typeof expr.value === 'string' ? `"${expr.value}"` : String(expr.value);
      case 'Err':
        return 'err';
      case 'Abrt':
        return 'abrt';
      
      case 'Let': {
        const typeAnn = expr.bindType ? `: ${this.emitType(expr.bindType)}` : '';
        return `let ${expr.bind}${typeAnn} = ${this.emitExpr(expr.value)} in ${this.emitExpr(expr.body)}`;
      }
      
      case 'Constr': {
        return `${expr.name}(${expr.args.join(', ')})`;
      }
      
      case 'Call': {
        return `(${expr.func} ${expr.args.join(' ')})`;
      }
      
      case 'Cast': {
        return `(${this.emitType(expr.targetType)}) ${expr.arg}`;
      }
      
      case 'Match': {
        const branches = expr.branches.map(b => {
          return `${this.emitPattern(b.pattern)} → ${this.emitExpr(b.body)}`;
        });
        return `match ${expr.scrutinee} { ${branches.join(' | ')} }`;
      }

      case 'Lambda': {
        const paramsList = expr.params.join(' ');
        const specStr = expr.spec
          ? ` :: λ ${expr.spec.params.join(' ')} ${expr.spec.result} . ${this.emitSpec(expr.spec.body)}`
          : '';
        return `λ ${paramsList} . ${this.emitExpr(expr.body)}${specStr}`;
      }
    }
  }

  private emitSpec(spec: Spec, indent = ''): string {
    switch (spec.kind) {
      case 'EnsSpec': {
        return `ens[${spec.result}] ${this.emitState(spec.post)}`;
      }
      case 'ReqEnsSpec': {
        const pList = spec.params.length > 0 ? `[${spec.params.join(',')}]` : '';
        return `req${pList} ${this.emitState(spec.pre)} ens[${spec.result}] ${this.emitState(spec.post)}`;
      }
      case 'CaseSpec': {
        const pList = spec.params.length > 0 ? `[${spec.params.join(',')}]` : '';
        const branches = spec.branches.map(b => {
          return `${indent}  ${this.emitState(b.guard)} → ${this.emitSpec(b.spec, indent + '  ')}`;
        });
        return `case${pList} {\n${branches.join('\n')}\n${indent}}`;
      }
      case 'ForallSpec': {
        const qVars = spec.vars.map(q => q.name + (q.bound ? `:${q.bound}` : '')).join(',');
        return `∀${qVars} . ${this.emitSpec(spec.body, indent)}`;
      }
    }
  }

  private emitState(state: State): string {
    switch (state.kind) {
      case 'TrueState':
        return '⊤';
      case 'HeapPure': {
        const existsStr = state.exists.length > 0 ? `∃${state.exists.join(',')}. ` : '';
        const heapStr = this.emitHeap(state.heap);
        const pureStr = this.emitPure(state.pure);
        
        if (heapStr === 'emp' && pureStr === 'true') return 'emp';
        if (heapStr === 'emp') return existsStr + pureStr;
        if (pureStr === 'true') return existsStr + heapStr;
        return `${existsStr}${heapStr} ∧ ${pureStr}`;
      }
      case 'DisjState': {
        return `(${this.emitState(state.left)} ∨ ${this.emitState(state.right)})`;
      }
    }
  }

  private emitHeap(heap: Heap): string {
    switch (heap.kind) {
      case 'Emp': return 'emp';
      case 'PointsTo': return `${heap.variable}↦${this.emitType(heap.type)}`;
      case 'SepConj': return `${this.emitHeap(heap.left)} ∗ ${this.emitHeap(heap.right)}`;
    }
  }

  private emitPure(pure: Pure): string {
    switch (pure.kind) {
      case 'PureTrue': return 'true';
      case 'TypeAssert': return `${pure.variable}:${this.emitType(pure.type)}`;
      case 'Eq': return `${pure.left}=${pure.right}`;
      case 'Neq': return `${pure.left}≠${pure.right}`;
      case 'PureAnd': return `(${this.emitPure(pure.left)} ∧ ${this.emitPure(pure.right)})`;
      case 'PureOr': return `(${this.emitPure(pure.left)} ∨ ${this.emitPure(pure.right)})`;
      case 'PureNot': return `¬(${this.emitPure(pure.inner)})`;
      case 'PureExists': return `∃${pure.vars.join(',')}. ${this.emitPure(pure.body)}`;
      case 'Constraint': return `${pure.left}${pure.op}${pure.right}`;
    }
  }

  private emitType(type: Type): string {
    switch (type.kind) {
      case 'SingletonVar': return `{${type.name}}`;
      case 'SingletonConst': return `{${type.value}}`;
      case 'Prim': return type.name;
      case 'RefType': return `Ref(${this.emitType(type.inner)})`;
      case 'ErrType': return 'Err';
      case 'AbrtType': return 'Abrt';
      case 'AnyType': return 'Any';
      case 'AnyPType': return 'AnyP';
      case 'BotType': return '⊥';
      case 'TopType': return '⊤';
      case 'ConstrType': {
        const args = type.args.length > 0 ? `(${type.args.map(a => this.emitType(a)).join(',')})` : '';
        return `${type.name}${args}`;
      }
      case 'PredType': {
        const args = type.args.length > 0 ? `(${type.args.map(a => this.emitType(a)).join(',')})` : '';
        return `${type.name}${args}`;
      }
      case 'TypeVar': return type.name;
      case 'SepType': return `↦${this.emitType(type.inner)}`;
      case 'ArrowType': return `(${this.emitType(type.from)} → ${this.emitType(type.to)})`;
      case 'AndType': return `(${this.emitType(type.left)} ∧ ${this.emitType(type.right)})`;
      case 'OrType': return `(${this.emitType(type.left)} ∨ ${this.emitType(type.right)})`;
      case 'NotType': return `¬(${this.emitType(type.inner)})`;
      case 'WildcardType': return '_';
    }
  }

  private emitPattern(pat: Pattern): string {
    switch (pat.kind) {
      case 'ConstPat': return String(pat.value);
      case 'TypePat': return pat.name;
      case 'ConstrPat': return `${pat.name}(${pat.bindings.join(', ')})`;
      case 'PredPat': return `${pat.name}(_)`;
      case 'ArrowPat': return '_→_';
      case 'AndPat': return `(${this.emitPattern(pat.left)} ∧ ${this.emitPattern(pat.right)})`;
      case 'OrPat': return `(${this.emitPattern(pat.left)} ∨ ${this.emitPattern(pat.right)})`;
      case 'NotPat': return `¬(${this.emitPattern(pat.inner)})`;
      case 'WildcardPat': return '_';
    }
  }
}
