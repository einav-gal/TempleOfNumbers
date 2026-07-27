import Phaser from 'phaser';
import crystalUrl from '../../assets/images/central-hall/OBJ_001-crystal.png';
import ringBackRearUrl from '../../assets/images/central-hall/Rings/Ring_Back-vetical-rear.png';
import ringBackFrontUrl from '../../assets/images/central-hall/Rings/Ring_Back-vetical-front.png';
import ringMiddleRearUrl from '../../assets/images/central-hall/Rings/Ring_Middle--rear.png';
import ringMiddleFrontUrl from '../../assets/images/central-hall/Rings/Ring_Middle--front.png';
import ringFrontRearUrl from '../../assets/images/central-hall/Rings/Ring-front--rear.png';
import ringFrontFrontUrl from '../../assets/images/central-hall/Rings/Ring-front-front.png';
import { CrystalId, areAllCrystalsPlaced } from './GameState';

const CRYSTAL_KEY = 'heart-crystal';
const RING_BACK_REAR_KEY = 'heart-ring-back-rear';
const RING_BACK_FRONT_KEY = 'heart-ring-back-front';
const RING_MIDDLE_REAR_KEY = 'heart-ring-middle-rear';
const RING_MIDDLE_FRONT_KEY = 'heart-ring-middle-front';
const RING_FRONT_REAR_KEY = 'heart-ring-front-rear';
const RING_FRONT_FRONT_KEY = 'heart-ring-front-front';

// All sizes are in background-image pixels (1536x1024 hall source), so the
// whole assembly scales together with the hall artwork.
const CRYSTAL_HEIGHT_BG_PX = 300;
// Lift of the crystal's base above the pedestal center, so the crystal
// hovers centered over the platform instead of resting on the stone.
const CRYSTAL_HOVER_BG_PX = 45;
const FLOAT_AMPLITUDE_BG_PX = 10;
const FLOAT_DURATION_MS = 4200;

// Each ring is a rear/front PNG pair exported from the same canvas: the
// rear layer (far arc) renders behind the crystal, the front layer (near
// arc) in front, so the ring genuinely wraps around it. Both layers of a
// pair always receive the identical transform (position/angle/scale) —
// see applyRingTransform(). Three SEPARATE ring objects (not one baked
// image), each independently positionable: this is what makes a real
// "open outward" sequence possible below, not just a rotation.
//
// Each ring is also tied to exactly one crystal (matching
// CrystalPlacementMode's own slot layout): placing that crystal makes
// THIS ring fall immediately (see playActivationNudge()) — not a shared
// wait-for-all-three sequence. Every ring's "open" motion is a real fall
// (Bounce.Out, so it visibly lands rather than just decelerating to a
// stop): green -> the ring that falls to the LEFT, pink -> the ring that
// falls to the RIGHT, red -> the ring that falls straight down.
const RING_BACK_LAYOUT = {
  widthBg: 179,
  offsetYBg: 0,
  baseAngleDeg: 0,
  crystalId: 'red' as CrystalId,
  openOffsetXBg: 0,
  openOffsetYBg: 460,
  openAngleDeg: 90,
  openScaleFactor: 0.68,
  openEase: Phaser.Math.Easing.Bounce.Out,
};
const RING_MIDDLE_LAYOUT = {
  widthBg: 366,
  offsetYBg: 0,
  baseAngleDeg: 22,
  crystalId: 'green' as CrystalId,
  openOffsetXBg: -220,
  openOffsetYBg: 420,
  openAngleDeg: -150,
  openScaleFactor: 0.82,
  openEase: Phaser.Math.Easing.Bounce.Out,
};
const RING_FRONT_LAYOUT = {
  widthBg: 366,
  offsetYBg: 0,
  baseAngleDeg: -22,
  crystalId: 'pink' as CrystalId,
  openOffsetXBg: 220,
  openOffsetYBg: 420,
  openAngleDeg: 150,
  openScaleFactor: 0.82,
  openEase: Phaser.Math.Easing.Bounce.Out,
};

