import Phaser from 'phaser';
import fireShadowLeftUrl from '../../assets/images/central-hall/fire/fire-shadow-left.png';
import fireShadowRightUrl from '../../assets/images/central-hall/fire/fire-shadow-right.png';

/** Maps background-image pixels (1536x1024 source) to screen space. */
export interface BackgroundTransform {
  x: (bgX: number) => number;
  y: (bgY: number) => number;
  scale: number;
}

const SOFT_KEY = 'atm-soft';
const RAY_KEY = 'atm-ray';
const FOIL_KEY = 'atm-foil';
const SHADOW_LEFT_KEY = 'atm-fire-shadow-left';
const SHADOW_RIGHT_KEY = 'atm-fire-shadow-right';

// Phaser's Geom shapes satisfy RandomZoneSource at runtime, but their
// getRandomPoint signatures don't line up under strict typing.
type ZoneSource = Phaser.Types.GameObjects.Particles.RandomZoneSource;

// Anchors in background-image pixels.
const TORCHES_BG = [
  { x: 110, y: 395 },
  { x: 395, y: 480 },
  { x: 1138, y: 488 },
  { x: 1427, y: 398 },
];
const OCULUS_BG = { x: 762, y: 80 };
const CRYSTAL_CENTER_BG = { x: 762, y: 580 };

// Resting alpha of each torch wall-light overlay (animated around this).
// Raised from the original 0.16: at that floor the additive orange glow
// blended into the already-warm-toned wall art and read as static even
// while the code was animating it correctly.
const TORCH_GLOW_BASE_ALPHA = 0.22;

// Per-torch wall-light flicker profile, one entry per TORCHES_BG anchor.
// freq (rad/s) sets the base cycle speed (period = 2*PI/freq, ~1.8-3.3s);
// the two left torches and two right torches use distinct freq/phase pairs
// so the sides never read as mirrored or synchronized.
const TORCH_FLICKER = [
  { freq: 2.7, phase: 0.0, alphaAmp: 0.06, scaleAmp: 0.02, driftAmpBg: 2.0 },
  { freq: 2.0, phase: 1.7, alphaAmp: 0.075, scaleAmp: 0.028, driftAmpBg: 3.0 },
  { freq: 3.4, phase: 3.4, alphaAmp: 0.065, scaleAmp: 0.024, driftAmpBg: 2.4 },
  { freq: 2.3, phase: 5.1, alphaAmp: 0.08, scaleAmp: 0.03, driftAmpBg: 3.2 },
];

// Fire-shadow overlays (NORMAL blend, alpha-composited over the wall) using
// the fire-shadow-left/right art. Four instances: the original two "rear"
// shadows anchored on the inner wall torches (TORCHES_BG[1]/[2], x=395/1138)
// plus two new "front" shadows anchored on the large foreground torches at
// the room's edges (TORCHES_BG[0]/[3], x=110/1427), reusing the same two
// textures. Anchoring on each torch directly (rather than the midpoint
// between same-side torches) keeps every shadow's dense base against its
// own torch's wall stone rather than drifting toward a doorway gap. Origin
// (0.5,1) puts that dense base at the torch position, wispy tapered top
// reaching up the wall above it. Front shadows use a larger width and a
// lower base alpha than rear so they read as farther forward without
// dominating the composition.
const SHADOW_WIDTH_BG = 130;
const SHADOW_FRONT_WIDTH_BG = SHADOW_WIDTH_BG * 1.2;
const SHADOW_REAR_BASE_ALPHA = 0.33; // varies ~0.28-0.38 with SHADOW_ALPHA_VAR
const SHADOW_FRONT_BASE_ALPHA = 0.23; // varies ~0.18-0.28 with SHADOW_ALPHA_VAR
const SHADOW_INSTANCES_BG = [
  { x: TORCHES_BG[1].x, y: TORCHES_BG[1].y, key: SHADOW_LEFT_KEY, widthBg: SHADOW_WIDTH_BG, baseAlpha: SHADOW_REAR_BASE_ALPHA },
  { x: TORCHES_BG[2].x, y: TORCHES_BG[2].y, key: SHADOW_RIGHT_KEY, widthBg: SHADOW_WIDTH_BG, baseAlpha: SHADOW_REAR_BASE_ALPHA },
  { x: TORCHES_BG[0].x, y: TORCHES_BG[0].y, key: SHADOW_LEFT_KEY, widthBg: SHADOW_FRONT_WIDTH_BG, baseAlpha: SHADOW_FRONT_BASE_ALPHA },
  { x: TORCHES_BG[3].x, y: TORCHES_BG[3].y, key: SHADOW_RIGHT_KEY, widthBg: SHADOW_FRONT_WIDTH_BG, baseAlpha: SHADOW_FRONT_BASE_ALPHA },
];

