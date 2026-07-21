import Phaser from 'phaser';
import Entrance from '../game/Entrance';
import torchUrl from '../../assets/images/central-hall/intro-torch.png';

const TORCH_KEY = 'hidden-passage-torch';
const BACKDROP_KEY = 'hidden-passage-backdrop-TEMP';

// Virtual design canvas, matching the Central Hall's own background
// dimensions so this room follows the same anchor-in-background-pixels,
// cover-scaled responsive convention as CentralHallScene (see
// toScreenX/toScreenY in layout()).
const DESIGN_WIDTH = 1536;
const DESIGN_HEIGHT = 1024;

// Exit doorway back to the Central Hall: reuses the Entrance class (the
// same procedural stone-arch-with-dark-interior motif already used for
// the hall's own hidden entrance) so it reads as matching temple
// architecture rather than a UI button, and to avoid duplicating that
// drawing code. Sized like a real doorway set into the back wall.
const EXIT_DEPTH = 2;
const EXIT_SIZE = { widthBg: 145, heightBg: 300 };
const EXIT_CENTER_X = 768;
const EXIT_BASE_Y = 820;

// Torches flanking the exit, reusing the same already-approved asset
// used in IntroOverlay (assets/images/central-hall/intro-torch.png) —
// no new art, matching lighting language.
const TORCH_HEIGHT_BG = 200;
const TORCH_LEFT_X = 560;
const TORCH_RIGHT_X = 976;
const TORCH_BASE_Y = 560;
const TORCH_DEPTH = 1;

// Entry: arrive already zoomed/darkened, continuing the hall's own
// threshold-crossing overlay, then settle to normal room framing.
const ENTRY_START_ZOOM = 1.5;
const ENTRY_START_OVERLAY_ALPHA = 0.8;
const ENTRY_SETTLE_DURATION_MS = 600;

// Return transition: short and single-phase (per "short doorway-style
// transition"), not a replay of the hall's full two-phase approach.
const EXIT_ZOOM = 1.6;
const EXIT_DURATION_MS = 450;
const EXIT_OVERLAY_ALPHA = 0.85;
const OVERLAY_DEPTH = 10;

/**
 * The room revealed behind the Central Hall's left statue. No room name,
 * educational topic, or puzzle type is defined anywhere in the project
 * documentation yet (checked game-design.md, central-hall.md, and
 * PROJECT_STATE.md — all explicitly leave puzzle/room topics open
 * pending "explicit instruction"), so this sprint builds only the
 * environment and navigation shell — no puzzle logic. The backdrop is a
 * TEMPORARY procedural stone chamber (matching the hall's material and
 * lighting language), isolated so it can be swapped for a real
 * background image later without touching the entry/exit logic.
 */
export default class HiddenPassageScene extends Phaser.Scene {
  private backdrop?: Phaser.GameObjects.Image;
  private torchLeft?: Phaser.GameObjects.Image;
  private torchRight?: Phaser.GameObjects.Image;
  private exit?: Entrance;
  private overlay?: Phaser.GameObjects.Rectangle;
  private backgroundScale = 1;
  private isReturning = false;

  constructor() {
    super('HiddenPassageScene');
  }

  preload(): void {
    this.load.image(TORCH_KEY, torchUrl);
  }

