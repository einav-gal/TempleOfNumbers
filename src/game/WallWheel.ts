import Phaser from 'phaser';
import wheelUrl from '../../assets/images/central-hall/wheel.png';

const WHEEL_KEY = 'central-hall-wall-wheel';
const GLOW_KEY = 'central-hall-wall-wheel-glow';
const PASSAGE_KEY = 'central-hall-wall-wheel-passage';
const SHADOW_KEY = 'central-hall-wall-wheel-shadow';
const DUST_KEY = 'central-hall-wall-wheel-dust';

const IDLE_GLOW_MIN_ALPHA = 0.18;
const IDLE_GLOW_MAX_ALPHA = 0.48;
const IDLE_GLOW_DURATION_MS = 1300;

const HOVER_SCALE = 1.035;
const HOVER_GLOW_ALPHA = 0.72;
const HOVER_TWEEN_MS = 180;

// A brief settle-shake before the main swing — "a light stone shake at the
// start of opening" plus "move the cover a few px forward/down at the
// start of the animation," read together as the disc jolting loose and
// dropping slightly before it swings open.
const SHAKE_DURATION_MS = 220;
const SHAKE_STEP_MS = 55;
const SHAKE_OFFSET_BG = 4;
const SHAKE_SETTLE_DROP_BG = 6;
const DUST_BURST_COUNT = 16;

// The main fall: the disc drops straight down to the floor (never
// sideways), tumbling as it goes, and settling with a bounce — the same
// "falls open" language as the Heart of the Temple's rings (see
// HeartOfTheTemple.ts) rather than a hinge-swing. Once landed, it fades
// away entirely (see fadeWheelAway()) rather than sitting in view in
// front of whatever hall elements are beneath the wall mount.
const OPEN_ROTATION_DEG = 220; // tumbles as it falls, more than the previous swing-open
const OPEN_SHIFT_Y_BG = 520; // falls toward the floor, not sideways
const OPEN_SCALE_FACTOR = 0.85;
const OPEN_DURATION_MS = 1300; // generous — Bounce.Out reads best with more time than a plain decelerate
const OPEN_EASE = Phaser.Math.Easing.Bounce.Out;
const WHEEL_FADE_DELAY_MS = 300;
const WHEEL_FADE_DURATION_MS = 500;

const SHADOW_ALPHA_OPEN = 0.5;

// Weak green light bleeding through from Room 3's own crystal, behind the
// dark opening — distinct from the wheel's own idle amber rim glow.
const PASSAGE_GLOW_COLOR = 0x4ade80;
const PASSAGE_GLOW_MIN_ALPHA = 0.16;
const PASSAGE_GLOW_MAX_ALPHA = 0.34;
const PASSAGE_GLOW_PULSE_MS = 1800;

export interface WallWheelSize {
  widthBg: number;
}

/**
 * Separate wall-wheel mechanism for the Central Hall.
 *
 * The wheel is active from the beginning during the current development
 * stage. Clicking it shakes loose, then falls straight down to the floor
 * (tumbling, with a bounce on landing — never sideways), fading away once
 * it lands, to reveal a dark circular passage lit by a weak green glow
 * (Room 3's own crystal light). Only once it lands does the passage
 * become clickable. The scene owns persistence and navigation through the
 * callbacks.
 */
export default class WallWheel {
  private scene: Phaser.Scene;
  private size: WallWheelSize;

  private wheel?: Phaser.GameObjects.Image;
  private shadow?: Phaser.GameObjects.Image;
  private glow?: Phaser.GameObjects.Image;
  private passage?: Phaser.GameObjects.Image;
  private passageGlow?: Phaser.GameObjects.Image;
  private dustEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private wheelZone?: Phaser.GameObjects.Zone;
  private passageZone?: Phaser.GameObjects.Zone;
  private wheelHitRect?: Phaser.Geom.Rectangle;
  private passageHitCircle?: Phaser.Geom.Circle;

  private idleGlowTween?: Phaser.Tweens.Tween;
  private hoverTween?: Phaser.Tweens.Tween;
  private shakeTween?: Phaser.Tweens.Tween;
  private openTween?: Phaser.Tweens.Tween;
  private passageGlowPulseTween?: Phaser.Tweens.Tween;

  private centerX = 0;
  private centerY = 0;
  private scale = 1;
  private wheelBaseScaleX = 1;
  private wheelBaseScaleY = 1;
  private isOpening = false;
  private isOpen = false;

  onOpened?: () => void;
  onActivate?: () => void;

  constructor(scene: Phaser.Scene, size: WallWheelSize) {
    this.scene = scene;
    this.size = size;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(WHEEL_KEY, wheelUrl);
  }

