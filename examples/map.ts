// examples/map.ts

/**
 * Higher-order mapping function with case specifications
 * @requires { xs: List(A) & f: (A -> B) }
 * @ensures { res: List(B) }
 */
function map(f: any, xs: any): any {
  if (xs === null) {
    return null;
  }
  const h = xs.val;
  const t = xs.next;
  const fh = f(h);
  const ft = map(f, t);
  return new Cons(fh, ft);
}