// Gentle oscillation around each pair's approved base angle (only while
// mechanismState === 'caged' — see update()):
// angle = base + sin(elapsedSeconds * speed + phase) * amplitude.
// The offset is always computed fresh from the fixed base (never
// accumulated), so every ring returns smoothly to its resting angle and
// can never rotate far enough to expose the front/rear split masking.
// Diagonal B shares diagonal A's speed with a half-cycle phase offset, so
// the two diagonals counter-swing at every instant (one rises while the
// other descends); differing speeds would drift them back into phase.
const RING_BACK_OSC = { amplitudeDeg: 2, speed: 1.8, phase: 0 };
const RING_MIDDLE_OSC = { amplitudeDeg: 2.5, speed: 2.0, phase: 0 };
const RING_FRONT_OSC = { amplitudeDeg: 2.5, speed: 2.0, phase: Math.PI };

// ---- per-ring fall sequence (each ring falls the moment ITS crystal is
// placed — see playActivationNudge()/playSingleRingOpen()) --------------
// A caged->fallen transition built from real per-ring position/angle/scale
// tweens (not a single flattening rotation), one ring at a time as each
// crystal goes in — never a shared wait-for-all-three sequence.
const SHAKE_AMPLITUDE_DEG = 3;
const SHAKE_STEP_MS = 55;
const SHAKE_REPEATS = 4; // 5 total forward+back cycles, ends back at the starting angle
const ALIGN_ANGLE_DEG = 0;
const ALIGN_DURATION_MS = 550;
const OPEN_DURATION_MS = 1300; // generous — Bounce.Out reads best with a bit more time than a plain decelerate
const GLOW_OPEN_OUTER_STRENGTH = 5.5;

// Once a ring lands, it fades away and disappears entirely — simpler than
// keeping it on screen forever, and it also means the exact spot each ring
// falls to no longer needs to stay inside the visible frame on every
// screen shape (short mobile ENVELOP crops included): wherever it lands,
// it's gone again a moment later regardless.
const RING_FADE_DELAY_MS = 300;
const RING_FADE_DURATION_MS = 500;

// The crystal itself shatters once the rings finish opening — a brief
// glow build-up, then it vanishes and a burst of shard particles covers
// the screen. A one-shot procedural texture (a small jagged translucent
// chip), not the crystal's own photo-real image — Phaser particles render
// one whole texture per particle, so a dedicated small shard shape reads
// far better at this quantity/speed than many copies of the full crystal.
const EXPLOSION_TEXTURE_KEY = 'heart-crystal-shard';
const EXPLOSION_BUILD_UP_MS = 450;
// "Thousands of glowing shards, significantly" — a real one-shot burst,
// not a token sparkle. 1000 small additive-blend particles is heavy
// enough to read as "the crystal shattered," while still being a single
// one-time event (never continuous), so the cost is a brief spike, not a
// sustained one.
const EXPLOSION_PARTICLE_COUNT = 1000;
const EXPLOSION_SPEED_MIN = 300;
const EXPLOSION_SPEED_MAX = 1400;
const EXPLOSION_LIFESPAN_MS = 1600;
const EXPLOSION_GRAVITY_Y = 450;
const EXPLOSION_TINTS = [0x66bbff, 0xffffff, 0x99d6ff, 0xbfe6ff];
const CRYSTAL_VANISH_MS = 220;
// How long after the burst starts the "you escaped" message appears — long
// enough that the explosion itself is clearly established first, short
// enough that it doesn't feel like a separate, disconnected event.
const MECHANISM_SHATTERED_MESSAGE_DELAY_MS = 700;

// Layering: all rear arcs behind the crystal, all front arcs in front.
const RING_BACK_REAR_DEPTH = 6;
const RING_MIDDLE_REAR_DEPTH = 7;
const RING_FRONT_REAR_DEPTH = 8;
const CRYSTAL_DEPTH = 9;
const RING_BACK_FRONT_DEPTH = 10;
const RING_MIDDLE_FRONT_DEPTH = 11;
const RING_FRONT_FRONT_DEPTH = 12;

type MechanismState = 'caged' | 'opening' | 'open';

