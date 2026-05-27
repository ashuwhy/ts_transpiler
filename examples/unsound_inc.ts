/**
 * Demonstration of TypeScript's unsoundness regarding aliases and mutations.
 * In TypeScript, structural typing allows subtyping on references (e.g. {a: number, b: number} <: {a: number}),
 * which leads to unsoundness when combined with mutation.
 * 
 * TypeHL uses Separation Logic to track precise memory locations, preventing these errors statically.
 */

interface Counter {
  val: number;
}

interface CounterWithLimit extends Counter {
  limit: number;
}

// 1. A function that takes a standard Counter and increments it
function inc(c: Counter) {
  c.val += 1;
}

// 2. We have a CounterWithLimit
const myCounter: CounterWithLimit = { val: 0, limit: 10 };

// 3. TypeScript allows us to pass a CounterWithLimit to a function expecting a Counter
// This is called "width subtyping"
const alias: Counter = myCounter;

// 4. We can increment via the alias
inc(alias);

// 5. This is technically unsafe in a more rigorous setting if the alias could invalidate 
// invariants of the original type (though for this specific case it's benign).
// However, the real danger is when arrays or more complex structures are involved.
// For instance:
const arr: CounterWithLimit[] = [{ val: 0, limit: 10 }];
const arrAlias: Counter[] = arr; // TS allows this array covariance

// 6. We can now insert a normal Counter into what is actually an array of CounterWithLimit
arrAlias.push({ val: 100 }); // Typechecks!

// 7. This causes a runtime error when we try to access the limit of the inserted element
// TypeError: Cannot read properties of undefined
const limit = arr[1].limit;

// TypeHL handles this by statically ensuring unique ownership or explicit sharing protocols,
// preventing unsound subtyping with mutable references.
