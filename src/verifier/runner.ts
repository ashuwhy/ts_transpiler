// src/verifier/runner.ts

import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseHipsleekOutput, VerificationResult } from './resultParser.js';

const execFileAsync = promisify(execFile);

export interface RunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  error?: Error;
  verification?: VerificationResult;
}

/**
 * Runs HIPsleek verifier command.
 * Typically: ./hip filePath
 */
export async function runHipsleek(execPath: string, filePath: string, timeoutMs = 15000): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(execPath, [filePath], {
      timeout: timeoutMs
    });
    const verification = parseHipsleekOutput(stdout, stderr);
    return {
      success: verification.verified,
      stdout,
      stderr,
      verification
    };
  } catch (err: any) {
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    const verification = parseHipsleekOutput(stdout, stderr);
    return {
      success: false,
      stdout,
      stderr,
      error: err,
      verification
    };
  }
}
