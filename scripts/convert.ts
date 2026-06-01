#!/usr/bin/env tsx
// scripts/convert.ts
// TypeHL → Heifer-type pipeline:
//   1. Read a TypeScript file
//   2. Walk AST → emit IMPL OCaml (real bodies, spec before =)  [shown in output]
//   3. Also emit STUB OCaml (failwith "assume", spec in assume comment) [used for verification]
//   4. Save stub form → Heifer-type/typehl_out/output.ml
//   5. Run dune exec main/hip.exe output.ml and report Pass/Fail

import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ASTWalker, normalizeRecordSyntax } from '../src/translator/walker.js';
import { HeiferEmitter } from '../src/emitter/heiferEmitter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HEIFER_DIR  = path.resolve(__dirname, '../Heifer-type');
const OUTPUT_SUBDIR = path.join(HEIFER_DIR, 'typehl_out');
const OUTPUT_ML     = path.join(OUTPUT_SUBDIR, 'output.ml');

// ─── Stub emitter (original format for Heifer verification) ──────────

interface FuncEntry {
  name: string;
  params: string[];
  reqs: string[];
  enss: string[];
  forall?: string;
  isRec: boolean;
}

interface FileLevel { preds: string[] }

function getTagText(tag: ts.JSDocTag): string {
  if (typeof tag.comment === 'string') return tag.comment.trim();
  if (Array.isArray(tag.comment))
    return (tag.comment as ts.NodeArray<ts.JSDocComment>).map(c => c.text).join('').trim();
  return '';
}

function extractFunctionsForStub(src: string, filePath: string): { fileLevel: FileLevel; entries: FuncEntry[] } {
  const sf = ts.createSourceFile(filePath, src, ts.ScriptTarget.Latest, true);
  const preds: string[] = [];
  const text = sf.text;
  const ranges = ts.getLeadingCommentRanges(text, 0) ?? [];
  for (const r of ranges) {
    for (const line of text.slice(r.pos, r.end).split('\n')) {
      const m = line.match(/\*\s*@pred\s+(.*)/);
      if (m) preds.push(m[1].trim());
    }
  }

  const entries: FuncEntry[] = [];
  ts.forEachChild(sf, node => {
    if (!ts.isFunctionDeclaration(node) || !node.name) return;
    const name = node.name.text;
    const params = node.parameters.map(p => (p.name as ts.Identifier).text).filter(n => n !== 'this');
    const reqs: string[] = [], enss: string[] = [];
    let forall: string | undefined, isRec = false;
    for (const tag of ts.getJSDocTags(node)) {
      const v = getTagText(tag);
      switch (tag.tagName.text) {
        case 'req':    if (v) reqs.push(v);    break;
        case 'ens':    if (v) enss.push(v);    break;
        case 'forall': forall = v;             break;
        case 'rec':    isRec = true;           break;
      }
    }
    if (reqs.length > 0 || enss.length > 0) entries.push({ name, params, reqs, enss, forall, isRec });
  });
  return { fileLevel: { preds }, entries };
}

function emitStubOCaml(fileLevel: FileLevel, entries: FuncEntry[]): string {
  const lines: string[] = [];
  for (const pred of fileLevel.preds) lines.push(`(*@ pred ${pred} @*)`);
  if (fileLevel.preds.length > 0) lines.push('');
  for (const fn of entries) {
    const letKw = fn.isRec ? 'let rec' : 'let';
    const paramStr = fn.params.length > 0 ? fn.params.join(' ') : '()';
    const caseCount = Math.max(fn.reqs.length, fn.enss.length, 1);
    const cases: string[] = [];
    for (let i = 0; i < caseCount; i++) {
      const req = normalizeRecordSyntax(fn.reqs[i] ?? 'emp');
      const ens = normalizeRecordSyntax(fn.enss[i] ?? 'emp');
      cases.push(`req ${req}; ens ${ens}`);
    }
    const casesStr = cases.join('\n  $ ');
    const specBody = fn.forall ? `forall ${fn.forall} ${casesStr}` : casesStr;
    lines.push(`${letKw} ${fn.name} ${paramStr} = failwith "assume"`);
    lines.push(` (*@ assume ${specBody} @*)`);
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

// ─── opam env ─────────────────────────────────────────────────────────

function getOpamEnv(): NodeJS.ProcessEnv {
  const r = spawnSync('opam', ['env', '--shell=sh'], { encoding: 'utf8' });
  if (r.status !== 0) return process.env;
  const merged = { ...process.env };
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^(\w+)='([^']*)'/);
    if (m) merged[m[1]] = m[2];
    else {
      const m2 = line.match(/^(\w+)=([^;]+)/);
      if (m2) merged[m2[1]] = m2[2].replace(/;$/, '').trim();
    }
  }
  return merged;
}

