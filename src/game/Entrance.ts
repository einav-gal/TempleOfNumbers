import Phaser from 'phaser';

const FRAME_KEY = 'central-hall-entrance-frame-TEMP';
const GLOW_KEY = 'central-hall-entrance-glow-TEMP';

export interface EntranceSize {
  widthBg: number;
  heightBg: number;
}

const BASE_GLOW_ALPHA = 0.5;
const HOVER_GLOW_BOOST = 0.4;
const HOVER_TWEEN_MS = 220;

// The actual dark opening is inset from the full frame image (the stone
// lip forms the gap between them) — these fractions of the frame's own
// display size describe that inset, shared between the texture drawing
// below and getOpeningBounds(), so the "walk through the doorway" camera
// target (the opening, not the whole frame) can never drift out of sync
// with what's actually drawn.
const OPENING_MARGIN_X_FRAC = 0.17;
const OPENING_TOP_Y_FRAC = 0.2;
const OPENING_BOTTOM_Y_FRAC = 0.99;

/**
 * TEMPORARY placeholder for the hidden passage revealed behind the left
 * statue: a procedurally-drawn stone arch with a dark recessed interior,
 * a couple of faint nested arches suggesting depth, and a soft cool
 * glow (separate sprite, ADD blend) glimmering from deeper inside. No
 * dedicated entrance/passage/room asset exists anywhere under
 * assets/images/central-hall — replace the generated textures with real
 * art when available; the rest of this class's behavior (reveal/hover/
 * click) shouldn't need to change.
 */
export default class Entrance {
  private scene: Phaser.Scene;
  private size: EntranceSize;
  private frame?: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Image;
  private zone?: Phaser.GameObjects.Zone;
  private hitRect?: Phaser.Geom.Rectangle;
  private hoverBoost = 0;
  private hoverTween?: Phaser.Tweens.Tween;

  /** Invoked on click, once the entrance has been revealed and made interactive. */
  onActivate?: () => void;

  constructor(scene: Phaser.Scene, size: EntranceSize) {
    this.scene = scene;
    this.size = size;
  }

