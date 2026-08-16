import Phaser from 'phaser';
import {
  CrystalId,
  CRYSTAL_IDS,
  getCrystalPlacementState,
  setCrystalPlaced,
  areAllCrystalsPlaced,
} from './GameState';
import { isEnvelopScaleMode } from './scaleMode';

// The gem's own base tint — same palette CrystalHolder.ts already uses for
// its pouch, kept as its own local copy (that file predates this task and
// isn't touched here). Slot glows reuse this same palette too.
const CRYSTAL_TINTS: Record<CrystalId, number> = {
  pink: 0xff8fce,
  red: 0xff5a4d,
  green: 0x5fe396,
};

// A richer two-tone glow specifically for the held/tray crystals (distinct
// from the plain per-crystal tint above) — "pink-violet", "red-orange",
// "green-turquoise", per this task's explicit request.
const CRYSTAL_GLOW_TINTS: Record<CrystalId, number> = {
  pink: 0xe066e8,
  red: 0xff7a33,
  green: 0x2ee6b8,
};

// One slot per crystal, fixed 1:1 by id — see the class doc comment below
// for why there is no separate "which slot fits which crystal" puzzle.
const SLOT_ID_BY_CRYSTAL: Record<CrystalId, string> = {
  pink: 'crystalSlot1',
  red: 'crystalSlot2',
  green: 'crystalSlot3',
};

const GEM_TEXTURE_KEY = 'crystal-placement-gem';
const SLOT_TEXTURE_KEY = 'crystal-placement-slot';
const GLOW_TEXTURE_KEY = 'crystal-placement-glow';

// All sizes/positions below are in background-image pixels (1536x1024
// hall source) — the same anchor convention every other Central Hall
// object (Pot, Handle, Statue, Doorway, WallWheel) already uses, and
// deliberately NOT scrollFactor(0): both the tray and the slots need to
// live in the same world-space coordinate system so a dragged crystal and
// its target slot can be compared directly, and so Phaser's own
// camera-aware drag system (dragX/dragY, already derived from
// pointer.worldX/worldY) positions the dragged gem correctly at any
// pinch-zoom/pan state with no hand-rolled screen-coordinate math.
const GEM_SIZE_BG = 46;
const GEM_GLOW_SIZE_BG = GEM_SIZE_BG * 2.1;
const GEM_HIT_SIZE_BG = 70; // generous drag/click hit area, bigger than the visible gem
const SLOT_SIZE_BG = 64;
const SLOT_GLOW_SIZE_BG = SLOT_SIZE_BG * 1.5;
const CATCH_RADIUS_BG = 55; // "a bit bigger than the visual slot" drop/click tolerance

// The Heart of the Temple's own crystal/rings sit centered a bit above the
// pedestal (see HeartOfTheTemple.layout() — crystalCenterY works out to
// roughly pedestalCenterY - 195 with this project's current constants);
// mirrored here as a fixed anchor rather than reaching into that class's
// internals. Slots are arranged left/top/right AROUND this same center,
// per this task's explicit "pink left, red top, green right" layout — the
// tray sits further down, near the bottom of the screen. On short
// phone-landscape screens (ENVELOP scale mode) the design canvas is
// cropped ~190bg-px off both the top and bottom edges (see scaleMode.ts),
// so both rows use a tighter, pulled-in offset table in that case instead
// of the more generous desktop/tablet (FIT) spacing.
const MECHANISM_CENTER_X_BG = 762; // same X as CentralHallScene's PEDESTAL_CENTER_X
const MECHANISM_CENTER_Y_BG = 580;

interface SlotOffset {
  dx: number;
  dy: number;
}
const SLOT_OFFSETS_FIT: Record<CrystalId, SlotOffset> = {
  pink: { dx: -230, dy: 40 },
  red: { dx: 0, dy: -210 },
  green: { dx: 230, dy: 40 },
};
const SLOT_OFFSETS_ENVELOP: Record<CrystalId, SlotOffset> = {
  pink: { dx: -200, dy: 55 },
  red: { dx: 0, dy: -140 },
  green: { dx: 200, dy: 55 },
};

