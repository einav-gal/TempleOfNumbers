import Phaser from 'phaser';
import pinkCrystalUrl from '../../assets/images/PinkRoom/pink.png';

const CRYSTAL_KEY = 'pink-room-crystal';
const SOFT_KEY = 'pink-room-soft';

// Phaser's Geom shapes satisfy RandomZoneSource at runtime, but their
// getRandomPoint signatures don't line up under strict typing (same
// workaround as Atmosphere.ts).
type ZoneSource = Phaser.Types.GameObjects.Particles.RandomZoneSource;

export interface PinkCrystalSize {
  /** Target displayed height of the crystal image, in background-image pixels. */
  heightBg: number;
}

const GLOW_COLOR = 0xff6fc0;

// Breathing pulse: one shared 0..1 tween (breathT) drives the crystal's
// scale, the postFX rim glow strength, the soft glow blob's alpha, and
// the reflected light's alpha together, so all four stay in lockstep
// rather than drifting out of phase as separate tweens would.
const PULSE_SCALE_MIN = 0.99;
const PULSE_SCALE_MAX = 1.015;
const PULSE_DURATION_MS = 2100; // within 1800-2400

const GLOW_OUTER_MIN = 2.2;
const GLOW_OUTER_MAX = 4;
const GLOW_BLOB_ALPHA_MIN = 0.28;
const GLOW_BLOB_ALPHA_MAX = 0.48;
const GLOW_BLOB_SIZE_FACTOR = 2.3; // relative to crystal display height

const REFLECTED_LIGHT_ALPHA_MIN = 0.1;
const REFLECTED_LIGHT_ALPHA_MAX = 0.2;
const REFLECTED_LIGHT_WIDTH_BG = 260;
const REFLECTED_LIGHT_HEIGHT_BG = 90;
const REFLECTED_LIGHT_OFFSET_Y_BG = 60; // below crystal center, toward the pedestal surface

// Occasional glint: a brief additive boost on top of the breathing glow's
// current value (not a competing writer to the same property), plus a
// quick bright flash sprite. Re-scheduled with a fresh random delay each
// time, so the interval is never a fixed mechanical loop.
const GLINT_MIN_DELAY_MS = 3000;
const GLINT_MAX_DELAY_MS = 6000;
const GLINT_FLASH_HALF_MS = 130;
const GLINT_BOOST = 3;
const GLINT_FLASH_PEAK_ALPHA = 0.55;

// Puzzle feedback (playIntensify/playDim): same additive-boost mechanism
// as the glint, just a different target and caller-controlled duration.
const GLOW_INTENSIFY_BOOST = 4;
const GLOW_DIM_AMOUNT = 1.6;

// Full-completion activation sequence (playActivationSequence): a
// stronger/longer glow surge, and the crystal permanently rising and
// growing slightly ("opening"), unlike the brief playIntensify pulse.
const ACTIVATION_GLOW_BOOST = 6;
const ACTIVATION_GLOW_DURATION_MS = 1200;
const ACTIVATION_RISE_BG = 18;
const ACTIVATION_SCALE = 1.08;
const ACTIVATION_RISE_DURATION_MS = 900;

// The crystal doubling as the puzzle's submit control (EquivalencePuzzle
// owns the click zone; this class only owns the visual response): a
// slow, clearly-visible extra glow breathing loop while a submission is
// expected (setSubmitReady), plus a small hover glow/scale nudge
// (setHovered) — both additive on top of the base breathing tween via
// the same glintBoost-style mechanism, so nothing fights over the same
// property.
const SUBMIT_PULSE_DURATION_MS = 1400;
const SUBMIT_PULSE_GLOW_BOOST = 1.4;
const HOVER_GLOW_BOOST_AMOUNT = 0.9;
const HOVER_SCALE_BOOST_AMOUNT = 0.035;
const HOVER_TWEEN_MS = 150;

// Sparse, irregular sparkles: a low base frequency plus a random
// per-particle delay (same technique as the Central Hall's beam-foil
// flecks) so spawns don't read as a metronome.
const SPARKLE_LIFESPAN_MIN_MS = 1200;
const SPARKLE_LIFESPAN_MAX_MS = 2000;
const SPARKLE_FREQUENCY_MS = 900;
const SPARKLE_DELAY_MAX_MS = 1200;

