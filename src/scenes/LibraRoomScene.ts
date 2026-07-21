import Phaser from 'phaser';
import backgroundUrl from '../../assets/images/LibraRoom/Background_Libra.png';
import Doorway from '../game/Doorway';
import LibraPuzzle from '../game/LibraPuzzle';
import CrystalHolder from '../game/CrystalHolder';
import { getLibraRoomState } from '../game/GameState';

const BACKGROUND_KEY = 'libra-room-background';
const PUZZLE_DEPTH = 5;

// Exit back to the Central Hall: Background_Libra.png already has a lit
// stone archway + stairway painted in on the right side — reusing that
// real architecture (Doorway's invisible-zone + hover-glow technique)
// rather than drawing a new doorway, same approach PinkRoomScene already
// takes for its own painted archway. Measured directly from the
// background art (1536x1024 source).
const EXIT_CENTER_X = 1360;
const EXIT_CENTER_Y = 420;
const EXIT_SIZE = { widthBg: 170, heightBg: 430 };

// Entry: arrive at a closer zoom with a brief darkened overlay —
// continuing the Central Hall floor seal's own descent — then settle to
// normal room framing. Same technique as PinkRoomScene/HiddenPassageScene.
const ENTRY_START_ZOOM = 1.5;
const ENTRY_START_OVERLAY_ALPHA = 0.85;
const ENTRY_SETTLE_DURATION_MS = 650;

// Return transition: short, single-phase, matching PinkRoomScene's own
// return-to-hall treatment.
const EXIT_FADE_MS = 400;
const OVERLAY_DEPTH = 90;

/**
 * The Libra Room: reached only through the Central Hall's hidden floor
 * seal (see FloorEntrance.ts / CentralHallScene.enterLibraRoomFromFloor())
 * — never from the Pink Room. Uses the real Background_Libra.png art (an
 * already-painted chamber centered on a giant crystal balance scale), so
 * unlike HiddenPassageScene's first pass, no procedural backdrop is
 * needed here. No puzzle logic yet — this sprint is scoped to arrival
 * and the return path, matching how PinkRoomScene/HiddenPassageScene
 * were both first introduced.
 */
export default class LibraRoomScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private exit?: Doorway;
  private puzzle?: LibraPuzzle;
  private crystalHolder?: CrystalHolder;
  private overlay?: Phaser.GameObjects.Rectangle;
  private backgroundScale = 1;
  private isReturning = false;

  constructor() {
    super('LibraRoomScene');
  }

  preload(): void {
    this.load.image(BACKGROUND_KEY, backgroundUrl);
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

    this.background = this.add.image(0, 0, BACKGROUND_KEY).setDepth(0);

    this.exit = new Doorway(this, EXIT_SIZE);
    this.exit.create();
    this.exit.onActivate = () => this.returnToCentralHall();

    // Fixed-to-screen (scrollFactor 0) mask, shared by the entry settle
    // and the exit transition — same technique as every other room scene.
    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(ENTRY_START_OVERLAY_ALPHA)
      .setScrollFactor(0);

    // The five-question balance puzzle. Locked/inert until the puzzle
    // is actually complete — the exit only becomes clickable via
    // onCompleted below (or immediately, if already completed on a
    // previous visit).
    this.puzzle = new LibraPuzzle(this);
    this.puzzle.createLibraPuzzle(PUZZLE_DEPTH);
    this.puzzle.onCompleted = () => {
      this.exit?.setActive(true);
      // "Make it obvious the doorway must now be clicked" — stops itself
      // automatically the instant the player actually clicks it.
      this.exit?.startAttentionPulse();
    };

    // Persistent cross-scene crystal pouch — reads shared state fresh
    // every time this scene is created, never local Scene state.
    this.crystalHolder = new CrystalHolder(this);
    this.crystalHolder.create(OVERLAY_DEPTH - 10);
    this.puzzle.crystalHolder = this.crystalHolder;

    if (getLibraRoomState(this.registry).completed) {
      this.puzzle.restoreCompleted();
      this.exit.setActive(true);
      // "On re-entry after completion, the doorway must already be
      // unlocked and glowing" — no animation replay, just already active.
      this.exit.startAttentionPulse();
    } else {
      this.exit.setActive(false);
    }

    this.layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.puzzle?.destroy();
      this.crystalHolder?.destroy();
    });

    this.playEntryAnimation();
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.background) {
      return;
    }

    // Cover the window: proportional fill, cropping overflow instead of
    // stretching — same convention as every other room's background.
    this.backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setScale(this.backgroundScale).setPosition(width / 2, height / 2);

    const toScreenX = (bgX: number) =>
      width / 2 + (bgX - this.background!.width / 2) * this.backgroundScale;
    const toScreenY = (bgY: number) =>
      height / 2 + (bgY - this.background!.height / 2) * this.backgroundScale;

    this.exit?.layout(toScreenX(EXIT_CENTER_X), toScreenY(EXIT_CENTER_Y), this.backgroundScale);
    this.puzzle?.layout(toScreenX, toScreenY, this.backgroundScale);

    this.overlay?.setSize(width, height);
  }

  // Arrive at a closer zoom with a brief darkened overlay, then settle to
  // the room's normal framing — continuing the floor seal's own descent
  // rather than cutting cleanly. Input stays locked until the settle
  // finishes.
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

  // Short transition back to the Central Hall. The hall's own floor-seal
  // (and statue/lever/entrance) state is preserved via the existing
  // registry flags CentralHallScene already checks on create() — nothing
  // scene-specific needed here, that mechanism works regardless of which
  // room sends the player back.
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