// Firelight-breath motion: each shadow runs its own chain of one-off tweens
// (not a shared periodic sine), so the motion never settles into a visible
// loop. Every breath picks fresh random targets and a fresh random duration,
// eases in and back out (yoyo) to the shadow's fixed rest state, then
// schedules the next breath with new randoms — irregular by construction,
// and since each of the four shadows randomizes independently, front/rear
// and left/right never flicker in sync.
const SHADOW_ALPHA_VAR = 0.05;
const SHADOW_DRIFT_X_MIN = 2;
const SHADOW_DRIFT_X_MAX = 4;
const SHADOW_DRIFT_Y_MIN = 1;
const SHADOW_DRIFT_Y_MAX = 3;
const SHADOW_SCALE_VAR = 0.02;
const SHADOW_ANGLE_VAR_DEG = 0.5;
const SHADOW_BREATH_DURATION_MIN_MS = 700;
const SHADOW_BREATH_DURATION_MAX_MS = 1600;
// Small random stagger before each shadow's very first breath, so all four
// don't start their cycles in the same frame.
const SHADOW_BREATH_INITIAL_DELAY_MAX_MS = 400;

// Layering: rays behind the Heart (ring_back is 8), sparkles between the
// middle (10) and front (12) rings, dust and flicker over the whole hall
// but far below the popup (100). Shadows sit just above the bare
// background and below every other game object (torches, rings, crystal,
// particles, UI all start at depth 5+).
const RAY_DEPTH = 7;
const BEAM_FOIL_DEPTH = 5;
const TORCH_DEPTH = 5;
const SHADOW_DEPTH = 1;
const SPARKLE_DEPTH = 11;
const DUST_DEPTH = 20;
const FLICKER_DEPTH = 25;

export default class Atmosphere {
  private scene: Phaser.Scene;
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private torchGlows: Phaser.GameObjects.Image[] = [];
  // Anchor position and unflickered display size for each torchGlow, so
  // update() can animate scale/position as small offsets from a fixed rest
  // state rather than drifting cumulatively.
  private torchGlowBase: { x: number; y: number; size: number }[] = [];
  private shadowOverlays: Phaser.GameObjects.Image[] = [];
  // Rest position and unflickered uniform scale for each shadow overlay
  // (parallel to shadowOverlays / SHADOW_INSTANCES_BG); each firelight-breath
  // tween animates as an offset from this fixed rest state rather than
  // drifting cumulatively.
  private shadowBase: { x: number; y: number; scale: number }[] = [];
  // The shadow's currently-running breath tween, one per shadowOverlays
  // index, so destroyEffects() can stop them before the images are gone.
  private shadowTweens: (Phaser.Tweens.Tween | undefined)[] = [];
  // Cached from the last layout() call; still used by the torch-glow drift.
  private bgScale = 1;
  private rays: Phaser.GameObjects.Image[] = [];
  private rayTweens: Phaser.Tweens.Tween[] = [];
  private flickerRect?: Phaser.GameObjects.Rectangle;
  private elapsedMs = 0;
  // Per-particle peak brightness and spin speed for the beam foil flecks,
  // keyed by instance since alpha/rotate onUpdate can't mutate Particle.
  private foilParticleData = new WeakMap<
    Phaser.GameObjects.Particles.Particle,
    { peakAlpha: number; spinDegPerSec: number }
  >();

