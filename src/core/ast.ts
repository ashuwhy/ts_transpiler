// ══════════════════════════════════════════════════════════════════════
// src/core/ast.ts
// Core Language AST — Figure 2 + Figure 3 of the Sep-Types paper
// Every type maps 1:1 to a grammar production in the paper.
// ══════════════════════════════════════════════════════════════════════

// ─── Figure 2: Syntax of Full and Core Language with Types ───────────

/**
 * (Prog) prog ::= def₁ ; · · · ; defₙ
 */
export interface Program {
  kind: 'Program';
  predicates: PredDef[];
  definitions: Definition[];
}

/**
 * (Defn) def ::= f x₁···xₙ = e  where f :: λ x₁···xₙ r . Φ[r]
 */
export interface Definition {
  kind: 'Definition';
  name: string;
  params: Param[];
  body: CoreExpr;
  spec: FuncSpec | null;   // null when no JSDoc annotation
  returnTypeAnnotation?: string;
  rawSpec?: string;        // raw Heifer spec string e.g. "req x:#int ; ens res:#int"
}

/** A typed parameter — carries optional TS type annotation for the walker */
export interface Param {
  name: string;
  typeAnnotation?: string; // original TS type string, informational only
}

/**
 * Function specification:  λ x* r . Φ[r]
 * The `quantifiers` list captures  ∀T, s, s1 . ...
 */
export interface FuncSpec {
  kind: 'FuncSpec';
  quantifiers: QuantVar[];  // ∀T:AnyP, s, s1:Any  →  [{name:'T',bound:'AnyP'}, ...]
  params: string[];         // x₁ · · · xₙ
  result: string;           // r
  body: Spec;               // Φ[r]
}

export interface QuantVar {
  name: string;
  bound?: string;           // e.g. 'AnyP', 'Any' — omitted when unbounded
}

// ─── Core Expressions (Figure 2, "Core" production) ─────────────────

/**
 * (Core) e ::= val | let x = e₁ in e₂ | C(x₁…xₙ) | (f x₁···xₙ)
 *            | (t) x | match x {p₁→e₁ | ··· | pₙ→eₙ}
 */
export type CoreExpr =
  | VarExpr
  | ConstExpr
  | ErrExpr
  | AbrtExpr
  | LetExpr
  | ConstrExpr
  | CallExpr
  | CastExpr
  | MatchExpr
  | LambdaExpr
  | RecordExpr;

export interface VarExpr    { kind: 'Var';    name: string }
export interface ConstExpr  { kind: 'Const';  value: number | string | boolean }
export interface ErrExpr    { kind: 'Err' }
export interface AbrtExpr   { kind: 'Abrt' }

export interface LetExpr {
  kind: 'Let';
  bind: string;
  bindType?: Type;          // optional type annotation on let x:t = ...
  value: CoreExpr;
  body: CoreExpr;
}

/** C(x₁ … xₙ) — constructor arguments are always variables in Core */
export interface ConstrExpr {
  kind: 'Constr';
  name: string;             // e.g. 'Cons', 'Nil', 'Node'
  args: string[];           // variable names only (ANF guarantee)
}

/** f x₁···xₙ — function arguments are always variables in Core */
export interface CallExpr {
  kind: 'Call';
  func: string;
  args: string[];           // variable names only (ANF guarantee)
}

/** (t) x — type cast */
export interface CastExpr {
  kind: 'Cast';
  targetType: Type;
  arg: string;              // variable name only in Core
}

/** match x { p₁→e₁ | ··· | pₙ→eₙ } */
export interface MatchExpr {
  kind: 'Match';
  scrutinee: string;        // variable name only in Core
  branches: MatchBranch[];
}

export interface MatchBranch {
  pattern: Pattern;
  body: CoreExpr;
}

/** { f₁=x₁, … } — record literal; fields are variable names (ANF guarantee) */
export interface RecordExpr {
  kind: 'Record';
  fields: { name: string; value: string }[];   // value is a variable name
}

/** λ x* . e :: λ x* r . Φ[r] */
export interface LambdaExpr {
  kind: 'Lambda';
  params: string[];
  body: CoreExpr;
  spec: FuncSpec;
}

// ─── Base Types and Types (Figure 2) ────────────────────────────────

/**
 * (Base) base ::= x | {x} | {c} | Bool | Int | Str | Ref(···)
 *               | Err | Abrt | Any | ⊥ | ⊤
 *               | C(t₁…tₙ) | pred(t₁…tₙ)
 */
