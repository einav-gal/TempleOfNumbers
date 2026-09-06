import Phaser from 'phaser';
import backgroundUrl from '../../assets/images/central-hall/background-without-wheel.png';
import mobileBackgroundUrl from '../../assets/images/central-hall/central-hall-mobile.png';
import potUrl from '../../assets/images/central-hall/Pot/pot.png';
import HeartOfTheTemple from '../game/HeartOfTheTemple';
import Atmosphere from '../game/Atmosphere';
import AmbienceAudio from '../game/AmbienceAudio';
import Pot from '../game/Pot';
import Handle from '../game/Handle';
import Statue from '../game/Statue';
import Entrance from '../game/Entrance';
import FloorEntrance from '../game/FloorEntrance';
import IntroOverlay from '../game/IntroOverlay';
import CrystalHolder from '../game/CrystalHolder';
import WallWheel from '../game/WallWheel';
import MobilePinchZoom from '../game/MobilePinchZoom';
import FixedUiCamera from '../game/FixedUiCamera';
import CrystalPlacementMode from '../game/CrystalPlacementMode';
import HintSystem from '../game/HintSystem';
import {
  hasSeenGameIntro,
  markGameIntroSeen,
  areAllCrystalsCollected,
  areAllCrystalsPlaced,
  isLeftStatuePassageOpen,
  setLeftStatuePassageOpen,
  isFloorEntranceOpen,
  setFloorEntranceOpen,
  isWallWheelOpen,
  setWallWheelOpen,
} from '../game/GameState';
import { createRtlText } from '../game/rtlText';
import { isEnvelopScaleMode, ENVELOP_EXTRA_ZOOM_FACTOR, isMobileDevice } from '../game/scaleMode';
import handleUrl from '../../assets/images/central-hall/handle/handle.png';
// Photoshop-matched statue variant, hand-graded to match the background's
// lighting/contrast/warmth. Replaces the earlier procedurally-blended
// variant; the original statue.png is kept on disk untouched.
import statueUrl from '../../assets/images/central-hall/statue/left-statue-background-matched.png';

const BACKGROUND_KEY = 'central-hall-background';
const MOBILE_BACKGROUND_KEY = 'central-hall-mobile-background';
const POT_KEY = 'central-hall-pot';
const HANDLE_KEY = 'central-hall-handle';
const STATUE_KEY = 'central-hall-statue';
const FADE_IN_DURATION_MS = 1200;
const POT_DEPTH = 4;
const HANDLE_DEPTH = 3;
const STATUE_DEPTH = 2;
const WALL_WHEEL_DEPTH = 2;

// Anchor measured in background-image pixels (1536x1024 source): the center
// of the pedestal's circular top surface. The Heart of the Temple derives
// all of its positioning from this point, so it stays glued to the pedestal
// at any window size.
const PEDESTAL_CENTER_X = 762;
const PEDESTAL_CENTER_Y = 775;

// Interactive pot: floor-contact point and target display height (full
// source image, leaves included), measured in background-image pixels.
// Placed beside the left statue, over the cleaned area where the painted
// pot used to be.
const POT_BASE_X = 430;
const POT_BASE_Y = 700;
const POT_HEIGHT_BG = 117;

// Hidden handle: mounted on the left statue's pedestal face, revealed once
// the pot has fallen clear of the area.
const HANDLE_CENTER_X = 470;
const HANDLE_CENTER_Y = 655;
const HANDLE_WIDTH_BG = 55;

// Left statue sprite: the niche's true floor-contact point (pedestal base,
// measured from the Photoshop reference) and target display height
// (helmet-tip to pedestal-base). This is the intended floor line itself —
// any asset-specific bottom padding is compensated for inside Statue.ts,
// not here.
const STATUE_CENTER_X = 504;
const STATUE_BASE_Y = 695;
const STATUE_HEIGHT_BG = 382;

// Duration of the statue's simulated vertical-axis turn (see Statue.open()).
const STATUE_TURN_DURATION_MS = 1100;

// Hidden entrance behind the left statue: no dedicated asset exists
// anywhere under assets/images/central-hall, so Entrance draws a
// TEMPORARY placeholder arch (see Entrance.ts). Shares the statue's
// floor anchor so it sits centered in the same niche.
const ENTRANCE_DEPTH = 1;
const ENTRANCE_SIZE = { widthBg: 145, heightBg: 300 };

// Hidden floor entrance to the Libra Room: a floor-tile segment on the
// flat hall floor to the right of the central platform, clear of the
// raised step tiers and the platform edge — inside the outer circular
// floor band, between the platform and the right-side statue/doorway.
// Measured visually from background.png. Currently a temporary
// Phaser-Graphics placeholder (no image assets) — see FloorEntrance.ts.
const FLOOR_ENTRANCE_DEPTH = 1;
const FLOOR_ENTRANCE_CENTER_X = 1160;
const FLOOR_ENTRANCE_CENTER_Y = 830;
const FLOOR_ENTRANCE_WIDTH_BG = 140;

