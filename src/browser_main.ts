import { WasmEngine } from './wasm_engine.ts';
import { Interpreter } from './interpreter.ts';
import { tokenize } from './lexer.ts';
import { Parser } from './parser.ts';
import pollenSource from './examples/sample.pollen?raw';

async function startGame() {
  const engine = new WasmEngine();
  
  console.log("Loading C++ SDL Engine...");
  await engine.init(); // Wait for WASM to boot up
  console.log("SDL Engine Loaded!");

  const interpreter = new Interpreter(engine);
  const { tokens } = tokenize(pollenSource);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  interpreter.interpret(ast);
  interpreter.triggerStart();

  // We don't call engine.render() because C++ handles rendering!
  function gameLoop() {
    console.log("Pollen Frame Ticking..."); 
    interpreter.triggerUpdate();
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}

startGame();