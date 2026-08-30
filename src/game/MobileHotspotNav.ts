import Phaser from 'phaser';
import { isEnvelopScaleMode, ENVELOP_TOP_SAFE_MARGIN_PX, ENVELOP_BOTTOM_SAFE_MARGIN_PX } from './scaleMode';

const BUTTON_SIZE_PX = 56;
const BUTTON_MARGIN_PX = 18;
const BUTTON_COLOR = 0x241f19;
const BUTTON_ALPHA = 0.55;
const BUTTON_STROKE_COLOR = 0xd9cfae;
const BUTTON_STROKE_ALPHA = 0.6;
const BUTTON_ARROW_COLOR = 0xf2e9d8;
const BUTTON_DEPTH = 70;

const TRANSITION_DURATION_MS = 650;
const FILL_FRACTION = 0.82;
const MAX_ZOOM = 3;

export interface Hotspot {
  id: string;
  /** Already in the owning scene's own screen-space (via its toScreenX/toScreenY), not raw background pixels. */
  bounds: Phaser.Geom.Rectangle;
}

/**
 * "One focus at a time" mobile navigation: instead of showing (and trying
 * to zoom into) the whole of a spread-out room at once — which real-device
 * feedback confirmed still reads as "too small, hard to tap" even with an
 * aggressive background zoom boost — the camera fills the viewport with
 * exactly one interactive area's bounds, and two screen-fixed arrow
 * buttons step through an ordered list of such areas. Every hit target
 * inside the current focus is therefore always comfortably large,
 * regardless of how spread out the room's elements are overall.
 *
 * Deliberately camera-only: every game object keeps its normal (desktop)
 * screen position from the owning scene's own layout() — this class only
 * moves/zooms the camera, via the exact same camera.pan()+zoomTo() pattern
 * already used by this project's own room-to-room transitions (e.g.
 * CentralHallScene.enterRoom3ThroughWheel()) — so no other component needs
 * a separate "mobile position" table.
 *
 * Replaces MobilePinchZoom for the scene that installs it — free-roam
 * pinch/pan and this focused step-through navigation don't compose well
 * (the two would fight over camera.zoom/scroll), and the whole point here
 * is to remove the need to find/pan to anything.
 */
export default class MobileHotspotNav {
  private scene: Phaser.Scene;
  private hotspots: Hotspot[] = [];
  private currentIndex = 0;
  private isNavigating = false;
  private inputEnabled = true;

