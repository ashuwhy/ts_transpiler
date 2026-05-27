export interface CachedResult {
  passed: string[]
  failed: string[]
}

export interface Example {
  id: string
  name: string
  description: string
  pattern: string
  tsCode: string
  ocamlSpec: string
  tsVerdict: "rejects" | "imprecise" | "unsound"
  heiferVerdict: string
  cached: CachedResult
}

export const EXAMPLES: Example[] = [
  {
    id: "plus",
    name: "plus",
    description: "Simple integer addition with precise types",
    pattern: "Value types",
    tsCode: `/**
 * Add two integers.
 * @req x:#int /\\ y:#int
 * @ens res:#int
 */
function plus(x: number, y: number): number {
  return x + y;
}`,
    ocamlSpec: `let plus x y = failwith "assume"
 (*@ assume req x:#int /\\ y:#int; ens res:#int @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Verifies: both inputs and output are int",
    cached: { passed: ["plus"], failed: [] },
  },
  {
    id: "deref",
    name: "deref",
    description: "Dereference — heap form vs value form",
    pattern: "Heap ownership",
    tsCode: `/**
 * Read a reference — two equivalent spec forms.
 * @req x:#Ref[t']
 * @ens res:#t'
 * @req x->#Ref[t']
 * @ens x->#Ref[t'] /\\ res:#t'
 */
function deref(x: any): any {
  return (x as any).val;
}`,
    ocamlSpec: `let deref x = failwith "assume"
 (*@ assume req x:#Ref[t']; ens res:#t'
  $ req x->#Ref[t']; ens x->#Ref[t'] /\\ res:#t' @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Two cases: value-form and heap-ownership-form — both verified",
    cached: { passed: ["deref"], failed: [] },
  },
  {
    id: "inc_inplace",
    name: "inc_inplace",
    description: "Type mutation — int cell becomes str cell",
    pattern: "Type-state / ownership mutation",
    tsCode: `/**
 * Mutate heap cell type from int to str.
 * TypeScript REJECTS or loses type info.
 * @req x->#Ref[int]
 * @ens x->#Ref[str]
 */
function inc_inplace(x: any): void {
  (x as any).val = String((x as any).val + 1);
}`,
    ocamlSpec: `let inc_inplace x = failwith "assume"
 (*@ assume req x->#Ref[int]; ens x->#Ref[str] @*)`,
    tsVerdict: "rejects",
    heiferVerdict: "Tracks type change: Ref[int] → Ref[str] across the call",
    cached: { passed: ["inc_inplace"], failed: [] },
  },
  {
    id: "swap",
    name: "swap",
    description: "Aliased vs disjoint heap — separating conjunction",
    pattern: "Separation / aliasing",
    tsCode: `/**
 * Swap two refs. Handles aliasing (x=y) and
 * disjoint ownership (x * y) separately.
 * @req x->#Ref[a'] /\\ x=y
 * @ens x->#Ref[a'] /\\ x=y
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[b'] * y->#Ref[a']
 */
function swap(x: any, y: any): void {
  const v1 = (x as any).val;
  const v2 = (y as any).val;
  (x as any).val = v2;
  (y as any).val = v1;
}`,
    ocamlSpec: `let swap x y = failwith "assume"
 (*@ assume req x->#Ref[a'] /\\ x=y; ens x->#Ref[a'] /\\ x=y
  $ req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[b'] * y->#Ref[a'] @*)`,
    tsVerdict: "unsound",
    heiferVerdict: "* asserts disjoint heap; aliased case handled separately",
    cached: { passed: ["swap"], failed: [] },
  },
  {
    id: "tail",
    name: "tail",
    description: "List tail — multi-case spec with Err on Nil",
    pattern: "ADT dispatch / error types",
    tsCode: `/**
 * Tail of a list — Err on empty.
 * @req x:#Cons[t',List[t']]
 * @ens res:#List[t']
 * @req x:#Nil[]
 * @ens res:#Err[]
 */
function tail(x: any): any {
  if (x === null) throw new Error("empty list");
  return x.next;
}`,
    ocamlSpec: `let tail x = failwith "assume"
 (*@ assume req x:#Cons[t',List[t']]; ens res:#List[t']
  $ req x:#Nil[]; ens res:#Err[] @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Proves exhaustive case split: Cons returns List, Nil returns Err",
    cached: { passed: ["tail"], failed: [] },
  },
  {
    id: "id2",
    name: "id2",
    description: "Parametric identity — forall quantifier",
    pattern: "Parametric polymorphism",
    tsCode: `/**
 * Identity — polymorphic over any type.
 * @forall t.
 * @req y:#t'
 * @ens res:#t'
 */
function id2(y: any): any { return y; }`,
    ocamlSpec: `let id2 y = failwith "assume"
 (*@ assume forall t. req y:#t'; ens res:#t' @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "forall t proves the spec holds for every type, not just syntactically",
    cached: { passed: ["id2"], failed: [] },
  },
  {
    id: "make_ref",
    name: "make_ref",
    description: "Allocate a new heap cell — ownership creation",
    pattern: "Heap allocation",
    tsCode: `/**
 * Allocate a new owned heap cell.
 * @req x:#a'
 * @ens res->#Ref[x] /\\ x:#a'
 */
function make_ref(x: any): any { return { val: x }; }`,
    ocamlSpec: `let make_ref x = failwith "assume"
 (*@ assume req x:#a'; ens res->#Ref[x] /\\ x:#a' @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "res owns a fresh heap cell containing exactly x — TypeScript can't express ownership",
    cached: { passed: ["make_ref"], failed: [] },
  },
  {
    id: "update",
    name: "update",
    description: "Type-changing store — m changes from t' to a'",
    pattern: "Type mutation",
    tsCode: `/**
 * Overwrite a ref, possibly changing its type.
 * @req m->#Ref[t'] /\\ v:#a'
 * @ens m->#Ref[a']
 */
function update(m: any, v: any): void { (m as any).val = v; }`,
    ocamlSpec: `let update m v = failwith "assume"
 (*@ assume req m->#Ref[t'] /\\ v:#a'; ens m->#Ref[a'] @*)`,
    tsVerdict: "unsound",
    heiferVerdict: "m's cell type changes from t' to a' — a type-state transition",
    cached: { passed: ["update"], failed: [] },
  },
  {
    id: "list_seg",
    name: "list_seg",
    description: "Three-element list segment — deep structural reasoning",
    pattern: "List structure",
    tsCode: `/**
 * Identity on a 3-element linked list — 6 spec cases.
 * @req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]
 * @ens x->#List[int] /\\ res=x
 * @req x->#Cons[1,y] * y->#Cons[2,z] * z->#Cons[3,Nil[]]
 * @ens x->#List[int] /\\ res=x
 * @req x->#Nil[]
 * @ens x->#List[a'] /\\ res = x
 */
function list_seg(x: any): any { return x; }`,
    ocamlSpec: `let list_seg x = failwith "assume"
 (*@ assume req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]; ens x->#List[int] /\\ res=x
  $ req x->#Cons[1,y] * y->#Cons[2,z] * z->#Cons[3,Nil[]]; ens x->#List[int] /\\ res=x
  $ req x->#Nil[]; ens x->#List[a'] /\\ res = x @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Reasons about concrete list shapes, exact values, and entailment to List[int]",
    cached: { passed: ["list_seg"], failed: [] },
  },
  {
    id: "map",
    name: "map",
    description: "Higher-order map — recursive, polymorphic, heap and value forms",
    pattern: "Recursive polymorphism",
    tsCode: `/**
 * Higher-order map over a list.
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
    ocamlSpec: `let rec map f xs = failwith "assume"
 (*@ assume req f:#Any /\\ xs:#Nil[]; ens res:#Nil[]
  $ req f:#(a'->b') /\\ xs:#Cons[a',List[a']]; ens res:#Cons[b',List[b']] @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Proves list structure is preserved: Cons[a'] in → Cons[b'] out",
    cached: { passed: ["map"], failed: [] },
  },
  {
    id: "partial_app",
    name: "partial_app",
    description: "Partial application — function type as first-class constraint",
    pattern: "Higher-order / partial application",
    tsCode: `/**
 * Partially apply plus to x.
 * @req plus:#(int->int->int) /\\ x:#int
 * @ens res:#int->int
 */
function partial_app(x: number): any { return (y: number) => x + y; }`,
    ocamlSpec: `let partial_app x = failwith "assume"
 (*@ assume req plus:#(int->int->int) /\\ x:#int; ens res:#int->int @*)`,
    tsVerdict: "imprecise",
    heiferVerdict: "Function types are logical constraints, not just annotations",
    cached: { passed: ["partial_app"], failed: [] },
  },
  {
    id: "two_pointer",
    name: "two_pointer",
    description: "Pointer-to-pointer aliasing — x now points to y's cell",
    pattern: "Pointer aliasing",
    tsCode: `/**
 * x := y — two cases: disjoint and aliased.
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[Ref[b']]
 * @req x->#Ref[a'] /\\ x=y
 * @ens x->#Ref[y] /\\ x=y
 */
function two_pointer(x: any, y: any, _z: any): void {
  (x as any).val = y;
}`,
    ocamlSpec: `let two_pointer x y = failwith "assume"
 (*@ assume req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[Ref[b']]
  $ req x->#Ref[a'] /\\ x=y; ens x->#Ref[y] /\\ x=y @*)`,
    tsVerdict: "unsound",
    heiferVerdict: "x->#Ref[Ref[b']] expresses pointer-to-pointer — TypeScript has no such type",
    cached: { passed: ["two_pointer"], failed: [] },
  },
]

export const DEMO_CACHED: CachedResult = { passed: ["plus", "inc_inplace", "swap"], failed: [] }

export const DEMO_CODE = `// TypeHL Live Demo
// Edit the specs below and click Verify

/**
 * Add two integers.
 * @req x:#int /\\ y:#int
 * @ens res:#int
 */
function plus(x: number, y: number): number {
  return x + y;
}

/**
 * Mutate heap cell type from int to str.
 * @req x->#Ref[int]
 * @ens x->#Ref[str]
 */
function inc_inplace(x: any): void {
  (x as any).val = String((x as any).val + 1);
}

/**
 * Swap two refs — aliased and disjoint cases.
 * @req x->#Ref[a'] /\\ x=y
 * @ens x->#Ref[a'] /\\ x=y
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[b'] * y->#Ref[a']
 */
function swap(x: any, y: any): void {
  const v1 = (x as any).val;
  const v2 = (y as any).val;
  (x as any).val = v2;
  (y as any).val = v1;
}`

export const COMPARISON_TABLE = [
  {
    n: 1,
    pattern: "Parametric identity",
    ts: "`<T>(y: T): T` — syntactic, not verified",
    heifer: "`forall t. req y:#t'; ens res:#t'`",
    why: "TS checks syntax; Heifer proves the heap entailment holds",
  },
  {
    n: 2,
    pattern: "Predicate fold/unfold",
    ts: "No concept — TS has no named heap predicates",
    heifer: "`req p_list(x); ens res=x /\\ p_list(x)`",
    why: "TS cannot abstract over heap shapes",
  },
  {
    n: 3,
    pattern: "Heap vs value duality",
    ts: "`deref(x: any): any` — loses type info",
    heifer: "`req x->#Ref[t']; ens x->#Ref[t'] /\\ res:#t'`",
    why: "TS erases the distinction between heap cells and values",
  },
  {
    n: 4,
    pattern: "Type mutation",
    ts: "Forbids typed mutation; accepts untyped `any`",
    heifer: "`req x->#Ref[int]; ens x->#Ref[str]`",
    why: "TS checks snapshots; Heifer tracks state transitions",
  },
  {
    n: 5,
    pattern: "Aliasing split",
    ts: "`swap(x: any, y: any)` — no aliasing detection",
    heifer: "`req x->#Ref[a'] /\\ x=y; ens x->#Ref[a'] /\\ x=y`",
    why: "TS cannot express disjoint vs aliased ownership",
  },
  {
    n: 6,
    pattern: "Disjoint ownership",
    ts: "Same type as aliased — indistinguishable",
    heifer: "`req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[b'] * y->#Ref[a']`",
    why: "`*` is separating conjunction — TS has no analog",
  },
  {
    n: 7,
    pattern: "ADT constructor dispatch",
    ts: "`typeof` narrows syntactically, no verification",
    heifer: "`req y:#Int[int]; ens res:#Int[int] $ req y:#Str[str]; ens res:#Str[str]`",
    why: "Heifer proves the match is exhaustive and each arm correct",
  },
  {
    n: 8,
    pattern: "Disjunctive return type",
    ts: "`T | Error` — accepts `x: null` without warning",
    heifer: "`req x:#Cons[...]; ens res:#List[t'] $ req x:#Nil[]; ens res:#Err[]`",
    why: "Spec precisely models the failure case",
  },
  {
    n: 9,
    pattern: "List segment shape",
    ts: "`any[]` or `T[]` — no structural constraint",
    heifer: "`req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]`",
    why: "TS length/structure is runtime; Heifer reasons statically",
  },
  {
    n: 10,
    pattern: "Create reference + ownership",
    ts: "`make_ref<T>(x: T): {val: T}` — correct but no ownership",
    heifer: "`req x:#a'; ens res->#Ref[x] /\\ x:#a'`",
    why: "TS cannot express that `res` owns a new heap cell",
  },
  {
    n: 11,
    pattern: "Type-changing update",
    ts: "`update(m: {val: any}, v: any)` — unconstrained",
    heifer: "`req m->#Ref[t'] /\\ v:#a'; ens m->#Ref[a']`",
    why: "TS cannot express that m's cell type changes after update",
  },
  {
    n: 12,
    pattern: "Two-pointer aliasing",
    ts: "`(x: any, y: any) => x.val = y` — no pointer type",
    heifer: "`req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[Ref[b']]`",
    why: "TS cannot state that x now points to y's heap location",
  },
  {
    n: 13,
    pattern: "Completeness",
    ts: "`(x: any): any` — return type imprecise",
    heifer: "`req x:#List[a']; ens res:#(List[a'] \\/ Err[])`",
    why: "TS unions are syntactic; Heifer proves exhaustiveness",
  },
  {
    n: 14,
    pattern: "Recursive map types",
    ts: "`map<A,B>(f:(a:A)=>B, xs:A[]): B[]` — shallow",
    heifer: "Four cases: Nil/Cons × value/heap — both verified",
    why: "TS doesn't verify list structure is preserved",
  },
  {
    n: 15,
    pattern: "Partial application",
    ts: "`partial_app(x: number) => (y: number) => number`",
    heifer: "`req plus:#(int->int->int) /\\ x:#int; ens res:#int->int`",
    why: "Heifer specs constrain function types in the logic",
  },
]