  private ensureFoilData(
    particle?: Phaser.GameObjects.Particles.Particle,
  ): { peakAlpha: number; spinDegPerSec: number } {
    if (!particle) {
      return { peakAlpha: 0.5, spinDegPerSec: 60 };
    }
    let data = this.foilParticleData.get(particle);
    if (!data) {
      data = {
        peakAlpha: Phaser.Math.FloatBetween(0.35, 0.8),
        spinDegPerSec: Phaser.Math.FloatBetween(40, 150) * (Math.random() < 0.5 ? -1 : 1),
      };
      this.foilParticleData.set(particle, data);
    }
    return data;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(SHADOW_LEFT_KEY, fireShadowLeftUrl);
    scene.load.image(SHADOW_RIGHT_KEY, fireShadowRightUrl);
  }

  create(): void {
    this.generateTextures();
  }

  /** (Re)build all effects for the current window size. */
  layout(width: number, height: number, bg: BackgroundTransform): void {
    this.destroyEffects();
    const s = bg.scale;
    this.bgScale = s;

    // Floating dust motes drifting through the whole hall.
    this.emitters.push(
      this.scene.add
        .particles(0, 0, SOFT_KEY, {
          emitZone: {
            type: 'random' as const,
            source: new Phaser.Geom.Rectangle(0, 0, width, height) as ZoneSource,
          },
          lifespan: { min: 9000, max: 16000 },
          speedX: { min: -7 * s, max: 7 * s },
          speedY: { min: -5 * s, max: 3 * s },
          scale: { min: 0.015, max: 0.05 },
          alpha: { start: 0.16, end: 0, ease: 'Sine.easeIn' },
          tint: 0xd8c9a8,
          frequency: 300,
          advance: 12000,
        })
        .setDepth(DUST_DEPTH),
    );

    // Cool sparkles rising slowly around the crystal.
    this.emitters.push(
      this.scene.add
        .particles(bg.x(CRYSTAL_CENTER_BG.x), bg.y(CRYSTAL_CENTER_BG.y), SOFT_KEY, {
          emitZone: {
            type: 'random' as const,
            source: new Phaser.Geom.Ellipse(0, 0, 170 * s, 300 * s) as ZoneSource,
          },
          lifespan: { min: 3000, max: 5200 },
          speedY: { min: -16 * s, max: -5 * s },
          speedX: { min: -4 * s, max: 4 * s },
          scale: { start: 0.055, end: 0, ease: 'Sine.easeIn' },
          alpha: { start: 0.45, end: 0 },
          tint: 0x8fd4ff,
          blendMode: Phaser.BlendModes.ADD,
          frequency: 160,
          advance: 4000,
        })
        .setDepth(SPARKLE_DEPTH),
    );

    // Torch flames: a lively additive ember stream plus a soft glow halo
    // whose alpha flickers in update().
    for (const torch of TORCHES_BG) {
      const tx = bg.x(torch.x);
      const ty = bg.y(torch.y);
      this.emitters.push(
        this.scene.add
          .particles(tx, ty, SOFT_KEY, {
            emitZone: {
              type: 'random' as const,
              source: new Phaser.Geom.Ellipse(0, 0, 12 * s, 8 * s) as ZoneSource,
            },
            lifespan: { min: 450, max: 850 },
            speedY: { min: -55 * s, max: -30 * s },
            speedX: { min: -7 * s, max: 7 * s },
            scale: { start: 0.14 * s, end: 0.02 * s },
            alpha: { start: 0.5, end: 0 },
            tint: [0xffd28a, 0xffa64d, 0xff7a33],
            blendMode: Phaser.BlendModes.ADD,
            frequency: 70,
            advance: 1000,
          })
          .setDepth(TORCH_DEPTH),
      );

      const glowSize = 110 * s;
      const glow = this.scene.add
        .image(tx, ty, SOFT_KEY)
        .setDisplaySize(glowSize, glowSize)
        .setTint(0xff9944)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(TORCH_GLOW_BASE_ALPHA)
        .setDepth(TORCH_DEPTH);
      this.torchGlows.push(glow);
      this.torchGlowBase.push({ x: tx, y: ty, size: glowSize });
    }

    // Fire-shadow overlays: the fire-shadow-left/right art, NORMAL blended
    // onto the wall near each torch (two rear on the inner wall torches, two
    // front on the foreground edge torches). Uniform scale (from width only)
    // keeps each PNG's natural aspect ratio undistorted. Each gets its own
    // independent firelight-breath tween chain (see scheduleShadowBreath).
    for (let i = 0; i < SHADOW_INSTANCES_BG.length; i++) {
      const instance = SHADOW_INSTANCES_BG[i];
      const sx = bg.x(instance.x);
      const sy = bg.y(instance.y);
      const shadow = this.scene.add
        .image(sx, sy, instance.key)
        .setOrigin(0.5, 1)
        .setBlendMode(Phaser.BlendModes.NORMAL)
        .setAlpha(instance.baseAlpha)
        .setDepth(SHADOW_DEPTH);
      const uniformScale = (instance.widthBg / shadow.width) * s;
      shadow.setScale(uniformScale);
      this.shadowOverlays.push(shadow);
      this.shadowBase.push({ x: sx, y: sy, scale: uniformScale });

      this.scene.time.delayedCall(
        Phaser.Math.Between(0, SHADOW_BREATH_INITIAL_DELAY_MAX_MS),
        () => this.scheduleShadowBreath(i),
      );
    }

    // Soft light rays fanning down from the oculus, slowly breathing.
    const rayConfigs = [
      { angleDeg: -9, widthBg: 150, alpha: 0.05, pulseMs: 7000 },
      { angleDeg: 1, widthBg: 210, alpha: 0.07, pulseMs: 9500 },
      { angleDeg: 10, widthBg: 140, alpha: 0.045, pulseMs: 8200 },
    ];
    for (const cfg of rayConfigs) {
      const ray = this.scene.add
        .image(bg.x(OCULUS_BG.x), bg.y(OCULUS_BG.y), RAY_KEY)
        .setOrigin(0.5, 0)
        .setAngle(cfg.angleDeg)
        .setTint(0xbfe2ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(cfg.alpha);
      ray.setDisplaySize(cfg.widthBg * s, 760 * s);
      ray.setDepth(RAY_DEPTH);
      this.rays.push(ray);
      this.rayTweens.push(
        this.scene.tweens.add({
          targets: ray,
          alpha: cfg.alpha * 2,
          duration: cfg.pulseMs,
          ease: Phaser.Math.Easing.Sine.InOut,
          yoyo: true,
          repeat: -1,
        }),
      );
    }

    // Sparse metallic foil flecks rising up through the oculus beam, above
    // the Heart: tiny irregular diamonds (FOIL_KEY, not a circular dot)
    // that tumble and catch the light as they float upward. A slight
    // random accelerationX makes each one curve/wobble sideways rather
    // than rise in a straight line. Rotate and alpha both use
    // onEmit/onUpdate (not the array-shorthand, which Phaser resolves to
    // one static value per particle rather than an animated curve) so
    // each fleck spins continuously at its own per-particle speed while
    // its alpha follows a fade-in/fade-out envelope with brief, sharp
    // brightness spikes ("glints") timed to the rotation, simulating
    // light reflecting off a tumbling flat surface. Random per-particle
    // delay (on top of the low frequency) keeps the appearances from
    // reading as a repeating pattern; the envelope reaching 0 by the end
    // of life hides any particle that drifts past the beam.
    this.emitters.push(
      this.scene.add
        .particles(0, 0, FOIL_KEY, {
          emitZone: {
            type: 'random' as const,
            source: new Phaser.Geom.Rectangle(
              bg.x(OCULUS_BG.x - 70),
              bg.y(100),
              140 * s,
              230 * s,
            ) as ZoneSource,
          },
          lifespan: { min: 4500, max: 7500 },
          speedY: { min: -22 * s, max: -10 * s },
          speedX: { min: -4 * s, max: 4 * s },
          accelerationX: { min: -4 * s, max: 4 * s },
          scaleX: { min: 0.3, max: 0.65 },
          scaleY: { min: 0.08, max: 0.22 },
          rotate: {
            onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => {
              this.ensureFoilData(particle);
              return 0;
            },
            onUpdate: (particle: Phaser.GameObjects.Particles.Particle | undefined, _key: string, t: number) => {
              const { spinDegPerSec } = this.ensureFoilData(particle);
              const elapsedSec = (t * (particle?.life ?? 6000)) / 1000;
              return (spinDegPerSec * elapsedSec) % 360;
            },
          },
          alpha: {
            onEmit: (particle?: Phaser.GameObjects.Particles.Particle) => {
              this.ensureFoilData(particle);
              return 0;
            },
            onUpdate: (particle: Phaser.GameObjects.Particles.Particle | undefined, _key: string, t: number) => {
              const { peakAlpha, spinDegPerSec } = this.ensureFoilData(particle);
              const fade = Math.sin(t * Math.PI);
              const elapsedSec = (t * (particle?.life ?? 6000)) / 1000;
              const angleRad = Phaser.Math.DegToRad(spinDegPerSec * elapsedSec);
              const glint = Math.pow(Math.abs(Math.sin(angleRad * 2)), 8);
              return peakAlpha * fade * (0.35 + 0.65 * glint);
            },
          },
          tint: [0xf5ecd8, 0xe9e6df],
          frequency: 350,
          delay: { min: 0, max: 500 },
          advance: 4000,
        })
        .setDepth(BEAM_FOIL_DEPTH),
    );

    // Full-screen warm veil whose alpha wavers in update(): the torches'
    // gentle ambient flicker on the whole room.
    this.flickerRect = this.scene.add
      .rectangle(0, 0, width, height, 0xffb066, 1)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.02)
      .setDepth(FLICKER_DEPTH);
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const t = this.elapsedMs / 1000;

    // Each torch's wall-light overlay flickers on its own freq/phase (see
    // TORCH_FLICKER), reusing one phase-shifted wave for alpha, scale, and
    // position so the three never crest in perfect lockstep.
    for (let i = 0; i < this.torchGlows.length; i++) {
      const profile = TORCH_FLICKER[i];
      const base = this.torchGlowBase[i];
      if (!profile || !base) {
        continue;
      }
      const alphaWave = this.flickerWave(t, profile.freq, profile.phase);
      const scaleWave = this.flickerWave(t, profile.freq, profile.phase + 1.3);
      const driftXWave = this.flickerWave(t, profile.freq, profile.phase + 2.6);
      const driftYWave = this.flickerWave(t, profile.freq, profile.phase + 4.1);

      const glow = this.torchGlows[i];
      glow.setAlpha(TORCH_GLOW_BASE_ALPHA + profile.alphaAmp * alphaWave);
      const size = base.size * (1 + profile.scaleAmp * scaleWave);
      glow.setDisplaySize(size, size);
      glow.setPosition(
        base.x + profile.driftAmpBg * this.bgScale * driftXWave,
        base.y + profile.driftAmpBg * this.bgScale * driftYWave,
      );
    }

    // Fire-shadow overlays are animated by their own tween chains (see
    // scheduleShadowBreath), not by per-frame code here.

    if (this.flickerRect) {
      const wave =
        0.55 * Math.sin(t * 1.9) +
        0.3 * Math.sin(t * 4.7 + 1.1) +
        0.15 * Math.sin(t * 9.3 + 2.4);
      this.flickerRect.setAlpha(0.02 + 0.012 * wave);
    }
  }

