import Phaser from 'phaser';
import staircaseUrl from '../../assets/images/LibraRoom/entrance.png';

const BACKGROUND_KEY = 'libra-staircase-entrance';

// Source image (1448x1086): the opened floor seal revealing spiral
// stairs, with a dark archway + two flanking torches at the foot of the
// stairs — the "lower doorway" the camera pushes toward. Measured
// directly from assets/images/LibraRoom/entrance.png.
const DOORWAY_CENTER_X = 702;
const DOORWAY_CENTER_Y = 489;

// The top opening itself (the dark stair-hole in the floor seal, not
// the whole image) — also measured directly from entrance.png. The
// scene starts framed on THIS region, already cropped/zoomed to
// approximate how the Central Hall's own camera left the opening
// filling most of the viewport (see CentralHallScene.
// enterLibraRoomThroughStairs()), instead of pulling back to reveal the
// full staircase image first.
const OPENING_CENTER_X = 740;
const OPENING_CENTER_Y = 520;
const OPENING_HEIGHT_BG = 470;
const START_FILL_FRACTION = 0.72;
const START_ZOOM_MIN = 1;
const START_ZOOM_MAX = 3.2;

// Descent: pan+zoom from the start framing toward the doorway (stage 1,
// "walking down the stairs"), then a faster push-in through it (stage
// 2). MID/END zoom are expressed as multiples of the actual start zoom
// (not fixed absolutes) so the zoom progression keeps the same relative
// shape/acceleration regardless of the start framing computed above —
// continuing Central Hall's own zoom-in rather than resetting to a wide
// shot.
const MID_ZOOM_FACTOR = 1.55;
const END_ZOOM_FACTOR = 5.3;

const DESCENT_DURATION_MS = 1400; // 1100-1500
const PUSH_IN_DURATION_MS = 500; // 350-550
const DARK_TRANSITION_MS = 150; // 80-150

// Crossfade-in from Central Hall's own brief flash overlay (see
// CentralHallScene's STAIR_CROSSFADE_PEAK_ALPHA/STAIR_CROSSFADE_MS) —
// this scene's first frame already shows the staircase image at
// matching zoom/position under that same translucent overlay, which
// then clears quickly. Never a full black frame.
const CROSSFADE_MS = 120; // 80-150
const CROSSFADE_PEAK_ALPHA = 0.55;

const OVERLAY_DEPTH = 90;

/**
 * Full-screen transition scene between the Central Hall's floor
 * entrance and the Libra Room: a single staircase illustration the
 * camera descends and zooms into, ending on a brief dark cut before
 * LibraRoomScene starts. No interaction at all — a purely scripted
 * camera move, entered only from CentralHallScene.enterLibraRoomThroughStairs()
 * (which leaves the hall's own camera zoomed onto the real opening) and
 * always exiting to LibraRoomScene.
 */
export default class LibraStaircaseScene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private overlay?: Phaser.GameObjects.Rectangle;
  private backgroundScale = 1;

  constructor() {
    super('LibraStaircaseScene');
  }

  preload(): void {
    this.load.image(BACKGROUND_KEY, staircaseUrl);
  }

  create(): void {
    // No interaction during this transition at all.
    this.input.enabled = false;

    this.background = this.add.image(0, 0, BACKGROUND_KEY).setDepth(0);

    // Starts at CROSSFADE_PEAK_ALPHA (never fully opaque) to continue
    // Central Hall's own brief flash rather than a black reveal — the
    // staircase image is already visible immediately underneath it.
    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(CROSSFADE_PEAK_ALPHA)
      .setScrollFactor(0);

    this.layout(this.scale.width, this.scale.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.tweens.killTweensOf(this.cameras.main);
      if (this.overlay) {
        this.tweens.killTweensOf(this.overlay);
      }
    });

    this.startFramedOnOpening();
    this.playDescent();
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.background) {
      return;
    }
    // Cover the window: proportional fill, cropping overflow instead of
    // stretching — same convention as every other scene's background.
    this.backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setScale(this.backgroundScale).setPosition(width / 2, height / 2);
    this.overlay?.setSize(width, height);
  }

  private toScreenX(bgX: number, width = this.scale.width): number {
    return width / 2 + (bgX - (this.background?.width ?? 0) / 2) * this.backgroundScale;
  }

  private toScreenY(bgY: number, height = this.scale.height): number {
    return height / 2 + (bgY - (this.background?.height ?? 0) / 2) * this.backgroundScale;
  }

  // Camera starts centered on and zoomed into the top opening itself —
  // approximating the same doorway size/placement Central Hall's camera
  // ended on — rather than pulled back to show the full staircase image.
  private startFramedOnOpening(): void {
    const camera = this.cameras.main;
    const openingHeightScreen = OPENING_HEIGHT_BG * this.backgroundScale;
    const startZoom = Phaser.Math.Clamp(
      (this.scale.height * START_FILL_FRACTION) / Math.max(openingHeightScreen, 1),
      START_ZOOM_MIN,
      START_ZOOM_MAX,
    );
    camera.setZoom(startZoom);
    camera.centerOn(this.toScreenX(OPENING_CENTER_X), this.toScreenY(OPENING_CENTER_Y));
  }

  // Crossfade in -> descend -> push through the doorway -> brief dark
  // cut -> LibraRoomScene. Each phase is chained off the previous one's
  // own completion event, never raced against a fixed delay.
  private playDescent(): void {
    const camera = this.cameras.main;
    const startZoom = camera.zoom;
    const targetX = this.toScreenX(DOORWAY_CENTER_X);
    const targetY = this.toScreenY(DOORWAY_CENTER_Y);

    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: CROSSFADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        // Stage 1 — descent: pan and zoom toward the doorway together,
        // continuing straight on from the start framing (no reset to a
        // wide shot, no pause).
        camera.pan(targetX, targetY, DESCENT_DURATION_MS, Phaser.Math.Easing.Sine.InOut);
        camera.zoomTo(startZoom * MID_ZOOM_FACTOR, DESCENT_DURATION_MS, Phaser.Math.Easing.Sine.InOut);

        camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
          // Stage 2 — push-in: faster, more aggressive zoom until the
          // doorway nearly fills the viewport.
          camera.zoomTo(startZoom * END_ZOOM_FACTOR, PUSH_IN_DURATION_MS, Phaser.Math.Easing.Cubic.In);

          camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
            // Very short dark cut, then straight into LibraRoomScene.
            this.tweens.add({
              targets: this.overlay,
              alpha: 1,
              duration: DARK_TRANSITION_MS,
              ease: Phaser.Math.Easing.Sine.In,
              onComplete: () => this.scene.start('LibraRoomScene'),
            });
          });
        });
      },
    });
  }
}