/**
 * The Pink Room's animated crystal: the separate pink.png asset (not the
 * background's baked-in placeholder light beam) plus a small set of
 * subtle life-like effects — breathing pulse, a soft glow behind the
 * crystal (plus a matching postFX rim glow), sparse rising sparkles, an
 * occasional brighter glint, and a soft reflected-light pool on the
 * pedestal. No interactivity yet.
 */
export default class PinkCrystal {
  private scene: Phaser.Scene;
  private size: PinkCrystalSize;

  private image?: Phaser.GameObjects.Image;
  private glowBlob?: Phaser.GameObjects.Image;
  private reflectedLight?: Phaser.GameObjects.Image;
  private glintFlash?: Phaser.GameObjects.Image;
  private sparkles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private postFxGlow?: Phaser.FX.Glow;

  private baseScale = 1;
  private breathT = 0;
  private glintBoost = 0;
  private breathTween?: Phaser.Tweens.Tween;
  private glintTween?: Phaser.Tweens.Tween;
  private glintFlashTween?: Phaser.Tweens.Tween;
  private glintTimer?: Phaser.Time.TimerEvent;

  // Permanent activation state (puzzle completion): a slight rise and
  // size boost on top of the normal breathing pulse. Cached base
  // position/scale so applyPosition()/applyBreath() can reapply them
  // whenever riseOffsetBg/activationScale change, without needing a
  // fresh layout() call.
  private riseOffsetBg = 0;
  private activationScale = 1;
  private activationTween?: Phaser.Tweens.Tween;
  private lastBaseX = 0;
  private lastBaseY = 0;
  private lastScale = 1;

