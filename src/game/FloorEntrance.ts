import Phaser from 'phaser';

export interface FloorEntranceSize {
  /** Target full width of the tile, in background-image pixels. Height/split-distance/stair-opening size all derive from this. */
  widthBg: number;
}

// Tile proportions, in local (unscaled) background-pixel units — a
// subtle, mostly-flat floor segment rather than a large circular seal.
const TILE_ASPECT = 0.58;
const TRAPEZOID_TOP_FACTOR = 0.72;

// The tile sits on the platform's engraved ring, to the right of and
// slightly below the crystal — not on the flat hall floor facing the
// camera square-on. A small clockwise rotation plus a flattened vertical
// scale mimics the ring's curve/perspective at that position.
const TILE_ROTATION_DEG = 14;
const TILE_VERTICAL_SQUASH = 0.82;

// Idle "light leaking from beneath" flicker: alpha-only, on the crack
// lines, hidden most of the time — a brief fade in/out every 3-5s.
const FLICKER_MIN_DELAY_MS = 3000;
const FLICKER_MAX_DELAY_MS = 5000;
const FLICKER_PEAK_ALPHA = 0.6;
const FLICKER_FADE_MS = 900;

const HOVER_GLOW_BOOST = 0.3;
const HOVER_TWEEN_MS = 200;

// Opening: a brief glow intensify (yoyo) on the cracks, overlapping the
// start of the split/slide-apart animation that reveals the stair hole.
const INTENSIFY_PEAK_ALPHA = 1;
const INTENSIFY_MS = 300;
const SPLIT_MS = 700;

const STONE_FILL_COLOR = 0x3a2e22;
const STONE_FILL_ALPHA = 0.4;
const BORDER_COLOR = 0x8a7050;
const BORDER_ALPHA = 0.5;
const CRACK_COLOR = 0xff6fc0;
const HOLE_FILL_COLOR = 0x0a0806;
const HOLE_FILL_ALPHA = 0.93;
const HOLE_RIM_COLOR = 0x6b5a42;
const STEP_HIGHLIGHT_COLOR = 0xffcf9e;

/**
 * The Central Hall's hidden floor entrance to the Libra Room — TEMPORARY
 * placeholder built entirely from Phaser Graphics (no image assets; the
 * previous large rectangular tile PNGs read as pasted-on and were
 * removed). A subtle stone floor segment, almost invisible while idle,
 * with thin pink-glowing cracks that briefly flicker every few seconds.
 * On click it splits into two halves that slide apart, revealing a dark
 * stair opening underneath that stays visible afterward. Visible and
 * clickable from the very first time Central Hall is shown — never
 * gated behind any other room's progress or reward. Only three guards
 * exist: `isFloorEntranceOpening` (mid-animation, blocks repeated
 * clicks), `isFloorEntranceOpen` (already opened — a click now means
 * "enter", not "open"), and the scene-owned transition guard the caller
 * applies around `onActivate`.
 *
 * The tile base (both split halves), the crack glow, the opening, and
 * the hit area are all anchored through a single Container: position,
 * rotation, and scale are set once on the container in layout(), so
 * they can never drift apart.
 */
export default class FloorEntrance {
  private scene: Phaser.Scene;
  private size: FloorEntranceSize;

  private container?: Phaser.GameObjects.Container;
  private leftHalf?: Phaser.GameObjects.Graphics;
  private rightHalf?: Phaser.GameObjects.Graphics;
  private crackGraphics?: Phaser.GameObjects.Graphics;
  private openGraphics?: Phaser.GameObjects.Graphics;
  private hitRect?: Phaser.Geom.Rectangle;

  private halfW = 0;
  private halfH = 0;
  private splitDist = 0;
  private stairHalfW = 0;
  private stairHalfH = 0;

  private flickerTimer?: Phaser.Time.TimerEvent;
  private flickerTween?: Phaser.Tweens.Tween;
  private hoverTween?: Phaser.Tweens.Tween;
  private splitTween?: Phaser.Tweens.Tween;

  private flickerAlpha = 0;
  private hoverBoost = 0;

  isFloorEntranceOpening = false;
  isFloorEntranceOpen = false;

  /** Fired once the opening animation finishes — CentralHallScene records this in the registry. */
  onOpened?: () => void;
  /** Fired when the revealed stair opening is clicked. */
  onActivate?: () => void;

