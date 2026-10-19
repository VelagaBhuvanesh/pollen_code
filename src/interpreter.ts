import * as AST from './ast.ts';
import { Environment, Value } from './environment.ts';

// A custom error to handle the `return` keyword bubbling up
export class ReturnSignal {
  constructor(public value: Value) {}
}

// ============================================================
// OOP RUNTIME CLASSES
// ============================================================

export class PollenClass {
  constructor(
    public name: string,
    public methods: Map<string, AST.FuncDecl>,
    public fields: AST.VarDecl[]
  ) {}

  findMethod(name: string) {
    return this.methods.get(name);
  }
}

export class PollenInstance {
  properties = new Map<string, Value>();
  constructor(public klass: PollenClass) {}

  get(name: string): Value {
    if (this.properties.has(name)) return this.properties.get(name)!;
    const method = this.klass.findMethod(name);
    if (method) return new PollenMethod(this, method);
    throw new Error(`Undefined property '${name}' on instance of '${this.klass.name}'.`);
  }

  set(name: string, value: Value) {
    this.properties.set(name, value);
  }
}

export class PollenFunction {
  constructor(public declaration: AST.FuncDecl, public closure: Environment) {}

  call(interpreter: Interpreter, args: Value[]): Value {
    const env = new Environment(this.closure);
    for (let i = 0; i < this.declaration.params.length; i++) {
      env.define(this.declaration.params[i], args[i]);
    }
    try {
      interpreter.executeBlock(this.declaration.body, env);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return null;
  }
}

export class PollenMethod {
  constructor(public instance: PollenInstance, public declaration: AST.FuncDecl) {}

  call(interpreter: Interpreter, args: Value[]): Value {
    const env = new Environment(interpreter.globals);
    env.define("self", this.instance);
    for (let i = 0; i < this.declaration.params.length; i++) {
      env.define(this.declaration.params[i], args[i]);
    }
    try {
      interpreter.executeBlock(this.declaration.body, env);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      throw e;
    }
    return null;
  }
}

// ============================================================
// INTERPRETER
// ============================================================

export class Interpreter {
  public globals = new Environment();
  public environment = this.globals;

  constructor(public engine: any) {}

  // Store events: on start, on update, on collision
  private events = new Map<string, AST.OnEvent[]>();

  public interpret(program: AST.Program) {
    try {
      for (const stmt of program.body) {
        // If it's an event block, just store it for later!
        if (stmt.kind === 'OnEvent') {
          const key = stmt.event === 'collision' ? `collision:${stmt.arg}` : stmt.event;
          if (!this.events.has(key)) this.events.set(key, []);
          this.events.get(key)!.push(stmt);
        } else {
          // Functions, classes, and variables at the top level run immediately
          this.execute(stmt);
        }
      }
    } catch (e) {
      if (e instanceof Error) console.error("Runtime Error:", e.message);
    }
  }

  // --- Trigger Events from the Engine ---
  public triggerStart() { this.runEvent('start'); }
  public triggerUpdate() { this.runEvent('update'); }
  public triggerCollision(target: string) { this.runEvent(`collision:${target}`); }

  private runEvent(key: string) {
    const eventBlocks = this.events.get(key);
    if (!eventBlocks) return;

    for (const block of eventBlocks) {
      try {
        this.executeBlock(block.body);
      } catch (e) {
        if (e instanceof Error) console.error("Runtime Error:", e.message);
      }
    }
  }

  // --- Executing Statements ---
  private execute(stmt: AST.Statement) {
    switch (stmt.kind) {
      case 'VarDecl':
        this.environment.define(stmt.name, this.evaluate(stmt.init));
        break;

      case 'FuncDecl':
        this.environment.define(stmt.name, new PollenFunction(stmt, this.environment));
        break;

      case 'ClassDecl': {
        const methods = new Map<string, AST.FuncDecl>();
        for (const m of stmt.methods) methods.set(m.name, m);
        const klass = new PollenClass(stmt.name, methods, stmt.properties);
        this.environment.define(stmt.name, klass);
        break;
      }

      case 'Assign': {
        const val = this.evaluate(stmt.value);
        if (stmt.target.kind === 'Identifier') {
          this.environment.assign(stmt.target.name, val);
        } else if (stmt.target.kind === 'Get') {
          const obj = this.evaluate(stmt.target.object);
          if (obj instanceof PollenInstance) {
            obj.set(stmt.target.name, val);
          } else {
            throw new Error("Can only set properties on instances.");
          }
        }
        break;
      }

      case 'ExprStatement':
        this.evaluate(stmt.expr);
        break;

      case 'Block':
        this.executeBlock(stmt);
        break;

      case 'If':
        for (const branch of stmt.branches) {
          if (this.isTruthy(this.evaluate(branch.condition))) {
            this.executeBlock(branch.body);
            return;
          }
        }
        if (stmt.elseBody) this.executeBlock(stmt.elseBody);
        break;

      case 'Repeat': {
        const count = this.evaluate(stmt.count);
        if (typeof count !== 'number') throw new Error("Repeat count must be a number.");
        for (let i = 0; i < count; i++) {
          this.executeBlock(stmt.body);
        }
        break;
      }

      case 'While':
        while (this.isTruthy(this.evaluate(stmt.condition))) {
          this.executeBlock(stmt.body);
        }
        break;

      case 'Return':
        throw new ReturnSignal(stmt.value ? this.evaluate(stmt.value) : null);

      case 'OnEvent':
        // Already handled in interpret()
        break;
    }
  }

