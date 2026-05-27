// examples/type_demo.ts
// Five TypeScript functions with Heifer-type specs in JSDoc.
// Run: tsx scripts/convert.ts examples/type_demo.ts

/**
 * Add two integers.
 * @req x:#int /\ y:#int
 * @ens res:#int
 */
function plus(x: number, y: number): number {
  return x + y;
}

/**
 * Dereference a heap cell — two equivalent specs (value and heap form).
 * @req x:#Ref[t']
 * @ens res:#t'
 * @req x->#Ref[t']
 * @ens x->#Ref[t'] /\ res:#t'
 */
function deref(x: any): any {
  return (x as { val: any }).val;
}

/**
 * Mutate a ref cell: int → str.  Core demonstration of ownership type change.
 * @req x->#Ref[int]
 * @ens x->#Ref[str]
 */
function inc_inplace(x: { val: any }): void {
  x.val = String((x.val as number) + 1);
}

/**
 * Swap two owned heap cells — disjoint-ownership case plus aliased case.
 * @req x->#Ref[a'] /\ x=y
 * @ens x->#Ref[a'] /\ x=y
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[b'] * y->#Ref[a']
 */
function swap(x: any, y: any): void {
  const v1 = x.val;
  const v2 = y.val;
  x.val = v2;
  y.val = v1;
}

/**
 * Tail of a list — multi-case spec returning Err on Nil.
 * @req x:#Cons[t',List[t']]
 * @ens res:#List[t']
 * @req x:#Nil[]
 * @ens res:#Err[]
 */
function tail(x: any): any {
  if (x === null) throw new Error("empty list");
  return x.next;
}
