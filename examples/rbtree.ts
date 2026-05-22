// examples/rbtree.ts

/**
 * @pred RBTree(T, c, h) = Nil ∧ c = Black ∧ h = 0
 *                      | ∃c1, c2, h1, h2. Node(c, val, left, right)
 *                        & left:RBTree(T, c1, h1) & right:RBTree(T, c2, h2)
 *                        & (c = Red -> c1 = Black & c2 = Black)
 *                        & h1 = h2
 *                        & h = h1 + (c = Black -> 1 | 0)
 */

/**
 * Checks if key is a member of the red-black tree.
 * @requires { t: RBTree(T, c, h) }
 * @ensures { res: Bool }
 */
function member(key: number, t: any): boolean {
  if (t === null) {
    return false;
  }
  const v = t.val;
  if (key === v) {
    return true;
  }
  if (key < v) {
    const left = t.left;
    return member(key, left);
  } else {
    const right = t.right;
    return member(key, right);
  }
}
