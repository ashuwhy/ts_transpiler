// src/__tests__/verifier.test.ts

import { describe, it, expect, vi } from 'vitest';
import { parseHipsleekOutput } from '../verifier/resultParser.js';
import { runHipsleek } from '../verifier/runner.js';
import { execFile } from 'child_process';

const customPromisifySymbol = Symbol.for('nodejs.util.promisify.custom');

// Mock child_process's execFile and attach the custom promisify symbol
vi.mock('child_process', () => {
  const fn = vi.fn();
  (fn as any)[Symbol.for('nodejs.util.promisify.custom')] = vi.fn();
  return {
    execFile: fn
  };
});

describe('resultParser', () => {
  it('should parse successful procedure checks', () => {
    const stdout = `
      Checking procedure swap... SUCCESS
      Procedure append$node~node ... SUCCESS
    `;
    const result = parseHipsleekOutput(stdout, '');
    expect(result.verified).toBe(true);
    expect(result.procedures).toHaveLength(2);
    expect(result.procedures[0]).toEqual({ name: 'swap', status: 'SUCCESS' });
    expect(result.procedures[1]).toEqual({ name: 'append', status: 'SUCCESS' });
  });

  it('should parse failing procedure checks and set overall verified to false', () => {
    const stdout = `
      Checking procedure swap$cell~cell ... FAIL
      Procedure append$node~node ... SUCCESS
    `;
    const result = parseHipsleekOutput(stdout, '');
    expect(result.verified).toBe(false);
    expect(result.procedures).toHaveLength(2);
    expect(result.procedures[0]).toEqual({ name: 'swap', status: 'FAIL' });
    expect(result.procedures[1]).toEqual({ name: 'append', status: 'SUCCESS' });
  });

  it('should handle case insensitivity and alternate status names', () => {
    const stdout = `
      Procedure test1 ... Ok
      Procedure test2 ... Fail
      Procedure test3 ... Error
    `;
    const result = parseHipsleekOutput(stdout, '');
    expect(result.verified).toBe(false);
    expect(result.procedures).toEqual([
      { name: 'test1', status: 'SUCCESS' },
      { name: 'test2', status: 'FAIL' },
      { name: 'test3', status: 'FAIL' }
    ]);
  });

  it('should fallback to checking overall status keyword in stdout/stderr when no procedures are found', () => {
    // case 1: fail keyword
    const res1 = parseHipsleekOutput('', 'Fatal error: exception Failure("Verification failed")');
    expect(res1.verified).toBe(false);
    expect(res1.procedures).toHaveLength(0);

    // case 2: success keyword
    const res2 = parseHipsleekOutput('Verification successfully completed', '');
    expect(res2.verified).toBe(true);
    expect(res2.procedures).toHaveLength(0);

    // case 3: default to true when empty
    const res3 = parseHipsleekOutput('', '');
    expect(res3.verified).toBe(true);
  });
});

describe('runner', () => {
  it('should run successfully and return parsed results', async () => {
    const execFileAsyncMock = (execFile as any)[customPromisifySymbol];
    execFileAsyncMock.mockResolvedValue({
      stdout: 'Checking procedure test... SUCCESS',
      stderr: ''
    });

    const runResult = await runHipsleek('/path/to/hip', 'test.ss');
    expect(runResult.success).toBe(true);
    expect(runResult.stdout).toBe('Checking procedure test... SUCCESS');
    expect(runResult.verification).toBeDefined();
    expect(runResult.verification?.verified).toBe(true);
    expect(runResult.verification?.procedures).toEqual([{ name: 'test', status: 'SUCCESS' }]);
  });

  it('should handle subprocess failure gracefully', async () => {
    const execFileAsyncMock = (execFile as any)[customPromisifySymbol];
    const err = new Error('Process exited with code 1') as any;
    err.stdout = 'Checking procedure test... FAIL';
    err.stderr = 'Some stderr message';
    execFileAsyncMock.mockRejectedValue(err);

    const runResult = await runHipsleek('/path/to/hip', 'test.ss');
    expect(runResult.success).toBe(false);
    expect(runResult.stdout).toBe('Checking procedure test... FAIL');
    expect(runResult.stderr).toBe('Some stderr message');
    expect(runResult.error).toBeDefined();
    expect(runResult.verification?.verified).toBe(false);
    expect(runResult.verification?.procedures).toEqual([{ name: 'test', status: 'FAIL' }]);
  });
});
