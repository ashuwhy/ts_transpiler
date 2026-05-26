#!/usr/bin/env tsx
// scripts/convert.ts
// TypeHL → Heifer-type pipeline:
//   1. Read a TypeScript file
//   2. Extract @req / @ens from JSDoc above each function
//   3. Emit OCaml  let fname args = failwith "assume"  (*@ assume req...; ens... @*)
//   4. Save as Heifer-type/output.ml
//   5. Run dune exec main/hip.exe output.ml and report Pass/Fail

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEIFER_DIR  = path.resolve(__dirname, '../Heifer-type');
// output.ml must be in a subdir — placing it directly in HEIFER_DIR causes Why3
// to find extras.why twice (once via cwd, once via input-file dir), which is an error.
const OUTPUT_SUBDIR = path.join(HEIFER_DIR, 'typehl_out');
const OUTPUT_ML     = path.join(OUTPUT_SUBDIR, 'output.ml');

// ─── Types ────────────────────────────────────────────────────────────

interface FuncEntry {
  name: string;
  params: string[];
  /** Parallel arrays: reqs[i] pairs with enss[i] as one case spec */
  reqs: string[];
  enss: string[];
}

// ─── Parse TypeScript source ──────────────────────────────────────────

function extractFunctions(src: string, filePath: string): FuncEntry[] {
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const entries: FuncEntry[] = [];

  ts.forEachChild(sf, node => {
    if (!ts.isFunctionDeclaration(node) || !node.name) return;

    const name = node.name.text;
    const params = node.parameters
      .map(p => (p.name as ts.Identifier).text)
      .filter(n => n !== 'this');

    const reqs: string[] = [];
    const enss: string[] = [];

    for (const tag of ts.getJSDocTags(node)) {
      const tagText = typeof tag.comment === 'string'
        ? tag.comment
        : Array.isArray(tag.comment)
          ? (tag.comment as ts.NodeArray<ts.JSDocComment>).map(c => c.text).join('')
          : '';

      const cleaned = tagText.trim();
      if (!cleaned) continue;

      if (tag.tagName.text === 'req') reqs.push(cleaned);
      else if (tag.tagName.text === 'ens') enss.push(cleaned);
    }

    // Fallback: parse from raw leading comment text (for editors that mangle tags)
    if (reqs.length === 0 && enss.length === 0) {
      const text = sf.text;
      const ranges = ts.getLeadingCommentRanges(text, node.pos) ?? [];
      for (const r of ranges) {
        const block = text.slice(r.pos, r.end);
        for (const line of block.split('\n')) {
          const m = line.match(/\*\s*@(req|ens)\s+(.*)/);
          if (m) {
            if (m[1] === 'req') reqs.push(m[2].trim());
            else                enss.push(m[2].trim());
          }
        }
      }
    }

    if (reqs.length > 0 || enss.length > 0) {
      entries.push({ name, params, reqs, enss });
    }
  });

  return entries;
}

// ─── Emit OCaml ───────────────────────────────────────────────────────

