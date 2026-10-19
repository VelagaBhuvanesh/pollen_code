export class WebEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  
  // Spawn player in the center of the screen
  public player = { x: 400, y: 300, size: 32, speed: 180 };
  public keys = new Set<string>();

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    // Make the canvas smaller so it fits on your screen
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.ctx = this.canvas.getContext('2d')!;

    console.log("WebEngine Initialized! Canvas size:", this.canvas.width, "x", this.canvas.height);

    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  public move(dx: number, dy: number) {
    this.player.x += dx * this.player.speed * (1/60); 
    this.player.y += dy * this.player.speed * (1/60);
    return null;
  }

  public key_pressed(key: string): boolean {
    if (key === "left") return this.keys.has("a") || this.keys.has("arrowleft");
    if (key === "right") return this.keys.has("d") || this.keys.has("arrowright");
    if (key === "up") return this.keys.has("w") || this.keys.has("arrowup");
    if (key === "down") return this.keys.has("s") || this.keys.has("arrowdown");
    if (key === "space") return this.keys.has(" ");
    return false;
  }

  public show(text: string) { console.log("POLLEN SHOW:", text); return null; }
  public say(text: string) { console.log("POLLEN SAY:", text); return null; }
  public jump() { console.log("Jump!"); return null; }
  public grounded() { return true; }
  public destroy_other() { return null; }

  public render() {
    // 1. Clear screen (Dark Gray)
    this.ctx.fillStyle = "#14141e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 2. Draw a helpful grid
    this.ctx.strokeStyle = "#333344";
    this.ctx.lineWidth = 1;
    for (let i = 0; i < this.canvas.width; i += 50) {
      this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.canvas.height); this.ctx.stroke();
    }
    for (let i = 0; i < this.canvas.height; i += 50) {
      this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(this.canvas.width, i); this.ctx.stroke();
    }

    // 3. Draw Player (Bright Green Square)
    this.ctx.fillStyle = "#00c800";
    this.ctx.fillRect(this.player.x, this.player.y, this.player.size, this.player.size);
  }
}