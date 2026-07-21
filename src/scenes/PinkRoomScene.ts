import Phaser from 'phaser';
import backgroundUrl from '../../assets/images/PinkRoom/Background_Room2.png';
import PinkCrystal from '../game/PinkCrystal';
import Doorway from '../game/Doorway';
import EquivalencePuzzle from '../game/EquivalencePuzzle';
import CrystalHolder from '../game/CrystalHolder';
import { getPinkRoomState } from '../game/GameState';

const BACKGROUND_KEY = 'pink-room-background';
// Raised from an earlier 3 so the equivalence puzzle's rings (which sit
// at offsets well below this value — see EquivalencePuzzle.ts) have room
// beneath the crystal's own internal layers (which span
// CRYSTAL_DEPTH-2..CRYSTAL_DEPTH+1) without colliding with them.
const CRYSTAL_DEPTH = 8;

// Measured directly from Background_Room2.png (1536x1024 source): the
// pedestal's glowing point — the background does not contain a real
// crystal object, only a thin placeholder light beam with a bright tip
// standing in for one. The separate pink.png crystal takes that visual
// role instead.
const CRYSTAL_CENTER_X = 768;
const CRYSTAL_CENTER_Y = 560;
const CRYSTAL_HEIGHT_BG = 140;

// Exit back to the Central Hall: the background already has a lit
// archway painted in (top-left, with steps) — reusing that real
// architecture rather than drawing a new doorway. Same invisible-zone +
// soft hover-glow technique (Doorway.ts) already used for the Central
// Hall's own doorway, measured directly from the archway opening.
const EXIT_CENTER_X = 193;
const EXIT_CENTER_Y = 338;
const EXIT_SIZE = { widthBg: 190, heightBg: 480 };

// Entry: arrive at a slightly closer zoom and a brief darkened overlay —
// continuing the Central Hall's own threshold-crossing — then settle to
// normal room framing. Same technique as HiddenPassageScene's entry.
const ENTRY_START_ZOOM = 1.4;
const ENTRY_START_OVERLAY_ALPHA = 0.7;
const ENTRY_SETTLE_DURATION_MS = 650; // within 500-800

// Return transition: short, single-phase.
const EXIT_FADE_MS = 400;
const OVERLAY_DEPTH = 90;

/**
 * The Pink Room: background, animated crystal centerpiece, and a
 * doorway back to the Central Hall (the background's own painted
 * archway, made interactive). No puzzle logic or crystal interactivity
 * yet — this sprint is scoped to arrival, the crystal, and the return
 * path.
 */
