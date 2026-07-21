import Phaser from 'phaser';

export interface HandleSize {
  /** Target displayed width of the full source image, in background-image pixels. */
  widthBg: number;
}

const HOVER_SCALE = 1.04;
const HOVER_TWEEN_MS = 200;
const REVEAL_FADE_MS = 400;

// Lever-pull animation: rotates to its activated position with a very
// small mechanical overshoot/bounce at the end rather than easing flatly
// to a stop.
const LEVER_ROTATION_DURATION_MS = 500;
const LEVER_ACTIVATED_ANGLE_DEG = -32;
const LEVER_BOUNCE_OVERSHOOT = 0.6;
// Small pause after the lever starts moving before the statue begins its
// own turn, so the two reads as cause-and-effect rather than simultaneous.
const STATUE_TRIGGER_DELAY_MS = 120;

/**
 * A hidden wall handle: invisible and non-interactive until reveal() is
 * called (by whatever uncovers it). Once fully faded in it becomes
 * clickable with only a subtle hover swell — no hand cursor. Acts as the
 * Central Hall's lever: a single click disables further input, rotates
 * the handle to its activated position, and then (once the rotation is
 * under way) notifies the scene via onActivate to begin whatever it
 * unlocks — no puzzle logic lives here.
 */
export default class Handle {
  private scene: Phaser.Scene;
  private textureKey: string;
  private size: HandleSize;
  private image?: Phaser.GameObjects.Image;
  private baseScale = 1;
  private hoverScale = 1;
  private hoverTween?: Phaser.Tweens.Tween;
  private revealed = false;
  private activated = false;

  /** Invoked once the lever has begun its activated rotation. */
  onActivate?: () => void;

  constructor(scene: Phaser.Scene, textureKey: string, size: HandleSize) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.size = size;
  }

  create(depth: number): void {
    this.image = this.scene.add
      .image(0, 0, this.textureKey)
      .setOrigin(0.5, 0.5)
      .setDepth(depth)
      .setAlpha(0);
  }

  layout(x: number, y: number, scale: number): void {
    if (!this.image) {
      return;
    }
    this.baseScale = (this.size.widthBg / this.image.width) * scale;
    this.image.setPosition(x, y);
    this.applyScale();
  }

  private applyScale(): void {
    this.image?.setScale(this.baseScale * this.hoverScale);
  }

  /** Fades the handle in; only once fully visible does it become interactive. */
  reveal(): void {
    if (this.revealed || !this.image) {
      return;
    }
    this.revealed = true;
    this.scene.tweens.add({
      targets: this.image,
      alpha: 1,
      duration: REVEAL_FADE_MS,
      onComplete: () => {
        if (!this.image) {
          return;
        }
        this.image.setInteractive({ useHandCursor: false });
        this.image.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
        this.image.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
        this.image.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleClick());
      },
    });
  }

  private setHovered(hovered: boolean): void {
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({
      targets: this,
      hoverScale: hovered ? HOVER_SCALE : 1,
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyScale(),
    });
  }

  /** Jumps straight to the activated state with no animation/reveal (e.g. returning to a scene where the lever was already pulled). */
  restoreActivated(): void {
    if (this.activated) {
      return;
    }
    this.revealed = true;
    this.activated = true;
    this.image?.setAlpha(1).setAngle(LEVER_ACTIVATED_ANGLE_DEG);
  }

  private handleClick(): void {
    if (this.activated || !this.image) {
      return;
    }
    // Clickable only once: disable further input immediately.
    this.activated = true;
    this.image.disableInteractive();
    this.setHovered(false);

    this.scene.tweens.add({
      targets: this.image,
      angle: LEVER_ACTIVATED_ANGLE_DEG,
      duration: LEVER_ROTATION_DURATION_MS,
      ease: (t: number) => Phaser.Math.Easing.Back.Out(t, LEVER_BOUNCE_OVERSHOOT),
    });

    // Let the lever's own motion read first, then hand off to whatever it
    // unlocks.
    this.scene.time.delayedCall(STATUE_TRIGGER_DELAY_MS, () => this.onActivate?.());
  }
}
