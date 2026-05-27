import { Hero } from "@/components/hero"
import { LiveDemo } from "@/components/live-demo"
import { KeyExamples } from "@/components/key-examples"
import { FunctionGrid } from "@/components/function-grid"
import { ComparisonTable } from "@/components/comparison-table"

export default function Home() {
  return (
    <main>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <span className="font-mono text-sm font-semibold">
            Type<span className="text-muted-foreground">HL</span>
          </span>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#demo" className="hover:text-foreground transition-colors">
              Demo
            </a>
            <a href="#patterns" className="hover:text-foreground transition-colors">
              Patterns
            </a>
            <a href="#compare" className="hover:text-foreground transition-colors">
              Compare
            </a>
          </div>
        </div>
      </nav>

      <Hero />

      <section className="mx-auto max-w-4xl px-6 py-12 text-center text-muted-foreground">
        <p className="text-lg leading-relaxed">
          <strong>TypeHL for TypeScript</strong> is a research prototype demonstrating separation logic applied to mainstream programming languages. It provides a front-end for annotating TypeScript with structural separation-logic specifications, compiling them into OCaml stubs verified by the Heifer backend. This prevents issues like unsound aliasing while maintaining a familiar developer experience.
        </p>
      </section>

      <div id="demo">
        <LiveDemo />
      </div>

      <KeyExamples />

      <div id="patterns">
        <FunctionGrid />
      </div>

      <div id="compare">
        <ComparisonTable />
      </div>

      <footer className="border-t border-border/40 px-6 py-8">
        <div className="mx-auto max-w-7xl text-center text-xs text-muted-foreground">
          TypeHL · TypeScript → Heifer-type separation logic verification ·{" "}
          <code className="font-mono">tsx scripts/convert.ts examples/type_demo_full.ts</code>
        </div>
      </footer>
    </main>
  )
}
