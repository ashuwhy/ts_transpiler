// examples/stateful_add.ts

/**
 * @requires { x ↦ Ref(Int) ∗ y ↦ Ref(Int) }
 * @ensures { x ↦ Ref(Int) ∗ y ↦ Ref(Int) }
 */
function stateful_add(x: any, y: any): void {
  // Adds y.val to x.val
  const vx = x.val;
  const vy = y.val;
  x.val = vx + vy;
}
