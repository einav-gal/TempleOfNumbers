import Phaser from 'phaser';

const GLOW_KEY = 'doorway-glow';

export interface DoorwaySize {
  widthBg: number;
  heightBg: number;
}

// A subtle always-on glow once the doorway is active (not just on
// hover), which then intensifies further while hovered — "add a subtle
// light around the door... on hover intensify the light... on pointer
// out restore the normal subtle glow."
const IDLE_GLOW_ALPHA = 0.14;
const HOVER_GLOW_ALPHA = 0.4;
const GLOW_TWEEN_MS = 220;

/**
 * A single interactive doorway hotspot: an invisible hit zone over the
 * doorway opening baked into the background art, with a soft warm glow
 * (subtle while idle, brighter on hover) and hand cursor. The scene
 * supplies the anchor via layout() and a callback for activation
 * (click); this class owns no puzzle logic.
 */
export default class Doorway {
  private scene: Phaser.Scene;
  private size: DoorwaySize;
  private zone?: Phaser.GameObjects.Zone;
  private hitRect?: Phaser.Geom.Rectangle;
  private glow?: Phaser.GameObjects.Image;
  private glowTween?: Phaser.Tweens.Tween;
  private active = false;

  /** Invoked on click. */
  onActivate?: () => void;

  constructor(scene: Phaser.Scene, size: DoorwaySize) {
    this.scene = scene;
    this.size = size;
  }

  create(): void {
    this.generateGlowTexture();

    this.glow = this.scene.add
      .image(0, 0, GLOW_KEY)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd28a)
      .setAlpha(0)
      .setDepth(2);

    this.zone = this.scene.add.zone(0, 0, 1, 1);
    // Interactivity is registered ONCE, with an explicit Rectangle hit
    // area kept in sync by layout() — never re-registered by setActive()
    // (which only toggles input.enabled), so a stale/placeholder-sized
    // hit area can never get baked in regardless of call order relative
    // to layout().
    this.hitRect = new Phaser.Geom.Rectangle(0, 0, 1, 1);
    this.zone.setInteractive(this.hitRect, Phaser.Geom.Rectangle.Contains);
    if (this.zone.input) {
      this.zone.input.cursor = 'pointer';
    }
    this.zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.zone.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.onActivate?.());
  }

  /** centerX/centerY are screen-space; scale is the background cover-scale factor. */
  layout(centerX: number, centerY: number, scale: number): void {
    if (!this.zone || !this.glow) {
      return;
    }
    const width = this.size.widthBg * scale;
    const height = this.size.heightBg * scale;

    this.zone.setPosition(centerX, centerY).setSize(width, height);
    if (this.hitRect) {
      this.hitRect.width = width;
      this.hitRect.height = height;
    }
    this.glow.setPosition(centerX, centerY).setDisplaySize(width * 1.15, height * 1.15);
  }

  // Toggles the already-registered InteractiveObject's enabled flag
  // directly — never calls setInteractive()/disableInteractive() again,
  // which would silently replace or drop the explicit hit area set once
  // in create().
  setActive(active: boolean): void {
    if (!this.zone?.input) {
      return;
    }
    this.active = active;
    this.zone.input.enabled = active;
    this.setHovered(false);
  }

  private setHovered(hovered: boolean): void {
    this.glowTween?.stop();
    const target = hovered ? HOVER_GLOW_ALPHA : this.active ? IDLE_GLOW_ALPHA : 0;
    this.glowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: target,
      duration: GLOW_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // A soft radial glow, generated once per game instance and reused by any
  // doorway that needs it.
  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_KEY)) {
      return;
    }
    const size = 128;
    const canvas = this.scene.textures.createCanvas(GLOW_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
