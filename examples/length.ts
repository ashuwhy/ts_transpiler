// examples/length.ts

/**
 * @pred List(T, n) = Nil ∧ n = 0 ∨ ∃m. Cons(T, r) & r:List(T, m) & n = m + 1
 */

/**
 * Returns the length of a list with singleton type logic.
 * @requires { xs: List(T, n) }
 * @ensures { res: {n} }
 */
function length(xs: any): number {
  if (xs === null) {
    return 0;
  }
  const t = xs.next;
  const l = length(t);
  return 1 + l;
}
