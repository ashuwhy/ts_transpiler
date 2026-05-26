# Graph Report - .  (2026-05-26)

## Corpus Check
- 56 files · ~23,020 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 240 nodes · 445 edges · 38 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Spec Parser|Spec Parser]]
- [[_COMMUNITY_Core Emitter|Core Emitter]]
- [[_COMMUNITY_Benchmark Experiments|Benchmark Experiments]]
- [[_COMMUNITY_TypeHL Translation Pipeline|TypeHL Translation Pipeline]]
- [[_COMMUNITY_Web UI Page Layer|Web UI Page Layer]]
- [[_COMMUNITY_JSDoc Spec Extraction|JSDoc Spec Extraction]]
- [[_COMMUNITY_Research Papers (ESLHSSL)|Research Papers (ESL/HSSL)]]
- [[_COMMUNITY_Heifer Verification Pipeline|Heifer Verification Pipeline]]
- [[_COMMUNITY_Heifer Project Architecture|Heifer Project Architecture]]
- [[_COMMUNITY_ANF Transformation|ANF Transformation]]
- [[_COMMUNITY_Prusti Benchmarks + Spec Lexer|Prusti Benchmarks + Spec Lexer]]
- [[_COMMUNITY_Prusti WIP Closures|Prusti WIP Closures]]
- [[_COMMUNITY_Verifier Runner + Tests|Verifier Runner + Tests]]
- [[_COMMUNITY_Web UI Core (WASM Bridge)|Web UI Core (WASM Bridge)]]
- [[_COMMUNITY_Prusti WIP Lambda|Prusti WIP Lambda]]
- [[_COMMUNITY_Prusti Counter Benchmark|Prusti Counter Benchmark]]
- [[_COMMUNITY_Prusti Blame Assignment|Prusti Blame Assignment]]
- [[_COMMUNITY_Prusti WIP Compose|Prusti WIP Compose]]
- [[_COMMUNITY_Core AST Types (DefSpec)|Core AST Types (Def/Spec)]]
- [[_COMMUNITY_Ace OCaml Highlighter|Ace OCaml Highlighter]]
- [[_COMMUNITY_Service Worker|Service Worker]]
- [[_COMMUNITY_Ace OCaml Build|Ace OCaml Build]]
- [[_COMMUNITY_Ace OCaml Web Build|Ace OCaml Web Build]]
- [[_COMMUNITY_Prusti Closure (Semantic)|Prusti Closure (Semantic)]]
- [[_COMMUNITY_Prusti Counter (Semantic)|Prusti Counter (Semantic)]]
- [[_COMMUNITY_Prusti Compose WIP (Semantic)|Prusti Compose WIP (Semantic)]]
- [[_COMMUNITY_AST Program Root|AST Program Root]]
- [[_COMMUNITY_Core Expression Type|Core Expression Type]]
- [[_COMMUNITY_Spec Lexer Module|Spec Lexer Module]]
- [[_COMMUNITY_JSDoc Extractor Module|JSDoc Extractor Module]]
- [[_COMMUNITY_Debug Library|Debug Library]]
- [[_COMMUNITY_Hipcore Typed Library|Hipcore Typed Library]]
- [[_COMMUNITY_Hipcore Common Library|Hipcore Common Library]]
- [[_COMMUNITY_OCaml Frontend Library|OCaml Frontend Library]]
- [[_COMMUNITY_Parsing Library|Parsing Library]]
- [[_COMMUNITY_APLAS 2022 Docker Artifact|APLAS 2022 Docker Artifact]]
- [[_COMMUNITY_ICFP 2024 Docker Artifact|ICFP 2024 Docker Artifact]]
- [[_COMMUNITY_TODO Variables Module|TODO: Variables Module]]