  // Three summed sines (decreasing weight, incommensurate frequency
  // multipliers) read as organic, non-repeating flicker rather than a
  // clean loop; returns roughly -1..1. Used by the torch glows.
  private flickerWave(t: number, freq: number, phase: number): number {
    return (
      0.6 * Math.sin(t * freq + phase) +
      0.3 * Math.sin(t * freq * 2.17 + phase * 2.1) +
      0.1 * Math.sin(t * freq * 4.43 + phase * 3.3)
    );
  }

  // One "breath" of firelight motion for the shadow at shadowOverlays[index]:
  // eases from its fixed rest state to a freshly randomized alpha/x/y/scale/
  // angle target and back (yoyo), over a randomized duration, then schedules
  // the next breath with new randoms. Because every cycle's target and
  // duration are re-rolled, the motion never settles into a repeating loop.
  // Guarded by shadow.active so a destroyed overlay (layout() rebuild) stops
  // the chain instead of scheduling forever.
  private scheduleShadowBreath(index: number): void {
    const shadow = this.shadowOverlays[index];
    const base = this.shadowBase[index];
    const instance = SHADOW_INSTANCES_BG[index];
    if (!shadow || !base || !instance || !shadow.active) {
      return;
    }

    const signX = Math.random() < 0.5 ? -1 : 1;
    const signY = Math.random() < 0.5 ? -1 : 1;
    const targetAlpha = instance.baseAlpha + Phaser.Math.FloatBetween(-SHADOW_ALPHA_VAR, SHADOW_ALPHA_VAR);
    const targetX = base.x + signX * Phaser.Math.FloatBetween(SHADOW_DRIFT_X_MIN, SHADOW_DRIFT_X_MAX);
    const targetY = base.y + signY * Phaser.Math.FloatBetween(SHADOW_DRIFT_Y_MIN, SHADOW_DRIFT_Y_MAX);
    const targetScale = base.scale * (1 + Phaser.Math.FloatBetween(-SHADOW_SCALE_VAR, SHADOW_SCALE_VAR));
    const targetAngle = Phaser.Math.FloatBetween(-SHADOW_ANGLE_VAR_DEG, SHADOW_ANGLE_VAR_DEG);
    const duration = Phaser.Math.Between(SHADOW_BREATH_DURATION_MIN_MS, SHADOW_BREATH_DURATION_MAX_MS);

    this.shadowTweens[index] = this.scene.tweens.add({
      targets: shadow,
      alpha: targetAlpha,
      x: targetX,
      y: targetY,
      scaleX: targetScale,
      scaleY: targetScale,
      angle: targetAngle,
      duration,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      onComplete: () => this.scheduleShadowBreath(index),
    });
  }