  constructor(scene: Phaser.Scene, size: FloorEntranceSize) {
    this.scene = scene;
    this.size = size;
  }

  create(depth: number): void {
    this.halfW = this.size.widthBg / 2;
    this.halfH = this.halfW * TILE_ASPECT;
    this.splitDist = this.halfW * 0.62;
    this.stairHalfW = this.halfW * 0.42;
    this.stairHalfH = this.halfH * 0.55;

    this.openGraphics = this.scene.add.graphics().setAlpha(0);
    this.drawOpenHole();

    this.leftHalf = this.scene.add.graphics();
    this.rightHalf = this.scene.add.graphics();
    this.drawTileHalves();

    this.crackGraphics = this.scene.add.graphics().setAlpha(0);
    this.drawCracks();

    // Render order (bottom to top): the dark hole, the two tile halves
    // covering it while closed, the crack glow on top of everything.
    this.container = this.scene.add
      .container(0, 0, [this.openGraphics, this.leftHalf, this.rightHalf, this.crackGraphics])
      .setDepth(depth);

    // Interactivity is registered ONCE, unconditionally, here — never
    // gated behind any progress flag. An explicit Phaser.Geom.Rectangle
    // hit area (kept updated in updateHitArea(), never replaced by a
    // second setInteractive() call) covers the full closed tile while
    // closed, then shrinks to just the stair opening once open. A
    // Container's hit-test local point is relative to its position
    // directly (centered), unlike a top-left-relative Zone/Image.
    // Whether a click does anything is decided inside handleClick(), by
    // the two isFloorEntranceOpening/isFloorEntranceOpen flags.
    this.hitRect = new Phaser.Geom.Rectangle(-1, -1, 1, 1);
    this.container.setInteractive(this.hitRect, Phaser.Geom.Rectangle.Contains);
    if (this.container.input) {
      this.container.input.cursor = 'pointer';
    }

    this.container.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.container.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.container.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleClick());

    this.updateHitArea();