  // Made public so PollenFunction and PollenMethod can call it
  public executeBlock(block: AST.Block, env?: Environment) {
    const previous = this.environment;
    try {
      this.environment = env ?? new Environment(previous);
      for (const stmt of block.statements) {
        this.execute(stmt);
      }
    } finally {
      this.environment = previous;
    }
  }

  // --- Evaluating Expressions ---
  private evaluate(expr: AST.Expression): Value {
    switch (expr.kind) {
      case 'Number': return expr.value;
      case 'String': return expr.value;
      case 'Bool': return expr.value;
      
      case 'Identifier': 
        return this.environment.get(expr.name);

      case 'Get': {
        const obj = this.evaluate(expr.object);
        if (obj instanceof PollenInstance) {
          return obj.get(expr.name);
        }
        throw new Error("Only instances have properties.");
      }

      case 'New': {
        const klass = this.environment.get(expr.className);
        if (!(klass instanceof PollenClass)) throw new Error("Can only instantiate classes.");
        const instance = new PollenInstance(klass);
        for (const field of klass.fields) {
          instance.set(field.name, this.evaluate(field.init));
        }
        return instance;
      }

      case 'Unary': {
        const right = this.evaluate(expr.operand);
        if (expr.op === '-') return -(right as number);
        if (expr.op === 'not') return !this.isTruthy(right);
        return null;
      }

      case 'Binary': {
        const left = this.evaluate(expr.left);
        const right = this.evaluate(expr.right);
        return this.evaluateBinary(expr.op, left, right);
      }

      case 'Call': {
        return this.evaluateCall(expr);
      }
    }
  }

  private evaluateBinary(op: AST.BinaryOp, left: Value, right: Value): Value {
    // Math
    if (op === '+') {
      if (typeof left === 'string' || typeof right === 'string') {
        return String(left) + String(right);
      }
      return (left as number) + (right as number);
    }
    if (op === '-') return (left as number) - (right as number);
    if (op === '*') return (left as number) * (right as number);
    if (op === '/') {
      if ((right as number) === 0) throw new Error("Division by zero.");
      return (left as number) / (right as number);
    }

    // Comparison
    if (op === '==') return left === right;
    if (op === '!=') return left !== right;
    if (op === '<') return (left as number) < (right as number);
    if (op === '<=') return (left as number) <= (right as number);
    if (op === '>') return (left as number) > (right as number);
    if (op === '>=') return (left as number) >= (right as number);
    
    // Logic
    if (op === 'and') return this.isTruthy(left) && this.isTruthy(right);
    if (op === 'or') return this.isTruthy(left) || this.isTruthy(right);

    return null;
  }

  private evaluateCall(expr: AST.CallExpr): Value {
    const args = expr.args.map(a => this.evaluate(a));

    // 1. Route built-in engine functions
    if (expr.callee.kind === 'Identifier') {
      const name = expr.callee.name;
      switch (name) {
        case 'show': return this.engine.show(String(args[0]));
        case 'say': return this.engine.say(String(args[0]));
        case 'move': return this.engine.move(Number(args[0]), Number(args[1]));
        case 'jump': return this.engine.jump();
        case 'grounded': return this.engine.grounded();
        case 'key_pressed': return this.engine.key_pressed(String(args[0]));
        case 'destroy_other': return this.engine.destroy_other();
        case 'take': return this.engine.take(String(args[0]));
        case 'clear_screen': return this.engine.clear_screen(Number(args[0]), Number(args[1]), Number(args[2]));
        case 'draw_rect': return this.engine.draw_rect(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5]), Number(args[6]));
        case 'present_frame': return this.engine.present_frame();
        case 'inspector_value': return this.engine.inspector_value(String(args[0]));
        case 'is_colliding': 
          return this.engine.check_collision(
            Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]),
            Number(args[4]), Number(args[5]), Number(args[6]), Number(args[7])
          );
        case 'collides': 
          return this.engine.collides(
            String(args[0]), String(args[1]), 
            Number(args[2]), Number(args[3]), 
            Number(args[4]), Number(args[5])
          );
        case 'draw_sprite': return this.engine.draw_sprite(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]));
      }
    }

    // 2. Route user-defined functions and methods
    const callee = this.evaluate(expr.callee);
    
    if (callee instanceof PollenFunction) {
      return callee.call(this, args);
    }
    if (callee instanceof PollenMethod) {
      return callee.call(this, args);
    }

    throw new Error(`Can only call functions and methods.`);
  }

  private isTruthy(value: Value): boolean {
    if (value === null) return false;
    if (typeof value === 'boolean') return value;
    return true;
  }
}