  create(): void {
    // Locked immediately, before anything else runs — released once
    // playEntryAnimation()'s settle finishes.
    this.input.enabled = false;

    this.createRoomEnvironment();
    this.createExitToCentralHall();

    this.layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });

    this.playEntryAnimation();
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.backdrop) {
      return;
    }

    // Cover the window exactly like CentralHallScene's background:
    // proportional fill, cropping overflow instead of stretching.
    this.backgroundScale = Math.max(width / this.backdrop.width, height / this.backdrop.height);
    this.backdrop.setScale(this.backgroundScale).setPosition(width / 2, height / 2);

    const toScreenX = (bgX: number) =>
      width / 2 + (bgX - this.backdrop!.width / 2) * this.backgroundScale;
    const toScreenY = (bgY: number) =>
      height / 2 + (bgY - this.backdrop!.height / 2) * this.backgroundScale;

    this.torchLeft
      ?.setPosition(toScreenX(TORCH_LEFT_X), toScreenY(TORCH_BASE_Y))
      .setDisplaySize(
        (this.torchLeft.width / this.torchLeft.height) * TORCH_HEIGHT_BG * this.backgroundScale,
        TORCH_HEIGHT_BG * this.backgroundScale,
      );
    this.torchRight
      ?.setPosition(toScreenX(TORCH_RIGHT_X), toScreenY(TORCH_BASE_Y))
      .setDisplaySize(
        (this.torchRight.width / this.torchRight.height) * TORCH_HEIGHT_BG * this.backgroundScale,
        TORCH_HEIGHT_BG * this.backgroundScale,
      );

    this.exit?.layout(toScreenX(EXIT_CENTER_X), toScreenY(EXIT_BASE_Y), this.backgroundScale);

    this.overlay?.setSize(width, height);
  }

  // Background, torches, and the screen-fixed transition overlay. No
  // interactive elements live here — see createExitToCentralHall() for
  // the one interactive object in the room.
  private createRoomEnvironment(): void {
    this.generateBackdropTexture();

    this.backdrop = this.add.image(0, 0, BACKDROP_KEY).setOrigin(0.5, 0.5).setDepth(0);

    this.torchLeft = this.add.image(0, 0, TORCH_KEY).setOrigin(0.5, 1).setDepth(TORCH_DEPTH);
    this.torchRight = this.add.image(0, 0, TORCH_KEY).setOrigin(0.5, 1).setDepth(TORCH_DEPTH);

    // Fixed-to-screen (scrollFactor 0) mask, shared by the entry settle
    // and the exit transition — same technique as CentralHallScene's own
    // threshold-crossing overlay.
    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(ENTRY_START_OVERLAY_ALPHA)
      .setScrollFactor(0);
  }

  // The one interactive object in the room: a doorway back to the
  // Central Hall, built from the same arch architecture as the hall's
  // own hidden entrance (not a floating UI button). Visible and
  // interactive from the moment the room appears — restoreRevealed()
  // skips Entrance's fade-in since this doorway isn't something the
  // player needs to "discover," it's just part of the room.
  private createExitToCentralHall(): void {
    this.exit = new Entrance(this, EXIT_SIZE);
    this.exit.create(EXIT_DEPTH);
    this.exit.restoreRevealed();
    this.exit.onActivate = () => this.returnToCentralHall();
  }

  // Arrive zoomed in and darkened — as if still mid-crossing from the
  // hall's own threshold transition — then settle to the room's normal
  // framing. Input stays locked until the settle finishes.
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
    });
  }

  // Short doorway-style transition back to the Central Hall: locks
  // input, zooms toward the exit, darkens the overlay, then switches
  // scenes only once that movement has fully completed. The statue/
  // lever/entrance state on the hall side is preserved via the shared
  // registry flag CentralHallScene checks on create() — this scene
  // doesn't need to know about that, it only needs to trigger the
  // return.
  private returnToCentralHall(): void {
    if (this.isReturning) {
      return;
    }
    this.isReturning = true;
    this.input.enabled = false;
    this.exit?.setActive(false);

    const camera = this.cameras.main;
    camera.zoomTo(EXIT_ZOOM, EXIT_DURATION_MS, Phaser.Math.Easing.Sine.In);
    this.tweens.add({
      targets: this.overlay,
      alpha: EXIT_OVERLAY_ALPHA,
      duration: EXIT_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.In,
    });

    camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      this.scene.start('CentralHallScene');
    });
  }

  // TEMPORARY room backdrop: a stone chamber with converging side walls,
  // a back wall holding a carved circular emblem (a placeholder for a
  // future puzzle mechanism — purely decorative pixels, not an
  // interactive object, so there's nothing here that can end up as a
  // broken hit area), and a floor with a faint radiating medallion
  // echoing the hall's own circular motifs. Swap for a real background
  // image later; nothing else in this scene should need to change.
  private generateBackdropTexture(): void {
    if (this.textures.exists(BACKDROP_KEY)) {
      return;
    }
    const w = DESIGN_WIDTH;
    const h = DESIGN_HEIGHT;
    const canvas = this.textures.createCanvas(BACKDROP_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();

    // 1. Base tone: dark ceiling, warmer mid stone, dark floor shadow.
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#0d0a08');
    base.addColorStop(0.35, '#221a12');
    base.addColorStop(0.7, '#1a130d');
    base.addColorStop(1, '#0a0705');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // 2. Side walls converging toward the back wall (simple perspective
    // cue for a chamber/passage, not a fully modeled 3D space).
    const nearLeftX = w * 0.02;
    const nearRightX = w * 0.98;
    const farLeftX = w * 0.34;
    const farRightX = w * 0.66;
    const wallTopY = h * 0.08;
    const wallBottomY = h * 0.86;
    const farY = h * 0.2;
    const farBottomY = h * 0.78;

    ctx.fillStyle = 'rgba(38,30,22,0.9)';
    ctx.beginPath();
    ctx.moveTo(nearLeftX, wallTopY);
    ctx.lineTo(farLeftX, farY);
    ctx.lineTo(farLeftX, farBottomY);
    ctx.lineTo(nearLeftX, wallBottomY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(nearRightX, wallTopY);
    ctx.lineTo(farRightX, farY);
    ctx.lineTo(farRightX, farBottomY);
    ctx.lineTo(nearRightX, wallBottomY);
    ctx.closePath();
    ctx.fill();

    // Faint stone-block seams on the side walls.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(nearLeftX + (farLeftX - nearLeftX) * t, wallTopY + (farY - wallTopY) * t);
      ctx.lineTo(nearLeftX + (farLeftX - nearLeftX) * t, wallBottomY + (farBottomY - wallBottomY) * t);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(nearRightX + (farRightX - nearRightX) * t, wallTopY + (farY - wallTopY) * t);
      ctx.lineTo(nearRightX + (farRightX - nearRightX) * t, wallBottomY + (farBottomY - wallBottomY) * t);
      ctx.stroke();
    }

    // 3. Back wall panel (lighter stone), holding the emblem and the
    // exit doorway (added separately as a real GameObject).
    const backGrad = ctx.createLinearGradient(0, farY, 0, farBottomY);
    backGrad.addColorStop(0, 'rgba(54,44,32,0.95)');
    backGrad.addColorStop(1, 'rgba(30,24,17,0.95)');
    ctx.fillStyle = backGrad;
    ctx.fillRect(farLeftX, farY, farRightX - farLeftX, farBottomY - farY);

    // 4. Carved circular emblem — placeholder for a future puzzle
    // mechanism, echoing the hall's own ring/crystal motif. Decorative
    // only; the real interactive puzzle element is not built yet.
    const cx = w / 2;
    const cy = farY + (farBottomY - farY) * 0.32;
    ctx.strokeStyle = 'rgba(176,138,72,0.35)';
    ctx.lineWidth = 3;
    for (const r of [46, 62, 78]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * 46, cy + Math.sin(angle) * 46);
      ctx.lineTo(cx + Math.cos(angle) * 78, cy + Math.sin(angle) * 78);
      ctx.stroke();
    }

    // 5. Ceiling (darker still, above the walls).
    ctx.fillStyle = 'rgba(6,5,4,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(nearRightX, wallTopY);
    ctx.lineTo(nearLeftX, wallTopY);
    ctx.closePath();
    ctx.fill();

    // 6. Floor, with a faint radiating medallion echoing the hall's own
    // circular floor motif.
    const floorGrad = ctx.createLinearGradient(0, wallBottomY, 0, h);
    floorGrad.addColorStop(0, 'rgba(46,36,25,0.95)');
    floorGrad.addColorStop(1, 'rgba(16,12,9,0.95)');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.moveTo(nearLeftX, wallBottomY);
    ctx.lineTo(nearRightX, wallBottomY);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(176,138,72,0.25)';
    ctx.lineWidth = 2;
    for (const r of [80, 130, 180]) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.92, r * 1.6, r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Soft vignette toward the extreme corners, for cinematic depth.
    const vignette = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.25, w / 2, h * 0.45, w * 0.62);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    canvas.refresh();
  }
}