export type BaseType =
  | { kind: 'SingletonVar';  name: string }            // {x}
  | { kind: 'SingletonConst'; value: number | string } // {c}  e.g. {0}, {"hi"}
  | { kind: 'Prim';   name: PrimTypeName }             // Bool | Int | Str | Unit
  | { kind: 'RefType'; inner: Type }                   // Ref(T)
  | { kind: 'ErrType' }                                // Err
  | { kind: 'AbrtType' }                               // Abrt
  | { kind: 'AnyType' }                                // Any
  | { kind: 'AnyPType' }                               // AnyP  (universe of pure types)
  | { kind: 'BotType' }                                // ⊥
  | { kind: 'TopType' }                                // ⊤
  | { kind: 'ConstrType';  name: string; args: Type[] }                         // C(t₁…tₙ)
  | { kind: 'PredType';    name: string; args: Type[] }                         // pred(t₁…tₙ)
  | { kind: 'TypeVar';     name: string }                                        // type variable T
  | { kind: 'RecordType';  fields: { name: string; type: Type }[] };            // { f₁:t₁, … }

export type PrimTypeName = 'Bool' | 'Int' | 'Str' | 'Unit';

/**
 * (Type) t ::= base | ↦base | t₁→t₂ | t₁∧t₂ | t₁∨t₂ | ¬t
 */
export type Type =
  | BaseType
  | { kind: 'SepType';   inner: BaseType }              // ↦base  (separation type)
  | { kind: 'ArrowType'; from: Type;  to: Type }        // t₁ → t₂
  | { kind: 'AndType';   left: Type;  right: Type }     // t₁ ∧ t₂
  | { kind: 'OrType';    left: Type;  right: Type }     // t₁ ∨ t₂
  | { kind: 'NotType';   inner: Type }                  // ¬t
  | { kind: 'WildcardType' };                           // _

// ─── Patterns (Figure 2, line 364-365) ──────────────────────────────

/**
 * (Pattern) p ::= c | Bool | Int | Str | · · · | Err | Abrt | Any
 *              | C(x₁…xₙ) | pred(_) | _→_ | p₁∧p₂ | p₁∨p₂ | ¬p | _
 */
export type Pattern =
  | { kind: 'ConstPat';   value: number | string | boolean }
  | { kind: 'TypePat';    name: string }               // Bool, Int, Str, Err, Abrt, Any
  | { kind: 'ConstrPat';  name: string; bindings: string[] }  // C(x₁…xₙ)
  | { kind: 'PredPat';    name: string }               // pred(_)
  | { kind: 'ArrowPat' }                               // _→_
  | { kind: 'AndPat';     left: Pattern; right: Pattern }
  | { kind: 'OrPat';      left: Pattern; right: Pattern }
  | { kind: 'NotPat';     inner: Pattern }
  | { kind: 'WildcardPat' };                           // _

// ══════════════════════════════════════════════════════════════════════
// Figure 3: Type Logic Specification
// ══════════════════════════════════════════════════════════════════════

/**
 * (State) Δ ::= ∨ᵢ ∃v* · σᵢ ∧ πᵢ
 *
 * Represented as a single HeapPure, or a disjunction of two States.
 */
export type State =
  | { kind: 'HeapPure';  exists: string[]; heap: Heap; pure: Pure }
  | { kind: 'DisjState'; left: State; right: State }
  | { kind: 'TrueState' };   // trivially true pre-state (no constraints)

/**
 * (Heap) σ ::= emp | x↦t | σ₁ ∗ σ₂
 */
export type Heap =
  | { kind: 'Emp' }
  | { kind: 'PointsTo'; variable: string; type: Type }  // x↦t
  | { kind: 'SepConj';  left: Heap; right: Heap };      // σ₁ ∗ σ₂

/**
 * (Pure) π ::= x:t | x₁=x₂ | π₁∧π₂ | π₁∨π₂ | ¬π | ∃v*·π | true
 */
export type Pure =
  | { kind: 'TypeAssert';  variable: string; type: Type }           // x:t
  | { kind: 'Eq';          left: string; right: string }            // x₁=x₂
  | { kind: 'Neq';         left: string; right: string }            // x₁≠x₂
  | { kind: 'PureAnd';     left: Pure; right: Pure }                // π₁ ∧ π₂
  | { kind: 'PureOr';      left: Pure; right: Pure }                // π₁ ∨ π₂
  | { kind: 'PureNot';     inner: Pure }                            // ¬π
  | { kind: 'PureExists';  vars: string[]; body: Pure }             // ∃v* · π
  | { kind: 'Constraint';  left: string; op: ConstraintOp; right: string } // lo≤v
  | { kind: 'PureTrue' };                                           // true (trivial)

export type ConstraintOp = '<=' | '<' | '>=' | '>' | '=';