function emitOCaml(entries: FuncEntry[]): string {
  const lines: string[] = [];

  for (const fn of entries) {
    const paramStr = fn.params.length > 0 ? fn.params.join(' ') : '()';
    const caseCount = Math.max(fn.reqs.length, fn.enss.length, 1);

    const cases: string[] = [];
    for (let i = 0; i < caseCount; i++) {
      const req = fn.reqs[i] ?? 'emp';
      const ens = fn.enss[i] ?? 'emp';
      cases.push(`req ${req}; ens ${ens}`);
    }

    const specBody = cases.join('\n  $ ');
    lines.push(`let ${fn.name} ${paramStr} = failwith "assume"`);
    lines.push(` (*@ assume ${specBody} @*)`);
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

// ─── opam env resolution ──────────────────────────────────────────────

function getOpamEnv(): NodeJS.ProcessEnv {
  // Run `opam env --shell=sh` to get KEY=value pairs, merge into process.env
  const r = spawnSync('opam', ['env', '--shell=sh'], { encoding: 'utf8' });
  if (r.status !== 0) return process.env;

  const merged = { ...process.env };
  for (const line of r.stdout.split('\n')) {
    // Matches: KEY='value'; export KEY;  or  KEY=value;
    const m = line.match(/^(\w+)='([^']*)'/);
    if (m) merged[m[1]] = m[2];
    else {
      const m2 = line.match(/^(\w+)=([^;]+)/);
      if (m2) merged[m2[1]] = m2[2].replace(/;$/, '').trim();
    }
  }
  return merged;
}

// ─── Run Heifer-type verifier ─────────────────────────────────────────

interface VerifyResult {
  raw: string;
  passed: string[];
  failed: string[];
}

function runHeifer(mlFile: string): VerifyResult {
  const env = getOpamEnv();

  // Pass relative path — cwd is already HEIFER_DIR
  const relPath = path.relative(HEIFER_DIR, mlFile);
  const r = spawnSync(
    'dune',
    ['exec', 'main/hip.exe', relPath],
    { cwd: HEIFER_DIR, env, encoding: 'utf8', timeout: 60_000 }
  );

  const raw = (r.stdout ?? '') + (r.stderr ?? '');
  const passed: string[] = [];
  const failed: string[] = [];

  let currentFn = '';
  for (const line of raw.split('\n')) {
    const fnMatch = line.match(/Function:\s+(\w+)/);
    if (fnMatch) { currentFn = fnMatch[1]; continue; }

    const entailMatch = line.match(/Entail Check\s*\]\s*(true|false)/);
    if (entailMatch && currentFn) {
      if (entailMatch[1] === 'true') passed.push(currentFn);
      else                           failed.push(currentFn);
      currentFn = '';
    }

    if (line.includes('error occurred') && currentFn) {
      failed.push(currentFn);
      currentFn = '';
    }
  }

  return { raw, passed, failed };
}

// ─── Pretty print ─────────────────────────────────────────────────────

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

function banner(title: string) {
  const line = '─'.repeat(60);
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${line}${RESET}`);
}

// ─── Main ─────────────────────────────────────────────────────────────

const inputFile = process.argv[2];
if (!inputFile) {
  console.error(`Usage: tsx scripts/convert.ts <file.ts>`);
  process.exit(1);
}

const absInput = path.resolve(inputFile);
if (!fs.existsSync(absInput)) {
  console.error(`File not found: ${inputFile}`);
  process.exit(1);
}

const src = fs.readFileSync(absInput, 'utf8');
banner(`TypeScript Input — ${path.basename(absInput)}`);
console.log(src.trimEnd());

const entries = extractFunctions(src, absInput);
if (entries.length === 0) {
  console.error(`\n${RED}No @req/@ens annotations found in ${inputFile}${RESET}`);
  process.exit(1);
}

const ocaml = emitOCaml(entries);
fs.mkdirSync(OUTPUT_SUBDIR, { recursive: true });
fs.writeFileSync(OUTPUT_ML, ocaml);

banner(`OCaml Output — output.ml`);
console.log(ocaml.trimEnd());

banner(`Heifer-type Verification`);
console.log(`${DIM}Running: dune exec main/hip.exe output.ml (cwd: Heifer-type)${RESET}\n`);

const result = runHeifer(OUTPUT_ML);

// Print Heifer output filtered to relevant lines
for (const line of result.raw.split('\n')) {
  if (line.includes('Function:'))           console.log(`\n${BOLD}${line.trim()}${RESET}`);
  else if (line.includes('Entail Check')) {
    const pass = line.includes('true');
    const icon = pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon}  ${line.trim()}`);
  }
  else if (line.includes('error occurred')) console.log(`  ${RED}✗  ${line.trim()}${RESET}`);
  else if (line.includes('FINAL SUMMARY'))  console.log(`\n${DIM}${line.trim()}${RESET}`);
  else if (line.startsWith('[') && line.includes(']')) console.log(`${DIM}${line}${RESET}`);
}

// Summary
console.log('');
const total = result.passed.length + result.failed.length;
if (result.failed.length === 0 && total > 0) {
  console.log(`${GREEN}${BOLD}✅  ALL ${total} SPEC(S) VERIFIED${RESET}`);
} else if (result.failed.length > 0) {
  console.log(`${RED}${BOLD}❌  ${result.failed.length}/${total} SPEC(S) FAILED${RESET}`);
  console.log(`   Failed: ${result.failed.join(', ')}`);
  process.exit(1);
} else {
  console.log(`${YELLOW}⚠️  No entail checks found in output${RESET}`);
  console.log(`\n${DIM}Raw Heifer output:${RESET}\n${result.raw}`);
}
