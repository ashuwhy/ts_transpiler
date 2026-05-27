// examples/type_demo_full.ts
// Full coverage of every spec pattern in Heifer-type/test/examples/type.ml
// Run: tsx scripts/convert.ts examples/type_demo_full.ts

// ─── File-level type predicate declarations ───────────────────────────
/**
 * @pred p_list(x) = x->#List[int]
 * @pred p_ref(x) = x:#Ref[int] /\ emp
 * @pred p_int_cell(x) = x->#Ref[int]
 */

// ─── 1. Identity — parametric polymorphism with forall ────────────────

/**
 * Identity function — polymorphic type variable.
 * @forall t.
 * @req y:#t'
 * @ens res:#t'
 */
function id2(y: any): any { return y; }

// ─── 2. Predicate fold / unfold ────────────────────────────────────────

/**
 * Identity that preserves a named predicate (no fold/unfold needed).
 * @req p_list(x)
 * @ens res = x /\ p_list(x)
 */
function pred_id(x: any): any { return x; }

/**
 * Unfold: replace predicate p_list with its definition x->#List[int].
 * @req p_list(y)
 * @ens res = y /\ y->#List[int]
 */
function pred_unfold(y: any): any { return y; }

/**
 * Fold: replace heap form x->#List[int] back into predicate p_list.
 * @req x->#List[int]
 * @ens res = x /\ p_list(x)
 */
function pred_fold(x: any): any { return x; }

/**
 * Mixed req: predicate + pure constraint.
 * @req p_list(y) /\ y = y
 * @ens res = y /\ y->#List[int]
 */
function pred_mixed_req(y: any): any { return y; }

/**
 * Mixed ens: heap in req, predicate in ens.
 * @req y->#List[int] /\ y = y
 * @ens res = y /\ p_list(y)
 */
function pred_mixed_ens(y: any): any { return y; }

// ─── 3. Simple arithmetic ─────────────────────────────────────────────

/**
 * Add two integers.
 * @req x:#int /\ y:#int
 * @ens res:#int
 */
function plus(x: number, y: number): number { return x + y; }

// ─── 4. Higher-order function application ─────────────────────────────

/**
 * Apply a function to an argument.
 * @req f:#(a'->b') /\ x:#a'
 * @ens res:#b'
 */
function apply(f: any, x: any): any { return f(x); }

// ─── 5. Dereference — value form and heap form ─────────────────────────

/**
 * Read a reference — two equivalent spec forms.
 * @req x:#Ref[t']
 * @ens res:#t'
 * @req x->#Ref[t']
 * @ens x->#Ref[t'] /\ res:#t'
 */
function deref(x: any): any { return (x as any).val; }

// ─── 6. Tail — multi-case with Err ────────────────────────────────────

/**
 * Tail of a list — four equivalent spec forms (value + heap × success + Err).
 * @req x:#Cons[t',List[t']]
 * @ens res:#List[t']
 * @req x:#Nil[]
 * @ens res:#Err[]
 * @req x->#Cons[t',List[t']]
 * @ens res:#List[t']
 * @req x->#Nil
 * @ens res:#Err
 */
function tail(x: any): any {
  if (x === null) throw new Error("empty");
  return x.next;
}

// ─── 7. ADT dispatch — match on constructor type ──────────────────────

/**
 * Increment Int branch, pass through Str, top for anything else.
 * @req y:#Int[int]
 * @ens res:#Int[int]
 * @req y:#Str[str]
 * @ens res:#Str[str]
 * @req y:#__
 * @ens res:#top
 */
function inc_if_int(y: any): any {
  if (typeof y === 'number') return y + 1;
  return y;
}

// ─── 8. Assumed helper (body irrelevant to verifier) ──────────────────

/**
 * Primitive assumed by the verifier — body not checked.
 * @req x:#int
 * @ens res:#str
 */
function string_of_ints(x: number): string { return String(x); }

// ─── 9. Type mutation — core type mutation demo ────────────────────────

/**
 * Mutate heap cell type from int to str.  TypeScript forbids this; Heifer tracks it.
 * @req x->#Ref[int]
 * @ens x->#Ref[str]
 */
function inc_inplace(x: any): void {
  (x as any).val = string_of_ints((x as any).val + 1);
}

// ─── 10. Create a reference ───────────────────────────────────────────

/**
 * Allocate a new heap cell.
 * @req x:#a'
 * @ens res->#Ref[x] /\ x:#a'
 */
function make_ref(x: any): any { return { val: x }; }

// ─── 11. Update a reference — type-changing store ─────────────────────

/**
 * Overwrite a heap cell with a new value, possibly changing its type.
 * @req m->#Ref[t'] /\ v:#a'
 * @ens m->#Ref[a']
 */