    // Idle flicker active from the moment the hall is shown — no
    // separate activation step tied to another room.
    this.scheduleFlicker();
  }

  /** centerX/centerY are screen-space; scale is the background cover-scale factor. */
  layout(centerX: number, centerY: number, scale: number): void {
    if (!this.container) {
      return;
    }
    this.container.setPosition(centerX, centerY);
    this.container.setRotation(Phaser.Math.DegToRad(TILE_ROTATION_DEG));
    this.container.setScale(scale, scale * TILE_VERTICAL_SQUASH);
  }

  // The left/right stone-tile halves, split down the vertical middle of
  // a slightly trapezoidal floor segment. Each half is drawn at its own
  // resting local position (0,0 on the Graphics object) so opening can
  // simply translate the whole object sideways without redrawing.
  private drawTileHalves(): void {
    const { halfW, halfH } = this;
    const topX = halfW * TRAPEZOID_TOP_FACTOR;
    const midTop = { x: 0, y: -halfH };
    const midBottom = { x: 0, y: halfH };

    const left = this.leftHalf;
    const right = this.rightHalf;
    if (!left || !right) {
      return;
    }

    left.clear();
    left.fillStyle(STONE_FILL_COLOR, STONE_FILL_ALPHA);
    left.fillPoints([{ x: -topX, y: -halfH }, midTop, midBottom, { x: -halfW, y: halfH }], true);
    left.lineStyle(1.5, BORDER_COLOR, BORDER_ALPHA);
    left.strokePoints([{ x: -topX, y: -halfH }, midTop, midBottom, { x: -halfW, y: halfH }], true);

    right.clear();
    right.fillStyle(STONE_FILL_COLOR, STONE_FILL_ALPHA);
    right.fillPoints([midTop, { x: topX, y: -halfH }, { x: halfW, y: halfH }, midBottom], true);
    right.lineStyle(1.5, BORDER_COLOR, BORDER_ALPHA);
    right.strokePoints([midTop, { x: topX, y: -halfH }, { x: halfW, y: halfH }, midBottom], true);
  }

  // A dark recessed hole with a faint carved-stone rim and a couple of
  // simple step-edge highlight lines — enough to read as "stairs down"
  // without needing real art. Stays drawn (just hidden via alpha) until
  // the tile opens, then fades in and stays visible.
  private drawOpenHole(): void {
    const g = this.openGraphics;
    if (!g) {
      return;
    }
    const w = this.stairHalfW;
    const h = this.stairHalfH;
    g.clear();

    g.fillStyle(HOLE_FILL_COLOR, HOLE_FILL_ALPHA);
    g.fillPoints(
      [
        { x: -w * 0.85, y: -h },
        { x: w * 0.85, y: -h },
        { x: w, y: h },
        { x: -w, y: h },
      ],
      true,
    );
    g.lineStyle(1.5, HOLE_RIM_COLOR, 0.7);
    g.strokePoints(
      [
        { x: -w * 0.85, y: -h },
        { x: w * 0.85, y: -h },
        { x: w, y: h },
        { x: -w, y: h },
      ],
      true,
    );

    for (let i = 0; i < 3; i++) {
      const t = i / 3;
      const y = -h + t * h * 1.7;
      const stepW = w * (0.8 - t * 0.25);
      g.lineStyle(1, STEP_HIGHLIGHT_COLOR, 0.22 - i * 0.05);
      g.lineBetween(-stepW, y, stepW, y);
    }
  }

  // A few short, thin jagged cracks across the tile — the "light
  // leaking from beneath" effect, alpha-driven (never redrawn) by
  // applyGlowAlpha().
  private drawCracks(): void {
    const g = this.crackGraphics;
    if (!g) {
      return;
    }
    const { halfW, halfH } = this;
    g.clear();
    g.lineStyle(2, CRACK_COLOR, 1);

    g.beginPath();
    g.moveTo(-halfW * 0.55, -halfH * 0.3);
    g.lineTo(-halfW * 0.15, halfH * 0.1);
    g.lineTo(halfW * 0.05, -halfH * 0.2);
    g.strokePath();

    g.beginPath();
    g.moveTo(halfW * 0.1, halfH * 0.5);
    g.lineTo(halfW * 0.4, halfH * 0.05);
    g.lineTo(halfW * 0.6, halfH * 0.35);
    g.strokePath();
  }

  // Resizes the (already-registered) hit rectangle in container-local,
  // unscaled pixels for the current open/closed state — the container's
  // own transform (position/rotation/scale) carries it into screen space
  // automatically, so this never needs to know about scale or rotation.
  private updateHitArea(): void {
    if (!this.hitRect) {
      return;
    }
    if (this.isFloorEntranceOpen) {
      this.hitRect.width = this.stairHalfW * 2;
      this.hitRect.height = this.stairHalfH * 2;
      this.hitRect.x = -this.stairHalfW;
      this.hitRect.y = -this.stairHalfH;
    } else {
      this.hitRect.width = this.halfW * 2;
      this.hitRect.height = this.halfH * 2;
      this.hitRect.x = -this.halfW;
      this.hitRect.y = -this.halfH;
    }
  }

  /**
   * The opened stair opening's real screen-space bounds (center + an
   * approximate axis-aligned width/height, ignoring the container's own
   * rotation for the size — matching this project's existing
   * "approximate opening bounds" convention elsewhere) — for the caller
   * to pan/zoom a camera onto, instead of a hard-coded screen point.
   * Only meaningful once open; undefined otherwise.
   */
  getStairOpeningBounds(): { centerX: number; centerY: number; width: number; height: number } | undefined {
    if (!this.container || !this.hitRect || !this.isFloorEntranceOpen) {
      return undefined;
    }
    const localCenterX = this.hitRect.x + this.hitRect.width / 2;
    const localCenterY = this.hitRect.y + this.hitRect.height / 2;
    const matrix = this.container.getWorldTransformMatrix();
    const point = matrix.transformPoint(localCenterX, localCenterY);
    return {
      centerX: point.x,
      centerY: point.y,
      width: this.hitRect.width * this.container.scaleX,
      height: this.hitRect.height * this.container.scaleY,
    };
  }

  /** Jumps straight to the fully-open, stair-clickable state with no animation (returning to a hall where this was already opened). */
  restoreOpen(): void {
    this.isFloorEntranceOpen = true;
    this.isFloorEntranceOpening = false;
    this.stopIdleFlicker();
    this.hoverTween?.stop();
    this.splitTween?.stop();
    this.leftHalf?.setX(-this.splitDist);
    this.rightHalf?.setX(this.splitDist);
    this.openGraphics?.setAlpha(1);
    this.crackGraphics?.setVisible(false);
    this.updateHitArea();
    this.setInteractionActive(true);
  }

  destroy(): void {
    this.flickerTimer?.remove();
    this.flickerTween?.stop();
    this.hoverTween?.stop();
    this.splitTween?.stop();
    this.container?.destroy();
  }

  // Registered once, unconditionally, in create() — always fires on
  // pointerdown. The only guards are the two state flags: mid-animation
  // (ignore repeated clicks) and already-open (a click now means "enter"
  // via onActivate, not "open" again).
  private handleClick(): void {
    if (this.isFloorEntranceOpening) {
      return;
    }
    if (this.isFloorEntranceOpen) {
      // Lock immediately — CentralHallScene's own staircase-scene
      // transition takes over from here.
      this.setInteractionActive(false);
      this.onActivate?.();
      return;
    }
    this.openTile();
  }

  // Locks input for the duration of the opening animation (prevents
  // repeated clicks), stops the idle flicker, briefly intensifies the
  // glow, then slides the two tile halves apart while the dark hole
  // fades in underneath — left slid open and the hit area shrunk to
  // just the stair opening once done.
  private openTile(): void {
    this.isFloorEntranceOpening = true;
    this.setInteractionActive(false);
    this.stopIdleFlicker();
    this.hoverTween?.stop();

    this.flickerTween?.stop();
    this.flickerTween = this.scene.tweens.add({
      targets: this,
      flickerAlpha: INTENSIFY_PEAK_ALPHA,
      duration: INTENSIFY_MS,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => this.applyGlowAlpha(),
    });

    this.splitTween?.stop();
    this.splitTween = this.scene.tweens.add({
      targets: this.leftHalf,
      x: -this.splitDist,
      delay: INTENSIFY_MS,
      duration: SPLIT_MS,
      ease: Phaser.Math.Easing.Cubic.InOut,
    });
    this.scene.tweens.add({
      targets: this.rightHalf,
      x: this.splitDist,
      delay: INTENSIFY_MS,
      duration: SPLIT_MS,
      ease: Phaser.Math.Easing.Cubic.InOut,
    });
    this.scene.tweens.add({
      targets: this.openGraphics,
      alpha: 1,
      delay: INTENSIFY_MS,
      duration: SPLIT_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => {
        this.isFloorEntranceOpening = false;
        this.isFloorEntranceOpen = true;
        this.crackGraphics?.setVisible(false);
        this.updateHitArea();
        this.setInteractionActive(true);
        this.onOpened?.();
      },
    });
  }

  private scheduleFlicker(): void {
    if (this.isFloorEntranceOpen || this.isFloorEntranceOpening) {
      return;
    }
    const delay = Phaser.Math.Between(FLICKER_MIN_DELAY_MS, FLICKER_MAX_DELAY_MS);
    this.flickerTimer = this.scene.time.delayedCall(delay, () => this.playFlicker());
  }

  private playFlicker(): void {
    if (this.isFloorEntranceOpen || this.isFloorEntranceOpening) {
      return;
    }
    this.flickerTween?.stop();
    this.flickerTween = this.scene.tweens.add({
      targets: this,
      flickerAlpha: FLICKER_PEAK_ALPHA,
      duration: FLICKER_FADE_MS,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyGlowAlpha(),
      onComplete: () => this.scheduleFlicker(),
    });
  }

  private stopIdleFlicker(): void {
    this.flickerTimer?.remove();
    this.flickerTimer = undefined;
    this.flickerTween?.stop();
    this.flickerAlpha = 0;
    this.applyGlowAlpha();
  }

  private setHovered(hovered: boolean): void {
    if (this.isFloorEntranceOpen || this.isFloorEntranceOpening) {
      return;
    }
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({
      targets: this,
      hoverBoost: hovered ? 1 : 0,
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyGlowAlpha(),
    });
  }

  private applyGlowAlpha(): void {
    this.crackGraphics?.setAlpha(Math.min(1, this.flickerAlpha + this.hoverBoost * HOVER_GLOW_BOOST));
  }

  // Toggles the already-registered InteractiveObject's enabled flag
  // directly — never calls setInteractive() again, which would silently
  // replace the explicit Rectangle hit area set once in create() with a
  // new auto-derived one (re-introducing the same stale-hit-area bug
  // through a different path).
  private setInteractionActive(active: boolean): void {
    if (!this.container?.input) {
      return;
    }
    this.container.input.enabled = active;
    if (!active) {
      this.hoverTween?.stop();
      this.hoverBoost = 0;
      this.applyGlowAlpha();
    }
  }
}
