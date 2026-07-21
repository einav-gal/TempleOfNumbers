import Phaser from 'phaser';
import { getCrystalCollectionState, type CrystalId } from './GameState';

// Compact — "a small ancient pouch," not a modern inventory panel —
// screen-fixed in the upper-left safe area, margin-anchored so it's
// never clipped by the top or left edge at any viewport size.
const HOLDER_WIDTH_PX = 186;
const HOLDER_HEIGHT_PX = 70;
const HOLDER_MARGIN_X_PX = 18;
const HOLDER_MARGIN_Y_PX = 18;

const SLOT_SIZE_PX = 40;
const SLOT_SPACING_PX = 54;
const GEM_SIZE_PX = 34;
const GEM_GLOW_SIZE_PX = 64;
const SLOT_POP_MS = 300;

const HOLDER_FRAME_TEXTURE_KEY = 'crystal-holder-frame';
const SLOT_FRAME_TEXTURE_KEY = 'crystal-holder-slot';
const GEM_TEXTURE_KEY = 'crystal-holder-gem';
const GLOW_TEXTURE_KEY = 'crystal-holder-glow';

// Left-to-right slot order: 1. pink, 2. red, 3. green.
const CRYSTAL_ORDER: CrystalId[] = ['pink', 'red', 'green'];
const CRYSTAL_TINTS: Record<CrystalId, number> = {
  pink: 0xff8fce,
  red: 0xff5a4d,
  green: 0x5fe396,
};

interface SlotRuntime {
  frame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  gem: Phaser.GameObjects.Image;
}

/**
 * The one persistent, cross-scene crystal-collection display: a small
 * carved stone/bronze holder in the upper-left safe area with exactly
 * three slots (pink, red, green). Screen-fixed, so its position never
 * needs recomputing on resize. Every scene that shows it owns its own
 * instance (create()/destroy(), same per-scene-object lifecycle as
 * every other UI helper in this project) but they all read the SAME
 * shared registry state (GameState.ts's crystal-collection slice) —
 * nothing about which crystals are collected is ever local Scene state,
 * and refresh() re-syncs from it every time a scene is (re)created.
 */
export default class CrystalHolder {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private slots: Partial<Record<CrystalId, SlotRuntime>> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(depth: number): void {
    this.generateTextures();

    const container = this.scene.add
      .container(HOLDER_MARGIN_X_PX, HOLDER_MARGIN_Y_PX)
      .setDepth(depth)
      .setScrollFactor(0);

    const frame = this.scene.add.image(0, 0, HOLDER_FRAME_TEXTURE_KEY).setOrigin(0, 0).setScrollFactor(0);
    container.add(frame);

    const rowWidth = (CRYSTAL_ORDER.length - 1) * SLOT_SPACING_PX;
    const startX = (HOLDER_WIDTH_PX - rowWidth) / 2;
    const slotY = HOLDER_HEIGHT_PX / 2;

    for (let i = 0; i < CRYSTAL_ORDER.length; i++) {
      const id = CRYSTAL_ORDER[i];
      const x = startX + i * SLOT_SPACING_PX;

      const glow = this.scene.add
        .image(x, slotY, GLOW_TEXTURE_KEY)
        .setTint(CRYSTAL_TINTS[id])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(GEM_GLOW_SIZE_PX, GEM_GLOW_SIZE_PX)
        .setAlpha(0)
        .setScrollFactor(0);
      const slotFrame = this.scene.add.image(x, slotY, SLOT_FRAME_TEXTURE_KEY).setScrollFactor(0);
      const gem = this.scene.add
        .image(x, slotY, GEM_TEXTURE_KEY)
        .setTint(CRYSTAL_TINTS[id])
        .setDisplaySize(GEM_SIZE_PX, GEM_SIZE_PX)
        .setAlpha(0)
        .setScrollFactor(0);

      container.add(glow);
      container.add(slotFrame);
      container.add(gem);
      this.slots[id] = { frame: slotFrame, glow, gem };
    }

    this.container = container;
    this.refresh();
  }

  /** Re-syncs every slot to the shared registry state — no animation, safe to call any time (e.g. once per scene create()). */
  refresh(): void {
    const state = getCrystalCollectionState(this.scene.registry);
    for (const id of CRYSTAL_ORDER) {
      if (state[id]) {
        this.setSlotFilled(id, false);
      } else {
        this.setSlotEmpty(id);
      }
    }
  }