  private destroyEffects(): void {
    for (const emitter of this.emitters) {
      emitter.destroy();
    }
    this.emitters = [];
    for (const glow of this.torchGlows) {
      glow.destroy();
    }
    this.torchGlows = [];
    this.torchGlowBase = [];
    for (const tween of this.shadowTweens) {
      tween?.stop();
    }
    this.shadowTweens = [];
    for (const shadow of this.shadowOverlays) {
      shadow.destroy();
    }
    this.shadowOverlays = [];
    this.shadowBase = [];
    for (const tween of this.rayTweens) {
      tween.destroy();
    }
    this.rayTweens = [];
    for (const ray of this.rays) {
      ray.destroy();
    }
    this.rays = [];
    this.flickerRect?.destroy();
    this.flickerRect = undefined;
  }

  // Procedural textures: a soft radial dot and a vertical light beam.
  private generateTextures(): void {
    if (!this.scene.textures.exists(SOFT_KEY)) {
      const size = 64;
      const canvas = this.scene.textures.createCanvas(SOFT_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        const grad = ctx.createRadialGradient(
          size / 2, size / 2, 0,
          size / 2, size / 2, size / 2,
        );
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        canvas.refresh();
      }
    }

    // Tiny irregular diamond for the beam foil flecks: a flat quad (not a
    // symmetric rhombus) so scaleX/scaleY variation per particle reads as
    // varied foil-chip shapes rather than identical circles.
    if (!this.scene.textures.exists(FOIL_KEY)) {
      const size = 14;
      const canvas = this.scene.textures.createCanvas(FOIL_KEY, size, size);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.beginPath();
        ctx.moveTo(7, 1);
        ctx.lineTo(13, 6);
        ctx.lineTo(8, 13);
        ctx.lineTo(1, 8);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.fill();
        canvas.refresh();
      }
    }

    if (!this.scene.textures.exists(RAY_KEY)) {
      const w = 128;
      const h = 512;
      const canvas = this.scene.textures.createCanvas(RAY_KEY, w, h);
      if (canvas) {
        const ctx = canvas.getContext();
        const across = ctx.createLinearGradient(0, 0, w, 0);
        across.addColorStop(0, 'rgba(255,255,255,0)');
        across.addColorStop(0.5, 'rgba(255,255,255,1)');
        across.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = across;
        ctx.fillRect(0, 0, w, h);
        const fade = ctx.createLinearGradient(0, 0, 0, h);
        fade.addColorStop(0, 'rgba(255,255,255,1)');
        fade.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        canvas.refresh();
      }
    }
  }
}
