// examples/swap.ts

/**
 * @case {
 *   i != j -> requires i::cell<a> ∗ j::cell<b> ensures i::cell<b> ∗ j::cell<a>,
 *   i = j  -> requires i::cell<a> ensures i::cell<a>
 * }
 */
function swap(i: any, j: any): void {
  const c = i.val;
  i.val = j.val;
  j.val = c;
}
