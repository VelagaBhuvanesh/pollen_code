export class WasmEngine {
  private module: any;
  public keys = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    // Attach the file upload function globally so HTML can find it
    (window as any).onSpriteSelected = (event: any) => this.handleSpriteUpload(event);
  }

  public async init() {
    return new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if ((window as any).wasmReady) {
          clearInterval(check);
          this.module = (window as any).Module;
          try { this.module._init_engine(); } catch (e) {}
          resolve();
        }
      }, 50);
    });
  }

  // --- Sprite Image Processing ---
  private handleSpriteUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const numBytes = imageData.data.length;
        
        const dataPtr = this.module._malloc(numBytes);
        this.module.HEAPU8.set(imageData.data, dataPtr);
        
        this.module._load_texture(dataPtr, img.width, img.height);
        this.module._free(dataPtr);
      };
      
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  // --- Drawing API ---
  public draw_sprite(x: number, y: number, w: number, h: number) {
    this.module._draw_sprite(x, y, w, h);
    return null;
  }

  public clear_screen(r: number, g: number, b: number) {
    this.module._clear_screen(r, g, b);
    return null;
  }

  public draw_rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    this.module._draw_rect(x, y, w, h, r, g, b);
    return null;
  }

  public present_frame() {
    this.module._present_frame();
    return null;
  }

  // --- Physics & Input API ---
  public collides(entityA: string, entityB: string, ax: number, ay: number, bx: number, by: number): boolean {
    const aHasCollider = (document.getElementById(`${entityA}-collider`) as HTMLInputElement)?.checked ?? true;
    const bHasCollider = (document.getElementById(`${entityB}-collider`) as HTMLInputElement)?.checked ?? true;
    if (!aHasCollider || !bHasCollider) return false;

    // Read the new Collider Width and Height from the Inspector
    const aW = parseInt((document.getElementById(`${entityA}-collider-w`) as HTMLInputElement)?.value) || 32;
    const aH = parseInt((document.getElementById(`${entityA}-collider-h`) as HTMLInputElement)?.value) || 32;
    
    // Hardcoded wall sizes for now
    const bW = entityB === 'wall1' ? 40 : 250;
    const bH = entityB === 'wall1' ? 300 : 40;

    return this.module._check_collision(ax, ay, aW, aH, bx, by, bW, bH) === 1;
  }

  public key_pressed(key: string): boolean {
    if (key === "left") return this.keys.has("a") || this.keys.has("arrowleft");
    if (key === "right") return this.keys.has("d") || this.keys.has("arrowright");
    if (key === "up") return this.keys.has("w") || this.keys.has("arrowup");
    if (key === "down") return this.keys.has("s") || this.keys.has("arrowdown");
    if (key === "space") return this.keys.has(" ");
    return false;
  }

  public inspector_value(key: string): number {
    if (key === "size") {
      return parseInt((document.getElementById('player-size') as HTMLInputElement).value) || 64;
    }
    if (key === "collider_w") {
      return parseInt((document.getElementById('player-collider-w') as HTMLInputElement).value) || 32;
    }
    if (key === "collider_h") {
      return parseInt((document.getElementById('player-collider-h') as HTMLInputElement).value) || 32;
    }
    if (key === "show_collider") {
      return (document.getElementById('player-show-collider') as HTMLInputElement).checked ? 1 : 0;
    }
    if (key === "r" || key === "g" || key === "b") {
      const el = document.getElementById('player-color') as HTMLInputElement;
      const hex = el ? el.value : "#00c800";
      if (key === "r") return parseInt(hex.substring(1, 3), 16);
      if (key === "g") return parseInt(hex.substring(3, 5), 16);
      if (key === "b") return parseInt(hex.substring(5, 7), 16);
    }
    return 0;
  }

  // --- Stubs ---
  public show(text: string) { return null; }
  public say(text: string) { return null; }
  public jump() { return null; }
  public grounded() { return true; }
  public destroy_other() { return null; }
}