  create(depth: number): void {
    this.generateTextures();

    this.passage = this.scene.add
      .image(0, 0, PASSAGE_KEY)
      .setDepth(depth)
      .setAlpha(0);

    this.passageGlow = this.scene.add
      .image(0, 0, GLOW_KEY)
      .setDepth(depth + 0.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(PASSAGE_GLOW_COLOR)
      .setAlpha(0);

    this.glow = this.scene.add
      .image(0, 0, GLOW_KEY)
      .setDepth(depth + 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xd9b46f)
      .setAlpha(IDLE_GLOW_MIN_ALPHA);

    this.shadow = this.scene.add
      .image(0, 0, SHADOW_KEY)
      .setDepth(depth + 1.2)
      .setAlpha(0);

    this.wheel = this.scene.add
      .image(0, 0, WHEEL_KEY)
      .setDepth(depth + 2);

    this.dustEmitter = this.scene.add
      .particles(0, 0, DUST_KEY, {
        emitting: false,
        lifespan: 900,
        speed: { min: 15, max: 55 },
        angle: { min: 60, max: 120 },
        gravityY: 60,
        scale: { start: 0.9, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        quantity: 1,
      })
      .setDepth(depth + 4);

    this.wheelZone = this.scene.add.zone(0, 0, 1, 1).setDepth(depth + 3);
    this.wheelHitRect = new Phaser.Geom.Rectangle(0, 0, 1, 1);
    this.wheelZone.setInteractive(this.wheelHitRect, Phaser.Geom.Rectangle.Contains);
    if (this.wheelZone.input) {
      this.wheelZone.input.cursor = 'pointer';
    }

    this.passageZone = this.scene.add.zone(0, 0, 1, 1).setDepth(depth + 3);
    this.passageHitCircle = new Phaser.Geom.Circle(0, 0, 1);
    this.passageZone.setInteractive(this.passageHitCircle, Phaser.Geom.Circle.Contains);
    if (this.passageZone.input) {
      this.passageZone.input.cursor = 'pointer';
      this.passageZone.input.enabled = false;
    }

    this.wheelZone.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.wheelZone.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));
    this.wheelZone.on(Phaser.Input.Events.POINTER_DOWN, () => this.open());

    this.passageZone.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (this.isOpen) {
        this.scene.tweens.add({
          targets: this.passage,
          alpha: 1,
          duration: HOVER_TWEEN_MS,
        });
      }
    });
    this.passageZone.on(Phaser.Input.Events.POINTER_OUT, () => {
      if (this.isOpen) {
        this.scene.tweens.add({
          targets: this.passage,
          alpha: 0.9,
          duration: HOVER_TWEEN_MS,
        });
      }
    });
    this.passageZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (!this.isOpen) {
        return;
      }
      this.setPassageInteractive(false);
      this.onActivate?.();
    });

    this.startIdleGlow();
  }

  layout(centerX: number, centerY: number, backgroundScale: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.scale = backgroundScale;

    const displayWidth = this.size.widthBg * backgroundScale;
    const texture = this.wheel?.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const textureWidth = texture?.width ?? 158;
    const textureHeight = texture?.height ?? 141;
    const displayHeight = displayWidth * (textureHeight / textureWidth);

    const shiftY = this.isOpen ? OPEN_SHIFT_Y_BG * backgroundScale : 0;

    this.wheel
      ?.setPosition(centerX, centerY + shiftY)
      .setDisplaySize(displayWidth, displayHeight)
      .setAngle(this.isOpen ? OPEN_ROTATION_DEG : 0);

    if (this.wheel) {
      // Captured BEFORE the open-state scale multiplier below, so both the
      // hover effect and the open animation's own scale tween always read
      // a stable 1.0-relative baseline regardless of whether the wheel is
      // currently open.
      this.wheelBaseScaleX = this.wheel.scaleX;
      this.wheelBaseScaleY = this.wheel.scaleY;
      if (this.isOpen) {
        this.wheel.setScale(this.wheelBaseScaleX * OPEN_SCALE_FACTOR, this.wheelBaseScaleY * OPEN_SCALE_FACTOR);
      }
    }

    this.shadow
      ?.setPosition(centerX + displayWidth * 0.05, centerY + shiftY + displayWidth * 0.08)
      .setDisplaySize(displayWidth * 1.05, displayWidth * 1.05);

    this.glow
      ?.setPosition(centerX, centerY)
      .setDisplaySize(displayWidth * 1.35, displayWidth * 1.35);

    const passageSize = displayWidth * 0.74;
    this.passage
      ?.setPosition(centerX, centerY)
      .setDisplaySize(passageSize, passageSize);

    this.passageGlow
      ?.setPosition(centerX, centerY)
      .setDisplaySize(passageSize * 1.3, passageSize * 1.3);

    this.wheelZone?.setPosition(centerX, centerY).setSize(displayWidth, displayHeight);
    if (this.wheelHitRect) {
      this.wheelHitRect.width = displayWidth;
      this.wheelHitRect.height = displayHeight;
    }

    this.passageZone?.setPosition(centerX, centerY).setSize(passageSize, passageSize);
    if (this.passageHitCircle) {
      this.passageHitCircle.x = passageSize / 2;
      this.passageHitCircle.y = passageSize / 2;
      this.passageHitCircle.radius = passageSize / 2;
    }
  }

  restoreOpen(): void {
    this.isOpening = false;
    this.isOpen = true;
    this.idleGlowTween?.stop();
    this.glow?.setAlpha(0.18);
    this.passage?.setAlpha(0.9);
    this.passageGlow?.setAlpha(PASSAGE_GLOW_MIN_ALPHA);
    // The wheel already fell and faded away in whatever earlier session
    // opened it — jump straight to "gone," never replaying the fall.
    this.wheel?.setAlpha(0);
    this.shadow?.setAlpha(0);
    this.setWheelInteractive(false);
    this.setPassageInteractive(true);
    this.layout(this.centerX, this.centerY, this.scale);
    this.startPassageGlowPulse();
  }

  getOpeningBounds(): { centerX: number; centerY: number; width: number; height: number } | undefined {
    if (!this.isOpen || !this.passage) {
      return undefined;
    }
    return {
      centerX: this.passage.x,
      centerY: this.passage.y,
      width: this.passage.displayWidth,
      height: this.passage.displayHeight,
    };
  }

  destroy(): void {
    this.idleGlowTween?.stop();
    this.hoverTween?.stop();
    this.shakeTween?.stop();
    this.openTween?.stop();
    this.passageGlowPulseTween?.stop();
    this.wheel?.destroy();
    this.shadow?.destroy();
    this.glow?.destroy();
    this.passage?.destroy();
    this.passageGlow?.destroy();
    this.dustEmitter?.destroy();
    this.wheelZone?.destroy();
    this.passageZone?.destroy();
  }

  private open(): void {
    if (this.isOpening || this.isOpen || !this.wheel) {
      return;
    }
    this.isOpening = true;
    this.setWheelInteractive(false);
    this.idleGlowTween?.stop();
    this.playOpeningShake();
  }

  // "A light stone shake at the start of opening" plus "move the cover a
  // few px forward/down at the start" — a quick jitter that settles into
  // a small permanent drop, with the shadow deepening and dust puffing out
  // as the disc jolts loose, right before the main swing begins.
  private playOpeningShake(): void {
    if (!this.wheel) {
      return;
    }
    const baseX = this.wheel.x;
    const baseY = this.wheel.y;
    const jitter = SHAKE_OFFSET_BG * this.scale;
    const settleDrop = SHAKE_SETTLE_DROP_BG * this.scale;

    this.spawnDustBurst();
    this.scene.tweens.add({
      targets: this.shadow,
      alpha: SHADOW_ALPHA_OPEN,
      duration: SHAKE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    this.shakeTween = this.scene.tweens.add({
      targets: this.wheel,
      x: { from: baseX - jitter, to: baseX + jitter },
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: 3,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => {
        this.wheel?.setPosition(baseX, baseY + settleDrop);
        this.beginFallOpen(baseY + settleDrop);
      },
    });
  }

  // The main fall: the disc drops straight down from its post-shake
  // position to the floor, tumbling (rotation) and shrinking slightly
  // (depth cue) along the way, landing with a bounce — real position/
  // angle/scale tweens on the wheel itself, no arc/hinge math needed for a
  // straight drop. Once it lands, it fades away (see fadeWheelAway()).
  private beginFallOpen(startY: number): void {
    if (!this.wheel) {
      return;
    }
    const targetY = this.centerY + OPEN_SHIFT_Y_BG * this.scale;
    const baseScaleX = this.wheelBaseScaleX;
    const baseScaleY = this.wheelBaseScaleY;

    this.wheel.setPosition(this.centerX, startY).setAngle(0);
    this.openTween = this.scene.tweens.add({
      targets: this.wheel,
      y: targetY,
      angle: OPEN_ROTATION_DEG,
      scaleX: baseScaleX * OPEN_SCALE_FACTOR,
      scaleY: baseScaleY * OPEN_SCALE_FACTOR,
      duration: OPEN_DURATION_MS,
      ease: OPEN_EASE,
      onComplete: () => {
        this.isOpening = false;
        this.isOpen = true;
        this.setPassageInteractive(true);
        this.startPassageGlowPulse();
        this.fadeWheelAway();
        this.onOpened?.();
      },
    });

    this.scene.tweens.add({
      targets: this.glow,
      alpha: 0.18,
      duration: OPEN_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    this.scene.tweens.add({
      targets: this.passage,
      alpha: 0.9,
      delay: OPEN_DURATION_MS * 0.35,
      duration: OPEN_DURATION_MS * 0.65,
      ease: Phaser.Math.Easing.Sine.InOut,
    });

    this.scene.tweens.add({
      targets: this.passageGlow,
      alpha: PASSAGE_GLOW_MIN_ALPHA,
      delay: OPEN_DURATION_MS * 0.45,
      duration: OPEN_DURATION_MS * 0.55,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // Once the wheel lands, it fades away and disappears entirely (along
  // with its trailing shadow) — simpler than leaving a fallen stone disc
  // sitting in view over whatever hall elements are beneath the wall
  // mount, and consistent with how the Heart of the Temple's rings
  // disappear once they land (see HeartOfTheTemple.ts).
  private fadeWheelAway(): void {
    this.scene.tweens.add({
      targets: [this.wheel, this.shadow],
      alpha: 0,
      delay: WHEEL_FADE_DELAY_MS,
      duration: WHEEL_FADE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.In,
    });
  }

  private spawnDustBurst(): void {
    if (!this.dustEmitter) {
      return;
    }
    this.dustEmitter.setPosition(this.centerX, this.centerY);
    this.dustEmitter.explode(DUST_BURST_COUNT);
  }

  // A slow, gentle breathing glow — "weak light coming from Room 3" —
  // started only once the passage is actually open (live or restored).
  private startPassageGlowPulse(): void {
    this.passageGlowPulseTween?.stop();
    this.passageGlow?.setAlpha(PASSAGE_GLOW_MIN_ALPHA);
    this.passageGlowPulseTween = this.scene.tweens.add({
      targets: this.passageGlow,
      alpha: PASSAGE_GLOW_MAX_ALPHA,
      duration: PASSAGE_GLOW_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  private setHovered(hovered: boolean): void {
    if (this.isOpening || this.isOpen) {
      return;
    }
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({
      targets: this.wheel,
      scaleX: this.wheelBaseScaleX * (hovered ? HOVER_SCALE : 1),
      scaleY: this.wheelBaseScaleY * (hovered ? HOVER_SCALE : 1),
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
    if (this.glow) {
      this.scene.tweens.add({
        targets: this.glow,
        alpha: hovered ? HOVER_GLOW_ALPHA : IDLE_GLOW_MIN_ALPHA,
        duration: HOVER_TWEEN_MS,
      });
    }
  }

  private startIdleGlow(): void {
    if (!this.glow) {
      return;
    }
    this.idleGlowTween?.stop();
    this.glow.setAlpha(IDLE_GLOW_MIN_ALPHA);
    this.idleGlowTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: IDLE_GLOW_MAX_ALPHA,
      duration: IDLE_GLOW_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  private setWheelInteractive(active: boolean): void {
    if (this.wheelZone?.input) {
      this.wheelZone.input.enabled = active;
    }
  }

  private setPassageInteractive(active: boolean): void {
    if (this.passageZone?.input) {
      this.passageZone.input.enabled = active;
    }
  }

  private generateTextures(): void {
    if (!this.scene.textures.exists(GLOW_KEY)) {
      const size = 192;
      const canvas = this.scene.textures.createCanvas(GLOW_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(255,235,180,0.95)');
        gradient.addColorStop(0.45, 'rgba(214,167,87,0.38)');
        gradient.addColorStop(1, 'rgba(120,75,25,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists(PASSAGE_KEY)) {
      const size = 192;
      const canvas = this.scene.textures.createCanvas(PASSAGE_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(2,2,3,1)');
        gradient.addColorStop(0.7, 'rgba(7,7,8,1)');
        gradient.addColorStop(0.88, 'rgba(35,31,25,1)');
        gradient.addColorStop(1, 'rgba(150,112,60,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists(SHADOW_KEY)) {
      const size = 192;
      const canvas = this.scene.textures.createCanvas(SHADOW_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
        gradient.addColorStop(0.6, 'rgba(0,0,0,0.4)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists(DUST_KEY)) {
      const size = 16;
      const canvas = this.scene.textures.createCanvas(DUST_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, 'rgba(214,196,158,0.9)');
        gradient.addColorStop(1, 'rgba(214,196,158,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }
  }
}