  create(depth: number): void {
    this.generateTextures();

    this.frame = this.scene.add
      .image(0, 0, FRAME_KEY)
      .setOrigin(0.5, 1)
      .setDepth(depth)
      .setAlpha(0);

    // Separate sprite so hover can brighten just the inner glow, ADD
    // blend so it reads as light rather than a flat colored shape.
    this.glow = this.scene.add
      .image(0, 0, GLOW_KEY)
      .setOrigin(0.5, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth)
      .setAlpha(0);

    this.zone = this.scene.add.zone(0, 0, 1, 1);
    // Interactivity is registered ONCE, with an explicit Rectangle hit
    // area kept in sync by layout() — never re-registered by setActive()
    // (which only toggles input.enabled), so a stale/placeholder-sized
    // hit area can never get baked in regardless of call order relative
    // to layout() (restoreRevealed() runs before the first layout() call).
    // Starts disabled, matching "not interactive until revealed."
    this.hitRect = new Phaser.Geom.Rectangle(0, 0, 1, 1);
    this.zone.setInteractive(this.hitRect, Phaser.Geom.Rectangle.Contains);
    if (this.zone.input) {
      this.zone.input.cursor = 'pointer';
      this.zone.input.enabled = false;
    }
    this.zone.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.zone.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.onActivate?.());
  }

  /** baseX/baseY: the opening's floor-contact point (same anchor as the statue). */
  layout(baseX: number, baseY: number, scale: number): void {
    if (!this.frame || !this.glow || !this.zone) {
      return;
    }
    const width = this.size.widthBg * scale;
    const height = this.size.heightBg * scale;

    this.frame.setPosition(baseX, baseY).setDisplaySize(width, height);
    // Glimmer sits roughly a third of the way down from the arch top,
    // where the passage would recede furthest into the wall.
    this.glow.setPosition(baseX, baseY - height * 0.62).setDisplaySize(width * 0.55, width * 0.55);
    this.zone.setPosition(baseX, baseY - height / 2).setSize(width, height);
    if (this.hitRect) {
      this.hitRect.width = width;
      this.hitRect.height = height;
    }
  }

  /**
   * The doorway's actual dark opening (not the whole frame image), in the
   * same coordinate space as layout()'s own baseX/baseY/scale — the
   * correct camera target for "walking through" the doorway. Derived
   * from the same fractions generateFrameTexture() draws with, so it can
   * never drift out of sync with the artwork.
   */
  getOpeningBounds(
    baseX: number,
    baseY: number,
    scale: number,
  ): { centerX: number; centerY: number; width: number; height: number } {
    const frameWidth = this.size.widthBg * scale;
    const frameHeight = this.size.heightBg * scale;
    const frameTop = baseY - frameHeight;

    const openingWidth = frameWidth * (1 - OPENING_MARGIN_X_FRAC * 2);
    const openingTop = frameTop + frameHeight * OPENING_TOP_Y_FRAC;
    const openingBottom = frameTop + frameHeight * OPENING_BOTTOM_Y_FRAC;
    const openingHeight = openingBottom - openingTop;

    return {
      centerX: baseX,
      centerY: openingTop + openingHeight / 2,
      width: openingWidth,
      height: openingHeight,
    };
  }

  /** Fades the opening (and its inner glow) in; call once the statue begins turning away. */
  reveal(durationMs: number): void {
    if (!this.frame || !this.glow) {
      return;
    }
    this.scene.tweens.add({
      targets: this.frame,
      alpha: 1,
      duration: durationMs,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
    this.scene.tweens.add({
      targets: this.glow,
      alpha: BASE_GLOW_ALPHA,
      duration: durationMs,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  /** Jumps straight to the fully-revealed, interactive state with no fade (e.g. returning to a scene where this already happened). */
  restoreRevealed(): void {
    this.frame?.setAlpha(1);
    this.glow?.setAlpha(BASE_GLOW_ALPHA);
    this.setActive(true);
  }

  // Toggles the already-registered InteractiveObject's enabled flag
  // directly — never calls setInteractive()/disableInteractive() again,
  // which would silently replace or drop the explicit hit area set once
  // in create().
  setActive(active: boolean): void {
    if (!this.zone?.input) {
      return;
    }
    this.zone.input.enabled = active;
    if (!active) {
      this.setHovered(false);
    }
  }

  private setHovered(hovered: boolean): void {
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({
      targets: this,
      hoverBoost: hovered ? 1 : 0,
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.glow?.setAlpha(BASE_GLOW_ALPHA + HOVER_GLOW_BOOST * this.hoverBoost),
    });
  }

  private generateTextures(): void {
    this.generateFrameTexture();
    this.generateGlowTexture();
  }

  // TEMP: a stone arch frame around a dark, gently-graduated recessed
  // interior, with a couple of faint nested-arch strokes suggesting a
  // passage receding into the wall, and a soft blurred outer edge so it
  // blends into the surrounding niche stonework instead of reading as a
  // pasted-on rectangle. Swap for a real entrance/passage asset when one
  // is available — nothing else here should need to change.
  private generateFrameTexture(): void {
    if (this.scene.textures.exists(FRAME_KEY)) {
      return;
    }
    const w = 170;
    const h = 350;
    const canvas = this.scene.textures.createCanvas(FRAME_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();

    const archPath = (marginX: number, topY: number, radius: number, bottomY: number) => {
      ctx.beginPath();
      ctx.moveTo(marginX, bottomY);
      ctx.lineTo(marginX, topY + radius);
      ctx.arc(w / 2, topY + radius, radius, Math.PI, 0);
      ctx.lineTo(w - marginX, bottomY);
      ctx.closePath();
    };

    // 1. Outer stone frame — warm dark stone, soft blurred edge to blend
    // into the wall around the niche.
    const outerMarginX = w * 0.06;
    const outerRadius = (w - outerMarginX * 2) / 2;
    const outerTopY = h * 0.12;
    ctx.save();
    ctx.filter = 'blur(6px)';
    archPath(outerMarginX, outerTopY, outerRadius, h);
    const frameGrad = ctx.createLinearGradient(0, outerTopY, 0, h);
    frameGrad.addColorStop(0, 'rgba(60,50,38,0.95)');
    frameGrad.addColorStop(1, 'rgba(28,23,17,0.95)');
    ctx.fillStyle = frameGrad;
    ctx.fill();
    ctx.restore();

    // 2. Faint worn-gold trim tracing the outer arch — ancient carved
    // detail, kept subtle.
    ctx.save();
    archPath(outerMarginX, outerTopY, outerRadius, h);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(176,138,72,0.3)';
    ctx.stroke();
    ctx.restore();

    // 3. Inner recessed passage — inset from the outer frame (the inset
    // itself reads as the frame's stone lip/depth), near-black with a
    // gentle radial gradient rather than flat black.
    const innerMarginX = w * OPENING_MARGIN_X_FRAC;
    const innerRadius = (w - innerMarginX * 2) / 2;
    const innerTopY = h * OPENING_TOP_Y_FRAC;
    ctx.save();
    archPath(innerMarginX, innerTopY, innerRadius, h * OPENING_BOTTOM_Y_FRAC);
    const innerGrad = ctx.createRadialGradient(w / 2, h * 0.5, 6, w / 2, h * 0.5, w * 0.65);
    innerGrad.addColorStop(0, 'rgba(9,8,9,0.98)');
    innerGrad.addColorStop(0.7, 'rgba(4,4,5,0.98)');
    innerGrad.addColorStop(1, 'rgba(2,2,3,0.98)');
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Soft inner shadow right where the frame's lip meets the dark
    // passage, so the opening reads as recessed rather than flat.
    ctx.filter = 'blur(4px)';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.stroke();
    ctx.restore();

    // 4. Two faint nested arches further inside, hinting at a passage
    // receding rather than a flat painted hole.
    for (let i = 1; i <= 2; i++) {
      const t = i * 0.16;
      ctx.save();
      archPath(
        innerMarginX + (w / 2 - innerMarginX) * t,
        innerTopY + h * 0.05 * i,
        innerRadius * (1 - t),
        h * 0.97,
      );
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.06 - i * 0.02})`;
      ctx.stroke();
      ctx.restore();
    }

    canvas.refresh();
  }

  // TEMP: soft cool radial glow standing in for light drifting out from
  // deeper in the passage. Separate texture so hover can brighten just
  // this layer.
  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_KEY)) {
      return;
    }
    const size = 140;
    const canvas = this.scene.textures.createCanvas(GLOW_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(150,220,232,0.9)');
    grad.addColorStop(0.4, 'rgba(94,176,200,0.5)');
    grad.addColorStop(1, 'rgba(60,140,180,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
