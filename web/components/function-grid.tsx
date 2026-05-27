import { EXAMPLES } from "@/lib/examples"
import { Badge } from "@/components/ui/badge"

const verdictColor = {
  rejects: "border-red-500/30 text-red-400",
  imprecise: "border-yellow-500/30 text-yellow-400",
  unsound: "border-orange-500/30 text-orange-400",
} as const

const verdictLabel = {
  rejects: "TS rejects",
  imprecise: "TS imprecise",
  unsound: "TS unsound",
} as const

export function FunctionGrid() {
  return (
    <section className="border-b border-border/40 px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <h2 className="text-2xl font-bold">All Spec Patterns</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {EXAMPLES.length} functions covering every separation-logic pattern in Heifer-type's test suite
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <div
              key={ex.id}
              className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-border"
            >
              {/* header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <code className="font-mono text-sm font-semibold text-foreground">
                    {ex.name}
                  </code>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ex.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline" className="text-xs">
                    {ex.pattern}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${verdictColor[ex.tsVerdict]}`}
                  >
                    {verdictLabel[ex.tsVerdict]}
                  </Badge>
                </div>
              </div>

              {/* OCaml spec */}
              <pre className="overflow-x-auto rounded-md border border-border/40 bg-background p-3 font-mono text-xs text-muted-foreground leading-relaxed">
                {ex.ocamlSpec}
              </pre>

              {/* Heifer verdict */}
              <div className="rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-1.5 text-xs">
                <span className="text-emerald-400 font-medium">Heifer: </span>
                <span className="text-muted-foreground">{ex.heiferVerdict}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
