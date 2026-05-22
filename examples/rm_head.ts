// examples/rm_head.ts

/**
 * @pred List(T) = Nil ∨ Cons(T, List(T))
 * @pred MList(T) = Nil ∨ ∃r, r1. Cons(T, r) ∗ r ↦ Ref(r1) ∗ r1 ↦ MList(T)
 */

/**
 * Removes the head cell, mutating the reference to point to the tail.
 * @requires { xs ↦ Ref(ys) ∗ ys ↦ MList(T) }
 * @ensures { ys = Nil & xs ↦ Ref(ys) & res: Err
 *           ∨ ∃h, t. ys = Cons(h, t) ∗ xs ↦ Ref(t) ∗ t ↦ MList(T) & res: T }
 */
function rm_head(xs: any): any {
  const ys = xs.val;
  if (ys === null) {
    throw new Error("Empty list");
  }
  const h = ys.val;
  const t = ys.next;
  xs.val = t;
  return h;
}
