import Phaser from 'phaser';
import crystalUrl from '../../assets/images/central-hall/OBJ_001-crystal.png';
import ringBackRearUrl from '../../assets/images/central-hall/Rings/Ring_Back-vetical-rear.png';
import ringBackFrontUrl from '../../assets/images/central-hall/Rings/Ring_Back-vetical-front.png';
import ringMiddleRearUrl from '../../assets/images/central-hall/Rings/Ring_Middle--rear.png';
import ringMiddleFrontUrl from '../../assets/images/central-hall/Rings/Ring_Middle--front.png';
import ringFrontRearUrl from '../../assets/images/central-hall/Rings/Ring-front--rear.png';
import ringFrontFrontUrl from '../../assets/images/central-hall/Rings/Ring-front-front.png';

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
// pair always receive the identical transform. Rings are used at their
// natural aspect (uniform scale, width given in background pixels);
// offsetYBg shifts the ring center relative to the crystal's midpoint.
// The two diagonal pairs share the crystal-midpoint center, identical
// scale, and mirrored angles, so they cross in an X near the crystal
// center; the vertical pair is unchanged.
const RING_BACK_LAYOUT = { widthBg: 179, offsetYBg: 0, baseAngleDeg: 0 };
const RING_MIDDLE_LAYOUT = { widthBg: 366, offsetYBg: 0, baseAngleDeg: 22 };
const RING_FRONT_LAYOUT = { widthBg: 366, offsetYBg: 0, baseAngleDeg: -22 };

// Gentle oscillation around each pair's approved base angle:
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

// Layering: all rear arcs behind the crystal, all front arcs in front.
const RING_BACK_REAR_DEPTH = 6;
const RING_MIDDLE_REAR_DEPTH = 7;
const RING_FRONT_REAR_DEPTH = 8;
const CRYSTAL_DEPTH = 9;
const RING_BACK_FRONT_DEPTH = 10;
const RING_MIDDLE_FRONT_DEPTH = 11;
const RING_FRONT_FRONT_DEPTH = 12;

interface RingPair {
  rear: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
}

/**
 * The Heart of the Temple: the floating crystal wrapped in three rune
 * rings, each split into rear/front layers so the crystal sits inside
 * them. Owns its own animations (float, glow pulse, hover, ring sway);
 * the scene provides the pedestal anchor via layout() and drives update().
 */
export default class HeartOfTheTemple {
  private scene: Phaser.Scene;
  private crystal?: Phaser.GameObjects.Image;
  private ringBack?: RingPair;
  private ringMiddle?: RingPair;
  private ringFront?: RingPair;
  private glowFx?: Phaser.FX.Glow;
  private glowTween?: Phaser.Tweens.Tween;
  private hoverTween?: Phaser.Tweens.Tween;
  private crystalBaseScale = 1;
  private hoverScale = 1;
  private crystalBaseY = 0;
  private floatOffset = 0;
  private assemblyScale = 1;
  private elapsedMs = 0;

  /** Invoked when the crystal is clicked (while not suppressed). */
  onCrystalClick?: () => void;

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
    this.ringBack = this.createRingPair(
      RING_BACK_REAR_KEY, RING_BACK_REAR_DEPTH,
      RING_BACK_FRONT_KEY, RING_BACK_FRONT_DEPTH,
    );
    this.ringMiddle = this.createRingPair(
      RING_MIDDLE_REAR_KEY, RING_MIDDLE_REAR_DEPTH,
      RING_MIDDLE_FRONT_KEY, RING_MIDDLE_FRONT_DEPTH,
    );
    this.ringFront = this.createRingPair(
      RING_FRONT_REAR_KEY, RING_FRONT_REAR_DEPTH,
      RING_FRONT_FRONT_KEY, RING_FRONT_FRONT_DEPTH,
    );

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

