// examples/record_demo.ts
// TypeHL record type support demonstration.
// Run: tsx scripts/convert.ts examples/record_demo.ts

/**
 * Read a field from a record — ownership preserved.
 * @req p->#Ref[{ x: int, y: int }]
 * @ens p->#Ref[{ x: int, y: int }] /\ res:#int
 */
function getX(p: { x: number; y: number }): number {
  return p.x;
}

/**
 * Update one field of a record in place — type-state changes for that field.
 * @req p->#Ref[{ x: int, y: int }]
 * @ens p->#Ref[{ x: str, y: int }]
 */
function labelX(p: { x: any; y: number }): void {
  p.x = String(p.x);
}

/**
 * Swap two fields of the same record — disjoint ownership within the record.
 * @req p->#Ref[{ a: int, b: str }]
 * @ens p->#Ref[{ a: str, b: int }]
 */
function swapFields(p: { a: any; b: any }): void {
  const tmp = p.a;
  p.a = p.b;
  p.b = tmp;
}

/**
 * Allocate a fresh two-field record.
 * @req x:#int /\ y:#int
 * @ens res->#Ref[{ x: int, y: int }]
 */
function makePoint(x: number, y: number): { x: number; y: number } {
  return { x, y };
}
