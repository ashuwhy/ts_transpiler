// examples/list_ops.ts

/**
 * @pred List(T, n) = Nil ∧ n = 0 ∨ ∃m. Cons(T, r) & r:List(T, m) & n = m + 1
 */

/**
 * Appends two lists together.
 * @requires { xs: List(T, n1) ∗ ys: List(T, n2) & xs != null }
 * @ensures { res: List(T, n1 + n2) }
 */
function append(xs: any, ys: any): any {
  const next = xs.next;
  if (next === null) {
    xs.next = ys;
  } else {
    append(next, ys);
  }
  return xs;
}
