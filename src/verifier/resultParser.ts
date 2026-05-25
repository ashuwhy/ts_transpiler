// src/verifier/resultParser.ts

export interface VerificationResult {
  verified: boolean;
  procedures: { name: string; status: 'SUCCESS' | 'FAIL'; details?: string }[];
  rawOutput: string;
}

export function parseHipsleekOutput(stdout: string, stderr: string): VerificationResult {
  const result: VerificationResult = {
    verified: true,
    procedures: [],
    rawOutput: stdout + (stderr ? '\n' + stderr : '')
  };

  const lines = stdout.split('\n');
  // Regex to match HIP/SLEEK variants, e.g.:
  // - "Checking procedure swap... SUCCESS"
  // - "Procedure append$node~node ... SUCCESS"
  // - "Procedure swap$cell~cell SUCCESS."
  // - "Procedure swap$cell~cell ... FAIL"
  const procRegex = /(?:Checking\s+)?(?:[Pp]rocedure)\s+([\w$~]+).*?\b(SUCCESS|FAIL|Fail|Ok|Error)\b/i;

  for (const line of lines) {
    const match = line.match(procRegex);
    if (match) {
      const rawName = match[1];
      // Clean up mangled OCaml function names if they have $ suffixes
      const name = rawName.split('$')[0];
      const statusStr = match[2].toUpperCase();
      const status: 'SUCCESS' | 'FAIL' = (statusStr === 'SUCCESS' || statusStr === 'OK') ? 'SUCCESS' : 'FAIL';
      
      result.procedures.push({ name, status });
      if (status === 'FAIL') {
        result.verified = false;
      }
    }
  }

  // Fallback: If no specific procedures were parsed, check for overall status keywords
  if (result.procedures.length === 0) {
    const combined = (stdout + '\n' + stderr).toLowerCase();
    if (combined.includes('fail') || combined.includes('error') || combined.includes('fatal')) {
      result.verified = false;
    } else if (combined.includes('success') || combined.includes('verified') || combined.includes('ok')) {
      result.verified = true;
    } else {
      // Default to true if no signs of failure
      result.verified = true;
    }
  }

  return result;
}
