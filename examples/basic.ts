// examples/basic.ts

/**
 * @requires { x: Int }
 * @ensures { res: Int & res = x }
 */
function id(x: number): number {
  return x;
}

/**
 * @requires { x: Int & x >= 0 }
 * @ensures { res: Int & res = x }
 */
function abs(x: number): number {
  if (x >= 0) {
    return x;
  } else {
    return 0 - x;
  }
}
