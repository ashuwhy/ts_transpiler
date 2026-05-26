// src/cli.ts

import { Command } from 'commander';
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { ASTWalker } from './translator/walker.js';
import { CoreEmitter } from './emitter/coreEmitter.js';
import { HipsleekEmitter } from './emitter/hipsleekEmitter.js';
import { HeiferEmitter } from './emitter/heiferEmitter.js';
import { runHipsleek } from './verifier/runner.js';

const program = new Command();

program
  .name('typehl')
  .description('TypeScript → TypeHL Core Language transpiler & verifier driver')
  .version('0.1.0');

program
  .command('convert')
  .description('Transpile TypeScript file to Core Language or target verifier format')
  .argument('<file>', 'TypeScript source file')
  .option('-f, --format <format>', 'Output format: core, hipsleek, heifer', 'core')
  .option('-o, --output <output>', 'Output file path (default: stdout)')
  .option('-s, --strict', 'Surfaces warning when dropping unsupported features (like Err in HIPsleek)')
  .action((file, options) => {
    try {
      const absolutePath = path.resolve(file);
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red(`[Error] File not found: ${file}`));
        process.exit(1);
      }

      const sourceCode = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        absolutePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const walker = new ASTWalker(sourceFile);
      const programAst = walker.walk();

      let emitter;
      if (options.format === 'hipsleek') {
        emitter = new HipsleekEmitter({ strict: options.strict });
      } else if (options.format === 'core') {
        emitter = new CoreEmitter();
      } else if (options.format === 'heifer') {
        emitter = new HeiferEmitter();
      } else {
        console.error(chalk.red(`[Error] Unknown format: ${options.format}`));
        process.exit(1);
      }

      const outputText = emitter.emit(programAst);

      if (options.output) {
        const outPath = path.resolve(options.output);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, outputText, 'utf8');
        console.log(chalk.green(`[Success] Transpiled ${file} → ${options.output}`));
      } else {
        console.log(outputText);
      }
    } catch (err: any) {
      console.error(chalk.red(`[Error] Transpilation failed:\n${err.stack || err.message}`));
      process.exit(1);
    }
  });

program
  .command('inspect')
  .description('Inspect parsed specs and definitions from TypeScript source')
  .argument('<file>', 'TypeScript source file')
  .option('--show <aspect>', 'Aspect to display: AST, specs, predicates', 'specs')
  .action((file, options) => {
    try {
      const absolutePath = path.resolve(file);
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red(`[Error] File not found: ${file}`));
        process.exit(1);
      }

      const sourceCode = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        absolutePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const walker = new ASTWalker(sourceFile);
      const programAst = walker.walk();

      if (options.show === 'AST') {
        console.log(JSON.stringify(programAst, null, 2));
      } else if (options.show === 'predicates') {
        console.log(chalk.blue('=== View Predicates ==='));
        programAst.predicates.forEach(p => {
          console.log(chalk.cyan(`pred ${p.selfVar}${p.isSeparation ? '↦' : ':'}${p.name}`));
        });
      } else {
        console.log(chalk.blue('=== Function Specifications ==='));
        programAst.definitions.forEach(def => {
          if (def.spec) {
            console.log(chalk.cyan(`function ${def.name}`));
            console.log(`  Params: ${def.params.map(p => p.name).join(', ')}`);
            console.log(`  Spec: ${JSON.stringify(def.spec.body)}`);
          } else {
            console.log(chalk.dim(`function ${def.name} (no specification)`));
          }
        });
      }
    } catch (err: any) {
      console.error(chalk.red(`[Error] Inspect failed: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command('verify')
  .description('Transpile and run the target Hoare Logic verifier on the TS file')
  .argument('<file>', 'TypeScript source file')
  .option('--tool <tool>', 'Verification tool: hipsleek', 'hipsleek')
  .option('--exec <path>', 'Path to verifier executable (e.g. ./hip)', './hip')
  .action(async (file, options) => {
    try {
      const absolutePath = path.resolve(file);
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red(`[Error] File not found: ${file}`));
        process.exit(1);
      }

      const sourceCode = fs.readFileSync(absolutePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        absolutePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const walker = new ASTWalker(sourceFile);
      const programAst = walker.walk();

      if (options.tool !== 'hipsleek') {
        console.error(chalk.red(`[Error] Unsupported verification tool: ${options.tool}`));
        process.exit(1);
      }

      const emitter = new HipsleekEmitter();
      const outputText = emitter.emit(programAst);

      // Create a temporary .ss file next to the source file
      const tempOutFile = absolutePath.replace(/\.ts$/, '.ss');
      fs.writeFileSync(tempOutFile, outputText, 'utf8');

      console.log(chalk.blue(`[Verifier] Temp .ss file written to: ${tempOutFile}`));
      console.log(chalk.blue(`[Verifier] Spawning ${options.exec} ${tempOutFile}...`));

      const runResult = await runHipsleek(options.exec, tempOutFile);

      // Clean up temp file
      if (fs.existsSync(tempOutFile)) {
        fs.unlinkSync(tempOutFile);
      }

      if (runResult.success) {
        console.log(chalk.green(`\n[SUCCESS] All procedures verified successfully.`));
        if (runResult.verification) {
          runResult.verification.procedures.forEach(p => {
            console.log(chalk.green(`  ✓ ${p.name}: ${p.status}`));
          });
        }
      } else {
        console.log(chalk.red(`\n[FAILURE] Verification failed or returned errors.`));
        if (runResult.verification && runResult.verification.procedures.length > 0) {
          runResult.verification.procedures.forEach(p => {
            if (p.status === 'SUCCESS') {
              console.log(chalk.green(`  ✓ ${p.name}: ${p.status}`));
            } else {
              console.log(chalk.red(`  ✗ ${p.name}: ${p.status}`));
            }
          });
        } else {
          console.error(chalk.red(runResult.stdout || runResult.stderr || runResult.error?.message || 'Unknown verification error'));
        }
        process.exit(1);
      }
    } catch (err: any) {
      console.error(chalk.red(`[Error] Verification failed: ${err.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
