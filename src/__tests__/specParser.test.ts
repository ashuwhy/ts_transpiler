// src/__tests__/specParser.test.ts
import { describe, it, expect } from 'vitest';
import { SpecParser } from '../parser/specParser.js';

describe('Spec Parser Tests', () => {
  it('should parse basic types', () => {
    const tInt = SpecParser.parseTypeStr('Int');
    expect(tInt).toEqual({ kind: 'Prim', name: 'Int' });

    const tRef = SpecParser.parseTypeStr('Ref(Int)');
    expect(tRef).toEqual({
      kind: 'RefType',
      inner: { kind: 'Prim', name: 'Int' }
    });

    const tSep = SpecParser.parseTypeStr('↦Int');
    expect(tSep).toEqual({
      kind: 'SepType',
      inner: { kind: 'Prim', name: 'Int' }
    });

    const tConj = SpecParser.parseTypeStr('Int ∧ Bool');
    expect(tConj).toEqual({
      kind: 'AndType',
      left: { kind: 'Prim', name: 'Int' },
      right: { kind: 'Prim', name: 'Bool' }
    });
  });

  it('should parse logic heap states', () => {
    const state = SpecParser.parseStateStr('x ↦ Ref(Int) * y ↦ Int & x = y');
    expect(state.kind).toBe('HeapPure');
    if (state.kind === 'HeapPure') {
      expect(state.heap.kind).toBe('SepConj');
      expect(state.pure.kind).toBe('Eq');
    }
  });

  it('should parse case specs', () => {
    const spec = SpecParser.parseSpecStr(`{
      i != j -> requires i::cell<a> * j::cell<b> ensures i::cell<b> * j::cell<a>,
      i = j  -> requires i::cell<a> ensures i::cell<a>
    }`);
    expect(spec.kind).toBe('CaseSpec');
  });

  it('should parse predicate definitions', () => {
    const pred = SpecParser.parsePredDefStr('List(T) = Nil ∨ Cons(T, List(T))');
    expect(pred.kind).toBe('PredDef');
    expect(pred.name).toBe('List');
    expect(pred.typeParams).toEqual(['T']);
  });

  it('should parse MList predicate', () => {
    const pred = SpecParser.parsePredDefStr('MList(T) = Nil ∨ ∃r, r1. Cons(T, r) ∗ r ↦ Ref(r1) ∗ r1 ↦ MList(T)');
    expect(pred.kind).toBe('PredDef');
  });

  it('should parse predicate with arithmetic constraints', () => {
    const pred = SpecParser.parsePredDefStr('List(T, n) = Nil ∧ n = 0 ∨ ∃m. Cons(T, r) & r:List(T, m) & n = m + 1');
    expect(pred.kind).toBe('PredDef');
  });

  it('should parse function spec with arithmetic', () => {
    const spec = SpecParser.parseSpecStr('requires xs: List(T, s) & s > 0 ensures res: T');
    expect(spec.kind).toBe('ReqEnsSpec');
  });
});
