"use client"

import { useState, useCallback } from "react"
import { DEMO_CODE, DEMO_CACHED, EXAMPLES } from "@/lib/examples"
import { extractFunctions, emitOCaml, type VerifyResult } from "@/lib/pipeline"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const DEMO_IMPL_OCAML = `let plus x y
(*@ req x:#int /\\ y:#int; ens res:#int @*)
= (x + y)

let inc_inplace x
(*@ req x->#Ref[int]; ens x->#Ref[str] @*)
= let _t0 = !x in
let _t1 = (_t0 + 1) in
let _t2 = (string_of_int _t1) in
(x := _t2)

let swap x y
(*@ req x->#Ref[a'] /\\ x=y; ens x->#Ref[a'] /\\ x=y
  $ req x->#Ref[a'] * y->#Ref[b']; ens x->#Ref[b'] * y->#Ref[a'] @*)
= let v1 = !x in
let v2 = !y in
(x := v2);
(y := v1)`

type OcamlMode = "stub" | "impl"

function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-current opacity-60 animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  )
}

export function LiveDemo() {
  const [code, setCode] = useState(DEMO_CODE)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedExample, setSelectedExample] = useState("custom")
  const [ocamlMode, setOcamlMode] = useState<OcamlMode>("stub")

  const verify = useCallback(async () => {
    if (selectedExample === "custom") {
      const { fileLevel, entries } = extractFunctions(code)
      const ocaml = emitOCaml(fileLevel, entries)
      setResult({ raw: "", ocaml, ...DEMO_CACHED })
      setError(null)
      return
    }
    const ex = EXAMPLES.find((e) => e.id === selectedExample)
    if (ex) {
      setResult({ raw: "", ocaml: ex.ocamlSpec, ...ex.cached })
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.error && !data.passed) {
        setError(data.error)
        if (data.ocaml) setResult({ ...data, passed: [], failed: [] })
      } else {
        setResult(data)
      }
    } catch (e) {
      setError(`Network error: ${e}`)
    } finally {
      setLoading(false)
    }
  }, [code, selectedExample])

  const loadExample = (id: string) => {
    setSelectedExample(id)
    if (id === "custom") {
      setCode(DEMO_CODE)
    } else {
      const ex = EXAMPLES.find((e) => e.id === id)
      if (ex) setCode(ex.tsCode)
    }
    setResult(null)
    setError(null)
  }

  const total = result ? result.passed.length + result.failed.length : 0
  const allPass = result && total > 0 && result.failed.length === 0

  // Determine which OCaml to show
  const getDisplayedOcaml = () => {
    if (ocamlMode === "impl") {
      if (selectedExample === "custom") return DEMO_IMPL_OCAML
      const ex = EXAMPLES.find((e) => e.id === selectedExample)
      return ex?.implOcaml ?? result?.ocaml
    }
    return result?.ocaml
  }

  const displayedOcaml = getDisplayedOcaml()

  return (
    <section className="border-b border-border/40 px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Live Demo</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Edit TypeScript with{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">@req</code> /{" "}
            <code className="font-mono text-xs bg-muted px-1 rounded">@ens</code> JSDoc tags, then
            click Verify to run the full Heifer-type pipeline.
          </p>
        </div>

        {/* toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <select
            value={selectedExample}
            onChange={(e) => loadExample(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="custom">Quick demo (3 functions)</option>
            {EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} — {ex.pattern}
              </option>
            ))}
          </select>

          <button
            onClick={verify}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                Running <LoadingDots />
              </>
            ) : (
              "Verify"
            )}
          </button>

          {result && total > 0 && (
            <Badge
              variant="outline"
              className={
                allPass
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-red-500/40 text-red-400"
              }
            >
              {allPass ? `${total}/${total} passed` : `${result.failed.length}/${total} failed`}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* TypeScript editor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                TypeScript Input
              </span>
              <Badge variant="outline" className="text-xs font-mono">
                .ts
              </Badge>
            </div>
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setSelectedExample("custom")
              }}
              spellCheck={false}
              className="h-96 w-full resize-none rounded-lg border border-border/60 bg-card p-4 font-mono text-sm text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* OCaml output + results */}
          <div className="flex flex-col gap-4">
            {/* OCaml panel with stub/impl toggle */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Emitted OCaml
                </span>
                <div className="flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
                  <button
                    onClick={() => setOcamlMode("stub")}
                    className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                      ocamlMode === "stub"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    stub
                  </button>
                  <button
                    onClick={() => setOcamlMode("impl")}
                    className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                      ocamlMode === "impl"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    impl
                  </button>
                </div>
              </div>
              <pre className="h-44 overflow-auto rounded-lg border border-border/60 bg-card p-4 font-mono text-sm text-muted-foreground leading-relaxed">
                {displayedOcaml ?? (
                  <span className="italic text-muted-foreground/50">
                    {ocamlMode === "stub"
                      ? "Click Verify to see emitted OCaml stubs"
                      : "Select an example or click Verify to see OCaml implementation"}
                  </span>
                )}
              </pre>
            </div>

            <Separator />

            {/* Results */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Heifer-type Results
              </span>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 font-mono text-xs text-red-400">
                  {error}
                </div>
              )}

              {!result && !error && !loading && (
                <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground/60 italic">
                  Results appear here after verification
                </div>
              )}

              {loading && (
                <div className="rounded-lg border border-border/40 p-4 text-sm text-muted-foreground">
                  Running Heifer-type verifier{" "}
                  <LoadingDots />
                </div>
              )}

              {result && total === 0 && !error && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-3 text-xs text-yellow-400">
                  No entail checks found — ensure functions have @req and @ens JSDoc tags
                </div>
              )}

              {result && (
                <div className="space-y-1">
                  {result.passed.map((fn) => (
                    <div
                      key={fn}
                      className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-1.5 font-mono text-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-foreground">{fn}</span>
                      <span className="ml-auto text-xs text-emerald-400/70">
                        [ Entail Check ] true
                      </span>
                    </div>
                  ))}
                  {result.failed.map((fn) => (
                    <div
                      key={fn}
                      className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-950/20 px-3 py-1.5 font-mono text-sm"
                    >
                      <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-foreground">{fn}</span>
                      <span className="ml-auto text-xs text-red-400/70">
                        [ Entail Check ] false
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