/**
 * (Spec) Φ ::= ens[r] Δ | case { Δ₁Φ₁ ; ··· ; ΔₙΦₙ } | ∀x* · Φ
 *
 * Shorthand:  req Δ₁ ens[r] Δ₂  ≡  case { Δ₁ ⇒ ens[r] Δ₂ }
 */
export type Spec =
  | { kind: 'EnsSpec';    result: string; post: State }             // ens[r] Δ
  | { kind: 'ReqEnsSpec'; params: string[]; pre: State;             // req[x*] Δ₁ ens[r] Δ₂
                           result: string; post: State }
  | { kind: 'CaseSpec';   params: string[];                         // case[x*] { Δ₁Φ₁; ... }
                           branches: CaseBranch[] }
  | { kind: 'ForallSpec'; vars: QuantVar[]; body: Spec };           // ∀x* · Φ

export interface CaseBranch {
  guard: State;             // Δᵢ  (precondition / guard)
  spec: Spec;               // Φᵢ  (postcondition spec)
  isOtherwise?: boolean;    // true for the implicit (_) ens[r] r:⊤ clause
}

// ─── Type Predicate Definitions (§2.4) ──────────────────────────────

/**
 * pred x : List(T) = x:Nil ∨ ∃r. x:Cons(T,r) ∧ r:List(T)
 * pred x↦MList(T) = x:Nil ∨ ∃r,r1. x↦Cons(T,r) ∗ r↦Ref(r1) ∗ r1↦MList(T)
 */
export interface PredDef {
  kind: 'PredDef';
  name: string;             // e.g. "List", "RBTree", "SortList"
  selfVar: string;          // e.g. "x" — the variable being typed
  typeParams: string[];     // e.g. ["T", "n"] or ["T", "c", "h"]
  isSeparation: boolean;    // true for x↦MList(T) style separation predicates
  body: State;              // The defining assertion (disjunction of cases)
}

// ─── Convenience constructors ───────────────────────────────────────