  private prevButton?: Phaser.GameObjects.Container;
  private nextButton?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.prevButton = this.createButton('‹', () => this.prev());
    this.nextButton = this.createButton('›', () => this.next());
  }

  /**
   * Called from the owning scene's own layout() on every create()/resize.
   * First call: jumps the camera straight to the first hotspot, no
   * animation (matches how the scene "just starts" at rest). Later calls
   * (a resize): re-snaps to whichever hotspot is already selected, using
   * its freshly recomputed bounds — also instant, since an animated camera
   * flight on every resize event would be jarring rather than helpful.
   */
  setHotspots(hotspots: Hotspot[]): void {
    this.hotspots = hotspots;
    this.positionButtons();

    if (hotspots.length === 0) {
      return;
    }
    this.currentIndex = Math.min(this.currentIndex, hotspots.length - 1);
    this.snapTo(this.currentIndex);
  }

  next(): void {
    if (!this.inputEnabled || this.isNavigating || this.hotspots.length === 0) {
      return;
    }
    this.flyTo((this.currentIndex + 1) % this.hotspots.length);
  }

  prev(): void {
    if (!this.inputEnabled || this.isNavigating || this.hotspots.length === 0) {
      return;
    }
    this.flyTo((this.currentIndex - 1 + this.hotspots.length) % this.hotspots.length);
  }

  /** Kept off while the intro overlay is showing (same reasoning/pattern as MobilePinchZoom.disable()) — the overlay's own dim rectangle isn't itself interactive, so without this a tap in a corner could reach these buttons underneath it. Dims the buttons too, so a disabled state is never an invisible dead control. */
  disable(): void {
    this.inputEnabled = false;
    this.prevButton?.setAlpha(0.3);
    this.nextButton?.setAlpha(0.3);
  }

  enable(): void {
    this.inputEnabled = true;
    this.prevButton?.setAlpha(1);
    this.nextButton?.setAlpha(1);
  }

  destroy(): void {
    this.prevButton?.destroy();
    this.nextButton?.destroy();
  }

  // ---- camera framing -----------------------------------------------

  /**
   * scene.scale.height is the FIXED 1536x1024 design resolution, not the
   * physical viewport — Phaser's Scale Manager handles that mapping
   * separately. On ENVELOP (short phone-landscape), it crops
   * ENVELOP_TOP/BOTTOM_SAFE_MARGIN_PX worth of that same fixed-resolution
   * canvas off the top/bottom at the CSS layer (see scaleMode.ts) — the
   * camera itself doesn't know that, so computing a fill fraction against
   * the raw scale.height would size things to fill space that's actually
   * cropped away, clipping the top/bottom of whatever's in frame. This
   * subtracts that cropped band first so "fill" means fill the space that
   * is actually visible.
   */
  private visibleHeight(): number {
    const full = this.scene.scale.height;
    return isEnvelopScaleMode(this.scene) ? full - ENVELOP_TOP_SAFE_MARGIN_PX - ENVELOP_BOTTOM_SAFE_MARGIN_PX : full;
  }

  private targetZoomFor(bounds: Phaser.Geom.Rectangle): number {
    const zoomForWidth = (this.scene.scale.width * FILL_FRACTION) / Math.max(bounds.width, 1);
    const zoomForHeight = (this.visibleHeight() * FILL_FRACTION) / Math.max(bounds.height, 1);
    return Math.max(1, Math.min(MAX_ZOOM, zoomForWidth, zoomForHeight));
  }

  private snapTo(index: number): void {
    const hotspot = this.hotspots[index];
    if (!hotspot) {
      return;
    }
    const camera = this.scene.cameras.main;
    camera.setZoom(this.targetZoomFor(hotspot.bounds));
    camera.centerOn(hotspot.bounds.centerX, hotspot.bounds.centerY);
  }

  /**
   * Animated hand-off between two hotspots — same camera.pan()+zoomTo()
   * pairing, duration, and input-lock/unlock convention already used by
   * every other camera move in CentralHallScene (e.g.
   * enterRoom3ThroughWheel()), so this reads as one consistent camera
   * language throughout the scene rather than a separate mechanism.
   */
  private flyTo(index: number): void {
    const hotspot = this.hotspots[index];
    if (!hotspot) {
      return;
    }
    this.isNavigating = true;
    this.scene.input.enabled = false;

    const camera = this.scene.cameras.main;
    camera.pan(hotspot.bounds.centerX, hotspot.bounds.centerY, TRANSITION_DURATION_MS, Phaser.Math.Easing.Sine.InOut);
    camera.zoomTo(this.targetZoomFor(hotspot.bounds), TRANSITION_DURATION_MS, Phaser.Math.Easing.Sine.InOut);

    camera.once(Phaser.Cameras.Scene2D.Events.ZOOM_COMPLETE, () => {
      this.currentIndex = index;
      this.isNavigating = false;
      this.scene.input.enabled = true;
    });
  }

  // ---- nav buttons -----------------------------------------------------

  private createButton(glyph: string, onClick: () => void): Phaser.GameObjects.Container {
    const half = BUTTON_SIZE_PX / 2;
    const background = this.scene.add
      .circle(0, 0, half, BUTTON_COLOR, BUTTON_ALPHA)
      .setStrokeStyle(1, BUTTON_STROKE_COLOR, BUTTON_STROKE_ALPHA);
    const arrow = this.scene.add
      .text(0, 0, glyph, { fontFamily: 'Bellefair, serif', fontSize: '30px', color: `#${BUTTON_ARROW_COLOR.toString(16)}` })
      .setOrigin(0.5);

    const container = this.scene.add
      .container(0, 0, [background, arrow])
      .setScrollFactor(0)
      .setDepth(BUTTON_DEPTH)
      .setSize(BUTTON_SIZE_PX, BUTTON_SIZE_PX);

    container.setInteractive(new Phaser.Geom.Circle(0, 0, half), Phaser.Geom.Circle.Contains);
    if (container.input) {
      container.input.cursor = 'pointer';
    }
    container.on(Phaser.Input.Events.POINTER_DOWN, onClick);

    return container;
  }

  // Universal left/right spatial convention (not tied to Hebrew reading
  // order, since this steps between visual areas, not text) — ‹ prev on
  // the left, › next on the right, same as any image carousel.
  private positionButtons(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const half = BUTTON_SIZE_PX / 2 + BUTTON_MARGIN_PX;
    this.prevButton?.setPosition(half, height - half);
    this.nextButton?.setPosition(width - half, height - half);
  }
}