const TRAY_CENTER_X_BG = 762;
const TRAY_SPACING_BG = 140;
const TRAY_CENTER_Y_BG_FIT = 970;
const TRAY_CENTER_Y_BG_ENVELOP = 815;

const REST_DEPTH = 15;
const CRYSTAL_DEPTH = REST_DEPTH + 2;
const DRAG_DEPTH = 70;
const TRAIL_DEPTH = DRAG_DEPTH - 1;

const RETURN_TWEEN_MS = 260;
const PLACE_TWEEN_MS = 220;
const PLACE_GLOW_FLASH_MS = 500;

// ---- crystal ambient-glow tuning ----------------------------------------
// A slow, non-flickering "breathing" idle animation (alpha + scale, both
// gentle) runs continuously behind every not-yet-placed crystal; hover,
// selection, and dragging layer an additional boost on top of whichever
// breathing value is current, so nothing ever fights the same tweened
// property from two different tweens at once (see applyCrystalGlowVisual()
// — a single function recombines base + boost and writes the result once).
const GLOW_BREATHE_ALPHA_MIN = 0.4;
const GLOW_BREATHE_ALPHA_MAX = 0.6;
const GLOW_BREATHE_SCALE_MIN = 0.94;
const GLOW_BREATHE_SCALE_MAX = 1.06;
const GLOW_BREATHE_DURATION_MS = 3000;
const GLOW_BREATHE_PHASE_STAGGER_MS = 350; // per-crystal offset so all three don't pulse in lockstep

const GLOW_HOVER_BOOST_ALPHA = 0.2;
const GLOW_HOVER_BOOST_SCALE = 0.1;
const GLOW_SELECT_BOOST_ALPHA = 0.25;
const GLOW_SELECT_BOOST_SCALE = 0.14;
const GLOW_DRAG_BOOST_ALPHA = 0.35;
const GLOW_DRAG_BOOST_SCALE = 0.2;
const GEM_HOVER_SCALE_BOOST = 0.08;
const GEM_DRAG_SCALE_BOOST = 0.12;

const GLOW_LOCK_FLASH_ALPHA = 1;
const GLOW_LOCK_FLASH_SCALE = 1.35;
const GLOW_LOCKED_STEADY_ALPHA = 0.5;
const GLOW_LOCKED_STEADY_SCALE = 1;

// ---- slot visual-state tuning --------------------------------------------
type SlotVisualState = 'rest' | 'targeted' | 'near' | 'filled';

const SLOT_GLOW_ALPHA: Record<SlotVisualState, number> = {
  rest: 0.3,
  targeted: 0.55,
  near: 0.85,
  filled: 0.6,
};
const SLOT_GLOW_SCALE_MULTIPLIER: Record<SlotVisualState, number> = {
  rest: 1,
  targeted: 1.1,
  near: 1.25,
  filled: 1,
};
const SLOT_STATE_TWEEN_MS = 160;

interface CrystalRuntime {
  id: CrystalId;
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  gem: Phaser.GameObjects.Image;
  /** The scale setDisplaySize() computed at creation (texture-native-px -> GEM_GLOW_SIZE_BG). Every later .setScale() on `glow` MUST multiply by this rather than set an absolute value, or it would silently discard the intended display size. */
  glowBaseScale: number;
  /** Same idea as glowBaseScale, for `gem`. */
  gemBaseScale: number;
  homeX: number;
  homeY: number;
  placed: boolean;
  dragging: boolean;
  hovered: boolean;
  selected: boolean;
  breathePhase: number;
  breatheTween?: Phaser.Tweens.Tween;
}

interface SlotRuntime {
  crystalId: CrystalId;
  slotKey: string;
  marker: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  hitRect: Phaser.Geom.Rectangle;
  x: number;
  y: number;
  filled: boolean;
  visualState: SlotVisualState;
}

