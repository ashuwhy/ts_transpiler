# TypeScript vs TypeHL/Heifer-type — Expressiveness Comparison

Each row shows a TypeScript program that standard TypeScript either rejects,
types imprecisely, or accepts unsoundly — and the corresponding Heifer-type
spec that verifies the correct behaviour.

Run all examples:
```bash
tsx scripts/convert.ts examples/type_demo_full.ts
```

---

## Pattern Table

| # | Pattern | TypeScript behaviour | Heifer-type spec | Why TypeScript fails |
|---|---------|---------------------|-----------------|----------------------|
| 1 | **Parametric identity** | `<T>(y: T): T` — correct but syntactic, not verifiable | `forall t. req y:#t'; ens res:#t'` | TS type-checks syntax; Heifer proves the heap entailment holds |
| 2 | **Predicate fold/unfold** | No concept — TS has no named heap predicates | `req p_list(x); ens res=x /\ p_list(x)` | TS cannot abstract over heap shapes or prove equivalence between forms |
| 3 | **Heap vs value duality** | `deref(x: any): any` — loses all type info | `req x->#Ref[t']; ens x->#Ref[t'] /\ res:#t'` | TS erases the distinction between owned heap cells and values |
| 4 | **Type mutation** `inc_inplace` | `x: {val: any}` — no change tracked; forbids typed version `x: {val: number}` → assign string | `req x->#Ref[int]; ens x->#Ref[str]` | TS type-checks snapshots, not state transitions across calls |
| 5 | **Aliasing split** `swap(x, x)` | `swap(x: any, y: any): void` — no aliasing detection | Case 1: `req x->#Ref[a'] /\ x=y; ens x->#Ref[a'] /\ x=y` | TS has no separating conjunction — cannot express disjoint vs aliased ownership |
| 6 | **Disjoint ownership** `swap(x, y)` | Same type as above — undistinguished | Case 2: `req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[b'] * y->#Ref[a']` | `*` is Heifer's separating conjunction; TS has no analog |
| 7 | **ADT constructor dispatch** | `typeof y === 'number'` narrows, but no verification | `req y:#Int[int]; ens res:#Int[int]  $ req y:#Str[str]; ens res:#Str[str]` | TS narrows syntactically; Heifer proves the match is exhaustive and each arm correct |
| 8 | **Disjunctive return type** | `tail(x): T \| Error` — TS accepts `x: null` without warning | `req x:#Cons[t',List[t']]; ens res:#List[t'] $ req x:#Nil[]; ens res:#Err[]` | TS nullability ≠ Heifer Err type — the spec precisely models the failure case |
| 9 | **List segment shape** | `any[]` or `T[]` — no structural constraint | `req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]` | TS length and structure are runtime; Heifer reasons statically over linked-list shapes |
| 10 | **Create reference + ownership** | `make_ref<T>(x: T): {val: T}` — correct typing but no ownership | `req x:#a'; ens res->#Ref[x] /\ x:#a'` | TS cannot express that `res` *owns* a new heap cell containing exactly `x` |
| 11 | **Type-changing update** | `update(m: {val: any}, v: any)` — unconstrained | `req m->#Ref[t'] /\ v:#a'; ens m->#Ref[a']` | TS cannot express that `m`'s cell type changes from `t'` to `a'` after the update |
| 12 | **Two-pointer aliasing** | `(x: any, y: any, z: any) => x.val = y` | `req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[Ref[b']]` | TS cannot state that `x` now points to `y`'s heap location — no pointer-to-pointer types |
| 13 | **Completeness** | `(x: any): any` — return type imprecise | `req x:#List[a']; ens res:#(List[a'] \/ Err[])` | TS unions are syntactic; Heifer proves the disjunction is exhaustive given the precondition |
| 14 | **Recursive map types** | `map<A,B>(f:(a:A)=>B, xs:A[]): B[]` — correct but shallow | Four cases: `Nil/Cons × value/heap` — both representations verified | TS doesn't verify that list structure is preserved; Heifer proves `Cons[b',List[b']]` out |
| 15 | **Partial application** | `partial_app(x: number) => (y: number) => number` | `req plus:#(int->int->int) /\ x:#int; ens res:#int->int` | TS infers function types syntactically; Heifer specs *constrain* the function type in the logic |

---

## The Three Killer Examples

### 1. `inc_inplace` — Ownership Type Change
```typescript
// TypeScript: REJECTS (can't assign string to number ref)
// or ACCEPTS (if typed as any, no guarantee)
function inc_inplace(x: { val: number }): void {
  x.val = String(x.val + 1);  // TS error: string not assignable to number
}
```
```ocaml
(* Heifer-type: VERIFIES — tracks type mutation through ownership *)
let inc_inplace x = failwith "assume"
 (*@ assume req x->#Ref[int]; ens x->#Ref[str] @*)
```
TypeScript's type system is *state-unaware*: it checks that each expression is well-typed in isolation, but cannot express that the type of a heap cell *changes* across a function call.  Heifer's separation types track exactly this — `Ref[int]` before, `Ref[str]` after.

---

### 2. `swap(x, x)` vs `swap(x, y)` — Aliasing
```typescript
// TypeScript: single type covers both cases, no aliasing detection
function swap(x: any, y: any): void { ... }
```
```ocaml
(* Heifer-type: two SEPARATE verified cases *)
let swap x y = failwith "assume"
 (*@ assume req x->#Ref[a'] /\ x=y; ens x->#Ref[a'] /\ x=y
  $ req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[b'] * y->#Ref[a'] @*)
```
The separating conjunction `*` asserts that `x` and `y` are *distinct heap locations*.  The aliased case `x=y` is handled separately.  TypeScript has no way to express or verify this — `swap(x, x)` and `swap(x, y)` are indistinguishable types.

---

### 3. `list_seg` — Deep Structural Reasoning
```typescript
// TypeScript: x is just any[], no structural constraints
function list_seg(x: any): any { return x; }
```
```ocaml
(* Heifer-type: VERIFIES six structural cases including concrete values *)
let list_seg x = failwith "assume"
 (*@ assume req x->#Cons[1,y] * y->#Cons[2,z] * z->#Cons[3,Nil[]]; ens x->#List[int] /\ res=x
  ...
  @*)
```
Heifer can reason about the *shape* of linked lists — exact element counts, concrete values at each node, and entailment between structural and predicate forms.  TypeScript's type system operates on arrays and interfaces with no heap structure at all.

---

## Spec Pattern Summary

| JSDoc Tag | Meaning | Heifer output |
|-----------|---------|---------------|
| `@req P` | Precondition | `req P` |
| `@ens Q` | Postcondition (pairs with preceding `@req`) | `ens Q` |
| `@forall t.` | Universal quantification over type variable | `forall t.` prefix |
| `@rec` | Recursive function | `let rec` |
| `@pred name(x) = body` | File-level predicate declaration | `(*@ pred name(x) = body @*)` |
| Multiple `@req`/`@ens` pairs | Case specs | `$ ` separated clauses |

### Heap vs Value form
| Form | Syntax | Meaning |
|------|--------|---------|
| Value type | `x:#int` | `x` evaluates to an int |
| Heap ownership | `x->#Ref[int]` | `x` is a pointer to a heap cell holding an int |
| Pure constraint | `x=y`, `x>=0` | Arithmetic/alias assertion |
| Separating conjunction | `P * Q` | P and Q hold on *disjoint* heap regions |
| Logical conjunction | `P /\ Q` | P and Q both hold (same heap) |
| Disjunction | `P \/ Q` | P or Q holds |