## God Nodes (most connected - your core abstractions)
1. `SpecParser` - 38 edges
2. `HipsleekEmitter` - 18 edges
3. `map()` - 15 edges
4. `CoreEmitter` - 11 edges
5. `ASTWalker` - 9 edges
6. `ESL – Effectful Specification Logic` - 8 edges
7. `run()` - 7 edges
8. `load_selected_example()` - 7 edges
9. `extractJSDocSpecs()` - 7 edges
10. `share()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `getCommentText()` --calls--> `map()`  [INFERRED]
  src/parser/jsdocExtractor.ts → Heifer-type/benchmarks/ho/prusti-wip/map.rs
- `run_heifer()` --calls--> `run()`  [INFERRED]
  Heifer-type/benchmarks/ho/experiments.py → Heifer-type/_build/default/web/page.js
- `HipSleek Emitter` --semantically_similar_to--> `Core Emitter`  [INFERRED] [semantically similar]
  src/emitter/hipsleekEmitter.ts → src/emitter/coreEmitter.ts
- `ASTWalker.walkFunctionDeclaration` --calls--> `extractJSDocSpecs()`  [EXTRACTED]
  src/translator/walker.ts → src/parser/jsdocExtractor.ts
- `ESL – Effectful Specification Logic` --conceptually_related_to--> `HSSL in FM 2024 TR`  [INFERRED]
  Heifer-type/docs/ICFP2024_TR.pdf → Heifer-type/docs/FM2024_TR.pdf

## Hyperedges (group relationships)
- **Heifer Verification Pipeline (ESL+HSSL)** — icfp2024_tr_esl, icfp2024_tr_staged_formulae, icfp2024_tr_biabduction, icfp2024_tr_heifer_verifier [EXTRACTED 0.95]
- **Web UI Integration Stack** — web_main_js, web_page_js, web_z3_wasm, web_hip_run_string [INFERRED 0.85]
- **HO Benchmark Suite Comparison** — experiments_run_heifer, experiments_run_cameleer, experiments_run_prusti [EXTRACTED 0.95]
- **TypeScript to HipSleek Translation Pipeline** — src_translator_walker_ts, src_parser_specparser_ts, src_translator_anf_ts, src_emitter_hipsleek_ts [INFERRED 0.90]
- **Specification Parsing Stack** — src_parser_lexer_ts, src_parser_specparser_ts, src_parser_jsdoc_ts [INFERRED 0.85]
- **Heifer Full Verification Pipeline** — heifer_pipeline_core_lang_typed, heifer_pipeline_forward_rules, heifer_pipeline_entail, heifer_pipeline_normalize, heifer_pipeline_simpl [EXTRACTED 0.95]
- **Heifer Prover Backends** — heifer_prover_z3, heifer_prover_why3, heifer_lib_provers [EXTRACTED 0.95]
- **Heifer Library Architecture** — heifer_lib_hipcore, heifer_lib_hipcore_typed, heifer_lib_hipprover, heifer_lib_provers, heifer_lib_ocamlfrontend [EXTRACTED 0.90]

## Communities

### Community 0 - "Spec Parser"
Cohesion: 0.2
Nodes (1): SpecParser

### Community 1 - "Core Emitter"
Cohesion: 0.15
Nodes (3): CoreEmitter, HipsleekEmitter, map()

### Community 2 - "Benchmark Experiments"
Cohesion: 0.13
Nodes (13): compute_stats(), count_loc(), eprint(), process_src_file(), Does not run the files, only counts lines.     Files can be absent for inexpress, Read Why3 session file, which contains a record of how the proof was done, Actualy run Heifer and collect stats, run_cameleer() (+5 more)

### Community 3 - "TypeHL Translation Pipeline"
Cohesion: 0.18
Nodes (7): HipsleekEmitter class, Core Emitter, HipSleek Emitter, Emitter Interface, ANF Tests, HipSleekEmitter Tests, SpecParser Tests

### Community 4 - "Web UI Page Layer"
Cohesion: 0.42
Nodes (13): clear_output(), current_example_name(), current_example_text(), debug_output(), editorGet(), editorSet(), enable_buttons(), load_selected_example() (+5 more)

### Community 5 - "JSDoc Spec Extraction"
Cohesion: 0.23
Nodes (5): cleanSpecCurlyBraces(), extractFromLeadingComments(), extractJSDocSpecs(), getCommentText(), ASTWalker

### Community 6 - "Research Papers (ESL/HSSL)"
Cohesion: 0.15
Nodes (15): Higher-Order Program Verification, HSSL in FM 2024 TR, OCaml 5 Native Effects, Algebraic Effects, Biabduction Normalization, Effect Handlers, ESL – Effectful Specification Logic, Heifer Verifier (ICFP 2024) (+7 more)

### Community 7 - "Heifer Verification Pipeline"
Cohesion: 0.2
Nodes (12): Hipprover Library (prover-dependent), Core_lang_typed (typedtree conversion), Entail.check_staged_spec_entailment, Hipprover.Forward_rules, Hipprover.Infer_types, Normalize (normalization rules), Reduce_shift_reset, Rewriting (unification variables) (+4 more)

### Community 8 - "Heifer Project Architecture"
Cohesion: 0.24
Nodes (10): hip.exe CLI Frontend, hipjs Web Frontend, Hipcore Library (untyped core AST), Provers Library (SMT backends), Simpl (SMT pre-simplification), Heifer Verifier Project, Why3 Prover Backend, Z3 Prover Backend (+2 more)

### Community 9 - "ANF Transformation"
Cohesion: 0.31
Nodes (5): ANFConverter, SpecLexer.tokenize, SpecParser.parseSpecStr, SpecParser.parseTypeStr, ASTWalker.walkFunctionDeclaration

### Community 10 - "Prusti Benchmarks + Spec Lexer"
Cohesion: 0.36
Nodes (2): test(), SpecLexer

### Community 11 - "Prusti WIP Closures"
Cohesion: 0.33
Nodes (1): List

### Community 12 - "Verifier Runner + Tests"
Cohesion: 0.53
Nodes (3): parseHipsleekOutput(), runHipsleek(), Verifier Tests

### Community 13 - "Web UI Core (WASM Bridge)"
Cohesion: 0.5
Nodes (4): hip_run_string WASM Entry, Web UI main.js, Web UI page.js, Z3 WASM Solver

### Community 14 - "Prusti WIP Lambda"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Prusti Counter Benchmark"
Cohesion: 1.0
Nodes (2): foo(), main()

### Community 16 - "Prusti Blame Assignment"
Cohesion: 1.0
Nodes (2): g(), main()

### Community 17 - "Prusti WIP Compose"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Core AST Types (Def/Spec)"
Cohesion: 1.0
Nodes (2): Definition (AST), FuncSpec – Function Specification

### Community 19 - "Ace OCaml Highlighter"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Service Worker"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Ace OCaml Build"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Ace OCaml Web Build"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Prusti Closure (Semantic)"
Cohesion: 1.0
Nodes (1): Prusti Closure Benchmark

### Community 24 - "Prusti Counter (Semantic)"
Cohesion: 1.0
Nodes (1): Prusti Counter Benchmark

### Community 25 - "Prusti Compose WIP (Semantic)"
Cohesion: 1.0
Nodes (1): Prusti WIP Compose (Expressiveness Limit)

### Community 26 - "AST Program Root"
Cohesion: 1.0
Nodes (1): Program (AST root)

### Community 27 - "Core Expression Type"
Cohesion: 1.0
Nodes (1): CoreExpr (core language expression)

### Community 28 - "Spec Lexer Module"
Cohesion: 1.0
Nodes (1): Spec Lexer

### Community 29 - "JSDoc Extractor Module"
Cohesion: 1.0
Nodes (1): JSDoc Extractor

### Community 30 - "Debug Library"
Cohesion: 1.0
Nodes (1): Debug Library

### Community 31 - "Hipcore Typed Library"
Cohesion: 1.0
Nodes (1): Hipcore_typed Library (typed core AST)

### Community 32 - "Hipcore Common Library"
Cohesion: 1.0
Nodes (1): Hipcore_common Library

### Community 33 - "OCaml Frontend Library"
Cohesion: 1.0
Nodes (1): Ocamlfrontend Library (OCaml parser)

### Community 34 - "Parsing Library"
Cohesion: 1.0
Nodes (1): Parsing Library (spec parsing)

### Community 35 - "APLAS 2022 Docker Artifact"
Cohesion: 1.0
Nodes (1): Docker: aplas22ae Artifact

### Community 36 - "ICFP 2024 Docker Artifact"
Cohesion: 1.0
Nodes (1): Docker: heifer-icfp24 Artifact

### Community 37 - "TODO: Variables Module"
Cohesion: 1.0
Nodes (1): TODO: Variables Module Refactor

## Knowledge Gaps
- **42 isolated node(s):** `Actualy run Heifer and collect stats`, `Does not run the files, only counts lines.     Files can be absent for inexpress`, `Read Why3 session file, which contains a record of how the proof was done`, `List`, `Effect Handlers` (+37 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Prusti WIP Compose`** (2 nodes): `main()`, `compose.rs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Core AST Types (Def/Spec)`** (2 nodes): `Definition (AST)`, `FuncSpec – Function Specification`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ace OCaml Highlighter`** (1 nodes): `ace_ocaml.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Service Worker`** (1 nodes): `coi-serviceworker.min.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ace OCaml Build`** (1 nodes): `ace_ocaml.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Ace OCaml Web Build`** (1 nodes): `ace_ocaml.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Prusti Closure (Semantic)`** (1 nodes): `Prusti Closure Benchmark`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Prusti Counter (Semantic)`** (1 nodes): `Prusti Counter Benchmark`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Prusti Compose WIP (Semantic)`** (1 nodes): `Prusti WIP Compose (Expressiveness Limit)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AST Program Root`** (1 nodes): `Program (AST root)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Core Expression Type`** (1 nodes): `CoreExpr (core language expression)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Spec Lexer Module`** (1 nodes): `Spec Lexer`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `JSDoc Extractor Module`** (1 nodes): `JSDoc Extractor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Debug Library`** (1 nodes): `Debug Library`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hipcore Typed Library`** (1 nodes): `Hipcore_typed Library (typed core AST)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Hipcore Common Library`** (1 nodes): `Hipcore_common Library`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OCaml Frontend Library`** (1 nodes): `Ocamlfrontend Library (OCaml parser)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Parsing Library`** (1 nodes): `Parsing Library (spec parsing)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `APLAS 2022 Docker Artifact`** (1 nodes): `Docker: aplas22ae Artifact`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ICFP 2024 Docker Artifact`** (1 nodes): `Docker: heifer-icfp24 Artifact`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TODO: Variables Module`** (1 nodes): `TODO: Variables Module Refactor`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SpecParser` connect `Spec Parser` to `TypeHL Translation Pipeline`, `JSDoc Spec Extraction`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `map()` connect `Core Emitter` to `ANF Transformation`, `Benchmark Experiments`, `JSDoc Spec Extraction`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `map()` (e.g. with `.emitDefinition()` and `.emitSpec()`) actually correct?**
  _`map()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Actualy run Heifer and collect stats`, `Does not run the files, only counts lines.     Files can be absent for inexpress`, `Read Why3 session file, which contains a record of how the proof was done` to the rest of the system?**
  _42 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Benchmark Experiments` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._