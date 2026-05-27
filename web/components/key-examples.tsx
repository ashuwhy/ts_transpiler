const KEY_EXAMPLES = [
  {
    title: "Type Mutation",
    fn: "inc_inplace",
    why: "TypeScript type-checks snapshots, not state transitions. It either rejects the typed version or loses all type info with any.",
    tsLabel: "TypeScript: Rejects or loses type info",
    tsCode: `// TS: type error OR unconstrained any
function inc_inplace(x: { val: number }): void {
  // Error: string not assignable to number
  x.val = String(x.val + 1);
}`,
    heiferLabel: "Heifer-type: Verifies type transition",
    heiferCode: `let inc_inplace x = failwith "assume"
 (*@ assume
   req x->#Ref[int];
   ens x->#Ref[str]
 @*)`,
    accent: "emerald",
    insight: "Ref[int] before → Ref[str] after. TypeScript has no concept of type-state.",
  },
  {
    title: "Aliasing Split",
    fn: "swap(x, x) vs swap(x, y)",
    why: "TypeScript gives both calls the same type. Heifer separates them: disjoint ownership (*) vs aliased case (x=y).",
    tsLabel: "TypeScript: Same type for both calls",
    tsCode: `// TS: swap(x, x) and swap(x, y)
// are completely indistinguishable
function swap(x: any, y: any): void {
  const t = x.val;
  x.val = y.val;
  y.val = t;
}`,
    heiferLabel: "Heifer-type: Separate verified cases",
    heiferCode: `let swap x y = failwith "assume"
 (*@ assume
   req x->#Ref[a'] /\\ x=y;
   ens x->#Ref[a'] /\\ x=y
 $ req x->#Ref[a'] * y->#Ref[b'];
   ens x->#Ref[b'] * y->#Ref[a']
 @*)`,
    accent: "violet",
    insight: "* is separating conjunction — asserts x and y are disjoint heap locations.",
  },
  {
    title: "Deep Structure",
    fn: "list_seg",
    why: "TypeScript treats all arrays as T[] with no structural constraints. Heifer reasons about exact linked-list shapes and entails them to abstract predicates.",
    tsLabel: "TypeScript: Unconstrained array (any[])",
    tsCode: `// TS: no structural constraints at all
// x is just "any" — could be anything
function list_seg(x: any): any {
  return x;
}`,
    heiferLabel: "Heifer-type: Verified structural cases",
    heiferCode: `let list_seg x = failwith "assume"
 (*@ assume
   req x->#Cons[int,y]
     * y->#Cons[int,z]
     * z->#Cons[int,Nil[]];
   ens x->#List[int] /\\ res=x
 $ req x->#Cons[1,y]
     * y->#Cons[2,z]
     * z->#Cons[3,Nil[]];
   ens x->#List[int] /\\ res=x
 @*)`,
    accent: "sky",
    insight: "Heifer proves that a concrete 3-element Cons chain entails the abstract List[int] predicate.",
  },
]

const accentMap: Record<string, { badge: string; border: string; glow: string }> = {
  emerald: {
    badge: "text-emerald-400 border-emerald-500/30",
    border: "border-emerald-500/20",
    glow: "bg-emerald-950/30",
  },
  violet: {
    badge: "text-violet-400 border-violet-500/30",
    border: "border-violet-500/20",
    glow: "bg-violet-950/30",
  },
  sky: {
    badge: "text-sky-400 border-sky-500/30",
    border: "border-sky-500/20",
    glow: "bg-sky-950/30",
  },
}

export function KeyExamples() {
  return (
    <section className="border-b border-border/40 px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <h2 className="text-2xl font-bold">Core Evaluation Examples</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Key patterns where TypeScript cannot express what Heifer-type verifies
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {KEY_EXAMPLES.map((k) => {
            const acc = accentMap[k.accent]
            return (
              <div
                key={k.fn}
                className={`flex flex-col gap-4 rounded-xl border p-5 ${acc.border} ${acc.glow}`}
              >
                <div>
                  <div className={`mb-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${acc.badge}`}>
                    {k.title}
                  </div>
                  <h3 className="mt-1 font-mono text-sm font-semibold text-foreground">
                    {k.fn}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{k.why}</p>
                </div>

                <div className="space-y-3">
                  {/* TypeScript */}
                  <div>
                    <div className="mb-1 text-xs text-red-400/80 font-medium">{k.tsLabel}</div>
                    <pre className="overflow-x-auto rounded-md border border-red-500/10 bg-red-950/20 p-3 font-mono text-xs text-muted-foreground leading-relaxed">
                      {k.tsCode}
                    </pre>
                  </div>

                  {/* Heifer */}
                  <div>
                    <div className={`mb-1 text-xs font-medium ${acc.badge.split(" ")[0]}`}>
                      {k.heiferLabel}
                    </div>
                    <pre className={`overflow-x-auto rounded-md border p-3 font-mono text-xs text-muted-foreground leading-relaxed ${acc.border} ${acc.glow}`}>
                      {k.heiferCode}
                    </pre>
                  </div>
                </div>

                <div className={`mt-auto rounded-md border px-3 py-2 text-xs ${acc.border}`}>
                  <span className="font-medium text-foreground">Key insight: </span>
                  <span className="text-muted-foreground">{k.insight}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
