// src/__tests__/anf.test.ts
import { describe, it, expect } from 'vitest';
import { ANFConverter } from '../translator/anf.js';
import { AST } from '../core/ast.js';

describe('ANF Let-Binding Flattening', () => {
  it('should not alter simple variables or constants', () => {
    const converter = new ANFConverter();
    const vExpr = AST.varExpr('x');
    const cExpr = AST.constExpr(42);

    expect(converter.convert(vExpr)).toEqual(vExpr);
    expect(converter.convert(cExpr)).toEqual(cExpr);
  });

  it('should flatten left-nested let bindings (let-associativity)', () => {
    const converter = new ANFConverter();
    // Represent: let x = (let y = 1 in y) in x
    const nestedLet = AST.letExpr(
      'x',
      AST.letExpr('y', AST.constExpr(1), AST.varExpr('y')),
      AST.varExpr('x')
    );

    const result = converter.convert(nestedLet);

    // Expected right-nested: let y = 1 in let x = y in x
    const expected = AST.letExpr(
      'y',
      AST.constExpr(1),
      AST.letExpr('x', AST.varExpr('y'), AST.varExpr('x'))
    );

    expect(result).toEqual(expected);
  });

  it('should recursively flatten multiple left-nested let bindings', () => {
    const converter = new ANFConverter();
    // Represent: let x = (let y = (let z = 1 in z) in y) in x
    const nestedLet = AST.letExpr(
      'x',
      AST.letExpr(
        'y',
        AST.letExpr('z', AST.constExpr(1), AST.varExpr('z')),
        AST.varExpr('y')
      ),
      AST.varExpr('x')
    );

    const result = converter.convert(nestedLet);

    // Expected right-nested: let z = 1 in let y = z in let x = y in x
    const expected = AST.letExpr(
      'z',
      AST.constExpr(1),
      AST.letExpr(
        'y',
        AST.varExpr('z'),
        AST.letExpr('x', AST.varExpr('y'), AST.varExpr('x'))
      )
    );

    expect(result).toEqual(expected);
  });
});