interface RingLayoutConfig {
  widthBg: number;
  offsetYBg: number;
  baseAngleDeg: number;
  crystalId: CrystalId;
  openOffsetXBg: number;
  openOffsetYBg: number;
  openAngleDeg: number;
  openScaleFactor: number;
  /** Per-ring easing for its open-outward tween — most rings decelerate to a stop (Cubic.Out); the falling ring uses Bounce.Out so it visibly lands instead. */
  openEase: (t: number) => number;
}

interface RingRuntime {
  rear: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  layout: RingLayoutConfig;
  osc: { amplitudeDeg: number; speed: number; phase: number };
  /** Current authoritative angle — written by the idle oscillation (caged), the opening tweens (opening), or left fixed (open). */
  angleDeg: number;
  /** 0 = fully closed/caged position, 1 = fully fallen — tweened once, the moment this ring's own crystal is placed. */
  openProgress: number;
  /** True once this ring's own fall sequence has been triggered — update()'s idle sway permanently skips it from here on, independent of the other two rings or the overall mechanismState. */
  hasOpened: boolean;
}

/**
 * The Heart of the Temple: the floating crystal caged inside three rune
 * rings. Owns its own animations (float, glow pulse, hover, ring sway) and
 * a small state machine (`caged` -> `opening` -> `open`):
 *
 * - `caged` (default): rings surround/cross in front of the crystal like a
 *   lock, gently swaying — the mechanism's normal idle state.
 * - Each ring falls INDIVIDUALLY, immediately, the moment its own crystal
 *   is placed (playActivationNudge(crystalId) -> playSingleRingOpen()) —
 *   not a shared, wait-for-all-three sequence. A ring that has already
 *   fallen (RingRuntime.hasOpened) is permanently skipped by the idle sway
 *   in update() from that point on, independent of the other two.
 * - `opening`: set only once the LAST crystal is placed (checked via
 *   GameState.areAllCrystalsPlaced — the same shared registry state
 *   CrystalPlacementMode already writes, never a parallel flag) — that
 *   final ring's own fall is chained into finishOpening() (glow build-up
 *   -> the crystal shatters) once it completes.
 * - `open`: the terminal state — every ring has fallen, the crystal has
 *   shattered — isOpen() lets the scene change what clicking the (now
 *   gone) crystal would mean.
 *
 * The scene provides the pedestal anchor via layout() and drives update().
 */
export default class HeartOfTheTemple {
  private scene: Phaser.Scene;
  private crystal?: Phaser.GameObjects.Image;
  private rings: RingRuntime[] = [];
  private glowFx?: Phaser.FX.Glow;
  private glowTween?: Phaser.Tweens.Tween;
  private hoverTween?: Phaser.Tweens.Tween;
  private crystalBaseScale = 1;
  private hoverScale = 1;
  private crystalBaseY = 0;
  private floatOffset = 0;
  private assemblyScale = 1;
  private elapsedMs = 0;
  private mechanismState: MechanismState = 'caged';
  private lastPedestalCenterX = 0;
  private lastPedestalCenterY = 0;