// "Pass through the doorway" transition, in two phases (see
// enterThroughLeftDoor()):
//   Phase 1 — approach: center on the doorway's actual OPENING (not the
//     whole frame image) and zoom until it dominates the viewport while
//     the stone frame is still visible.
//   Phase 2 — cross the threshold: zoom further, more aggressively, until
//     the frame's edges are pushed past the viewport and only the dark
//     opening remains on screen — the visual bridge into the next scene.
// A brief, never-fully-opaque overlay masks just the moment of the scene
// cut. All targets are computed at click-time from the entrance's real
// current bounds/viewport (not fixed constants), so it stays responsive.
const PHASE1_DURATION_MS = 800;
const PHASE1_FILL_FRACTION = 0.6;
const PHASE2_DURATION_MS = 500;
const PHASE2_FRAME_OVERSHOOT = 1.25;
const PHASE2_MAX_ZOOM = 8;
const OVERLAY_DURATION_MS = 150;
const OVERLAY_PEAK_ALPHA = 0.8;
const OVERLAY_DEPTH = 90;

// Stair-opening hand-off (see enterLibraRoomThroughStairs()): pans/zooms
// this hall's own camera onto the real opened-stair bounds (never a
// hard-coded screen point) until the opening fills most of the
// viewport, then a brief, never-fully-opaque flash — not a black
// fade — bridges into LibraStaircaseScene, which starts already framed
// to match this hall's final camera position/zoom (see
// LibraStaircaseScene's own START_FILL_FRACTION).
const STAIR_ZOOM_DURATION_MS = 850;
const STAIR_FILL_FRACTION = 0.75;
const STAIR_ZOOM_MAX = 6;
const STAIR_CROSSFADE_MS = 120;
const STAIR_CROSSFADE_PEAK_ALPHA = 0.55;

const POPUP_TEXT = 'לב המקדש רדום.';
// Shown automatically once the crystal shatters (see
// heart.onMechanismShattered wiring in create()) — the game's actual
// "you won" message. Nothing further (credits, a real ending scene,
// reset) is built beyond this message — a separate, future task.
const FINAL_STAGE_POPUP_TEXT = 'הצלחתם לצאת מהמקדש!';

// The project has no shared game-state system yet; scene.start() fully
// recreates a Scene from scratch, so anything the player already did
// (pot fallen, lever pulled, statue open) would otherwise be lost on
// return from whichever room the entrance leads to (currently
// PinkRoomScene). Persisted via GameState.ts's isLeftStatuePassageOpen()/
// setLeftStatuePassageOpen() (Phaser's own registry, not a second,
// competing state system) — read regardless of the return path, so it
// doesn't need to change if the destination does.

// Separate circular wall mechanism, measured in the 1536x1024 Central Hall
// background. The visible wheel is centered over the circular brick recess.
const WALL_WHEEL_CENTER_X = 768;
const WALL_WHEEL_CENTER_Y = 286;
const WALL_WHEEL_WIDTH_BG = 185;

// Dedicated panoramic composition used only by /mobile/. Coordinates are
// measured in the 1870x841 mobile background. Desktop continues to use
// every original constant above unchanged.
const MOBILE_HALL = {
  pedestal: { x: 935, y: 565 },
  statue: { x: 420, baseY: 515, heightBg: 360 },
  entrance: { widthBg: 155, heightBg: 315 },
  pot: { x: 500, baseY: 535, heightBg: 125 },
  handle: { x: 475, y: 455, widthBg: 64 },
  wheel: { x: 1182, y: 215, widthBg: 205 },
  floorEntrance: { x: 1260, y: 700, widthBg: 210 },
} as const;

const WHEEL_ENTRY_DURATION_MS = 850;
const WHEEL_ENTRY_FILL_FRACTION = 0.7;
const WHEEL_ENTRY_MAX_ZOOM = 5;

