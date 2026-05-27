export interface FuncEntry {
  name: string
  params: string[]
  reqs: string[]
  enss: string[]
  forall?: string
  isRec: boolean
}

export interface FileLevel {
  preds: string[]
}

export interface VerifyResult {
  raw: string
  passed: string[]
  failed: string[]
  ocaml: string
  error?: string
}

export function extractFunctions(src: string): { fileLevel: FileLevel; entries: FuncEntry[] } {
  const preds: string[] = []
  const entries: FuncEntry[] = []

  const topMatch = src.match(/^\/\*\*([\s\S]*?)\*\//)
  if (topMatch) {
    for (const line of topMatch[1].split("\n")) {
      const m = line.match(/\*\s*@pred\s+(.+)/)
      if (m) preds.push(m[1].trim())
    }
  }

  const funcRe =
    /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = funcRe.exec(src)) !== null) {
    const jsdoc = match[1]
    const name = match[2]
    const paramStr = match[3]

    const params = paramStr
      .split(",")
      .map((p) => p.trim().split(":")[0].trim().replace(/^_+/, ""))
      .filter((p) => p && p !== "this")

    const reqs: string[] = []
    const enss: string[] = []
    let forall: string | undefined
    let isRec = false

    for (const line of jsdoc.split("\n")) {
      const m = line.match(/\*\s*@(req|ens|forall|rec)\s*(.*)/)
      if (!m) continue
      const val = m[2].trim()
      if (m[1] === "req" && val) reqs.push(val)
      else if (m[1] === "ens" && val) enss.push(val)
      else if (m[1] === "forall") forall = val
      else if (m[1] === "rec") isRec = true
    }

    if (reqs.length > 0 || enss.length > 0) {
      entries.push({ name, params, reqs, enss, forall, isRec })
    }
  }

  return { fileLevel: { preds }, entries }
}

export function emitOCaml(fileLevel: FileLevel, entries: FuncEntry[]): string {
  const lines: string[] = []

  for (const pred of fileLevel.preds) {
    lines.push(`(*@ pred ${pred} @*)`)
  }
  if (fileLevel.preds.length > 0) lines.push("")

  for (const fn of entries) {
    const letKw = fn.isRec ? "let rec" : "let"
    const paramStr = fn.params.length > 0 ? fn.params.join(" ") : "()"
    const caseCount = Math.max(fn.reqs.length, fn.enss.length, 1)

    const cases: string[] = []
    for (let i = 0; i < caseCount; i++) {
      const req = fn.reqs[i] ?? "emp"
      const ens = fn.enss[i] ?? "emp"
      cases.push(`req ${req}; ens ${ens}`)
    }

    const casesStr = cases.join("\n  $ ")
    const specBody = fn.forall ? `forall ${fn.forall} ${casesStr}` : casesStr

    lines.push(`${letKw} ${fn.name} ${paramStr} = failwith "assume"`)
    lines.push(` (*@ assume ${specBody} @*)`)
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}

export function parseHeiferOutput(raw: string, ocaml: string): VerifyResult {
  const passed: string[] = []
  const failed: string[] = []
  let currentFn = ""

  for (const line of raw.split("\n")) {
    const fnMatch = line.match(/Function:\s+(\w+)/)
    if (fnMatch) {
      currentFn = fnMatch[1]
      continue
    }
    const entailMatch = line.match(/Entail Check\s*\]\s*(true|false)/)
    if (entailMatch && currentFn) {
      if (entailMatch[1] === "true") passed.push(currentFn)
      else failed.push(currentFn)
      currentFn = ""
    }
    if (line.includes("error occurred") && currentFn) {
      failed.push(currentFn)
      currentFn = ""
    }
  }

  return { raw, passed, failed, ocaml }
}