// ─── Heifer runner ────────────────────────────────────────────────────

interface VerifyResult { raw: string; passed: string[]; failed: string[] }

function runHeifer(mlFile: string): VerifyResult {
  const env = getOpamEnv();
  const relPath = path.relative(HEIFER_DIR, mlFile);
  const r = spawnSync('dune', ['exec', 'main/hip.exe', relPath],
    { cwd: HEIFER_DIR, env, encoding: 'utf8', timeout: 60_000 });
  const raw = (r.stdout ?? '') + (r.stderr ?? '');
  const passed: string[] = [], failed: string[] = [];
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
    if (line.includes('error occurred') && currentFn) { failed.push(currentFn); currentFn = ''; }
  }
  return { raw, passed, failed };
}

// ─── Pretty print ─────────────────────────────────────────────────────

const RESET = '\x1b[0m', BOLD = '\x1b[1m', GREEN = '\x1b[32m',
      RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', DIM = '\x1b[2m';

function banner(title: string) {
  const line = '─'.repeat(60);
  console.log(`\n${BOLD}${CYAN}${line}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${line}${RESET}`);
}

// ─── Main ─────────────────────────────────────────────────────────────

const inputFile = process.argv[2];
if (!inputFile) { console.error(`Usage: tsx scripts/convert.ts <file.ts>`); process.exit(1); }

const absInput = path.resolve(inputFile);
if (!fs.existsSync(absInput)) { console.error(`File not found: ${inputFile}`); process.exit(1); }

const src = fs.readFileSync(absInput, 'utf8');
banner(`TypeScript Input — ${path.basename(absInput)}`);
console.log(src.trimEnd());

// 1. Generate IMPL OCaml (real bodies) — shown to user
const sourceFile = ts.createSourceFile(absInput, src, ts.ScriptTarget.Latest, true);
const walker = new ASTWalker(sourceFile);
const program = walker.walk();
const implOcaml = new HeiferEmitter().emit(program);

banner(`OCaml Output — output.ml`);
console.log(implOcaml.trimEnd());

// 2. Generate STUB OCaml — used for Heifer spec verification
const { fileLevel, entries } = extractFunctionsForStub(src, absInput);
if (entries.length === 0) {
  console.error(`\n${RED}No @req/@ens annotations found in ${inputFile}${RESET}`);
  process.exit(1);
}
const stubOcaml = emitStubOCaml(fileLevel, entries);
fs.mkdirSync(OUTPUT_SUBDIR, { recursive: true });
fs.writeFileSync(OUTPUT_ML, stubOcaml);

banner(`Heifer-type Verification`);
console.log(`${DIM}Running: dune exec main/hip.exe output.ml (cwd: Heifer-type)${RESET}\n`);

const result = runHeifer(OUTPUT_ML);

for (const line of result.raw.split('\n')) {
  if (line.includes('Function:'))         console.log(`\n${BOLD}${line.trim()}${RESET}`);
  else if (line.includes('Entail Check')) {
    const pass = line.includes('true');
    console.log(`  ${pass ? GREEN+'✓'+RESET : RED+'✗'+RESET}  ${line.trim()}`);
  }
  else if (line.includes('error occurred')) console.log(`  ${RED}✗  ${line.trim()}${RESET}`);
  else if (line.includes('FINAL SUMMARY'))  console.log(`\n${DIM}${line.trim()}${RESET}`);
  else if (line.startsWith('[') && line.includes(']')) console.log(`${DIM}${line}${RESET}`);
}

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