function update(m: any, v: any): void { (m as any).val = v; }

// ─── 12. Swap — aliased case + disjoint case ──────────────────────────

/**
 * Swap two references, handling aliasing (x=y) and disjointness (x*y).
 * @req x->#Ref[a'] /\ x=y
 * @ens x->#Ref[a'] /\ x=y
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[b'] * y->#Ref[a']
 */
function swap(x: any, y: any): void {
  const v1 = (x as any).val;
  const v2 = (y as any).val;
  (x as any).val = v2;
  (y as any).val = v1;
}

// ─── 13. Swap with predicate in spec ──────────────────────────────────

/**
 * Swap using named predicates instead of raw heap forms.
 * @req p_int_cell(x) /\ y->#Ref[str]
 * @ens x->#Ref[str] /\ p_int_cell(y)
 */
function swap_mixed(x: any, y: any): void { swap(x, y); }

// ─── 14. List segment — deep structural specs ─────────────────────────

/**
 * Identity on a three-element list segment — six spec cases.
 * @req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]
 * @ens x->#Cons[int,Cons[int,Cons[int,Nil[]]]] /\ res=x
 * @req x->#Nil[]
 * @ens x->#List[a'] /\ res = x
 * @req x->#Cons[int,y] * y->#Cons[int,z] * z->#Cons[int,Nil[]]
 * @ens x->#List[int] /\ res=x
 * @req x->#Cons[1,y] * y->#Cons[2,z] * z->#Cons[3,Nil[]]
 * @ens x->#List[int] /\ res=x
 * @req x->#Cons[a',y] * y->#List[a']
 * @ens x->#List[a'] /\ res=x
 * @req x->#Nil[]
 * @ens x->#Nil[] /\ res=x
 */
function list_seg(x: any): any { return x; }

// ─── 15. List entailment — predicate subsumption ──────────────────────

/**
 * Pass a list through list_seg to demonstrate predicate entailment.
 * @req y->#List[a']
 * @ens y->#List[a'] /\ res=y
 */
function list_entail(y: any): any { return list_seg(y); }

// ─── 16. Two-pointer aliasing ─────────────────────────────────────────

/**
 * x := y — aliased case and disjoint case.
 * @req x->#Ref[a'] * y->#Ref[b']
 * @ens x->#Ref[Ref[b']]
 * @req x->#Ref[a'] /\ x=y
 * @ens x->#Ref[y] /\ x=y
 */
function two_pointer(x: any, y: any, _z: any): void { (x as any).val = y; }

// ─── 17. Completeness check — union return type ───────────────────────

/**
 * Returns List[a'] on success or Err[] on Nil — disjunctive post-condition.
 * @req x:#List[a']
 * @ens res:#(List[a'] \/ Err[])
 */
function check_spec_completeness(x: any): any { return tail(x); }

// ─── 18. Recursive map — four equivalent specs ────────────────────────

/**
 * Higher-order map over a list.
 * @rec
 * @req f:#Any /\ xs:#Nil[]
 * @ens res:#Nil[]
 * @req f:#(a'->b') /\ xs:#Cons[a',List[a']]
 * @ens res:#Cons[b',List[b']]
 * @req f:#Any /\ xs->#Nil[]
 * @ens xs->#Nil[] /\ res:#Nil[]
 * @req f:#(a'->b') /\ xs->#Cons[a',List[a']]
 * @ens xs->#Cons[a',List[a']] /\ res:#Cons[b',List[b']]
 */
function map(f: any, xs: any): any {
  if (!xs) return null;
  return { val: f(xs.val), next: map(f, xs.next) };
}

// ─── 19. Multi-argument higher-order ─────────────────────────────────

/**
 * Apply a two-argument function.
 * @req f:#(a'->b'->c') /\ x:#a' /\ y:#b'
 * @ens res:#c'
 */
function more_args(f: any, x: any, y: any): any { return f(x)(y); }

// ─── 20. Partial application ─────────────────────────────────────────

/**
 * Partially apply plus to x — returns a function.
 * @req plus:#(int->int->int) /\ x:#int
 * @ens res:#int->int
 */
function partial_app(x: number): any { return (y: number) => x + y; }

// ─── 21. Specialised map with concrete types ──────────────────────────

/**
 * Map an int-to-str function over a list, in two spec forms.
 * @req l:#List[int] /\ f:#int->str
 * @ens res:#List[str]
 * @req l->#List[int] /\ f:#int->str
 * @ens l->#List[int] /\ res:#List[str]
 */
function maplist_int_string(l: any, f: any): any { return map(f, l); }