  // Submit-ready ambient pulse + hover response (see the constants above).
  private submitPulseT = 0;
  private submitReady = false;
  private submitPulseTween?: Phaser.Tweens.Tween;
  private hoverGlowBoost = 0;
  private hoverScaleBoost = 0;
  private hoverGlowTween?: Phaser.Tweens.Tween;
  private hoverScaleTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, size: PinkCrystalSize) {
    this.scene = scene;
    this.size = size;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(CRYSTAL_KEY, pinkCrystalUrl);
  }

  create(depth: number): void {
    this.generateSoftTexture();

    // Layer order: reflected light (floor/pedestal) < soft glow blob <
    // crystal (+ its own postFX rim glow) < glint flash.
    this.reflectedLight = this.scene.add
      .image(0, 0, SOFT_KEY)
      .setTint(GLOW_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(REFLECTED_LIGHT_ALPHA_MIN)
      .setDepth(depth - 2);

    this.glowBlob = this.scene.add
      .image(0, 0, SOFT_KEY)
      .setTint(GLOW_COLOR)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(GLOW_BLOB_ALPHA_MIN)
      .setDepth(depth - 1);

    // No tint on the crystal itself — its own pink coloring stays intact;
    // alpha stays at the default 1; no blur.
    this.image = this.scene.add.image(0, 0, CRYSTAL_KEY).setOrigin(0.5, 0.5).setDepth(depth);

    this.postFxGlow = this.image.postFX?.addGlow(GLOW_COLOR, 0, 0, false, 0.1, 16);

    this.glintFlash = this.scene.add
      .image(0, 0, SOFT_KEY)
      .setTint(0xffe6f6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(depth + 1);

    this.breathTween = this.scene.tweens.add({
      targets: this,
      breathT: 1,
      duration: PULSE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
      onUpdate: () => this.applyBreath(),
    });

    this.scheduleGlint();
  }

  /** baseX/baseY: the crystal's center point in screen space; scale: background cover-scale factor. */
  layout(baseX: number, baseY: number, scale: number): void {
    if (!this.image || !this.glowBlob || !this.reflectedLight || !this.glintFlash) {
      return;
    }
    this.lastBaseX = baseX;
    this.lastBaseY = baseY;
    this.lastScale = scale;
    this.baseScale = (this.size.heightBg / this.image.height) * scale;
    this.applyPosition();
    this.applyBreath();

    const glowSize = this.size.heightBg * GLOW_BLOB_SIZE_FACTOR * scale;
    this.glowBlob.setPosition(baseX, baseY).setDisplaySize(glowSize, glowSize);
    this.glintFlash.setPosition(baseX, baseY).setDisplaySize(glowSize * 0.8, glowSize * 0.8);

    this.reflectedLight
      .setPosition(baseX, baseY + REFLECTED_LIGHT_OFFSET_Y_BG * scale)
      .setDisplaySize(REFLECTED_LIGHT_WIDTH_BG * scale, REFLECTED_LIGHT_HEIGHT_BG * scale);

    this.recreateSparkles(baseX, baseY, scale);
  }

  /** No per-frame work needed — breathing is tween-driven, sparkles/glint self-schedule. */
  update(_deltaMs: number): void {}

  /**
   * Briefly intensifies the glow above its normal breathing range — e.g.
   * correct puzzle feedback. Reuses the same additive glintBoost/
   * applyBreath mechanism as the ambient glint, so it never fights the
   * continuous breathing tween's own writes to the same properties.
   */
  playIntensify(durationMs = 500): void {
    this.tweenGlintBoost(GLOW_INTENSIFY_BOOST, durationMs);
  }

  /** Briefly dims the glow below its normal breathing range — e.g. incorrect puzzle feedback. */
  playDim(durationMs = 400): void {
    this.tweenGlintBoost(-GLOW_DIM_AMOUNT, durationMs);
  }

  /**
   * Permanent activation sequence for full puzzle completion: a stronger,
   * longer glow surge plus the crystal rising and growing slightly —
   * "opening" — and staying there (not a brief pulse like playIntensify).
   */
  playActivationSequence(): void {
    this.tweenGlintBoost(ACTIVATION_GLOW_BOOST, ACTIVATION_GLOW_DURATION_MS);

    this.activationTween?.stop();
    this.activationTween = this.scene.tweens.add({
      targets: this,
      riseOffsetBg: ACTIVATION_RISE_BG,
      activationScale: ACTIVATION_SCALE,
      duration: ACTIVATION_RISE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => {
        this.applyPosition();
        this.applyBreath();
      },
    });
  }

  /**
   * Toggles the crystal's "waiting for a submission" ambient pulse — a
   * slower, more clearly visible breathing loop layered on top of the
   * normal idle breath, distinct from a brief one-shot playIntensify().
   */
  setSubmitReady(active: boolean): void {
    if (active === this.submitReady) {
      return;
    }
    this.submitReady = active;
    this.submitPulseTween?.stop();
    if (active) {
      this.submitPulseT = 0;
      this.submitPulseTween = this.scene.tweens.add({
        targets: this,
        submitPulseT: 1,
        duration: SUBMIT_PULSE_DURATION_MS,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
        onUpdate: () => this.applyBreath(),
      });
    } else {
      this.submitPulseT = 0;
      this.applyBreath();
    }
  }

  /** A subtle hover response: slightly stronger glow, very small scale increase. */
  setHovered(hovered: boolean): void {
    this.hoverGlowTween?.stop();
    this.hoverGlowTween = this.scene.tweens.add({
      targets: this,
      hoverGlowBoost: hovered ? HOVER_GLOW_BOOST_AMOUNT : 0,
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyBreath(),
    });
    this.hoverScaleTween?.stop();
    this.hoverScaleTween = this.scene.tweens.add({
      targets: this,
      hoverScaleBoost: hovered ? HOVER_SCALE_BOOST_AMOUNT : 0,
      duration: HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyBreath(),
    });
  }

  /** Stops tweens/timers and destroys every GameObject; call on scene shutdown. */
  destroy(): void {
    this.breathTween?.stop();
    this.glintTween?.stop();
    this.glintFlashTween?.stop();
    this.activationTween?.stop();
    this.submitPulseTween?.stop();
    this.hoverGlowTween?.stop();
    this.hoverScaleTween?.stop();
    this.glintTimer?.remove();
    this.sparkles?.destroy();
    this.image?.destroy();
    this.glowBlob?.destroy();
    this.reflectedLight?.destroy();
    this.glintFlash?.destroy();
  }

  // Re-applies the cached base position plus the permanent rise offset —
  // called from layout() and from the activation sequence's rise tween.
  private applyPosition(): void {
    this.image?.setPosition(this.lastBaseX, this.lastBaseY - this.riseOffsetBg * this.lastScale);
  }

  private applyBreath(): void {
    if (!this.image || !this.glowBlob || !this.reflectedLight) {
      return;
    }
    const pulseScale =
      Phaser.Math.Linear(PULSE_SCALE_MIN, PULSE_SCALE_MAX, this.breathT) *
      this.activationScale *
      (1 + this.hoverScaleBoost);
    this.image.setScale(this.baseScale * pulseScale);

    // Three independent additive boosts on top of the base breathing
    // value — glint (ambient sparkle), submit-ready (puzzle: "expecting
    // a click"), and hover — combined rather than fighting each other,
    // same pattern used throughout for this shared property.
    const totalBoost = this.glintBoost + this.submitPulseT * SUBMIT_PULSE_GLOW_BOOST + this.hoverGlowBoost;

    if (this.postFxGlow) {
      this.postFxGlow.outerStrength = Phaser.Math.Linear(GLOW_OUTER_MIN, GLOW_OUTER_MAX, this.breathT) + totalBoost;
    }
    // totalBoost also nudges the glow blob's alpha (scaled down, since its
    // alpha range is much narrower than the postFX strength range) so any
    // boost reads on both layers, not just the rim glow.
    const blobAlpha = Phaser.Math.Linear(GLOW_BLOB_ALPHA_MIN, GLOW_BLOB_ALPHA_MAX, this.breathT) + totalBoost * 0.04;
    this.glowBlob.setAlpha(Phaser.Math.Clamp(blobAlpha, 0, 1));
    this.reflectedLight.setAlpha(
      Phaser.Math.Linear(REFLECTED_LIGHT_ALPHA_MIN, REFLECTED_LIGHT_ALPHA_MAX, this.breathT),
    );
  }

  // Re-schedules itself with a fresh random delay each time, so the
  // glint's cadence never settles into a fixed loop.
  private scheduleGlint(): void {
    this.glintTimer = this.scene.time.delayedCall(Phaser.Math.Between(GLINT_MIN_DELAY_MS, GLINT_MAX_DELAY_MS), () => {
      this.playGlint();
      this.scheduleGlint();
    });
  }

  private playGlint(): void {
    if (!this.glintFlash) {
      return;
    }
    this.tweenGlintBoost(GLINT_BOOST, GLINT_FLASH_HALF_MS * 2);

    this.glintFlashTween?.stop();
    this.glintFlashTween = this.scene.tweens.add({
      targets: this.glintFlash,
      alpha: GLINT_FLASH_PEAK_ALPHA,
      duration: GLINT_FLASH_HALF_MS,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  // Shared driver behind the ambient glint and the puzzle-feedback
  // intensify/dim: tweens glintBoost up (or down) and back to 0 over
  // durationMs, re-applying it through applyBreath() each step so it
  // never fights the continuous breathing tween's own writes to the same
  // properties.
  private tweenGlintBoost(targetBoost: number, durationMs: number): void {
    this.glintTween?.stop();
    this.glintTween = this.scene.tweens.add({
      targets: this,
      glintBoost: targetBoost,
      duration: durationMs / 2,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => this.applyBreath(),
    });
  }

  private recreateSparkles(baseX: number, baseY: number, scale: number): void {
    this.sparkles?.destroy();
    this.sparkles = this.scene.add
      .particles(baseX, baseY, SOFT_KEY, {
        emitZone: {
          type: 'random' as const,
          source: new Phaser.Geom.Ellipse(
            0,
            0,
            this.size.heightBg * 1.1 * scale,
            this.size.heightBg * 1.3 * scale,
          ) as ZoneSource,
        },
        lifespan: { min: SPARKLE_LIFESPAN_MIN_MS, max: SPARKLE_LIFESPAN_MAX_MS },
        speedY: { min: -10 * scale, max: -3 * scale },
        speedX: { min: -3 * scale, max: 3 * scale },
        scale: { start: 0.05, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0xffd6f0, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: SPARKLE_FREQUENCY_MS,
        delay: { min: 0, max: SPARKLE_DELAY_MAX_MS },
      })
      .setDepth((this.image?.depth ?? 0) + 1);
  }

  // A soft radial white dot, alpha-only falloff — reused (tinted) for the
  // glow blob, reflected light, sparkles, and glint flash.
  private generateSoftTexture(): void {
    if (this.scene.textures.exists(SOFT_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(SOFT_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
