# TypeHL for TypeScript: A Separation Logic Front-End

> **Research Prototype:** A TypeScript → OCaml (Heifer) separation logic pipeline.
> This repository serves as a reference implementation for demonstrating separation logic types on real-world, mainstream programming languages, building upon the principles of *Sep-Types*.

**TypeHL for TypeScript** provides a web-based and CLI front-end for annotating standard TypeScript with structural separation-logic specifications. It parses JSDoc-based invariants (`@req`, `@ens`) on TypeScript functions, maps them to an intermediate core language, and compiles these specifications into OCaml stubs verified by the Heifer separation-logic backend.

This system demonstrates that rigorous separation logic can be applied to an existing ecosystem (TypeScript) to statically prevent issues like unsound aliasing, without sacrificing the language's familiar developer experience.

---

---

## Status

- All 25 tests pass (`vitest run`).
- TypeScript strict mode, `tsc --noEmit` clean.
- 9 paper-derived examples in `examples/`.
- Verifier subprocess driver works against canned fixtures; a real `./hip` binary is required to verify against the production checker.

---

## Quickstart

```bash
npm install
npm test

# Convert to paper notation (default)
npx tsx src/cli.ts convert examples/swap.ts

# Convert to HIPsleek .ss
npx tsx src/cli.ts convert examples/swap.ts --format hipsleek -o out/swap.ss

# Inspect parsed specs
npx tsx src/cli.ts inspect examples/rm_head.ts --show specs

# Transpile + run HIPsleek verifier (requires ./hip on PATH or --exec)
npx tsx src/cli.ts verify examples/swap.ts --exec /path/to/hip
```

The `typehl` binary is also registered in `package.json`. After `npm run build`, `npx typehl convert ...` works.

---

## How it works

```
TypeScript .ts  ──┐
                  ├──► walker.ts ──► anf.ts ──► Program (Fig.2 + Fig.3 AST)
JSDoc tags     ──►│                                     │
specLexer/Parser ─┘                                     │
                                                        ▼
                                            ┌─ coreEmitter   → paper notation
                                            └─ hipsleekEmitter → .ss file
                                                                    │
                                                                    ▼
                                                            runner.ts ──► ./hip
                                                                    │
                                                                    ▼
                                                            resultParser.ts
```

| Stage | File |
| --- | --- |
| Core AST | `src/core/ast.ts` |
| Spec lexer/parser | `src/parser/specLexer.ts`, `src/parser/specParser.ts` |
| JSDoc extractor | `src/parser/jsdocExtractor.ts` |
| TS → Core walker | `src/translator/walker.ts` |
| A-Normal Form pass | `src/translator/anf.ts` |
| Paper-notation emitter | `src/emitter/coreEmitter.ts` |
| HIPsleek emitter | `src/emitter/hipsleekEmitter.ts` |
| Verifier subprocess | `src/verifier/runner.ts`, `src/verifier/resultParser.ts` |
| CLI | `src/cli.ts` |

---

## Spec annotation language

Specs are written inside JSDoc blocks attached to functions or as top-level predicate decls. Both Unicode and ASCII forms are accepted by the lexer.

| Construct | Unicode | ASCII fallback |
| --- | --- | --- |
| Heap arrow | `↦` | `\|->` |
| Sep conjunction | `∗` | `*` |
| Pure conjunction | `∧` | `&&` or `&` |
| Disjunction | `∨` | `\|\|` |
| Negation | `¬` | `!` |
| Existential | `∃` | `exists` |
| Universal | `∀` | `forall` |
| Bottom / Top | `⊥` / `⊤` | `_\|_` / `Top` |

Supported tags:

- `@requires { Δ }` — precondition.
- `@ensures { Δ }` — postcondition; use `res` for the return value.
- `@case { guard₁ -> requires Δ₁ ensures Δ₁', guard₂ -> ... }` — case spec with pairwise-disjoint guards.
- `@pred Name(params) = body` — view predicate; bind `self` implicitly.
- `@forall T:Bound, x, y` — universally quantified type and value variables.

---

## Example

`examples/swap.ts`:

```ts
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
```

`npx tsx src/cli.ts convert examples/swap.ts --format hipsleek` produces a `.ss` shaped like `hipsleek/3234/tutorial_ex/swap.ss` — a `case` block with two pairwise-disjoint guards, separating conjunction on the heap part, and `res` for the return value.

