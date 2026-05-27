import { COMPARISON_TABLE } from "@/lib/examples"

function Code({ children }: { children: string }) {
  return (
    <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  )
}

function renderWithCode(text: string) {
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <Code key={i}>{part.slice(1, -1)}</Code>
    ) : (
      part
    )
  )
}

export function ComparisonTable() {
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">TypeScript vs Heifer-type</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            15 patterns where TypeScript falls short — and how Heifer-type's separation logic fills the gap
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-8">#</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-40">Pattern</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">TypeScript</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Heifer-type spec</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Why TypeScript fails</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_TABLE.map((row, idx) => (
                <tr
                  key={row.n}
                  className={`border-b border-border/30 transition-colors hover:bg-muted/20 ${
                    idx % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground/60">
                    {row.n}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{row.pattern}</td>
                  <td className="px-4 py-3 text-muted-foreground">{renderWithCode(row.ts)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{renderWithCode(row.heifer)}</td>
                  <td className="px-4 py-3 text-muted-foreground/80 text-xs">{renderWithCode(row.why)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* spec syntax legend */}
        <div className="mt-8 rounded-xl border border-border/40 p-5">
          <h3 className="mb-4 text-sm font-semibold">Spec Syntax Reference</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs md:grid-cols-3 lg:grid-cols-4">
            {[
              ["x:#int", "x evaluates to an int"],
              ["x->#Ref[int]", "x points to a heap cell holding int"],
              ["P * Q", "P and Q on disjoint heap regions"],
              ["P /\\ Q", "P and Q (same heap)"],
              ["P \\/ Q", "P or Q holds"],
              ["P $ Q", "case split: P OR Q (multi-spec)"],
              ["req P; ens Q", "precondition P, postcondition Q"],
              ["forall t.", "universal type quantifier"],
              ["#Ref[t']", "heap cell holding type t'"],
              ["#List[t']", "abstract list predicate"],
              ["#Cons[h,t]", "constructor node: head h, tail t"],
              ["#Nil[]", "empty list / nil constructor"],
            ].map(([syntax, meaning]) => (
              <div key={syntax} className="flex items-start gap-2">
                <Code>{syntax}</Code>
                <span className="text-muted-foreground">{meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
