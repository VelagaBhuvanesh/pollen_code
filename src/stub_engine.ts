import { readSync } from 'node:fs'; // Import must be at the very top

export class StubEngine {
  public show(text: string) {
    console.log(`   [ENGINE] show: "${text}"`);
    return null;
  }

  public say(text: string) {
    console.log(`   [ENGINE] say: "${text}"`);
    return null;
  }

  public move(dx: number, dy: number) {
    console.log(`   [ENGINE] move: (${dx}, ${dy})`);
    return null;
  }

  public jump() {
    console.log(`   [ENGINE] jump!`);
    return null;
  }

  public grounded(): boolean {
    return true; // Fake: always grounded
  }

  public key_pressed(key: string): boolean {
    console.log(`   [ENGINE] checking key: "${key}"`);
    return key === "right"; // Fake: pretend player is pressing right
  }

  public destroy_other() {
    console.log(`   [ENGINE] destroy_other!`);
    return null;
  }

  // Make sure `take` is INSIDE the class!
  public take(promptText: string): string {
    process.stdout.write(`   [ENGINE] ${promptText} `);
    const buffer = Buffer.alloc(1024);
    const bytesRead = readSync(0, buffer, 0, buffer.length, null);
    const input = buffer.toString('utf8', 0, bytesRead).trim();
    return input;
  }
}