export const AST = {
  // Programs
  program: (predicates: PredDef[], definitions: Definition[]): Program =>
    ({ kind: 'Program', predicates, definitions }),

  // Definitions
  def: (name: string, params: Param[], body: CoreExpr, spec: FuncSpec | null, returnTypeAnnotation?: string, rawSpec?: string): Definition =>
    ({ kind: 'Definition', name, params, body, spec, returnTypeAnnotation, rawSpec }),

  param: (name: string, typeAnnotation?: string): Param =>
    ({ name, typeAnnotation }),

  funcSpec: (quantifiers: QuantVar[], params: string[], result: string, body: Spec): FuncSpec =>
    ({ kind: 'FuncSpec', quantifiers, params, result, body }),

  quantVar: (name: string, bound?: string): QuantVar =>
    ({ name, bound }),

  // Core Expressions
  varExpr:   (name: string): VarExpr    => ({ kind: 'Var', name }),
  constExpr: (value: number | string | boolean): ConstExpr => ({ kind: 'Const', value }),
  errExpr:   (): ErrExpr    => ({ kind: 'Err' }),
  abrtExpr:  (): AbrtExpr   => ({ kind: 'Abrt' }),

  letExpr: (bind: string, value: CoreExpr, body: CoreExpr, bindType?: Type): LetExpr =>
    ({ kind: 'Let', bind, value, body, bindType }),

  constrExpr: (name: string, args: string[]): ConstrExpr =>
    ({ kind: 'Constr', name, args }),

  callExpr: (func: string, args: string[]): CallExpr =>
    ({ kind: 'Call', func, args }),

  castExpr: (targetType: Type, arg: string): CastExpr =>
    ({ kind: 'Cast', targetType, arg }),

  matchExpr: (scrutinee: string, branches: MatchBranch[]): MatchExpr =>
    ({ kind: 'Match', scrutinee, branches }),

  branch: (pattern: Pattern, body: CoreExpr): MatchBranch =>
    ({ pattern, body }),

  lambdaExpr: (params: string[], body: CoreExpr, spec: FuncSpec): LambdaExpr =>
    ({ kind: 'Lambda', params, body, spec }),

  // Types
  singletonVar:  (name: string): BaseType  => ({ kind: 'SingletonVar', name }),
  singletonConst:(v: number|string): BaseType => ({ kind: 'SingletonConst', value: v }),
  primType:      (name: PrimTypeName): BaseType => ({ kind: 'Prim', name }),
  refType:       (inner: Type): BaseType    => ({ kind: 'RefType', inner }),
  errType:       (): BaseType               => ({ kind: 'ErrType' }),
  abrtType:      (): BaseType               => ({ kind: 'AbrtType' }),
  anyType:       (): BaseType               => ({ kind: 'AnyType' }),
  anyPType:      (): BaseType               => ({ kind: 'AnyPType' }),
  botType:       (): BaseType               => ({ kind: 'BotType' }),
  topType:       (): BaseType               => ({ kind: 'TopType' }),
  constrType:    (name: string, args: Type[]): BaseType => ({ kind: 'ConstrType', name, args }),
  predType:      (name: string, args: Type[]): BaseType => ({ kind: 'PredType', name, args }),
  typeVar:       (name: string): BaseType   => ({ kind: 'TypeVar', name }),
  recordType:    (fields: { name: string; type: Type }[]): BaseType => ({ kind: 'RecordType', fields }),

  recordExpr:    (fields: { name: string; value: string }[]): RecordExpr => ({ kind: 'Record', fields }),

  sepType:       (inner: BaseType): Type    => ({ kind: 'SepType', inner }),
  arrowType:     (from: Type, to: Type): Type => ({ kind: 'ArrowType', from, to }),
  andType:       (left: Type, right: Type): Type => ({ kind: 'AndType', left, right }),
  orType:        (left: Type, right: Type): Type => ({ kind: 'OrType', left, right }),
  notType:       (inner: Type): Type        => ({ kind: 'NotType', inner }),
  wildcardType:  (): Type                   => ({ kind: 'WildcardType' }),

  // Patterns
  constPat:    (value: number|string|boolean): Pattern => ({ kind: 'ConstPat', value }),
  typePat:     (name: string): Pattern      => ({ kind: 'TypePat', name }),
  constrPat:   (name: string, bindings: string[]): Pattern => ({ kind: 'ConstrPat', name, bindings }),
  predPat:     (name: string): Pattern      => ({ kind: 'PredPat', name }),
  arrowPat:    (): Pattern                  => ({ kind: 'ArrowPat' }),
  andPat:      (left: Pattern, right: Pattern): Pattern => ({ kind: 'AndPat', left, right }),
  orPat:       (left: Pattern, right: Pattern): Pattern => ({ kind: 'OrPat', left, right }),
  notPat:      (inner: Pattern): Pattern    => ({ kind: 'NotPat', inner }),
  wildcardPat: (): Pattern                  => ({ kind: 'WildcardPat' }),

  // States (Figure 3)
  heapPure: (exists: string[], heap: Heap, pure: Pure): State =>
    ({ kind: 'HeapPure', exists, heap, pure }),
  disjState: (left: State, right: State): State =>
    ({ kind: 'DisjState', left, right }),
  trueState: (): State => ({ kind: 'TrueState' }),

  // Heaps
  emp:      (): Heap => ({ kind: 'Emp' }),
  pointsTo: (variable: string, type: Type): Heap => ({ kind: 'PointsTo', variable, type }),
  sepConj:  (left: Heap, right: Heap): Heap => ({ kind: 'SepConj', left, right }),

  // Pure constraints
  typeAssert:  (variable: string, type: Type): Pure => ({ kind: 'TypeAssert', variable, type }),
  eq:          (left: string, right: string): Pure => ({ kind: 'Eq', left, right }),
  neq:         (left: string, right: string): Pure => ({ kind: 'Neq', left, right }),
  pureAnd:     (left: Pure, right: Pure): Pure => ({ kind: 'PureAnd', left, right }),
  pureOr:      (left: Pure, right: Pure): Pure => ({ kind: 'PureOr', left, right }),
  pureNot:     (inner: Pure): Pure => ({ kind: 'PureNot', inner }),
  pureExists:  (vars: string[], body: Pure): Pure => ({ kind: 'PureExists', vars, body }),
  constraint:  (left: string, op: ConstraintOp, right: string): Pure =>
    ({ kind: 'Constraint', left, op, right }),
  pureTrue:    (): Pure => ({ kind: 'PureTrue' }),

  // Specs
  ensSpec:    (result: string, post: State): Spec =>
    ({ kind: 'EnsSpec', result, post }),
  reqEnsSpec: (params: string[], pre: State, result: string, post: State): Spec =>
    ({ kind: 'ReqEnsSpec', params, pre, result, post }),
  caseSpec:   (params: string[], branches: CaseBranch[]): Spec =>
    ({ kind: 'CaseSpec', params, branches }),
  forallSpec: (vars: QuantVar[], body: Spec): Spec =>
    ({ kind: 'ForallSpec', vars, body }),
  caseBranch: (guard: State, spec: Spec, isOtherwise?: boolean): CaseBranch =>
    ({ guard, spec, isOtherwise }),

  // Predicate definitions
  predDef: (name: string, selfVar: string, typeParams: string[],
            isSeparation: boolean, body: State): PredDef =>
    ({ kind: 'PredDef', name, selfVar, typeParams, isSeparation, body }),
} as const;