/**
 * Stage 1 of the "return the crystals" sequence: once every crystal has
 * been collected (checked by the caller via GameState.areAllCrystalsCollected
 * — this class reads that SAME shared registry state, never a parallel
 * tracker), shows a short instruction, a tray of the collected crystals
 * near the bottom of the hall, and one fixed slot per crystal arranged
 * around the Heart of the Temple's mechanism (pink left, red top, green
 * right), and lets the player drag (or click-then-click) each crystal into
 * its own slot. Does not yet build the full ring-opening sequence — see
 * onCrystalPlaced()/onAllCrystalsPlaced().
 *
 * WHICH CRYSTAL FITS WHICH SLOT: fixed 1:1 by crystal id (SLOT_ID_BY_CRYSTAL
 * above) — 'pink' always belongs in 'crystalSlot1', 'red' in
 * 'crystalSlot2', 'green' in 'crystalSlot3' (the same left-to-right order
 * CrystalHolder.ts already uses for its own pouch UI). There is no puzzle
 * about WHICH slot a given crystal goes in — every crystal has exactly one
 * correct destination — only about actually dragging/clicking it there.
 *
 * PLACEHOLDER ART: no dedicated slot/gem artwork exists yet, so both are
 * drawn as small procedural markers (a faceted gem shape reused/tinted
 * per crystal, and a gentle dashed-diamond recess for each slot) — see
 * PROJECT_STATE.md for the real assets worth commissioning later.
 */
export default class CrystalPlacementMode {
  private scene: Phaser.Scene;
  private crystals: CrystalRuntime[] = [];
  private slots: SlotRuntime[] = [];
  private selectedCrystalId?: CrystalId;
  private scale = 1;
  private dragTrailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  /** Fires once, right when a crystal locks into its correct slot (never on the initial restore of an already-placed crystal) — e.g. wired by CentralHallScene to nudge one of the Heart of the Temple's rings as "the mechanism activated" feedback. */
  onCrystalPlaced?: (crystalId: CrystalId, slotId: string) => void;
  /** Fires once, the moment the LAST crystal is placed this session (never on restore). */
  onAllCrystalsPlaced?: () => void;

