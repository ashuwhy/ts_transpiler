// src/__tests__/hipsleekEmitter.test.ts
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import fs from 'fs';
import path from 'path';
import { ASTWalker } from '../translator/walker.js';
import { HipsleekEmitter } from '../emitter/hipsleekEmitter.js';

describe('HIPsleek Emitter Snapshot Tests', () => {
  const examplesDir = path.resolve(__dirname, '../../examples');
  const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.ts'));

  files.forEach(file => {
    it(`should match snapshot for examples/${file}`, () => {
      const filePath = path.join(examplesDir, file);
      const sourceCode = fs.readFileSync(filePath, 'utf8');
      
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      const walker = new ASTWalker(sourceFile);
      const programAst = walker.walk();

      const emitter = new HipsleekEmitter();
      const outputText = emitter.emit(programAst);

      expect(outputText).toMatchSnapshot();
    });
  });
});
