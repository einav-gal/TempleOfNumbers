import Phaser from 'phaser';

const SHADOW_KEY = 'statue-contact-shadow';

// left-statue-background-matched.png (145x423) has a soft, low-opacity
// cutout feather beneath the pedestal's true solid edge, tapering from
// roughly row 402 down to row 420 (of 423). With origin (0.5, 1) anchored
// at the canvas's literal bottom edge, that ~20px source-pixel gap would
// otherwise float the visible pedestal above the intended floor line.
// Compensated for here (asset-specific), not in the scene's floor target,
// so the contact shadow — anchored at the true floor line — stays put.
const BOTTOM_FEATHER_PX = 20;

// Simulated vertical-axis turn: this is a flat 2D sprite, so a normal
// Z-axis angle tween would look like the image spinning in the picture
// plane rather than pivoting away in depth. Instead scaleX narrows toward
// a thin sliver (scaleY untouched) while the statue shifts slightly
// sideways, mimicking a figure turning on a hidden vertical axis into the
// wall. Shift is toward the handle/mechanism side.
const TURN_SCALE_X = 0.11;
const TURN_OFFSET_BG_PX = -14;

export interface StatueSize {
  /** Target displayed height of the full source image, in background-image pixels. */
  heightBg: number;
}

/**
 * A single static statue sprite, seated in the wall niche in the
 * background art with a soft contact shadow so it reads as built into the
 * wall/floor rather than pasted in front of the room. Origin is bottom-
 * center; the scene supplies the true floor-contact point, and this class
 * accounts for the source asset's own bottom padding when placing the
 * image. Also owns the one-time "turn away" animation that reveals
 * whatever sits behind it (see open()).
 */
export default class Statue {
  private scene: Phaser.Scene;
  private textureKey: string;
  private size: StatueSize;
  private image?: Phaser.GameObjects.Image;
  private shadow?: Phaser.GameObjects.Image;

  private baseScale = 1;
  private lastBaseX = 0;
  private lastBaseY = 0;
  private lastCoverScale = 1;

  // Turn progress: 1/0 = resting (facing out), animates toward
  // TURN_SCALE_X / TURN_OFFSET_BG_PX as the statue opens.
  private turnScaleX = 1;
  private turnOffsetBg = 0;
  private turnTween?: Phaser.Tweens.Tween;
  private isOpening = false;
  private isOpen = false;

  constructor(scene: Phaser.Scene, textureKey: string, size: StatueSize) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.size = size;
  }

  create(depth: number): void {
    this.generateShadowTexture();

    this.shadow = this.scene.add
      .image(0, 0, SHADOW_KEY)
      .setOrigin(0.5, 0.5)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setAlpha(0.28)
      .setDepth(depth - 1);

    // Photoshop-matched source art (left-statue-background-matched.png):
    // no runtime tint or blur, alpha stays at the default 1.
    this.image = this.scene.add
      .image(0, 0, this.textureKey)
      .setOrigin(0.5, 1)
      .setDepth(depth);
  }

  /** baseX/baseY: the niche's true floor-contact point (pedestal base) in screen space. */
  layout(baseX: number, baseY: number, scale: number): void {
    if (!this.image || !this.shadow) {
      return;
    }
    this.lastBaseX = baseX;
    this.lastBaseY = baseY;
    this.lastCoverScale = scale;
    this.baseScale = (this.size.heightBg / this.image.height) * scale;
    this.applyTransform();

    // A soft, squashed ellipse sitting just beneath the pedestal's front
    // edge, grounding it against the floor. Sized from the resting scale
    // and anchored at the true floor line — the pedestal's footprint
    // doesn't change just because the figure above it turns away.
    const shadowWidth = this.image.width * this.baseScale * 0.62;
    const shadowHeight = shadowWidth * 0.3;
    this.shadow.setPosition(baseX, baseY + shadowHeight * 0.2).setDisplaySize(shadowWidth, shadowHeight);
  }

  /**
   * Simulates the statue pivoting away on a vertical axis (not a Z-axis
   * spin) to reveal whatever sits behind it. Ignored if already open or
   * mid-animation, so repeated/overlapping calls can't stack tweens.
   */
  open(durationMs: number, onComplete?: () => void): void {
    if (this.isOpening || this.isOpen || !this.image) {
      return;
    }
    this.isOpening = true;

    this.turnTween = this.scene.tweens.add({
      targets: this,
      turnScaleX: TURN_SCALE_X,
      turnOffsetBg: TURN_OFFSET_BG_PX,
      duration: durationMs,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyTransform(),
      onComplete: () => {
        this.isOpening = false;
        this.isOpen = true;
        onComplete?.();
      },
    });
  }

  /** Stops any in-flight turn tween; called on scene shutdown. */
  destroy(): void {
    this.turnTween?.stop();
  }

  /**
   * Jumps straight to the fully-open state with no animation (e.g.
   * returning to the hall after the statue was already opened). Safe to
   * call before the first layout() — the next layout() picks up the
   * already-open turn values via applyTransform().
   */
  restoreOpen(): void {
    if (this.isOpen) {
      return;
    }
    this.isOpen = true;
    this.turnScaleX = TURN_SCALE_X;
    this.turnOffsetBg = TURN_OFFSET_BG_PX;
  }

  private applyTransform(): void {
    if (!this.image) {
      return;
    }
    // Position/feather-compensation stay in background-design-pixel space
    // via lastCoverScale, exactly like layout()'s own conversions.
    const imageX = this.lastBaseX + this.turnOffsetBg * this.lastCoverScale;
    const imageY = this.lastBaseY + BOTTOM_FEATHER_PX * this.baseScale;
    this.image.setPosition(imageX, imageY);
    this.image.setScale(this.baseScale * this.turnScaleX, this.baseScale);
  }

  // A soft radial falloff (white, alpha-only gradient) generated once and
  // tinted dark at draw time — same technique as Doorway's hover glow.
  private generateShadowTexture(): void {
    if (this.scene.textures.exists(SHADOW_KEY)) {
      return;
    }
    const size = 128;
    const canvas = this.scene.textures.createCanvas(SHADOW_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(35,28,20,0.55)');
    grad.addColorStop(0.7, 'rgba(35,28,20,0.25)');
    grad.addColorStop(1, 'rgba(35,28,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