  /** Invoked when the crystal is clicked (while not suppressed) — only ever while still caged, since it's gone once shattered. */
  onCrystalClick?: () => void;
  /** Fires once, automatically, a short beat after the crystal shatters (see playCrystalExplosion()) — never on restoreOpen()'s "already resolved" path, so a returning visit never replays it. */
  onMechanismShattered?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(CRYSTAL_KEY, crystalUrl);
    scene.load.image(RING_BACK_REAR_KEY, ringBackRearUrl);
    scene.load.image(RING_BACK_FRONT_KEY, ringBackFrontUrl);
    scene.load.image(RING_MIDDLE_REAR_KEY, ringMiddleRearUrl);
    scene.load.image(RING_MIDDLE_FRONT_KEY, ringMiddleFrontUrl);
    scene.load.image(RING_FRONT_REAR_KEY, ringFrontRearUrl);
    scene.load.image(RING_FRONT_FRONT_KEY, ringFrontFrontUrl);
  }

  create(): void {
    this.rings = [
      this.createRing(RING_BACK_REAR_KEY, RING_BACK_REAR_DEPTH, RING_BACK_FRONT_KEY, RING_BACK_FRONT_DEPTH, RING_BACK_LAYOUT, RING_BACK_OSC),
      this.createRing(RING_MIDDLE_REAR_KEY, RING_MIDDLE_REAR_DEPTH, RING_MIDDLE_FRONT_KEY, RING_MIDDLE_FRONT_DEPTH, RING_MIDDLE_LAYOUT, RING_MIDDLE_OSC),
      this.createRing(RING_FRONT_REAR_KEY, RING_FRONT_REAR_DEPTH, RING_FRONT_FRONT_KEY, RING_FRONT_FRONT_DEPTH, RING_FRONT_LAYOUT, RING_FRONT_OSC),
    ];

    this.crystal = this.scene.add
      .image(0, 0, CRYSTAL_KEY)
      .setOrigin(0.5, 1)
      .setDepth(CRYSTAL_DEPTH);
    this.crystal.setInteractive({ useHandCursor: true });
    this.crystal.on(Phaser.Input.Events.POINTER_DOWN, () => this.onCrystalClick?.());
    this.crystal.on(Phaser.Input.Events.POINTER_OVER, () => this.setHovered(true));
    this.crystal.on(Phaser.Input.Events.POINTER_OUT, () => this.setHovered(false));

    this.glowFx = this.crystal.postFX?.addGlow(0x66bbff, 2.5, 0, false, 0.08, 20);
    if (this.glowFx) {
      this.glowTween = this.scene.tweens.add({
        targets: this.glowFx,
        outerStrength: 4,
        duration: 2600,
        ease: Phaser.Math.Easing.Sine.InOut,
        yoyo: true,
        repeat: -1,
      });
    }

    this.scene.tweens.addCounter({
      from: -1,
      to: 1,
      duration: FLOAT_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        this.floatOffset = tween.getValue() ?? 0;
        this.applyCrystalFloat();
      },
    });
  }

  /** True once the full opening sequence has completed — lets the scene change what clicking the crystal means. */
  isOpen(): boolean {
    return this.mechanismState === 'open';
  }

  /**
   * Instantly jumps to the fully-open end state (rings spread out, no
   * animation) — for returning to the hall after the mechanism was already
   * opened on a previous visit, the same "restore, don't replay" pattern
   * every other Central Hall object uses (Statue.restoreOpen(),
   * Entrance.restoreRevealed(), etc.). Safe to call before the first
   * layout() — it only sets state; layout() reads it afterward.
   */
  restoreOpen(): void {
    this.mechanismState = 'open';
    for (const ring of this.rings) {
      ring.openProgress = 1;
      ring.angleDeg = ring.layout.openAngleDeg;
      ring.hasOpened = true;
      // Rings fade away for good once they land (see fadeRingAway()) —
      // a returning visit jumps straight to that same "gone" state.
      ring.rear.setAlpha(0).setVisible(false);
      ring.front.setAlpha(0).setVisible(false);
    }
    if (this.glowFx) {
      this.glowFx.outerStrength = GLOW_OPEN_OUTER_STRENGTH;
    }
    // The crystal already shattered in whatever earlier session finished
    // the sequence — jump straight to "gone," never replaying the
    // build-up/explosion.
    this.crystal?.disableInteractive();
    this.crystal?.setVisible(false);
  }

  /**
   * Position the assembly. pedestalCenter is the pedestal's top-surface
   * center in screen space; scale is the background's cover-scale factor.
   * Re-derives every ring's position from its CURRENT openProgress/angleDeg
   * (whatever the mechanism state currently is) rather than resetting to
   * the closed layout, so a resize mid-opening (or after opening) stays
   * correct.
   */
  layout(pedestalCenterX: number, pedestalCenterY: number, scale: number): void {
    if (!this.crystal || this.rings.length === 0) {
      return;
    }
    this.lastPedestalCenterX = pedestalCenterX;
    this.lastPedestalCenterY = pedestalCenterY;

    this.assemblyScale = scale;
    this.crystalBaseScale = (CRYSTAL_HEIGHT_BG_PX / this.crystal.height) * scale;
    this.applyCrystalScale();
    this.crystal.setX(pedestalCenterX);
    this.crystalBaseY = pedestalCenterY - CRYSTAL_HOVER_BG_PX * scale;
    this.applyCrystalFloat();

    // Ring centers are placed relative to the hovering crystal's midpoint.
    const crystalCenterY = pedestalCenterY - (CRYSTAL_HOVER_BG_PX + CRYSTAL_HEIGHT_BG_PX / 2) * scale;
    for (const ring of this.rings) {
      this.applyRingTransform(ring, pedestalCenterX, crystalCenterY, scale);
    }
  }

  /** Advance the idle ring sway; call once per scene update. A ring that has already fallen (hasOpened) is skipped permanently — its angle is owned by its own fall tween (or fixed once done), never fought over by this per-frame recomputation. */
  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const seconds = this.elapsedMs / 1000;
    for (const ring of this.rings) {
      if (ring.hasOpened) {
        continue;
      }
      ring.angleDeg = ring.layout.baseAngleDeg + Math.sin(seconds * ring.osc.speed + ring.osc.phase) * ring.osc.amplitudeDeg;
      this.setPairAngle(ring, ring.angleDeg);
    }
  }

  /**
   * "This crystal's ring falls" — the moment `crystalId`'s crystal is
   * placed, its one tied ring (RING_*_LAYOUT.crystalId) immediately plays
   * its own shake -> align -> fall sequence (playSingleRingOpen()), not a
   * shared wait-for-all-three animation. No-op if that ring already fell
   * (e.g. this got called twice for the same crystal, which shouldn't
   * happen given CrystalPlacementMode's own placed/filled guards, but
   * costs nothing to check).
   *
   * Once GameState.areAllCrystalsPlaced() is true (checked fresh here —
   * this IS the last crystal, so nothing else needs tracking separately),
   * that ring's own fall is chained into finishOpening() once it lands.
   */
  playActivationNudge(crystalId: CrystalId): void {
    const ring = this.rings.find((r) => r.layout.crystalId === crystalId);
    if (!ring || ring.hasOpened) {
      return;
    }
    const isLastCrystal = areAllCrystalsPlaced(this.scene.registry);
    if (isLastCrystal) {
      this.mechanismState = 'opening';
      this.crystal?.disableInteractive();
    }

    this.playSingleRingOpen(ring, () => {
      if (isLastCrystal) {
        this.finishOpening();
      }
    });
  }

  // ---- per-ring fall sequence ---------------------------------------------

  private playSingleRingOpen(ring: RingRuntime, onComplete: () => void): void {
    ring.hasOpened = true;

    this.playRingShake(ring, () => {
      this.playRingAlign(ring, () => {
        this.playRingFall(ring, onComplete);
      });
    });
  }

  // Phase 1: a few quick small-angle jitters, ending back at exactly the
  // angle the ring started from — "a mechanical, ancient thing waking up,"
  // not a cosmetic shimmer, and a clean, known starting angle for the
  // align phase that follows.
  private playRingShake(ring: RingRuntime, onComplete: () => void): void {
    const startAngle = ring.angleDeg;
    this.scene.tweens.add({
      targets: ring,
      angleDeg: startAngle + SHAKE_AMPLITUDE_DEG,
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.setPairAngle(ring, ring.angleDeg),
      onComplete: () => {
        ring.angleDeg = startAngle;
        this.setPairAngle(ring, ring.angleDeg);
        onComplete();
      },
    });
  }

  // Phase 2: rotate to a flat reference angle — "straightening out" before
  // falling, rather than falling from whatever angle its idle sway
  // happened to leave it at.
  private playRingAlign(ring: RingRuntime, onComplete: () => void): void {
    this.scene.tweens.add({
      targets: ring,
      angleDeg: ALIGN_ANGLE_DEG,
      duration: ALIGN_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.setPairAngle(ring, ring.angleDeg),
      onComplete,
    });
  }

  // Phase 3: the ring falls to its own OPEN_* target (position via
  // openProgress, angle, and a slight scale-down for depth) using its own
  // Bounce.Out easing so it visibly lands. layout() already knows how to
  // render any openProgress/angleDeg, so onUpdate just re-runs it. Once
  // landed, it fades away and disappears (see fadeRingAway()) — fired off
  // in parallel with onComplete(), never blocking the caller (e.g. the
  // last ring's own chain into the crystal explosion) on the fade finishing.
  private playRingFall(ring: RingRuntime, onComplete: () => void): void {
    this.scene.tweens.add({
      targets: ring,
      openProgress: 1,
      angleDeg: ring.layout.openAngleDeg,
      duration: OPEN_DURATION_MS,
      ease: ring.layout.openEase,
      onUpdate: () => this.applyRingTransform(ring, this.lastPedestalCenterX, this.crystalCenterYForCurrentLayout(), this.assemblyScale),
      onComplete: () => {
        this.fadeRingAway(ring);
        onComplete();
      },
    });
  }

  // Once a ring has landed, it fades out and disappears entirely — simpler
  // than leaving it on screen, and it also means exactly where it lands no
  // longer needs to stay inside the visible frame on every screen shape.
  private fadeRingAway(ring: RingRuntime): void {
    this.scene.tweens.add({
      targets: [ring.rear, ring.front],
      alpha: 0,
      delay: RING_FADE_DELAY_MS,
      duration: RING_FADE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.In,
      onComplete: () => {
        ring.rear.setVisible(false);
        ring.front.setVisible(false);
      },
    });
  }

  // Phase 4: settle — a brief, stronger glow build-up around the now-clear
  // crystal, then it shatters (see playCrystalExplosion()). Nothing is left
  // to click afterward, so the crystal is never re-enabled here.
  private finishOpening(): void {
    this.mechanismState = 'open';

    if (this.glowFx) {
      this.glowTween?.stop();
      this.glowTween = this.scene.tweens.add({
        targets: this.glowFx,
        outerStrength: GLOW_OPEN_OUTER_STRENGTH,
        duration: EXPLOSION_BUILD_UP_MS,
        ease: Phaser.Math.Easing.Sine.In,
      });
    }

    this.scene.time.delayedCall(EXPLOSION_BUILD_UP_MS, () => this.playCrystalExplosion());
  }

  // The grand finale: the crystal vanishes (a quick scale/alpha collapse,
  // not an instant pop) while a one-shot burst of shard particles explodes
  // outward from its exact position, far enough and fast enough to spread
  // across the whole screen — never covering only a small radius around
  // where the crystal was.
  private playCrystalExplosion(): void {
    if (!this.crystal) {
      return;
    }
    this.generateShardTexture();

    const crystalX = this.crystal.x;
    const crystalY = this.crystal.y - this.crystal.displayHeight / 2;

    const emitter = this.scene.add
      .particles(crystalX, crystalY, EXPLOSION_TEXTURE_KEY, {
        lifespan: EXPLOSION_LIFESPAN_MS,
        speed: { min: EXPLOSION_SPEED_MIN, max: EXPLOSION_SPEED_MAX },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0.15 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        gravityY: EXPLOSION_GRAVITY_Y,
        blendMode: Phaser.BlendModes.ADD,
        tint: EXPLOSION_TINTS,
        emitting: false,
      })
      .setDepth(CRYSTAL_DEPTH + 5);
    emitter.explode(EXPLOSION_PARTICLE_COUNT);
    this.scene.time.delayedCall(EXPLOSION_LIFESPAN_MS + 100, () => emitter.destroy());

    this.crystal.disableInteractive();
    this.scene.tweens.add({
      targets: this.crystal,
      scale: 0,
      alpha: 0,
      duration: CRYSTAL_VANISH_MS,
      ease: Phaser.Math.Easing.Cubic.In,
      onComplete: () => this.crystal?.setVisible(false),
    });

    this.scene.time.delayedCall(MECHANISM_SHATTERED_MESSAGE_DELAY_MS, () => this.onMechanismShattered?.());
  }

  // A small jagged translucent chip — a shard of the crystal, not a copy
  // of its full photo-real image (which would look like many tiny whole
  // crystals floating away rather than an explosion of fragments).
  private generateShardTexture(): void {
    if (this.scene.textures.exists(EXPLOSION_TEXTURE_KEY)) {
      return;
    }
    const size = 22;
    const canvas = this.scene.textures.createCanvas(EXPLOSION_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -cy);
    ctx.lineTo(cx * 0.7, -cy * 0.15);
    ctx.lineTo(cx * 0.3, cy);
    ctx.lineTo(-cx * 0.6, cy * 0.3);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -cy, 0, cy);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0.5)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    canvas.refresh();
  }

  // The crystal-center-Y used during layout() isn't stored directly (only
  // the pedestal center is) — re-derived the same way layout() computes it,
  // so the opening tweens' onUpdate can call applyRingTransform() without
  // needing layout() to run again mid-animation.
  private crystalCenterYForCurrentLayout(): number {
    return this.lastPedestalCenterY - (CRYSTAL_HOVER_BG_PX + CRYSTAL_HEIGHT_BG_PX / 2) * this.assemblyScale;
  }

  /**
   * While suppressed (e.g. covered by a popup) the crystal ignores input and
   * its glow postFX is dropped, since that pass draws over later objects.
   */
  setSuppressed(suppressed: boolean): void {
    if (!this.crystal) {
      return;
    }
    if (suppressed) {
      this.crystal.disableInteractive();
      // disableInteractive suppresses POINTER_OUT, so settle the hover here.
      this.setHovered(false);
    } else if (this.mechanismState !== 'opening') {
      // Never re-enable mid-opening-animation — finishOpening() re-enables
      // it itself once the sequence actually completes.
      this.crystal.setInteractive({ useHandCursor: true });
    }
    if (this.glowFx) {
      this.glowFx.active = !suppressed;
    }
  }

  private createRing(
    rearKey: string,
    rearDepth: number,
    frontKey: string,
    frontDepth: number,
    layout: RingLayoutConfig,
    osc: { amplitudeDeg: number; speed: number; phase: number },
  ): RingRuntime {
    return {
      rear: this.scene.add.image(0, 0, rearKey).setOrigin(0.5, 0.5).setDepth(rearDepth),
      front: this.scene.add.image(0, 0, frontKey).setOrigin(0.5, 0.5).setDepth(frontDepth),
      layout,
      osc,
      angleDeg: layout.baseAngleDeg,
      openProgress: 0,
      hasOpened: false,
    };
  }

  // Both layers of a ring always share the exact same transform so the
  // rear and front arcs (exported from one canvas) stay perfectly aligned
  // — position/scale interpolated by openProgress (0 = caged, 1 = fully
  // open), angle read straight from the ring's own current angleDeg
  // (owned by whichever phase is currently driving it).
  private applyRingTransform(ring: RingRuntime, crystalCenterX: number, crystalCenterY: number, scale: number): void {
    const closedY = crystalCenterY + ring.layout.offsetYBg * scale;
    const openX = crystalCenterX + ring.layout.openOffsetXBg * scale;
    const openY = closedY + ring.layout.openOffsetYBg * scale;
    const x = Phaser.Math.Linear(crystalCenterX, openX, ring.openProgress);
    const y = Phaser.Math.Linear(closedY, openY, ring.openProgress);
    const scaleFactor = Phaser.Math.Linear(1, ring.layout.openScaleFactor, ring.openProgress);
    const uniformScale = (ring.layout.widthBg / ring.rear.width) * scale * scaleFactor;

    for (const layer of [ring.rear, ring.front]) {
      layer.setScale(uniformScale);
      layer.setPosition(x, y);
      layer.setAngle(ring.angleDeg);
    }
  }

  private setPairAngle(ring: RingRuntime, angle: number): void {
    ring.rear.setAngle(angle);
    ring.front.setAngle(angle);
  }

  private applyCrystalScale(): void {
    this.crystal?.setScale(this.crystalBaseScale * this.hoverScale);
  }

  private applyCrystalFloat(): void {
    if (!this.crystal) {
      return;
    }
    this.crystal.setY(this.crystalBaseY + this.floatOffset * FLOAT_AMPLITUDE_BG_PX * this.assemblyScale);
  }

  // Hover: the crystal swells slightly and its glow pulses faster.
  private setHovered(hovered: boolean): void {
    this.hoverTween?.stop();
    this.hoverTween = this.scene.tweens.add({
      targets: this,
      hoverScale: hovered ? 1.06 : 1,
      duration: 250,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.applyCrystalScale(),
    });
    if (this.glowTween) {
      this.glowTween.timeScale = hovered ? 2.2 : 1;
    }
  }
}
