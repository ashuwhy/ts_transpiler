// src/emitter/emitterInterface.ts

import { Program } from '../core/ast.js';

export interface Emitter {
  emit(program: Program): string;
  readonly formatName: string;
  readonly fileExtension: string;
}
