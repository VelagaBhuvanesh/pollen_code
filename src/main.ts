import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenize } from './lexer.ts';
import { formatDiagnostic } from './errors.ts';
import { Parser, ParseError } from './parser.ts';
import { Interpreter } from './interpreter.ts';
import { StubEngine } from './stub_engine.ts';

const fileArg = process.argv[2] ?? 'src/examples/sample.pollen';
const filePath = resolve(fileArg);

let source = "";
try {
  source = readFileSync(filePath, 'utf-8');
} catch {
  console.error(`✗ Could not read file: ${filePath}`);
  process.exit(1);
}

const { tokens, diagnostics } = tokenize(source);
if (diagnostics.length > 0) {
  for (const d of diagnostics) console.log(formatDiagnostic(source, d));
  process.exit(1);
}

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`\n=== 🚀 EXECUTING ${filePath} ===\n`);
  
  const interpreter = new Interpreter(new StubEngine()); 
  interpreter.interpret(ast);

  // Simulate the game engine firing events!
  console.log("\n--- SIMULATING: ON START ---");
  interpreter.triggerStart();

  console.log("\n--- SIMULATING: ON UPDATE (1 frame) ---");
  interpreter.triggerUpdate();

  console.log("\n--- SIMULATING: ON COLLISION (coin) ---");
  interpreter.triggerCollision("coin");

  console.log("\n✓ Execution complete.");
} catch (error) {
  if (error instanceof ParseError) {
    console.error('=== PARSE ERROR ===\n');
    console.error(formatDiagnostic(source, {
      message: error.message,
      line: error.token.line,
      column: error.token.column,
      severity: 'error'
    }));
    process.exit(1);
  }
  console.error(error);
}