export default class PinkRoomScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private crystal?: PinkCrystal;
  private puzzle?: EquivalencePuzzle;
  private exit?: Doorway;
  private crystalHolder?: CrystalHolder;
  private overlay?: Phaser.GameObjects.Rectangle;
  private backgroundScale = 1;
  private isReturning = false;

  constructor() {
    super('PinkRoomScene');
  }

  preload(): void {
    this.load.image(BACKGROUND_KEY, backgroundUrl);
    PinkCrystal.preload(this);
  }

  create(): void {
    // Locked immediately, before anything else runs — released once
    // playEntryAnimation()'s settle finishes.
    this.input.enabled = false;
    // Phaser reuses this Scene instance across stop()/start() — without
    // this reset, leaving once via the exit would leave isReturning
    // permanently true, silently breaking the exit door on every later
    // revisit (returnToCentralHall() would just no-op forever).
    this.isReturning = false;

    this.createRoomEnvironment();
    this.createEquivalencePuzzle();
    this.createExitToCentralHall();

    // Persistent cross-scene crystal pouch — reads shared state fresh
    // every time this scene is created, never local Scene state.
    this.crystalHolder = new CrystalHolder(this);
    this.crystalHolder.create(OVERLAY_DEPTH - 10);
    if (this.puzzle) {
      this.puzzle.crystalHolder = this.crystalHolder;
    }

    this.layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.crystal?.destroy();
      this.puzzle?.destroy();
      this.crystalHolder?.destroy();
    });

    this.playEntryAnimation();
  }

  update(_time: number, delta: number): void {
    this.crystal?.update(delta);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.background) {
      return;
    }

    // Cover the window: proportional fill, cropping overflow instead of
    // stretching — same convention as CentralHallScene's background.
    this.backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setScale(this.backgroundScale).setPosition(width / 2, height / 2);

    const toScreenX = (bgX: number) =>
      width / 2 + (bgX - this.background!.width / 2) * this.backgroundScale;
    const toScreenY = (bgY: number) =>
      height / 2 + (bgY - this.background!.height / 2) * this.backgroundScale;

    this.crystal?.layout(toScreenX(CRYSTAL_CENTER_X), toScreenY(CRYSTAL_CENTER_Y), this.backgroundScale);
    // The puzzle mechanism anchors to the exact same crystal-center point
    // and cover-scale factor as the crystal itself — never computed from
    // raw viewport coordinates independently.
    this.puzzle?.layout(toScreenX(CRYSTAL_CENTER_X), toScreenY(CRYSTAL_CENTER_Y), this.backgroundScale);
    this.exit?.layout(toScreenX(EXIT_CENTER_X), toScreenY(EXIT_CENTER_Y), this.backgroundScale);

    this.overlay?.setSize(width, height);
  }

  // Depth order: background (0) < equivalence-puzzle mechanism (see
  // createEquivalencePuzzle(), depths well below CRYSTAL_DEPTH) <
  // crystal + its own reflected glow/glint/sparkles (CRYSTAL_DEPTH-2..+1)
  // < puzzle marker/check control (above that) < the screen-fixed
  // transition overlay, topmost of all.
  private createRoomEnvironment(): void {
    this.background = this.add.image(0, 0, BACKGROUND_KEY).setDepth(0);

    this.crystal = new PinkCrystal(this, { heightBg: CRYSTAL_HEIGHT_BG });
    this.crystal.create(CRYSTAL_DEPTH);

    // Fixed-to-screen (scrollFactor 0) mask, shared by the entry settle
    // and the exit transition.
    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(ENTRY_START_OVERLAY_ALPHA)
      .setScrollFactor(0);
  }

  // The fraction/decimal/percent equivalence puzzle: three rotating rings
  // around the crystal, a fixed marker, a check control, a crystal-code
  // panel, and per-round intro popups. Anchored to the same crystal-
  // center point/scale the crystal itself uses (see layout()). If the
  // puzzle was already completed in an earlier visit, jumps straight to
  // the finished state instead of replaying it; otherwise stays fully
  // inert until playEntryAnimation() settles and calls beginPuzzle().
  private createEquivalencePuzzle(): void {
    if (!this.crystal) {
      return;
    }
    this.puzzle = new EquivalencePuzzle(this, this.crystal);
    this.puzzle.create(CRYSTAL_DEPTH);
    this.puzzle.onComplete = () => this.exit?.setActive(true);

    if (getPinkRoomState(this.registry).completed) {
      this.puzzle.restoreCompleted();
    }
  }

  // The room's one other interactive object: the background's own
  // painted archway, made clickable (invisible hit zone + soft hover
  // glow, hand cursor) rather than a floating UI button or a newly-drawn
  // doorway. Locked until the puzzle is solved — revealed by
  // EquivalencePuzzle's onComplete callback (or immediately here, if the
  // puzzle was already completed in an earlier visit).
  private createExitToCentralHall(): void {
    this.exit = new Doorway(this, EXIT_SIZE);
    this.exit.create();
    this.exit.setActive(getPinkRoomState(this.registry).completed);
    this.exit.onActivate = () => this.returnToCentralHall();
  }

  // Arrive at a slightly closer zoom with a brief darkened overlay, then
  // settle to the room's normal framing. Input stays locked until the
  // settle finishes. The background/crystal are already fully visible
  // from the first frame — only the camera/overlay animate.
  private playEntryAnimation(): void {
    const camera = this.cameras.main;
    camera.setZoom(ENTRY_START_ZOOM);

    this.tweens.add({
      targets: camera,
      zoom: 1,
      duration: ENTRY_SETTLE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: ENTRY_SETTLE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    this.time.delayedCall(ENTRY_SETTLE_DURATION_MS, () => {
      this.input.enabled = true;
      this.puzzle?.beginPuzzle();
    });
  }

  // Short transition back to the Central Hall. The hall's own statue/
  // lever/entrance state is preserved via the existing registry flag
  // CentralHallScene already checks on create() — nothing scene-specific
  // needed here, that mechanism works regardless of which room sends the
  // player back.
  private returnToCentralHall(): void {
    if (this.isReturning) {
      return;
    }
    this.isReturning = true;
    this.input.enabled = false;
    this.exit?.setActive(false);

    this.cameras.main.fadeOut(EXIT_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('CentralHallScene');
    });
  }
}