export default class CentralHallScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private heart?: HeartOfTheTemple;
  private atmosphere?: Atmosphere;
  private ambience = new AmbienceAudio();
  private pot?: Pot;
  private handle?: Handle;
  private statue?: Statue;
  private entrance?: Entrance;
  private floorEntrance?: FloorEntrance;
  private intro?: IntroOverlay;
  private crystalHolder?: CrystalHolder;
  private wallWheel?: WallWheel;
  private pinchZoom?: MobilePinchZoom;
  private fixedUiCamera?: FixedUiCamera;
  private crystalPlacementMode?: CrystalPlacementMode;
  private hintSystem?: HintSystem;
  // Independent per-destination transition guards — never one shared
  // lock. Each is reset to false at the top of create() (Phaser reuses
  // this Scene instance across stop()/start(), so without the reset a
  // flag set true on the way out of the hall would stay true forever,
  // permanently blocking that destination — and previously all of them,
  // since they used to share a single `leavingHall` flag).
  private isEnteringPinkRoom = false;
  private isEnteringLibraRoom = false;
  private isEnteringRoom3 = false;
  private backgroundScale = 1;
  private mobileLayout = false;
  private popup?: Phaser.GameObjects.Container;
  private popupOverlay?: Phaser.GameObjects.Rectangle;
  private lastPopupToggleAt = -Infinity;
  private overlay?: Phaser.GameObjects.Rectangle;

  constructor() {
    super('CentralHallScene');
  }

  preload(): void {
    if (isMobileDevice(this)) {
      this.load.image(MOBILE_BACKGROUND_KEY, mobileBackgroundUrl);
    } else {
      this.load.image(BACKGROUND_KEY, backgroundUrl);
    }
    this.load.image(POT_KEY, potUrl);
    this.load.image(HANDLE_KEY, handleUrl);
    this.load.image(STATUE_KEY, statueUrl);
    HeartOfTheTemple.preload(this);
    WallWheel.preload(this);
    if (!isMobileDevice(this)) {
      Atmosphere.preload(this);
    }
    IntroOverlay.preload(this);
  }

  create(): void {
    // Phaser reuses the same Scene instance across stop()/start() —
    // without this, returning here after the stair camera zoomed/panned
    // away (see enterLibraRoomThroughStairs()) would restart the hall
    // still zoomed into wherever that camera move last left off.
    this.cameras.main.setZoom(1).setScroll(0, 0);

    // Same Scene-instance-reuse reasoning: `this.input.enabled` and the
    // three transition guards below are plain fields that survive
    // stop()/start() — every exit path sets input.enabled=false and its
    // own guard true right before leaving, and nothing previously ever
    // reset them back on return, so the hall would come back permanently
    // input-locked (or with a stale guard blocking one destination) from
    // the second visit onward.
    this.input.enabled = true;
    this.isEnteringPinkRoom = false;
    this.isEnteringLibraRoom = false;
    this.isEnteringRoom3 = false;
    this.mobileLayout = isMobileDevice(this);

    this.background = this.add.image(
      0,
      0,
      this.mobileLayout ? MOBILE_BACKGROUND_KEY : BACKGROUND_KEY,
    );

    this.wallWheel = new WallWheel(this, {
      widthBg: this.mobileLayout ? MOBILE_HALL.wheel.widthBg : WALL_WHEEL_WIDTH_BG,
    });
    this.wallWheel.create(WALL_WHEEL_DEPTH);
    this.wallWheel.onOpened = () => setWallWheelOpen(this.registry);
    this.wallWheel.onActivate = () => this.enterRoom3ThroughWheel();

    // Plain full-viewport rectangle, fixed to screen (scrollFactor 0) so
    // it stays flat rather than panning/zooming with the world — used
    // only as the brief mask right at the moment enterThroughLeftDoor()
    // cuts to the next scene, never held at full opacity.
    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(0)
      .setScrollFactor(0);

    // Persistent cross-scene crystal pouch — reads shared state fresh
    // every time this scene is created (see CrystalHolder.refresh()),
    // never local Scene state. Depth kept below the transition overlay
    // so it never shows through a scene-cut.
    this.crystalHolder = new CrystalHolder(this);
    this.crystalHolder.create(OVERLAY_DEPTH - 10);

    // Small always-in-the-corner "hint" button for the hall's three hidden
    // discovery targets (pot, floor tile, wall wheel) — hides itself
    // whenever nothing is currently pending; see HintSystem.ts.
    this.hintSystem = new HintSystem(this);
    this.hintSystem.create();

    // Stage 1 of "return the crystals": only exists at all once every
    // crystal has actually been collected (same shared registry state
    // CrystalHolder already reads, never a parallel tracker) — otherwise
    // the hall behaves exactly as before, with nothing extra created.
    if (areAllCrystalsCollected(this.registry)) {
      this.crystalPlacementMode = new CrystalPlacementMode(this);
      this.crystalPlacementMode.create();
      this.crystalPlacementMode.onCrystalPlaced = (crystalId) => this.heart?.playActivationNudge(crystalId);
      // Avoid showing the same collected crystals at full strength twice —
      // the pouch was never actually clickable, so this only dims its
      // look; CrystalPlacementMode is now "the" active crystal display.
      this.crystalHolder?.setDimmed(true);
    }

    // Mobile uses a single fixed composition: every discovery target is
    // positioned inside the visible frame, so no pinch or panorama
    // controls are needed. Desktop keeps its existing pinch interaction.
    if (!this.mobileLayout) {
      this.pinchZoom = new MobilePinchZoom(this);
      this.pinchZoom.create();
    }

    this.heart = new HeartOfTheTemple(this);
    this.heart.create();
    // "Restore, don't replay" — same pattern as Statue/Entrance/FloorEntrance:
    // if every crystal was already placed on a previous visit, jump
    // straight to the fully-open end state (before the first layout()
    // call below) instead of showing the caged mechanism and re-animating.
    if (areAllCrystalsPlaced(this.registry)) {
      this.heart.restoreOpen();
    }
    // Only ever fires while the crystal is still caged and visible — once
    // it shatters it's disabled and hidden, so there's nothing left for
    // this to be called for.
    this.heart.onCrystalClick = () => this.openPopup();
    // The actual "you won" message — fires once, automatically, a beat
    // after the crystal shatters (never on the restoreOpen() "already
    // resolved" path above, so a returning visit never replays it).
    this.heart.onMechanismShattered = () => this.openFinalStagePopup();

    // The mobile panoramic artwork already contains its own torches.
    // Keeping the animated desktop fire there would create duplicates.
    if (!this.mobileLayout) {
      this.atmosphere = new Atmosphere(this);
      this.atmosphere.create();
    }

    // Created before the statue so it renders behind it at every step
    // (ENTRANCE_DEPTH < STATUE_DEPTH); starts fully transparent and
    // non-interactive until the statue has fully opened.
    this.entrance = new Entrance(
      this,
      this.mobileLayout ? MOBILE_HALL.entrance : ENTRANCE_SIZE,
    );
    this.entrance.create(ENTRANCE_DEPTH);
    this.entrance.onActivate = () => this.enterThroughLeftDoor();

    this.statue = new Statue(this, STATUE_KEY, {
      heightBg: this.mobileLayout ? MOBILE_HALL.statue.heightBg : STATUE_HEIGHT_BG,
    });
    this.statue.create(STATUE_DEPTH);

    this.handle = new Handle(this, HANDLE_KEY, {
      widthBg: this.mobileLayout ? MOBILE_HALL.handle.widthBg : HANDLE_WIDTH_BG,
    });
    this.handle.create(HANDLE_DEPTH);
    this.handle.onActivate = () => this.openStatueEntrance();

    this.pot = new Pot(this, POT_KEY, {
      heightBg: this.mobileLayout ? MOBILE_HALL.pot.heightBg : POT_HEIGHT_BG,
    });
    this.pot.create(POT_DEPTH);
    this.pot.onMoved = () => this.handle?.reveal();

    // If the player already completed the pot → lever → statue → entrance
    // sequence on a previous visit, jump straight to that end state
    // instead of replaying it — before the first layout() call, so
    // nothing flashes through its closed/default appearance first.
    if (isLeftStatuePassageOpen(this.registry)) {
      this.pot.restoreFallen();
      this.handle.restoreActivated();
      this.statue.restoreOpen();
      this.entrance.restoreRevealed();
    }

    // Hidden floor entrance to the Libra Room — entirely separate from
    // the pot/lever/statue/entrance sequence above, and never reachable
    // through it or through the Pink Room itself. Visible, glowing, and
    // clickable from the moment create() runs (see FloorEntrance.create())
    // — not gated behind any other room's progress or reward.
    this.floorEntrance = new FloorEntrance(this, {
      widthBg: this.mobileLayout ? MOBILE_HALL.floorEntrance.widthBg : FLOOR_ENTRANCE_WIDTH_BG,
    });
    this.floorEntrance.create(FLOOR_ENTRANCE_DEPTH);
    this.floorEntrance.onOpened = () => setFloorEntranceOpen(this.registry);
    this.floorEntrance.onActivate = () => this.enterLibraRoomThroughStairs();

    // If the seal was already opened on a previous visit, jump straight
    // to that state instead of replaying the opening animation. Runs
    // after this.layout() below (not here) so the hit-area/visual sizing
    // is already correct at real screen scale.

    // The opening message is a GAME intro, not a room-specific one — it
    // must appear exactly once per game session, tracked in the shared
    // registry (not a local Scene field, which would reset every time
    // this Scene restarts on a return trip from Pink Room/Libra Room).
    if (hasSeenGameIntro(this.registry)) {
      // Phaser reuses the same Scene instance across stop()/start()
      // cycles rather than constructing a fresh one — without this,
      // `this.intro` would retain whatever (now-destroyed) value a
      // previous create() left it as, and layout() below would call
      // .layout() on a dead GameObject and crash.
      this.intro = undefined;
      this.heart.setSuppressed(false);
      this.pot.setActive(true);
    } else {
      // Hall interactions stay disabled until the intro overlay is dismissed.
      this.heart.setSuppressed(true);
      this.pot.setActive(false);
      this.pinchZoom?.disable();

      this.intro = new IntroOverlay(this);
      this.intro.create();
      this.intro.onDismissed = () => {
        markGameIntroSeen(this.registry);
        this.heart?.setSuppressed(false);
        this.pot?.setActive(true);
        this.pinchZoom?.enable();
      };
    }

    // Room transitions and desktop pinch gestures move the world camera. Phaser's
    // scrollFactor(0) alone does not opt UI out of that zoom, so route all
    // fixed UI through a stable second camera before the first layout can
    // focus a hotspot.
    if (this.mobileLayout) {
      this.fixedUiCamera = new FixedUiCamera(this);
      this.fixedUiCamera.create();
    }

    // Audio may only start after a user gesture.
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => this.ambience.start());

    // Closes the popup on any click; openPopup/closePopup guard against the
    // duplicate pointer events some environments synthesize per click.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.closePopup, this);

    this.layout(this.scale.width, this.scale.height);

    if (isFloorEntranceOpen(this.registry)) {
      this.floorEntrance?.restoreOpen();
    }

    if (isWallWheelOpen(this.registry)) {
      this.wallWheel?.restoreOpen();
    }

    // Final, authoritative pass — every return path (Pink Room, Libra
    // Room, or the puzzle placeholder) re-enters through this same
    // create(), so this always runs regardless of where the player is
    // coming back from.
    this.restoreCentralHallInteractions();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.statue?.destroy();
      this.floorEntrance?.destroy();
      this.crystalHolder?.destroy();
      this.wallWheel?.destroy();
      this.pinchZoom?.destroy();
      this.fixedUiCamera?.destroy();
      this.crystalPlacementMode?.destroy();
      this.hintSystem?.destroy();
    });

    this.cameras.main.fadeIn(FADE_IN_DURATION_MS, 0, 0, 0);
    this.fixedUiCamera?.fadeIn(FADE_IN_DURATION_MS, 0, 0, 0);
  }

  /**
   * Single focused place deciding "what should be clickable right now" —
   * called once at the end of every create() (i.e. on every return to
   * the hall, from any room). Restores exactly the persistent states
   * (intro seen, statue open, floor entrance open) rather than
   * unconditionally enabling everything, and never touches unrelated
   * listeners (no removeAllListeners()/broad cleanup of any kind).
   */
  private restoreCentralHallInteractions(): void {
    this.input.enabled = true;
    this.overlay?.setAlpha(0);

    const introSeen = hasSeenGameIntro(this.registry);
    this.pot?.setActive(introSeen);

    if (isLeftStatuePassageOpen(this.registry)) {
      this.entrance?.setActive(true);
    }
    // The floor entrance manages its own interactivity/hit-area state
    // internally (see FloorEntrance.restoreOpen(), already called above
    // when applicable) — nothing further needed here.
  }

  update(_time: number, delta: number): void {
    this.heart?.update(delta);
    this.atmosphere?.update(delta);
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.background) {
      return;
    }

    // Mobile fits the panoramic artwork to the full logical height. Its
    // resulting width is intentionally larger than the viewport and the
    // camera pans across it. Desktop retains the original cover formula.
    this.backgroundScale = this.mobileLayout
      ? height / this.background.height
      : Math.max(width / this.background.width, height / this.background.height) *
        (isEnvelopScaleMode(this) ? ENVELOP_EXTRA_ZOOM_FACTOR : 1);
    this.background
      .setScale(this.backgroundScale)
      .setPosition(width / 2, height / 2);

    const toScreenX = (bgX: number) => this.toScreenX(bgX, width);
    const toScreenY = (bgY: number) => this.toScreenY(bgY, height);

    this.pinchZoom?.setWorldBounds(
      new Phaser.Geom.Rectangle(
        toScreenX(0),
        toScreenY(0),
        toScreenX(this.background.width) - toScreenX(0),
        toScreenY(this.background.height) - toScreenY(0),
      ),
    );

    this.overlay?.setSize(width, height);

    const pedestal = this.mobileLayout
      ? MOBILE_HALL.pedestal
      : { x: PEDESTAL_CENTER_X, y: PEDESTAL_CENTER_Y };
    const statue = this.mobileLayout
      ? MOBILE_HALL.statue
      : { x: STATUE_CENTER_X, baseY: STATUE_BASE_Y };
    const handle = this.mobileLayout
      ? MOBILE_HALL.handle
      : { x: HANDLE_CENTER_X, y: HANDLE_CENTER_Y };
    const pot = this.mobileLayout
      ? MOBILE_HALL.pot
      : { x: POT_BASE_X, baseY: POT_BASE_Y };
    const wheel = this.mobileLayout
      ? MOBILE_HALL.wheel
      : { x: WALL_WHEEL_CENTER_X, y: WALL_WHEEL_CENTER_Y };
    const floorEntrance = this.mobileLayout
      ? MOBILE_HALL.floorEntrance
      : { x: FLOOR_ENTRANCE_CENTER_X, y: FLOOR_ENTRANCE_CENTER_Y };

    this.wallWheel?.layout(toScreenX(wheel.x), toScreenY(wheel.y), this.backgroundScale);

    this.heart?.layout(
      toScreenX(pedestal.x),
      toScreenY(pedestal.y),
      this.backgroundScale,
    );

    this.atmosphere?.layout(width, height, {
      x: toScreenX,
      y: toScreenY,
      scale: this.backgroundScale,
    });

    this.statue?.layout(toScreenX(statue.x), toScreenY(statue.baseY), this.backgroundScale);

    // Shares the statue's floor anchor so the opening stays centered in
    // the same niche at any window size.
    this.entrance?.layout(toScreenX(statue.x), toScreenY(statue.baseY), this.backgroundScale);

    this.handle?.layout(toScreenX(handle.x), toScreenY(handle.y), this.backgroundScale);

    this.pot?.layout(toScreenX(pot.x), toScreenY(pot.baseY), this.backgroundScale);

    this.floorEntrance?.layout(
      toScreenX(floorEntrance.x),
      toScreenY(floorEntrance.y),
      this.backgroundScale,
    );

    this.crystalPlacementMode?.layout(toScreenX, toScreenY, this.backgroundScale);
    this.crystalHolder?.layout();
    this.hintSystem?.layout();

    this.intro?.layout(width, height);

    if (this.popup && this.popupOverlay) {
      this.popup.setPosition(width / 2, height / 2);
      this.popupOverlay.setSize(width, height);
      this.popupOverlay.setPosition(-width / 2, -height / 2);
    }
  }

  // Maps a background-image-pixel coordinate to current screen space,
  // through the same cover-scale transform layout() uses. Also used by
  // enterThroughLeftDoor() to compute the doorway's pan target/on-screen
  // size from its actual bounds.
  private toScreenX(bgX: number, width = this.scale.width): number {
    return width / 2 + (bgX - (this.background?.width ?? 0) / 2) * this.backgroundScale;
  }

  private toScreenY(bgY: number, height = this.scale.height): number {
    return height / 2 + (bgY - (this.background?.height ?? 0) / 2) * this.backgroundScale;
  }

  private openPopup(): void {
    if (this.popup || this.time.now - this.lastPopupToggleAt < 300) {
      return;
    }
    this.lastPopupToggleAt = this.time.now;

    const width = this.scale.width;
    const height = this.scale.height;

    this.popup = this.add.container(width / 2, height / 2).setDepth(100);

    // Dim the hall while the popup is open — interactive (even with no
    // listener of its own) so it actually intercepts clicks at the
    // Phaser hit-testing level, rather than letting them pass through to
    // whatever's underneath in world space (e.g. the crystal itself,
    // which sits roughly centered like this popup) while the scene-wide
    // dismiss listener (closePopup(), see create()) closes the popup.
    // Without this, a click on the popup could simultaneously close it
    // AND re-open it (or open a different popup) via that same click
    // reaching the crystal's own handler underneath.
    this.popupOverlay = this.add
      .rectangle(-width / 2, -height / 2, width, height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setInteractive();
    this.popup.add(this.popupOverlay);

    this.heart?.setSuppressed(true);

    const panelWidth = Math.min(width * 0.85, 680);
    const panelHeight = 210;
    this.popup.add(this.drawStonePanel(panelWidth, panelHeight));

    const message = createRtlText(this, 0, -12, POPUP_TEXT, {
      fontSize: `${Math.max(22, Math.min(32, width * 0.024))}px`,
      color: '#d9cfae',
      align: 'center',
      wordWrap: { width: panelWidth - 80 },
    }).setOrigin(0.5);
    this.popup.add(message);

    const hint = createRtlText(this, 0, panelHeight / 2 - 34, '— לחצו לסגירה —', {
      fontSize: '22px',
      color: '#8a8068',
    }).setOrigin(0.5);
    this.popup.add(hint);

    this.popup.setAlpha(0);
    this.tweens.add({ targets: this.popup, alpha: 1, duration: 200 });

    // Background interaction locked while the popup is open — every
    // object locked here is explicitly re-enabled by
    // closePopupAndRestoreInput() below, never left to chance.
    this.pot?.setActive(false);
  }

  /**
   * Same popup shell as openPopup() (dim overlay, stone panel, suppress/
   * lock, fade-in), but with its own Hebrew RTL "you won" message — fires
   * automatically from heart.onMechanismShattered (see create()), never
   * from a click. Kept as its own method rather than parameterizing
   * openPopup() itself, so the dormant-crystal popup can't be affected by
   * this addition.
   */
  private openFinalStagePopup(): void {
    if (this.popup || this.time.now - this.lastPopupToggleAt < 300) {
      return;
    }
    this.lastPopupToggleAt = this.time.now;

    const width = this.scale.width;
    const height = this.scale.height;

    this.popup = this.add.container(width / 2, height / 2).setDepth(100);

    this.popupOverlay = this.add
      .rectangle(-width / 2, -height / 2, width, height, 0x000000, 0.5)
      .setOrigin(0, 0);
    this.popup.add(this.popupOverlay);

    this.heart?.setSuppressed(true);

    const panelWidth = Math.min(width * 0.85, 680);
    const panelHeight = 210;
    this.popup.add(this.drawStonePanel(panelWidth, panelHeight));

    const message = createRtlText(this, 0, -12, FINAL_STAGE_POPUP_TEXT, {
      fontSize: `${Math.max(22, Math.min(32, width * 0.024))}px`,
      color: '#d9cfae',
      align: 'center',
      wordWrap: { width: panelWidth - 80 },
    }).setOrigin(0.5);
    this.popup.add(message);

    const hint = createRtlText(this, 0, panelHeight / 2 - 34, '— לחצו לסגירה —', {
      fontSize: '22px',
      color: '#8a8068',
    }).setOrigin(0.5);
    this.popup.add(hint);

    this.popup.setAlpha(0);
    this.tweens.add({ targets: this.popup, alpha: 1, duration: 200 });

    this.pot?.setActive(false);
  }

  /**
   * Lever hand-off: turns the statue away and fades the entrance in
   * alongside it, over the same duration, so the opening reads as
   * progressively revealed rather than popping in once the turn ends.
   * The entrance only becomes clickable once the turn fully completes.
   */
  private openStatueEntrance(): void {
    this.entrance?.reveal(STATUE_TURN_DURATION_MS);
    this.statue?.open(STATUE_TURN_DURATION_MS, () => {
      this.entrance?.setActive(true);
      setLeftStatuePassageOpen(this.registry);
    });
  }

  /**
   * Entrance click hand-off: walks the camera through the doorway rather
   * than a plain zoom-and-fade cut. Disables the entrance immediately
   * (the lever is already permanently disabled after its one-time click,
   * since the entrance can't even become interactive before that) and
   * locks all scene input for the duration. Two phases (see the PHASE1
   * and PHASE2 constants above): approach the actual dark OPENING (not the whole
   * frame image) until it dominates the viewport with the frame still
   * visible, then zoom further/more aggressively until the frame's stone
   * edges are pushed off-screen and the opening is the only thing left —
   * the visual bridge into the next scene — followed by a brief,
   * never-fully-opaque overlay exactly as the scene switches. Only once
   * that overlay is timed to land does scene.start() fire — the camera
   * movement is always fully complete first. isTransitioningAway()
   * guards against repeated clicks and overlapping camera tweens from
   * any of the hall's exits, not just this one.
   */
  private enterThroughLeftDoor(): void {
    if (this.isTransitioningAway()) {
      return;
    }
    this.isEnteringPinkRoom = true;
    this.entrance?.setActive(false);
    this.input.enabled = false;

    const width = this.scale.width;
    const height = this.scale.height;
    const frameBaseX = this.toScreenX(STATUE_CENTER_X, width);
    const frameBaseY = this.toScreenY(STATUE_BASE_Y, height);
    const frameWidthScreen = ENTRANCE_SIZE.widthBg * this.backgroundScale;

    const opening = this.entrance?.getOpeningBounds(frameBaseX, frameBaseY, this.backgroundScale);
    if (!opening) {
      // Entrance isn't ready for some reason — still leave, just without
      // the choreographed camera movement.
      this.scene.start('PinkRoomScene');
      return;
    }

    const camera = this.cameras.main;

    // PHASE 1 — approach: center on the opening, zoom until it dominates
    // the viewport while the outer stone frame is still visible (capped
    // so the frame's own width doesn't already exceed the viewport).
    const phase1ZoomForFill = (height * PHASE1_FILL_FRACTION) / opening.height;
    const phase1ZoomFrameLimit = (width * 0.95) / frameWidthScreen;
    const phase1Zoom = Math.max(1, Math.min(phase1ZoomForFill, phase1ZoomFrameLimit));

    camera.pan(opening.centerX, opening.centerY, PHASE1_DURATION_MS, Phaser.Math.Easing.Sine.InOut);
    camera.zoomTo(phase1Zoom, PHASE1_DURATION_MS, Phaser.Math.Easing.Sine.InOut);

    camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      // PHASE 2 — cross the threshold: continue zooming, more
      // aggressively, until the frame's edges are pushed past the
      // viewport (frameWidthScreen * zoom clearly exceeds width), so
      // only the dark opening remains visible.
      const phase2ZoomForOvershoot = (width * PHASE2_FRAME_OVERSHOOT) / frameWidthScreen;
      const phase2Zoom = Math.max(phase1Zoom * 1.4, Math.min(phase2ZoomForOvershoot, PHASE2_MAX_ZOOM));

      camera.zoomTo(phase2Zoom, PHASE2_DURATION_MS, Phaser.Math.Easing.Cubic.In);

      // A brief, never-fully-opaque overlay timed to land right as the
      // threshold-crossing completes — masks the scene cut without ever
      // holding on a black screen.
      const overlayDelay = Math.max(0, PHASE2_DURATION_MS - OVERLAY_DURATION_MS);
      this.tweens.add({
        targets: this.overlay,
        alpha: OVERLAY_PEAK_ALPHA,
        delay: overlayDelay,
        duration: OVERLAY_DURATION_MS,
        ease: Phaser.Math.Easing.Sine.In,
      });

      camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
        this.scene.start('PinkRoomScene');
      });
    });
  }

  /**
   * Floor-seal click hand-off: locks input immediately (preserving the
   * hall's current camera position/zoom — no reset, no fade to black
   * yet), pans/zooms this hall's own camera onto the real opened-stair
   * bounds (never a hard-coded screen point — see
   * FloorEntrance.getStairOpeningBounds()) until the opening fills most
   * of the viewport, then a brief, never-fully-opaque flash bridges into
   * `LibraStaircaseScene`, which starts already framed to match this
   * hall's final camera position/zoom — so the whole hand-off reads as
   * one continuous camera move, never a hard cut. isTransitioningAway()
   * guards against repeated clicks/overlapping camera tweens from any of
   * the hall's exits; the floor entrance itself carries no dependency on
   * any other room's progress.
   */
  private enterLibraRoomThroughStairs(): void {
    if (this.isTransitioningAway()) {
      return;
    }
    this.isEnteringLibraRoom = true;
    this.input.enabled = false;

    const opening = this.floorEntrance?.getStairOpeningBounds();
    if (!opening) {
      // Opening bounds aren't available for some reason — still leave,
      // just without the choreographed camera move.
      this.scene.start('LibraStaircaseScene');
      return;
    }

    const camera = this.cameras.main;
    const targetZoom = Math.min(
      STAIR_ZOOM_MAX,
      (this.scale.height * STAIR_FILL_FRACTION) / Math.max(opening.height, 1),
    );

    camera.pan(opening.centerX, opening.centerY, STAIR_ZOOM_DURATION_MS, Phaser.Math.Easing.Cubic.InOut);
    camera.zoomTo(targetZoom, STAIR_ZOOM_DURATION_MS, Phaser.Math.Easing.Cubic.InOut);

    camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      // A brief, never-fully-opaque flash — not a black fade — bridges
      // the scene cut; LibraStaircaseScene starts already showing the
      // staircase image zoomed/cropped to match this same framing, so
      // nothing black is ever held on screen.
      this.tweens.add({
        targets: this.overlay,
        alpha: STAIR_CROSSFADE_PEAK_ALPHA,
        duration: STAIR_CROSSFADE_MS,
        ease: Phaser.Math.Easing.Sine.InOut,
        onComplete: () => this.scene.start('LibraStaircaseScene'),
      });
    });
  }


  /**
   * Third-room entrance: once the wall wheel has opened, center the camera
   * on the revealed circular passage and push through it before starting
   * Room3Scene. The wheel itself owns opening and persistence callbacks;
   * this method owns only the scene transition.
   */
  private enterRoom3ThroughWheel(): void {
    if (this.isTransitioningAway()) {
      return;
    }
    this.isEnteringRoom3 = true;
    this.input.enabled = false;

    const opening = this.wallWheel?.getOpeningBounds();
    if (!opening) {
      this.scene.start('Room3Scene');
      return;
    }

    const camera = this.cameras.main;
    const targetZoom = Math.min(
      WHEEL_ENTRY_MAX_ZOOM,
      (this.scale.height * WHEEL_ENTRY_FILL_FRACTION) / Math.max(opening.height, 1),
    );

    camera.pan(opening.centerX, opening.centerY, WHEEL_ENTRY_DURATION_MS, Phaser.Math.Easing.Cubic.InOut);
    camera.zoomTo(targetZoom, WHEEL_ENTRY_DURATION_MS, Phaser.Math.Easing.Cubic.InOut);

    camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      this.tweens.add({
        targets: this.overlay,
        alpha: 0.75,
        duration: 160,
        ease: Phaser.Math.Easing.Sine.In,
        onComplete: () => this.scene.start('Room3Scene'),
      });
    });
  }

  // Independent per-destination guards, checked together only to stop
  // one exit's transition overlapping another's (never used as a single
  // persistent lock — each flag is reset in create(), see there).
  private isTransitioningAway(): boolean {
    return this.isEnteringPinkRoom || this.isEnteringLibraRoom || this.isEnteringRoom3;
  }

  private closePopup(): void {
    if (!this.popup || this.time.now - this.lastPopupToggleAt < 300) {
      return;
    }
    this.lastPopupToggleAt = this.time.now;
    this.closePopupAndRestoreInput();
  }

  /**
   * Single dedicated cleanup for the crystal popup (the hall's one
   * in-scene modal/"exercise" popup): destroys the popup + its overlay,
   * resets the popup's own state, and — unconditionally, not relying on
   * anything else having behaved — restores scene input and every hall
   * object openPopup() locked. This is the *only* path that's allowed to
   * close the popup; there is no separate success/failure/cancel
   * branch, so there's nothing else that needs to call it.
   */
  private closePopupAndRestoreInput(): void {
    if (!this.popup) {
      return;
    }
    const popup = this.popup;
    this.popup = undefined;
    this.popupOverlay = undefined;

    this.tweens.add({
      targets: popup,
      alpha: 0,
      duration: 150,
      onComplete: () => popup.destroy(),
    });

    // Explicit, unconditional restore of exactly what openPopup() locked
    // — never a blanket this.input.removeAllListeners() or similar, and
    // never dependent on the lock/unlock pairing having gone right
    // elsewhere.
    this.input.enabled = true;
    this.heart?.setSuppressed(false);
    this.pot?.setActive(true);
  }

  // Ancient chiseled stone slab: dark base, weathered face, carved edges.
  private drawStonePanel(panelWidth: number, panelHeight: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const x = -panelWidth / 2;
    const y = -panelHeight / 2;

    g.fillStyle(0x241f19, 1);
    g.fillRoundedRect(x - 6, y - 6, panelWidth + 12, panelHeight + 12, 14);

    g.fillStyle(0x574d40, 1);
    g.fillRoundedRect(x, y, panelWidth, panelHeight, 10);

    g.fillStyle(0x655a4a, 1);
    g.fillRoundedRect(x + 4, y + 4, panelWidth - 8, panelHeight / 2, 8);

    g.lineStyle(2, 0x33291f, 1);
    g.strokeRoundedRect(x + 10, y + 10, panelWidth - 20, panelHeight - 20, 6);

    g.lineStyle(1, 0x7d715c, 0.6);
    g.strokeRoundedRect(x + 13, y + 13, panelWidth - 26, panelHeight - 26, 5);

    return g;
  }
}
