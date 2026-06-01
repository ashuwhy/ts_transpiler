// src/translator/walker.ts

import ts from 'typescript';
import { Program, Definition, CoreExpr, Param, FuncSpec, AST, Type, Pattern, PredDef } from '../core/ast.js';
import { extractJSDocSpecs } from '../parser/jsdocExtractor.js';
import { SpecParser } from '../parser/specParser.js';

import { ANFConverter } from './anf.js';

/**
 * Convert inline record syntax in spec strings to Heifer's constructor notation.
 * Heifer uses `Name[arg1,arg2]` bracket syntax — no named fields, no `{`.
 *
 * `{ x: int, y: int }` → `Rec[int,int]`   (field names dropped, types kept)
 * `{ x: t', y: s' }`   → `Rec[t',s']`     (type variables preserved)
 *
 * Open question for meeting: does Heifer support named field predicates?
 */
export function normalizeRecordSyntax(spec: string): string {
  return spec.replace(/\{\s*([^{}]+?)\s*\}/g, (_match, inner: string) => {
    const types = inner.split(',').map((part: string) => {
      const colonIdx = part.indexOf(':');
      // field:type pair → take the type part; otherwise use whole token
      return (colonIdx >= 0 ? part.slice(colonIdx + 1) : part).trim();
    });
    return `Rec[${types.join(',')}]`;
  });
}

export class ASTWalker {
  private sourceFile: ts.SourceFile;

  constructor(sourceFile: ts.SourceFile) {
    this.sourceFile = sourceFile;
  }

