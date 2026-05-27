import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import { extractFunctions, emitOCaml, parseHeiferOutput } from "@/lib/pipeline"

const execFileAsync = promisify(execFile)

const HEIFER_DIR = path.resolve(process.cwd(), "../Heifer-type")
const OUT_DIR = path.join(HEIFER_DIR, "typehl_out")
const OUT_FILE = path.join(OUT_DIR, "output.ml")

async function getOpamEnv(): Promise<NodeJS.ProcessEnv> {
  try {
    const { stdout } = await execFileAsync("opam", ["env", "--shell=sh"])
    const env = { ...process.env }
    for (const line of stdout.split("\n")) {
      const m = line.match(/^(\w+)='([^']*)'/)
      if (m) env[m[1]] = m[2]
      else {
        const m2 = line.match(/^(\w+)=([^;]+)/)
        if (m2) env[m2[1]] = m2[2].replace(/;$/, "").trim()
      }
    }
    return env
  } catch {
    return process.env
  }
}

export async function POST(req: NextRequest) {
  let body: { code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const code = (body.code ?? "").trim()
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 })
  }

  const { fileLevel, entries } = extractFunctions(code)

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No @req/@ens annotations found. Add JSDoc @req and @ens tags above your functions." },
      { status: 422 }
    )
  }

  const ocaml = emitOCaml(fileLevel, entries)

  // Write OCaml to disk for Heifer
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(OUT_FILE, ocaml)
  } catch (e) {
    return NextResponse.json({ error: `Could not write output file: ${e}`, ocaml }, { status: 500 })
  }

  // Run Heifer verifier
  const env = await getOpamEnv()
  const relPath = path.relative(HEIFER_DIR, OUT_FILE)

  try {
    const { stdout, stderr } = await execFileAsync(
      "dune",
      ["exec", "main/hip.exe", relPath],
      { cwd: HEIFER_DIR, env, timeout: 90_000 }
    )
    const raw = stdout + stderr
    const result = parseHeiferOutput(raw, ocaml)
    return NextResponse.json(result)
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    const raw = (err.stdout ?? "") + (err.stderr ?? "")
    if (raw) {
      const result = parseHeiferOutput(raw, ocaml)
      return NextResponse.json(result)
    }
    return NextResponse.json(
      {
        error: `Heifer not available: ${err.message ?? e}. Is Heifer-type built? Run: cd ../Heifer-type && dune build`,
        ocaml,
        passed: [],
        failed: [],
        raw: "",
      },
      { status: 503 }
    )
  }
}
