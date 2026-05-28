#!/usr/bin/env tsx
// Generate implOcaml for all web examples — paste output into lib/examples.ts

import ts from 'typescript';
import { ASTWalker } from '../src/translator/walker.js';
import { HeiferEmitter } from '../src/emitter/heiferEmitter.js';

function gen(code: string): string {
  try {
    const sf = ts.createSourceFile('inline.ts', code, ts.ScriptTarget.Latest, true);
    const prog = new ASTWalker(sf).walk();
    return new HeiferEmitter().emit(prog).trim();
  } catch (e: any) {
    return `(* translation error: ${e.message} *)`;
  }
}

const snippets: Record<string, string> = {
  plus: `/**
 * @req x:#int /\\ y:#int
 * @ens res:#int
 */
function plus(x: number, y: number): number { return x + y; }`,

  deref: `/**
 * @req x:#Ref[t']
 * @ens res:#t'
 * @req x->#Ref[t']
 * @ens x->#Ref[t'] /\\ res:#t'
 */
function deref(x: any): any { return (x as any).val; }`,

  inc_inplace: `/**
 * @req x->#Ref[int]
 * @ens x->#Ref[str]
 */
function inc_inplace(x: any): void { (x as any).val = String((x as any).val + 1); }`,

  swap: `/**
 * @req x->#Ref[a'] /\\ x=y
 * @ens x->#Ref[a'] /\\ x=y
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[b'] * y->#Ref[a']
 */
function swap(x: any, y: any): void {
  const v1 = (x as any).val; const v2 = (y as any).val;
  (x as any).val = v2; (y as any).val = v1;
}`,

  tail: `/**
 * @req x:#Cons[t',List[t']]
 * @ens res:#List[t']
 * @req x:#Nil[]
 * @ens res:#Err[]
 */
function tail(x: any): any { if (x === null) throw new Error("empty"); return x.next; }`,

  id2: `/**
 * @forall t.
 * @req y:#t'
 * @ens res:#t'
 */
function id2(y: any): any { return y; }`,

  make_ref: `/**
 * @req x:#a'
 * @ens res->#Ref[x] /\\ x:#a'
 */
function make_ref(x: any): any { return { val: x }; }`,

  update: `/**
 * @req m->#Ref[t'] /\\ v:#a'
 * @ens m->#Ref[a']
 */
function update(m: any, v: any): void { (m as any).val = v; }`,

  list_seg: `/**
 * @req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]
 * @ens x->#List[int] /\\ res=x
 */
function list_seg(x: any): any { return x; }`,

  map: `/**
 * @rec
 * @req f:#Any /\\ xs:#Nil[]
 * @ens res:#Nil[]
 * @req f:#(a'->b') /\\ xs:#Cons[a',List[a']]
 * @ens res:#Cons[b',List[b']]
 */
function map(f: any, xs: any): any {
  if (!xs) return null;
  return { val: f(xs.val), next: map(f, xs.next) };
}`,

  partial_app: `/**
 * @req plus:#(int->int->int) /\\ x:#int
 * @ens res:#int->int
 */
function partial_app(x: number): any { return (y: number) => x + y; }`,

  two_pointer: `/**
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[Ref[b']]
 * @req x->#Ref[a'] /\\ x=y
 * @ens x->#Ref[y] /\\ x=y
 */
function two_pointer(x: any, y: any): void { (x as any).val = y; }`,
};

for (const [id, code] of Object.entries(snippets)) {
  const out = gen(code);
  console.log(`  // ${id}`);
  console.log(`  ${JSON.stringify(out)},`);
  console.log();
}