  private readonly handleDragStart = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) => this.onDragStart(gameObject);
  private readonly handleDrag = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dragX: number,
    dragY: number,
  ) => this.onDrag(gameObject, dragX, dragY);
  private readonly handleDragEnd = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) => this.onDragEnd(gameObject);

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.createCrystalPlacementMode();
  }

  /** toScreenX/toScreenY map a background-pixel coordinate to current screen space; scale is the background cover-scale factor — same signature convention every other Central Hall component's layout() uses. */
  layout(toScreenX: (bgX: number) => number, toScreenY: (bgY: number) => number, scale: number): void {
    this.scale = scale;
    const envelop = isEnvelopScaleMode(this.scene);
    const offsets = envelop ? SLOT_OFFSETS_ENVELOP : SLOT_OFFSETS_FIT;

    this.slots.forEach((slot) => {
      const offset = offsets[slot.crystalId];
      const x = toScreenX(MECHANISM_CENTER_X_BG + offset.dx);
      const y = toScreenY(MECHANISM_CENTER_Y_BG + offset.dy);
      slot.x = x;
      slot.y = y;

      slot.marker.setPosition(x, y).setDisplaySize(SLOT_SIZE_BG * scale, SLOT_SIZE_BG * scale);
      this.applySlotVisualStateInstant(slot);

      const clickSize = CATCH_RADIUS_BG * 2 * scale;
      slot.zone.setPosition(x, y).setSize(clickSize, clickSize);
      slot.hitRect.width = clickSize;
      slot.hitRect.height = clickSize;
    });

    const trayY = toScreenY(envelop ? TRAY_CENTER_Y_BG_ENVELOP : TRAY_CENTER_Y_BG_FIT);
    const trayRowWidth = (this.crystals.length - 1) * TRAY_SPACING_BG;
    const trayStartX = TRAY_CENTER_X_BG - trayRowWidth / 2;

    this.crystals.forEach((crystal, i) => {
      crystal.container.setScale(scale);
      if (crystal.placed) {
        const slot = this.slots.find((s) => s.crystalId === crystal.id);
        if (slot) {
          crystal.container.setPosition(slot.x, slot.y);
        }
        return;
      }
      const homeX = toScreenX(trayStartX + i * TRAY_SPACING_BG);
      crystal.homeX = homeX;
      crystal.homeY = trayY;
      if (!crystal.dragging) {
        crystal.container.setPosition(homeX, trayY);
      }
    });
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.DRAG_START, this.handleDragStart);
    this.scene.input.off(Phaser.Input.Events.DRAG, this.handleDrag);
    this.scene.input.off(Phaser.Input.Events.DRAG_END, this.handleDragEnd);

    this.crystals.forEach((c) => {
      c.breatheTween?.stop();
      c.container.destroy();
    });
    this.crystals = [];

    this.slots.forEach((s) => {
      s.marker.destroy();
      s.glow.destroy();
      s.zone.destroy();
    });
    this.slots = [];

    this.dragTrailEmitter?.destroy();
    this.dragTrailEmitter = undefined;
  }

  // ---- setup -------------------------------------------------------------

  private createCrystalPlacementMode(): void {
    this.generateTextures();
    this.createCrystalSlots();
    this.createCollectedCrystalsTray();

    this.scene.input.on(Phaser.Input.Events.DRAG_START, this.handleDragStart);
    this.scene.input.on(Phaser.Input.Events.DRAG, this.handleDrag);
    this.scene.input.on(Phaser.Input.Events.DRAG_END, this.handleDragEnd);
  }

  private createCrystalSlots(): void {
    this.slots = CRYSTAL_IDS.map((crystalId) => {
      const glow = this.scene.add
        .image(0, 0, GLOW_TEXTURE_KEY)
        .setTint(CRYSTAL_TINTS[crystalId])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(REST_DEPTH);
      const marker = this.scene.add.image(0, 0, SLOT_TEXTURE_KEY).setDepth(REST_DEPTH + 1);

      const zone = this.scene.add.zone(0, 0, 1, 1);
      const hitRect = new Phaser.Geom.Rectangle(0, 0, 1, 1);
      zone.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains);
      if (zone.input) {
        zone.input.cursor = 'pointer';
      }
      zone.on(Phaser.Input.Events.POINTER_DOWN, () => this.onSlotClicked(crystalId));

      return {
        crystalId,
        slotKey: SLOT_ID_BY_CRYSTAL[crystalId],
        marker,
        glow,
        zone,
        hitRect,
        x: 0,
        y: 0,
        filled: false,
        visualState: 'rest' as SlotVisualState,
      };
    });
  }

  private createCollectedCrystalsTray(): void {
    const placement = getCrystalPlacementState(this.scene.registry);

    this.crystals = CRYSTAL_IDS.map((id, index) => {
      const alreadyPlaced = placement[id];

      const glow = this.scene.add
        .image(0, 0, GLOW_TEXTURE_KEY)
        .setTint(CRYSTAL_GLOW_TINTS[id])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(GEM_GLOW_SIZE_BG, GEM_GLOW_SIZE_BG);
      const gem = this.scene.add
        .image(0, 0, GEM_TEXTURE_KEY)
        .setTint(CRYSTAL_TINTS[id])
        .setDisplaySize(GEM_SIZE_BG, GEM_SIZE_BG);

      // Glow added first so it renders BEHIND the gem, never covering its
      // facet detail — a separate, non-interactive layer, never part of
      // the container's own hit area below.
      const container = this.scene.add.container(0, 0, [glow, gem]).setDepth(CRYSTAL_DEPTH);

      const runtime: CrystalRuntime = {
        id,
        container,
        glow,
        gem,
        // Captured immediately after setDisplaySize() above, BEFORE
        // anything ever calls .setScale() on these — every such call from
        // here on multiplies by this base rather than setting an absolute
        // value, or it would silently discard the intended display size.
        glowBaseScale: glow.scaleX,
        gemBaseScale: gem.scaleX,
        homeX: 0,
        homeY: 0,
        placed: alreadyPlaced,
        dragging: false,
        hovered: false,
        selected: false,
        breathePhase: 0,
      };

      if (alreadyPlaced) {
        const slot = this.slots.find((s) => s.crystalId === id);
        if (slot) {
          slot.filled = true;
          slot.visualState = 'filled';
        }
        glow.setAlpha(GLOW_LOCKED_STEADY_ALPHA).setScale(runtime.glowBaseScale * GLOW_LOCKED_STEADY_SCALE);
      } else {
        const half = GEM_HIT_SIZE_BG / 2;
        container.setInteractive(
          new Phaser.Geom.Rectangle(-half, -half, GEM_HIT_SIZE_BG, GEM_HIT_SIZE_BG),
          Phaser.Geom.Rectangle.Contains,
        );
        this.scene.input.setDraggable(container);
        if (container.input) {
          container.input.cursor = 'pointer';
        }
        container.on(Phaser.Input.Events.POINTER_DOWN, () => this.selectCrystal(id));
        container.on(Phaser.Input.Events.POINTER_OVER, () => this.setCrystalHovered(runtime, true));
        container.on(Phaser.Input.Events.POINTER_OUT, () => this.setCrystalHovered(runtime, false));

        this.startCrystalBreathing(runtime, index * GLOW_BREATHE_PHASE_STAGGER_MS);
      }

      return runtime;
    });
  }

  // ---- crystal ambient glow / hover / breathing ---------------------------

  private startCrystalBreathing(crystal: CrystalRuntime, phaseDelayMs: number): void {
    crystal.breatheTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: GLOW_BREATHE_DURATION_MS,
      delay: phaseDelayMs,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: (tween) => {
        crystal.breathePhase = tween.getValue() ?? 0;
        this.applyCrystalGlowVisual(crystal);
      },
    });
  }

  private setCrystalHovered(crystal: CrystalRuntime, hovered: boolean): void {
    if (crystal.placed) {
      return;
    }
    crystal.hovered = hovered;
    this.applyCrystalGlowVisual(crystal);
  }

  /**
   * The single place that combines the slow idle "breathing" value with
   * whatever interaction boost currently applies (hover, click-selection,
   * or an active drag — the strongest one wins, they don't stack) and
   * writes the result once. Never fights the breathing tween, which only
   * ever supplies the base value this reads.
   */
  private applyCrystalGlowVisual(crystal: CrystalRuntime): void {
    if (crystal.placed) {
      return;
    }
    const breatheAlpha = Phaser.Math.Linear(GLOW_BREATHE_ALPHA_MIN, GLOW_BREATHE_ALPHA_MAX, crystal.breathePhase);
    const breatheScale = Phaser.Math.Linear(GLOW_BREATHE_SCALE_MIN, GLOW_BREATHE_SCALE_MAX, crystal.breathePhase);

    let boostAlpha = 0;
    let boostScale = 0;
    let gemBoostScale = 0;
    if (crystal.dragging) {
      boostAlpha = GLOW_DRAG_BOOST_ALPHA;
      boostScale = GLOW_DRAG_BOOST_SCALE;
      gemBoostScale = GEM_DRAG_SCALE_BOOST;
    } else if (crystal.selected) {
      boostAlpha = GLOW_SELECT_BOOST_ALPHA;
      boostScale = GLOW_SELECT_BOOST_SCALE;
      gemBoostScale = GEM_HOVER_SCALE_BOOST;
    } else if (crystal.hovered) {
      boostAlpha = GLOW_HOVER_BOOST_ALPHA;
      boostScale = GLOW_HOVER_BOOST_SCALE;
      gemBoostScale = GEM_HOVER_SCALE_BOOST;
    }

    crystal.glow.setAlpha(Math.min(1, breatheAlpha + boostAlpha));
    crystal.glow.setScale(crystal.glowBaseScale * (breatheScale + boostScale));
    crystal.gem.setScale(crystal.gemBaseScale * (1 + gemBoostScale));
  }

  // ---- drag handling -------------------------------------------------------

  private onDragStart(gameObject: Phaser.GameObjects.GameObject): void {
    const crystal = this.crystals.find((c) => c.container === gameObject);
    if (!crystal || crystal.placed) {
      return;
    }
    this.deselectCrystal();
    crystal.dragging = true;
    crystal.container.setDepth(DRAG_DEPTH);
    this.applyCrystalGlowVisual(crystal);
    this.startDragTrail(crystal);

    const slot = this.slots.find((s) => s.crystalId === crystal.id);
    if (slot && !slot.filled) {
      this.setSlotVisualState(slot, 'targeted');
    }
  }

  private onDrag(gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number): void {
    const crystal = this.crystals.find((c) => c.container === gameObject);
    if (!crystal || crystal.placed) {
      return;
    }
    // dragX/dragY are already world-space (Phaser derives them from
    // pointer.worldX/worldY internally), so this stays correct at any
    // pinch-zoom/pan state with no extra coordinate conversion needed.
    crystal.container.setPosition(dragX, dragY);
    this.dragTrailEmitter?.setPosition(dragX, dragY);

    const slot = this.slots.find((s) => s.crystalId === crystal.id);
    if (slot && !slot.filled) {
      const dist = Phaser.Math.Distance.Between(dragX, dragY, slot.x, slot.y);
      this.setSlotVisualState(slot, dist <= CATCH_RADIUS_BG * this.scale ? 'near' : 'targeted');
    }
  }

  private onDragEnd(gameObject: Phaser.GameObjects.GameObject): void {
    const crystal = this.crystals.find((c) => c.container === gameObject);
    if (!crystal || crystal.placed) {
      return;
    }
    crystal.dragging = false;
    crystal.container.setDepth(CRYSTAL_DEPTH);
    this.stopDragTrail();

    this.handleCrystalDrop(crystal);

    const slot = this.slots.find((s) => s.crystalId === crystal.id);
    if (slot && !slot.filled) {
      this.setSlotVisualState(slot, 'rest');
    }
    this.applyCrystalGlowVisual(crystal);
  }

  private handleCrystalDrop(crystal: CrystalRuntime): void {
    const catchRadius = CATCH_RADIUS_BG * this.scale;
    const nearestSlot = this.slots.find(
      (slot) => Phaser.Math.Distance.Between(crystal.container.x, crystal.container.y, slot.x, slot.y) <= catchRadius,
    );

    if (nearestSlot && nearestSlot.crystalId === crystal.id && !nearestSlot.filled) {
      this.placeCrystalInSlot(crystal, nearestSlot);
    } else {
      this.returnCrystalToStart(crystal);
    }
  }

  private startDragTrail(crystal: CrystalRuntime): void {
    const emitter = this.ensureDragTrailEmitter();
    emitter.setPosition(crystal.container.x, crystal.container.y);
    emitter.setParticleTint(CRYSTAL_GLOW_TINTS[crystal.id]);
    emitter.start();
  }

  private stopDragTrail(): void {
    this.dragTrailEmitter?.stop();
  }

  // A few soft sparks trailing a crystal while it's being dragged — "אפשר
  // להוסיף שובל אור עדין או חלקיקים מעטים." One shared emitter (repositioned
  // per drag) rather than one per crystal, since only one crystal is ever
  // dragged at a time.
  private ensureDragTrailEmitter(): Phaser.GameObjects.Particles.ParticleEmitter {
    if (!this.dragTrailEmitter) {
      this.dragTrailEmitter = this.scene.add
        .particles(0, 0, GLOW_TEXTURE_KEY, {
          lifespan: 380,
          speed: { min: 8, max: 24 },
          scale: { start: 0.3, end: 0 },
          alpha: { start: 0.5, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
          frequency: 70,
          quantity: 1,
          emitting: false,
        })
        .setDepth(TRAIL_DEPTH);
    }
    return this.dragTrailEmitter;
  }

  // ---- click-to-select-then-place (mobile-friendly alternative to drag) --

  private selectCrystal(id: CrystalId): void {
    if (this.selectedCrystalId === id) {
      this.deselectCrystal();
      return;
    }
    this.deselectCrystal();
    const crystal = this.crystals.find((c) => c.id === id);
    if (!crystal || crystal.placed) {
      return;
    }
    this.selectedCrystalId = id;
    crystal.selected = true;
    this.applyCrystalGlowVisual(crystal);
  }

  private deselectCrystal(): void {
    if (!this.selectedCrystalId) {
      return;
    }
    const previous = this.crystals.find((c) => c.id === this.selectedCrystalId);
    if (previous) {
      previous.selected = false;
      this.applyCrystalGlowVisual(previous);
    }
    this.selectedCrystalId = undefined;
  }

  private onSlotClicked(crystalId: CrystalId): void {
    if (!this.selectedCrystalId) {
      return;
    }
    const slot = this.slots.find((s) => s.crystalId === crystalId);
    const crystal = this.crystals.find((c) => c.id === this.selectedCrystalId);
    if (!slot || !crystal || crystal.placed || slot.filled) {
      return;
    }
    if (slot.crystalId === crystal.id) {
      this.placeCrystalInSlot(crystal, slot);
    }
    // A wrong slot is an explicit no-op — "לחיצה על שקע לא נכון לא תציב
    // אותו": the crystal stays selected and in the tray.
  }

  // ---- placement outcomes --------------------------------------------------

  private placeCrystalInSlot(crystal: CrystalRuntime, slot: SlotRuntime): void {
    crystal.placed = true;
    slot.filled = true;
    slot.visualState = 'filled';
    this.deselectCrystal();
    crystal.breatheTween?.stop();
    crystal.breatheTween = undefined;

    this.scene.tweens.add({
      targets: crystal.container,
      x: slot.x,
      y: slot.y,
      scale: this.scale * 0.94,
      duration: PLACE_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        // Locked in place — no further drag/click once correctly placed.
        crystal.container.disableInteractive();

        this.scene.tweens.add({
          targets: crystal.container,
          scale: { from: this.scale * 0.94, to: this.scale },
          duration: PLACE_GLOW_FLASH_MS * 0.6,
          ease: Phaser.Math.Easing.Back.Out,
        });

        // Brief flash, then settle to a steady (non-breathing) glow. Both
        // scale values are pre-multiplied by glowBaseScale (the scale
        // setDisplaySize() established at creation) — tweening `.scale`
        // directly between two absolute numbers here is equivalent to
        // tweening a multiplier and re-multiplying every frame, since
        // glowBaseScale is constant for the duration of this tween.
        crystal.glow.setAlpha(GLOW_LOCK_FLASH_ALPHA).setScale(crystal.glowBaseScale * GLOW_LOCK_FLASH_SCALE);
        this.scene.tweens.add({
          targets: crystal.glow,
          alpha: GLOW_LOCKED_STEADY_ALPHA,
          scale: crystal.glowBaseScale * GLOW_LOCKED_STEADY_SCALE,
          duration: PLACE_GLOW_FLASH_MS,
          ease: Phaser.Math.Easing.Sine.Out,
        });

        this.setSlotVisualState(slot, 'filled');

        this.handleCrystalPlacedSaved(crystal.id, slot.slotKey);
      },
    });
  }

  private returnCrystalToStart(crystal: CrystalRuntime): void {
    this.scene.tweens.add({
      targets: crystal.container,
      x: crystal.homeX,
      y: crystal.homeY,
      duration: RETURN_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  /**
   * Saves progress via the SAME shared registry the rest of GameState.ts
   * already uses, notifies the public onCrystalPlaced hook (e.g. for
   * CentralHallScene to nudge — and, on the last crystal, fully open — the
   * Heart of the Temple's rings), then checks for full completion. Never
   * runs on the initial restore of an already-placed crystal — see
   * createCollectedCrystalsTray()'s alreadyPlaced branch, which sets slot
   * state directly without going through here.
   *
   * No standalone "all placed" toast here anymore — HeartOfTheTemple's own
   * real ring-opening sequence (triggered from the SAME onCrystalPlaced
   * hook, via playActivationNudge()) is now that feedback; a separate text
   * popup at the same moment would just be redundant clutter on top of it.
   */
  private handleCrystalPlacedSaved(crystalId: CrystalId, slotId: string): void {
    setCrystalPlaced(this.scene.registry, crystalId);
    this.onCrystalPlaced?.(crystalId, slotId);
    if (areAllCrystalsPlaced(this.scene.registry)) {
      this.onAllCrystalsPlaced?.();
    }
  }

  // ---- slot visual states --------------------------------------------------

  /** Animated transition between rest/targeted/near/filled — used during real gameplay interactions. */
  private setSlotVisualState(slot: SlotRuntime, state: SlotVisualState): void {
    slot.visualState = state;
    const size = SLOT_GLOW_SIZE_BG * this.scale * SLOT_GLOW_SCALE_MULTIPLIER[state];
    this.scene.tweens.add({
      targets: slot.glow,
      displayWidth: size,
      displayHeight: size,
      alpha: SLOT_GLOW_ALPHA[state],
      duration: SLOT_STATE_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  /** Instant (non-tweened) re-application of the slot's CURRENT visual state — used from layout() so a resize mid-animation always lands on a value consistent with the slot's actual state, rather than resetting to a flat default. */
  private applySlotVisualStateInstant(slot: SlotRuntime): void {
    const size = SLOT_GLOW_SIZE_BG * this.scale * SLOT_GLOW_SCALE_MULTIPLIER[slot.visualState];
    slot.glow.setPosition(slot.x, slot.y).setDisplaySize(size, size).setAlpha(SLOT_GLOW_ALPHA[slot.visualState]);
  }

  // ---- placeholder art (see PROJECT_STATE.md for real assets to commission) --

  private generateTextures(): void {
    this.generateGemTexture();
    this.generateSlotTexture();
    this.generateGlowTexture();
  }

  // A small faceted gem, generated once in neutral white and tinted per
  // crystal at runtime — same "one shared texture, tinted per use"
  // convention as CrystalHolder.ts's own gem texture.
  private generateGemTexture(): void {
    if (this.scene.textures.exists(GEM_TEXTURE_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(GEM_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const r = size / 2 - 6;
    ctx.save();
    ctx.translate(size / 2, size / 2);

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.78, -r * 0.12);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.78, -r * 0.12);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();

    ctx.restore();
    canvas.refresh();
  }

  // A gentle dashed-diamond recess standing in for a real carved slot —
  // deliberately subtle, so it reads as part of the pedestal rather than
  // an obvious UI widget until real art replaces it. Drawn to look
  // engraved/sunken into metal: a dark inset fill plus a soft highlight
  // along the upper-left edge.
  private generateSlotTexture(): void {
    if (this.scene.textures.exists(SLOT_TEXTURE_KEY)) {
      return;
    }
    const size = 80;
    const canvas = this.scene.textures.createCanvas(SLOT_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);

    const inset = ctx.createLinearGradient(-r * 0.62, -r * 0.62, r * 0.62, r * 0.62);
    inset.addColorStop(0, 'rgba(6,5,3,0.55)');
    inset.addColorStop(0.5, 'rgba(20,16,10,0.4)');
    inset.addColorStop(1, 'rgba(30,25,16,0.3)');
    ctx.fillStyle = inset;
    ctx.fillRect(-r * 0.62, -r * 0.62, r * 1.24, r * 1.24);

    // A thin bright highlight along the "raised metal lip" edge.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,244,214,0.5)';
    ctx.beginPath();
    ctx.moveTo(-r * 0.72, r * 0.1);
    ctx.lineTo(-r * 0.72, -r * 0.72);
    ctx.lineTo(r * 0.1, -r * 0.72);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.6)';
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);

    ctx.restore();
    canvas.refresh();
  }

  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = 120;
    const canvas = this.scene.textures.createCanvas(GLOW_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