The full set of examples (each is a TS file with JSDoc specs):

| File | Paper anchor | Demonstrates |
| --- | --- | --- |
| `examples/basic.ts` | §1, Appendix A.1 | Pure types, `req`/`ens` |
| `examples/stateful_add.ts` | §2.2 | Flow-sensitive type mutation |
| `examples/swap.ts` | §2.2 | Must-aliasing, 3-case spec |
| `examples/head.ts` | §2.3 | Three error-spec levels |
| `examples/length.ts` | Appendix A.2 | Singleton return types |
| `examples/map.ts` | §2.3 | Higher-order, case specs |
| `examples/list_ops.ts` | §6.2.3 Table 4 | append, rev, filter, fold_left |
| `examples/rm_head.ts` | §2.5 | All four ingredients combined |
| `examples/rbtree.ts` | §2.4 Table 2 | GADT-style type predicates |

---

## CLI reference

```text
typehl convert <file>
  -f, --format <core|hipsleek|heifer>   Output format (default: core)
  -o, --output <path>                   Write to file instead of stdout
  -s, --strict                          Warn when dropping unsupported features
                                        (e.g. Err in HIPsleek)

typehl inspect <file>
  --show <AST|specs|predicates>         Aspect to display (default: specs)

typehl verify <file>
  --tool <hipsleek>                     Verification backend (default: hipsleek)
  --exec <path>                         Path to verifier binary (default: ./hip)
```

`heifer` is currently aliased to `core` with a warning until the Heifer emitter lands in v2.

---

## Project layout

```
.
├── src/
│   ├── core/ast.ts                  Figure 2 + Figure 3 discriminated unions
│   ├── parser/
│   │   ├── specLexer.ts             Unicode + ASCII spec tokenizer
│   │   ├── specParser.ts            Recursive-descent → Figure 3 AST
│   │   └── jsdocExtractor.ts        ts.getJSDocTags() collector
│   ├── translator/
│   │   ├── walker.ts                TS AST → Full Core grammar
│   │   └── anf.ts                   Full → Core (§3.1 preprocessing)
│   ├── emitter/
│   │   ├── emitterInterface.ts      { emit(Program): string }
│   │   ├── coreEmitter.ts           Paper notation (reference)
│   │   └── hipsleekEmitter.ts       .ss format (primary)
│   ├── verifier/
│   │   ├── runner.ts                child_process subprocess driver
│   │   └── resultParser.ts          Parses "Procedure X$… SUCCESS/FAIL"
│   ├── cli.ts                       commander entry point
│   └── __tests__/                   vitest specs + snapshots
├── examples/                        9 paper-derived TS inputs
├── Sep-Types.md / Sep-Types.pdf     The paper (source of truth)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Development

```bash
npm run dev <args>      # tsx src/cli.ts <args>
npm test                # vitest run
npm run test:watch      # vitest in watch mode
npm run build           # tsc → dist/
```

Conventions:

- TypeScript strict mode (`"strict": true`); no `any` outside of declared `TODO`s.
- ESM (`"type": "module"`); imports use the `.js` extension as Node 16 module resolution requires.
- Tests are co-located in `src/__tests__/` and run via Vitest.
- AST types in `src/core/ast.ts` are discriminated unions keyed on `kind`; every type tag maps 1:1 to a Figure 2 / Figure 3 production.

---

## Paper anchors

For any AST node or emitter rule you're unsure about, the source of truth is the paper:

- **Figure 2** (Full / Core grammar, types, patterns) — `Sep-Types.md` lines 354-366.
- **Figure 3** (State `Δ`, Heap `σ`, Pure `π`, Spec `Φ`) — `Sep-Types.md` lines 393-396.
- **§3.1 ANF preprocessing rules** — lines 372-378.
- **§2.2 swap** — line 154 (the canonical three-case spec).
- **§2.5 rm_head** — line 319 (combined example).

---

## Roadmap

- Heifer `.ml` emitter for effect-trace verification (v2).
- Round-trip property tests: `parse(emit(x)) ≡ x` on the core AST.
- Direct integration against an actual HIPsleek install (currently only the result parser is exercised against canned fixtures).
- `@inline` / lemma-bridging tags for richer entailment hints.
