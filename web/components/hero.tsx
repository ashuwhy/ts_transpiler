import { Badge } from "@/components/ui/badge"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/40 bg-background px-6 py-20 text-center lg:py-28">
      {/* grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.985 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.985 0 0) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            TypeScript → OCaml → Separation Logic
          </Badge>
          <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-400">
            25 / 25 entail checks passed
          </Badge>
        </div>

        <h1 className="mb-4 text-5xl font-bold tracking-tight lg:text-6xl">
          Type<span className="text-muted-foreground">HL</span>
        </h1>

        <p className="mb-3 text-xl text-muted-foreground">
          Annotate TypeScript with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-base text-foreground">
            @req
          </code>{" "}
          /{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-base text-foreground">
            @ens
          </code>{" "}
          specs
        </p>
        <p className="mb-8 text-xl text-muted-foreground">
          Get{" "}
          <span className="text-foreground font-medium">Heifer-type</span>{" "}
          separation logic verification that TypeScript{" "}
          <span className="text-foreground font-medium">cannot express</span>
        </p>

        {/* mini terminal */}
        <div className="mx-auto max-w-2xl rounded-lg border border-border/60 bg-card text-left shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              tsx scripts/convert.ts examples/type_demo.ts
            </span>
          </div>
          <div className="p-4 font-mono text-sm">
            <div className="text-muted-foreground">
              <span className="text-emerald-400">[PASS]</span>{" "}
              <span className="text-foreground">plus</span>
              {"  "}[ Entail Check ] true
            </div>
            <div className="text-muted-foreground">
              <span className="text-emerald-400">[PASS]</span>{" "}
              <span className="text-foreground">deref</span>
              {"  "}[ Entail Check ] true
            </div>
            <div className="text-muted-foreground">
              <span className="text-emerald-400">[PASS]</span>{" "}
              <span className="text-foreground">inc_inplace</span>
              {"  "}[ Entail Check ] true
            </div>
            <div className="text-muted-foreground">
              <span className="text-emerald-400">[PASS]</span>{" "}
              <span className="text-foreground">swap</span>
              {"  "}[ Entail Check ] true
            </div>
            <div className="text-muted-foreground">
              <span className="text-emerald-400">[PASS]</span>{" "}
              <span className="text-foreground">tail</span>
              {"  "}[ Entail Check ] true
            </div>
            <div className="mt-2 text-emerald-400 font-semibold">
              ALL 5 SPEC(S) VERIFIED
            </div>
          </div>
        </div>

        {/* feature tags */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          {[
            "Heap ownership",
            "Separating conjunction",
            "Type mutation",
            "Aliasing analysis",
            "Parametric polymorphism",
            "ADT dispatch",
          ].map((f) => (
            <span key={f} className="rounded-full border border-border/50 px-3 py-1">
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
