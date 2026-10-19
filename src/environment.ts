export type Value = any; // <-- Changed to 'any' to support all OOP objects

export interface PollenCallable {
  arity(): number;
  call(interpreter: any, args: Value[]): Value;
}

export class Environment {
  private values = new Map<string, Value>();

  constructor(public enclosing: Environment | null = null) {}

  define(name: string, value: Value): void {
    this.values.set(name, value);
  }

  get(name: string): Value {
    if (this.values.has(name)) return this.values.get(name)!;
    if (this.enclosing) return this.enclosing.get(name);
    throw new Error(`Undefined variable '${name}'.`);
  }

  assign(name: string, value: Value): void {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return;
    }
    if (this.enclosing) {
      this.enclosing.assign(name, value);
      return;
    }
    throw new Error(`Undefined variable '${name}'.`);
  }
}