  /**
   * Position the assembly. pedestalCenter is the pedestal's top-surface
   * center in screen space; scale is the background's cover-scale factor.
   */
  layout(pedestalCenterX: number, pedestalCenterY: number, scale: number): void {
    if (!this.crystal || !this.ringBack || !this.ringMiddle || !this.ringFront) {
      return;
    }

    this.assemblyScale = scale;
    this.crystalBaseScale =
      (CRYSTAL_HEIGHT_BG_PX / this.crystal.height) * scale;
    this.applyCrystalScale();
    this.crystal.setX(pedestalCenterX);
    this.crystalBaseY = pedestalCenterY - CRYSTAL_HOVER_BG_PX * scale;
    this.applyCrystalFloat();

    // Ring centers are placed relative to the hovering crystal's midpoint.
    const crystalCenterY =
      pedestalCenterY -
      (CRYSTAL_HOVER_BG_PX + CRYSTAL_HEIGHT_BG_PX / 2) * scale;
    this.layoutRingPair(this.ringBack, RING_BACK_LAYOUT, pedestalCenterX, crystalCenterY, scale);
    this.layoutRingPair(this.ringMiddle, RING_MIDDLE_LAYOUT, pedestalCenterX, crystalCenterY, scale);
    this.layoutRingPair(this.ringFront, RING_FRONT_LAYOUT, pedestalCenterX, crystalCenterY, scale);
  }

  /** Advance the ring motion; call once per scene update. */
  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const seconds = this.elapsedMs / 1000;
    this.applyOscillation(this.ringBack, RING_BACK_LAYOUT, RING_BACK_OSC, seconds);
    this.applyOscillation(this.ringMiddle, RING_MIDDLE_LAYOUT, RING_MIDDLE_OSC, seconds);
    this.applyOscillation(this.ringFront, RING_FRONT_LAYOUT, RING_FRONT_OSC, seconds);
  }

  private applyOscillation(
    pair: RingPair | undefined,
    ringLayout: { baseAngleDeg: number },
    osc: { amplitudeDeg: number; speed: number; phase: number },
    seconds: number,
  ): void {
    this.setPairAngle(
      pair,
      ringLayout.baseAngleDeg +
        Math.sin(seconds * osc.speed + osc.phase) * osc.amplitudeDeg,
    );
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
    } else {
      this.crystal.setInteractive({ useHandCursor: true });
    }
    if (this.glowFx) {
      this.glowFx.active = !suppressed;
    }
  }

  private createRingPair(
    rearKey: string,
    rearDepth: number,
    frontKey: string,
    frontDepth: number,
  ): RingPair {
    return {
      rear: this.scene.add.image(0, 0, rearKey).setOrigin(0.5, 0.5).setDepth(rearDepth),
      front: this.scene.add.image(0, 0, frontKey).setOrigin(0.5, 0.5).setDepth(frontDepth),
    };
  }

  // Both layers of a pair share the exact same transform so the rear and
  // front arcs (exported from one canvas) stay perfectly aligned.
  private layoutRingPair(
    pair: RingPair,
    ringLayout: { widthBg: number; offsetYBg: number; baseAngleDeg: number },
    crystalCenterX: number,
    crystalCenterY: number,
    scale: number,
  ): void {
    const uniformScale = (ringLayout.widthBg / pair.rear.width) * scale;
    const y = crystalCenterY + ringLayout.offsetYBg * scale;
    for (const layer of [pair.rear, pair.front]) {
      layer.setScale(uniformScale);
      layer.setPosition(crystalCenterX, y);
      layer.setAngle(ringLayout.baseAngleDeg);
    }
  }

  // Rear and front layers of a pair always share the exact same angle.
  private setPairAngle(pair: RingPair | undefined, angle: number): void {
    if (!pair) {
      return;
    }
    pair.rear.setAngle(angle);
    pair.front.setAngle(angle);
  }

  private applyCrystalScale(): void {
    this.crystal?.setScale(this.crystalBaseScale * this.hoverScale);
  }

  private applyCrystalFloat(): void {
    if (!this.crystal) {
      return;
    }
    this.crystal.setY(
      this.crystalBaseY +
        this.floatOffset * FLOAT_AMPLITUDE_BG_PX * this.assemblyScale,
    );
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
