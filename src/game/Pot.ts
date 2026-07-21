import Phaser from 'phaser';

export interface PotSize {
  /** Target displayed height of the full source image, in background-image pixels. */
  heightBg: number;
}

const HOVER_SCALE = 1.05;
const HOVER_TWEEN_MS = 220;

// Fall sequence, in background-image pixels/degrees: tilt + slide away from
// the statue first, then drop to the floor with a small final settling
// rotation. Two short tweens chained — no physics, no bounce.
const SLIDE_X_BG = -32;
const FALL_Y_BG = 56;
const TILT_ANGLE_DEG = 14;
const FINAL_ANGLE_DEG = 78;
const SLIDE_DURATION_MS = 340;
const FALL_DURATION_MS = 320;

/**
 * A single interactive potted plant: hand cursor + subtle hover swell, and
 * a one-time fall (tilt, slide away, drop, settle) on first click that
 * holds its final fallen position/angle. No puzzle logic — the scene may
 * hook onMoved for that, once the pot has fully cleared the area.
 */
export default class Pot {
  private scene: Phaser.Scene;
  private textureKey: string;
  private size: PotSize;
  private image?: Phaser.GameObjects.Image;
  private baseScale = 1;
  private baseX = 0;
  private baseY = 0;
  private bgScale = 1;
  private hoverScale = 1;
  private hoverTween?: Phaser.Tweens.Tween;
  private moved = false;

  /** Invoked once, after the pot has finished falling and settled. */
  onMoved?: () => void;

  constructor(scene: Phaser.Scene, textureKey: string, size: PotSize) {
    this.scene = scene;
    this.textureKey = textureKey;
    this.size = size;
  }

  create(depth: number): void {
    this.image = this.scene.add
      .image(0, 0, this.textureKey)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.NORMAL)
      .setAlpha(1)
      .setAngle(0)
      .setDepth(depth);

    this.image.setInteractive({ useHandCursor: true });
    this.image.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.image.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.image.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleClick());
  }

  /** baseX/baseY: the pot's floor-contact point in screen space; scale: background cover-scale factor. */
  layout(baseX: number, baseY: number, scale: number): void {
    if (!this.image) {
      return;
    }
    this.baseScale = (this.size.heightBg / this.image.height) * scale;
    this.baseX = baseX;
    this.baseY = baseY;
    this.bgScale = scale;
    if (this.moved) {
      this.image
        .setPosition(baseX + SLIDE_X_BG * scale, baseY + FALL_Y_BG * scale)
        .setAngle(FINAL_ANGLE_DEG);
    } else {
      this.image.setPosition(baseX, baseY).setAngle(0);
    }
    this.applyScale();
  }

  private applyScale(): void {
    this.image?.setScale(this.baseScale * this.hoverScale);
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

  /** Disables/re-enables pointer interaction (e.g. while a modal overlay is open). */
  setActive(active: boolean): void {
    if (!this.image) {
      return;
    }
    // Once fallen, the pot stays inert regardless of what the scene asks
    // for — handleClick() already no-ops if moved, but this keeps the
    // hover/cursor feedback from reappearing on an already-used pot too.
    if (active && !this.moved) {
      this.image.setInteractive({ useHandCursor: true });
    } else {
      this.image.disableInteractive();
      this.setHovered(false);
    }
  }

  /** Jumps straight to the fallen state with no animation (e.g. returning to a scene where this already happened). */
  restoreFallen(): void {
    if (this.moved) {
      return;
    }
    this.moved = true;
    this.image?.disableInteractive();
  }

  private handleClick(): void {
    if (this.moved || !this.image) {
      return;
    }
    this.moved = true;
    this.setHovered(false);
    this.image.disableInteractive();

    const slideX = this.baseX + SLIDE_X_BG * this.bgScale;
    const fallY = this.baseY + FALL_Y_BG * this.bgScale;

    // Phase 1: tilt and slide away from the statue.
    this.scene.tweens.add({
      targets: this.image,
      x: slideX,
      angle: TILT_ANGLE_DEG,
      duration: SLIDE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        // Phase 2: drop to the floor with a small final settling rotation.
        this.scene.tweens.add({
          targets: this.image,
          y: fallY,
          angle: FINAL_ANGLE_DEG,
          duration: FALL_DURATION_MS,
          ease: Phaser.Math.Easing.Cubic.In,
          onComplete: () => this.onMoved?.(),
        });
      },
    });
  }
}
