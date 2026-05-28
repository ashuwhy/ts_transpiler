// src/translator/anf.ts

import { CoreExpr, AST, Type } from '../core/ast.js';

export class ANFConverter {
  private counter = 0;

  private freshVar(): string {
    return `_t${this.counter++}`;
  }

  public convert(expr: CoreExpr): CoreExpr {
    this.counter = 0; // reset counter per function definition
    return this.toANF(expr);
  }

  private makeLet(bind: string, value: CoreExpr, body: CoreExpr, bindType?: Type): CoreExpr {
    if (value.kind === 'Let') {
      return this.makeLet(
        value.bind,
        value.value,
        this.makeLet(bind, value.body, body, bindType),
        value.bindType
      );
    }
    return AST.letExpr(bind, value, body, bindType);
  }

  private toANF(expr: CoreExpr): CoreExpr {
    switch (expr.kind) {
      case 'Var':
      case 'Const':
      case 'Err':
      case 'Abrt':
        return expr;

      case 'Let': {
        const valueANF = this.toANF(expr.value);
        const bodyANF = this.toANF(expr.body);
        return this.makeLet(expr.bind, valueANF, bodyANF, expr.bindType);
      }

      case 'Constr': {
        const bindings: { varName: string; expr: CoreExpr }[] = [];
        const normArgs = expr.args.map(arg => {
          const argExpr = arg as unknown as CoreExpr;
          if (argExpr.kind === 'Var') {
            return argExpr.name;
          }
          const normArg = this.toANF(argExpr);
          if (normArg.kind === 'Var') {
            return normArg.name;
          }
          const v = this.freshVar();
          bindings.push({ varName: v, expr: normArg });
          return v;
        });

        let result: CoreExpr = AST.constrExpr(expr.name, normArgs);
        // Nest bindings
        for (let i = bindings.length - 1; i >= 0; i--) {
          result = this.makeLet(bindings[i].varName, bindings[i].expr, result);
        }
        return result;
      }

      case 'Call': {
        const bindings: { varName: string; expr: CoreExpr }[] = [];
        const normArgs = expr.args.map(arg => {
          const argExpr = arg as unknown as CoreExpr;
          if (argExpr.kind === 'Var') {
            return argExpr.name;
          }
          const normArg = this.toANF(argExpr);
          // If normalization reduced to a Var (e.g. transparent Cast), inline directly
          if (normArg.kind === 'Var') {
            return normArg.name;
          }
          const v = this.freshVar();
          bindings.push({ varName: v, expr: normArg });
          return v;
        });

        let result: CoreExpr = AST.callExpr(expr.func, normArgs);
        // Nest bindings
        for (let i = bindings.length - 1; i >= 0; i--) {
          result = this.makeLet(bindings[i].varName, bindings[i].expr, result);
        }
        return result;
      }

      case 'Cast': {
        // Cast is transparent in OCaml — skip the wrapper and normalize inner directly
        return this.toANF(expr.arg as unknown as CoreExpr);
      }

      case 'Match': {
        const normBranches = expr.branches.map(b => ({
          pattern: b.pattern,
          body: this.toANF(b.body)
        }));
        return AST.matchExpr(expr.scrutinee, normBranches);
      }

      case 'Lambda': {
        return AST.lambdaExpr(expr.params, this.toANF(expr.body), expr.spec);
      }
    }
  }
}