  /** Pops a slot from empty to filled with a brief scale-bounce — call exactly once, right as a crystal is actually collected. */
  revealCollected(id: CrystalId): void {
    this.setSlotFilled(id, true);
  }

  /** The slot's screen-space center — for a reward animation to fly its collected crystal into. */
  getSlotScreenPosition(id: CrystalId): { x: number; y: number } {
    const slot = this.slots[id];
    if (!slot || !this.container) {
      return { x: HOLDER_MARGIN_X_PX, y: HOLDER_MARGIN_Y_PX };
    }
    return { x: this.container.x + slot.frame.x, y: this.container.y + slot.frame.y };
  }

  destroy(): void {
    this.container?.destroy();
  }

  private setSlotFilled(id: CrystalId, animate: boolean): void {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.glow.setAlpha(0.65);
    slot.gem.setAlpha(1);
    if (!animate) {
      slot.gem.setScale(1);
      return;
    }
    slot.gem.setScale(1.7);
    this.scene.tweens.add({
      targets: slot.gem,
      scale: 1,
      duration: SLOT_POP_MS,
      ease: Phaser.Math.Easing.Back.Out,
    });
  }

  private setSlotEmpty(id: CrystalId): void {
    const slot = this.slots[id];
    if (!slot) {
      return;
    }
    slot.gem.setAlpha(0).setScale(1);
    slot.glow.setAlpha(0);
  }

  private generateTextures(): void {
    this.generateHolderFrameTexture();
    this.generateSlotFrameTexture();
    this.generateGemTexture();
    this.generateGlowTexture();
  }

  // A small carved dark stone/bronze plaque — same family as this
  // project's other frames (RoundIntroPopup, Libra's answer banner),
  // just compact enough to read as a pouch rather than a full panel.
  private generateHolderFrameTexture(): void {
    if (this.scene.textures.exists(HOLDER_FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = HOLDER_WIDTH_PX;
    const h = HOLDER_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(HOLDER_FRAME_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 14;

    const drawRoundedRect = (x: number, y: number, width: number, height: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    };

    // Dark enough to separate the pouch from any background art behind it.
    const outerGrad = ctx.createLinearGradient(0, 0, 0, h);
    outerGrad.addColorStop(0, '#5a4a35');
    outerGrad.addColorStop(0.5, '#3c3122');
    outerGrad.addColorStop(1, '#211a12');
    drawRoundedRect(1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = outerGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.6)';
    ctx.stroke();

    const inset = 8;
    const innerGrad = ctx.createLinearGradient(0, inset, 0, h - inset);
    innerGrad.addColorStop(0, '#1c1610');
    innerGrad.addColorStop(1, '#100c08');
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 5);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    canvas.refresh();
  }

  // A small carved diamond slot, empty at rest — same shared-texture
  // convention as Libra's banner slots (tinted glow + gem convey state,
  // this frame itself never changes).
  private generateSlotFrameTexture(): void {
    if (this.scene.textures.exists(SLOT_FRAME_TEXTURE_KEY)) {
      return;
    }
    const size = SLOT_SIZE_PX;
    const canvas = this.scene.textures.createCanvas(SLOT_FRAME_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, '#332a1e');
    grad.addColorStop(1, '#17130d');
    ctx.fillStyle = grad;
    ctx.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(214,178,112,0.65)';
    ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();

    canvas.refresh();
  }

  // A small faceted gem, generated once in neutral white/near-white and
  // tinted per-crystal at runtime (setTint) — the same "one shared
  // texture, tinted per use" convention as every glow in this project.
  private generateGemTexture(): void {
    if (this.scene.textures.exists(GEM_TEXTURE_KEY)) {
      return;
    }
    const size = 48;
    const canvas = this.scene.textures.createCanvas(GEM_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const r = size / 2 - 4;
    ctx.save();
    ctx.translate(size / 2, size / 2);

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.75, -r * 0.15);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.75, -r * 0.15);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(1, 'rgba(255,255,255,0.72)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();

    // A single facet line for a touch of cut-gem sparkle.
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    ctx.restore();
    canvas.refresh();
  }

  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = 96;
    const canvas = this.scene.textures.createCanvas(GLOW_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