  public walk(): Program {
    const predicates: PredDef[] = [];
    const definitions: Definition[] = [];

    // First, scan for any file-level predicates in JSDoc comments
    this.extractFileLevelPredicates(predicates);

    // Walk top-level statements
    for (const statement of this.sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement)) {
        const def = this.walkFunctionDeclaration(statement);
        definitions.push(def);
        
        // Also extract any @pred declarations associated with the function
        const specs = extractJSDocSpecs(statement, this.sourceFile);
        for (const predStr of specs.preds) {
          try {
            const pred = SpecParser.parsePredDefStr(predStr);
            predicates.push(pred);
          } catch (err: any) {
            console.warn(`[Warning] Failed to parse predicate: "${predStr}". Error: ${err.message}`);
          }
        }
      } else if (ts.isVariableStatement(statement)) {
        // We could extract top-level globals, but for core language we focus on functions and predicates
      }
    }

    return AST.program(predicates, definitions);
  }

  private extractFileLevelPredicates(predicates: PredDef[]) {
    // Scan leading comments of the source file for @pred tags
    const text = this.sourceFile.text;
    const leadingComments = ts.getLeadingCommentRanges(text, 0);
    if (!leadingComments) return;

    for (const range of leadingComments) {
      const commentText = text.substring(range.pos, range.end);
      const lines = commentText.split(/\r?\n/);
      for (const line of lines) {
        const match = line.match(/\*\s*@pred\s+(.*)/);
        if (match) {
          const predStr = match[1].trim();
          try {
            const pred = SpecParser.parsePredDefStr(predStr);
            predicates.push(pred);
          } catch (err: any) {
            console.warn(`[Warning] Failed to parse file-level predicate: "${predStr}". Error: ${err.message}`);
          }
        }
      }
    }
  }

  private walkFunctionDeclaration(node: ts.FunctionDeclaration): Definition {
    const name = node.name ? node.name.text : 'anonymous';
    const params: Param[] = node.parameters.map(p => {
      const pName = p.name.getText(this.sourceFile);
      const pType = p.type ? p.type.getText(this.sourceFile) : undefined;
      return AST.param(pName, pType);
    });

    // Extract specs
    const specs = extractJSDocSpecs(node, this.sourceFile);

    // Build rawSpec directly in Heifer format — bypass SpecParser which doesn't handle #type syntax
    let rawSpec: string | undefined;
    if (specs.requires.length > 0 || specs.ensures.length > 0) {
      const caseCount = Math.max(specs.requires.length, specs.ensures.length, 1);
      const cases: string[] = [];
      for (let i = 0; i < caseCount; i++) {
        const req = specs.requires[i];
        const ens = specs.ensures[i];
        const parts: string[] = [];
        if (req) parts.push(`req ${normalizeRecordSyntax(req)}`);
        if (ens) parts.push(`ens ${normalizeRecordSyntax(ens)}`);
        cases.push(parts.join('; '));
      }
      const casesStr = cases.join('\n  $ ');
      rawSpec = specs.foralls.length > 0
        ? `forall ${specs.foralls[0]} ${casesStr}`
        : casesStr;
    }

    const funcSpec: FuncSpec | null = null;

    // Parse body
    let bodyExpr: CoreExpr = AST.constExpr(0); // default fallback
    if (node.body) {
      bodyExpr = this.walkBlock(node.body);
    }

    const anfConverter = new ANFConverter();
    const anfBody = anfConverter.convert(bodyExpr);

    const returnTypeAnnotation = node.type ? node.type.getText(this.sourceFile) : undefined;
    return AST.def(name, params, anfBody, funcSpec, returnTypeAnnotation, rawSpec);
  }

  private walkBlock(node: ts.Block): CoreExpr {
    return this.walkStatements(node.statements, 0);
  }

  private walkStatements(statements: ts.NodeArray<ts.Statement>, index: number): CoreExpr {
    if (index >= statements.length) {
      return AST.constExpr(0); // Unit / 0
    }

    const stmt = statements[index];

    if (ts.isReturnStatement(stmt)) {
      if (stmt.expression) {
        return this.walkExpression(stmt.expression);
      }
      return AST.constExpr(0);
    }

    if (ts.isVariableStatement(stmt)) {
      const declList = stmt.declarationList;
      // We only support single declarations for simplicity, but can loop if multiple
      const decl = declList.declarations[0];
      const bindName = decl.name.getText(this.sourceFile);
      const valExpr = decl.initializer ? this.walkExpression(decl.initializer) : AST.constExpr(0);
      const restExpr = this.walkStatements(statements, index + 1);
      
      let bindType: Type | undefined;
      if (decl.type) {
        try {
          bindType = SpecParser.parseTypeStr(decl.type.getText(this.sourceFile));
        } catch {}
      }

      return AST.letExpr(bindName, valExpr, restExpr, bindType);
    }

    if (ts.isExpressionStatement(stmt)) {
      const expr = this.walkExpression(stmt.expression);
      if (index === statements.length - 1) {
        return expr;
      }
      // desugar statement execution as: let _unused = expr in rest
      const restExpr = this.walkStatements(statements, index + 1);
      return AST.letExpr('_', expr, restExpr);
    }

    if (ts.isIfStatement(stmt)) {
      // Translate if-statement
      // if (cond) then else
      const cond = this.walkExpression(stmt.expression);
      const thenBranch = stmt.thenStatement;
      const elseBranch = stmt.elseStatement;

      const thenExpr = ts.isBlock(thenBranch) ? this.walkBlock(thenBranch) : this.walkStatements(ts.factory.createNodeArray([thenBranch]), 0);
      const elseExpr = elseBranch
        ? (ts.isBlock(elseBranch) ? this.walkBlock(elseBranch) : this.walkStatements(ts.factory.createNodeArray([elseBranch]), 0))
        : AST.varExpr('()');

      let ifExpr: CoreExpr;
      // If condition is `x instanceof T`, translate to pattern match!
      if (ts.isBinaryExpression(stmt.expression) && stmt.expression.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
        const leftVar = stmt.expression.left.getText(this.sourceFile);
        const rightType = stmt.expression.right.getText(this.sourceFile);

        // Pattern matches: T and ¬T
        ifExpr = AST.matchExpr(leftVar, [
          AST.branch(AST.typePat(rightType), thenExpr),
          AST.branch(AST.notPat(AST.typePat(rightType)), elseExpr)
        ]);
      } else {
        // Default: boolean pattern match
        // match cond { true -> thenExpr | false -> elseExpr }
        // In ANF this will be lifted
        ifExpr = AST.letExpr('_cond', cond, AST.matchExpr('_cond', [
          AST.branch(AST.constPat(true), thenExpr),
          AST.branch(AST.constPat(false), elseExpr)
        ]));
      }

      if (index === statements.length - 1) {
        return ifExpr;
      }
      const restExpr = this.walkStatements(statements, index + 1);
      return AST.letExpr('_', ifExpr, restExpr);
    }

    if (ts.isThrowStatement(stmt)) {
      // check if throw new Error() or similar
      return AST.errExpr();
    }

    // Default statement walker fallback
    return this.walkStatements(statements, index + 1);
  }

  private walkExpression(node: ts.Expression): CoreExpr {
    if (ts.isParenthesizedExpression(node)) {
      return this.walkExpression(node.expression);
    }

    if (node.kind === ts.SyntaxKind.NullKeyword ||
        node.kind === ts.SyntaxKind.UndefinedKeyword) {
      return AST.constExpr('null');
    }

    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (name === 'undefined' || name === 'null') return AST.constExpr('null');
      return AST.varExpr(name);
    }

    if (ts.isNumericLiteral(node)) {
      return AST.constExpr(Number(node.text));
    }

    if (ts.isStringLiteral(node)) {
      return AST.constExpr(node.text);
    }

    if (node.kind === ts.SyntaxKind.TrueKeyword) {
      return AST.constExpr(true);
    }

    if (node.kind === ts.SyntaxKind.FalseKeyword) {
      return AST.constExpr(false);
    }

    if (ts.isPropertyAccessExpression(node)) {
      const obj = this.walkExpression(node.expression);
      const prop = node.name.text;
      return {
        kind: 'Call',
        func: `read_field_${prop}`,
        args: [obj] as any
      };
    }

    // Object literals — dispatch on shape:
    //   {val: x}             → ref x        (single heap ref)
    //   {val: h, next: t}    → h :: t       (list cons cell)
    //   {f1: v1, f2: v2, …}  → RecordExpr   (general record)
    if (ts.isObjectLiteralExpression(node)) {
      const props: Record<string, CoreExpr> = {};
      const orderedKeys: string[] = [];
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const key = prop.name.getText(this.sourceFile);
          props[key] = this.walkExpression(prop.initializer);
          orderedKeys.push(key);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          // { x, y } shorthand → treat as { x: x, y: y }
          const key = prop.name.text;
          props[key] = AST.varExpr(key);
          orderedKeys.push(key);
        }
      }
      if (orderedKeys.length === 1 && props['val']) {
        return { kind: 'Call', func: 'ref', args: [props['val']] as any };
      }
      if (orderedKeys.length === 2 && props['val'] && props['next']) {
        return { kind: 'Call', func: 'cons_cell', args: [props['val'], props['next']] as any };
      }
      // General record — ANF will lift field values to variables
      return {
        kind: 'Record',
        fields: orderedKeys.map(k => ({ name: k, value: props[k] as any }))
      } as any;
    }

    if (ts.isNewExpression(node)) {
      // constructor application new Cons(h, t)
      const className = node.expression.getText(this.sourceFile);
      // We first walk nested expressions. ANF will lift them later
      const args = node.arguments ? node.arguments.map(arg => this.walkExpression(arg)) : [];
      
      // Temporary construct node (args are nested expressions, not just variables)
      // This is allowed in "Full" AST but will be normalized by anf.ts
      return {
        kind: 'Constr',
        name: className,
        args: args as any // walker generates temp nested args, anf.ts lifts them
      };
    }

    if (ts.isCallExpression(node)) {
      const funcName = node.expression.getText(this.sourceFile);
      const args = node.arguments.map(arg => this.walkExpression(arg));
      return {
        kind: 'Call',
        func: funcName,
        args: args as any // walker generates temp nested args, anf.ts lifts them
      };
    }

    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      const expr = ts.isAsExpression(node) ? node.expression : node.expression;
      const typeNode = ts.isAsExpression(node) ? node.type : node.type;

      // x as { f: T, … } → Cast to RecordType
      if (ts.isTypeLiteralNode(typeNode)) {
        const fields: { name: string; type: Type }[] = [];
        for (const member of typeNode.members) {
          if (ts.isPropertySignature(member) && member.type) {
            const fname = member.name.getText(this.sourceFile);
            try {
              const ftype = SpecParser.parseTypeStr(member.type.getText(this.sourceFile));
              fields.push({ name: fname, type: ftype });
            } catch {
              fields.push({ name: fname, type: AST.anyType() });
            }
          }
        }
        if (fields.length > 0) {
          return {
            kind: 'Cast',
            targetType: AST.recordType(fields),
            arg: this.walkExpression(expr) as any
          };
        }
      }

      const typeStr = typeNode.getText(this.sourceFile);
      try {
        const parsedType = SpecParser.parseTypeStr(typeStr);
        return {
          kind: 'Cast',
          targetType: parsedType,
          arg: this.walkExpression(expr) as any
        };
      } catch {
        return this.walkExpression(expr);
      }
    }

    // `!expr` — truthy negation; in TypeHL context usually a null/empty check
    if (ts.isPrefixUnaryExpression(node) &&
        node.operator === ts.SyntaxKind.ExclamationToken) {
      const inner = this.walkExpression(node.operand);
      return { kind: 'Call', func: 'not_truthy', args: [inner] as any };
    }

    // Arrow function `(x) => body` — emit as OCaml fun
    if (ts.isArrowFunction(node)) {
      const params = node.parameters.map(p => p.name.getText(this.sourceFile));
      const body = ts.isBlock(node.body)
        ? this.walkBlock(node.body as ts.Block)
        : this.walkExpression(node.body as ts.Expression);
      return AST.lambdaExpr(params, body, null as any);
    }

    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.getText(this.sourceFile);
      if (op === '=') {
        if (ts.isPropertyAccessExpression(node.left)) {
          const obj = this.walkExpression(node.left.expression);
          const prop = node.left.name.text;
          const val = this.walkExpression(node.right);
          return {
            kind: 'Call',
            func: `write_field_${prop}`,
            args: [obj, val] as any
          };
        }
      }
      
      // standard binary operators like arithmetic, comparisons
      const left = this.walkExpression(node.left);
      const right = this.walkExpression(node.right);
      
      // Translate to standard function call e.g. add(left, right) or eq(left, right)
      // This is a typical compiler technique for core languages that only have constructor and call
      return {
        kind: 'Call',
        func: this.getBinaryOpName(op),
        args: [left, right] as any // temporary nested args
      };
    }

    // Default expression walker fallback
    return AST.constExpr(0);
  }

  private getBinaryOpName(op: string): string {
    switch (op) {
      case '+': return 'add';
      case '-': return 'sub';
      case '*': return 'mul';
      case '/': return 'div';
      case '==':
      case '===': return 'eq';
      case '!=':
      case '!==': return 'neq';
      case '<': return 'lt';
      case '<=': return 'lte';
      case '>': return 'gt';
      case '>=': return 'gte';
      default: return `op_${op}`;
    }
  }
}
