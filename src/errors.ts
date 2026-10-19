// A single problem found during lexing/parsing/validation.
// The editor displays these as squiggles; the CLI prints them.
export interface Diagnostic {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

export function formatDiagnostic(source: string, d: Diagnostic): string {
  const lines = source.split('\n');
  const srcLine = lines[d.line - 1] ?? '';
  const pointer = ' '.repeat(Math.max(0, d.column - 1)) + '^';
  return [
    `${d.severity} at line ${d.line}, column ${d.column}: ${d.message}`,
    srcLine,
    pointer,
  ].join('\n');
}