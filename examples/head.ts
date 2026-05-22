// examples/head.ts

/**
 * @pred List(T) = Nil ∨ Cons(T, List(T))
 * @pred List(T, n) = Nil ∧ n = 0 ∨ ∃m. Cons(T, r) & r:List(T, m) & n = m + 1
 */

/**
 * Spec Level 1: safe head under non-empty precondition
 * @requires { xs: List(T, s) & s > 0 }
 * @ensures { res: T }
 */
function safeHead<T>(xs: any): T {
  return xs.val;
}

/**
 * Spec Level 2: total head returning Err on Nil
 * @requires { xs: List(T) }
 * @ensures { xs: Nil & res: Err ∨ ∃r. xs: Cons(T, r) & res: T }
 */
function totalHead<T>(xs: any): any {
  if (xs === null) {
    throw new Error("Empty list");
  }
  return xs.val;
}
