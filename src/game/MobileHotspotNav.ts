import Phaser from 'phaser';
import { isEnvelopScaleMode, ENVELOP_TOP_SAFE_MARGIN_PX, ENVELOP_BOTTOM_SAFE_MARGIN_PX } from './scaleMode';

// FIT preserves the complete 3:2 canvas on a wide phone, so each design
// pixel becomes smaller on the physical display. A labelled row of large
// direct-access buttons is clearer than two anonymous carousel arrows:
// players can see where every room entrance is and jump straight to it.
const BUTTON_HEIGHT_PX = 112;
const BUTTON_MAX_WIDTH_PX = 310;
const BUTTON_GAP_PX = 18;
const BUTTON_SIDE_MARGIN_PX = 34;
const BUTTON_BOTTOM_MARGIN_PX = 28;
const BUTTON_COLOR = 0x241f19;
const BUTTON_ALPHA = 0.55;
const BUTTON_SELECTED_COLOR = 0x6b4d20;
const BUTTON_SELECTED_ALPHA = 0.9;
const BUTTON_STROKE_COLOR = 0xd9cfae;
const BUTTON_STROKE_ALPHA = 0.6;
const BUTTON_TEXT_COLOR = '#f2e9d8';
const BUTTON_DEPTH = 70;

const TRANSITION_DURATION_MS = 650;
const FILL_FRACTION = 0.82;
const MAX_ZOOM = 3;

export interface Hotspot {
  id: string;
  /** Short Hebrew destination shown in the mobile navigation row. */
  label: string;
  /** Optional floor for overview/detail framing on a small FIT canvas. */
  minZoom?: number;
  /** Already in the owning scene's own screen-space (via its toScreenX/toScreenY), not raw background pixels. */
  bounds: Phaser.Geom.Rectangle;
}

interface NavButton {
  id: string;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  width: number;
}

/**
 * "One focus at a time" mobile navigation: instead of showing (and trying
 * to zoom into) the whole of a spread-out room at once — which real-device
 * feedback confirmed still reads as "too small, hard to tap" even with an
 * aggressive background zoom boost — the camera fills the viewport with
 * exactly one interactive area's bounds, and a row of labelled,
 * screen-fixed buttons opens each area directly. Every hit target
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

  private navButtons: NavButton[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    // Buttons are built in setHotspots(), once their destination labels
    // and ordering are available from the owning scene.
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
    this.ensureNavButtons();
    this.positionButtons();

    if (hotspots.length === 0) {
      return;
    }
    this.currentIndex = Math.min(this.currentIndex, hotspots.length - 1);
    this.snapTo(this.currentIndex);
  }

  /** Kept off while the intro overlay is showing (same reasoning/pattern as MobilePinchZoom.disable()) — the overlay's own dim rectangle isn't itself interactive, so without this a tap in a corner could reach these buttons underneath it. Dims the buttons too, so a disabled state is never an invisible dead control. */
  disable(): void {
    this.inputEnabled = false;
    this.navButtons.forEach((button) => button.container.setVisible(false));
  }

  enable(): void {
    this.inputEnabled = true;
    this.navButtons.forEach((button) => button.container.setVisible(true));
  }

  destroy(): void {
    this.navButtons.forEach((button) => button.container.destroy());
    this.navButtons = [];
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

  private targetZoomFor(hotspot: Hotspot): number {
    const zoomForWidth = (this.scene.scale.width * FILL_FRACTION) / Math.max(hotspot.bounds.width, 1);
    const zoomForHeight = (this.visibleHeight() * FILL_FRACTION) / Math.max(hotspot.bounds.height, 1);
    return Math.max(hotspot.minZoom ?? 1, Math.min(MAX_ZOOM, zoomForWidth, zoomForHeight));
  }

  private snapTo(index: number): void {
    const hotspot = this.hotspots[index];
    if (!hotspot) {
      return;
    }
    const camera = this.scene.cameras.main;
    camera.setZoom(this.targetZoomFor(hotspot));
    camera.centerOn(hotspot.bounds.centerX, hotspot.bounds.centerY);
    this.updateSelectedButton();
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
    if (!hotspot || !this.inputEnabled || this.isNavigating) {
      return;
    }
    if (index === this.currentIndex) {
      this.snapTo(index);
      return;
    }
    this.isNavigating = true;
    this.currentIndex = index;
    this.updateSelectedButton();
    this.scene.input.enabled = false;

    const camera = this.scene.cameras.main;
    camera.pan(hotspot.bounds.centerX, hotspot.bounds.centerY, TRANSITION_DURATION_MS, Phaser.Math.Easing.Sine.InOut);
    camera.zoomTo(this.targetZoomFor(hotspot), TRANSITION_DURATION_MS, Phaser.Math.Easing.Sine.InOut);

    // Two neighbouring destinations can legitimately use the same zoom
    // (e.g. wall and floor entrances). In that case Phaser may not emit a
    // ZOOM_COMPLETE event at all, so unlock on the shared transition
    // duration instead of risking a permanently disabled scene.
    this.scene.time.delayedCall(TRANSITION_DURATION_MS, () => {
      this.isNavigating = false;
      this.scene.input.enabled = true;
    });
  }

  // ---- nav buttons -----------------------------------------------------

  private ensureNavButtons(): void {
    const matches =
      this.navButtons.length === this.hotspots.length &&
      this.navButtons.every((button, index) => button.id === this.hotspots[index]?.id);
    if (matches) {
      this.hotspots.forEach((hotspot, index) => this.navButtons[index]?.label.setText(hotspot.label));
      return;
    }

    this.navButtons.forEach((button) => button.container.destroy());
    this.navButtons = this.hotspots.map((hotspot, index) => {
      const background = this.scene.add.graphics();
      const label = this.scene.add
        .text(0, 0, hotspot.label, {
          fontFamily: 'Bellefair, serif',
          fontSize: '34px',
          color: BUTTON_TEXT_COLOR,
          align: 'center',
          rtl: true,
        })
        .setOrigin(0.5);
      const container = this.scene.add
        .container(0, 0, [background, label])
        .setScrollFactor(0)
        .setDepth(BUTTON_DEPTH)
        .setVisible(this.inputEnabled);
      container.on(Phaser.Input.Events.POINTER_DOWN, () => this.flyTo(index));
      return { id: hotspot.id, container, background, label, width: BUTTON_MAX_WIDTH_PX };
    });
  }

  private positionButtons(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const count = Math.max(this.navButtons.length, 1);
    const availableWidth = width - BUTTON_SIDE_MARGIN_PX * 2 - BUTTON_GAP_PX * (count - 1);
    const buttonWidth = Math.min(BUTTON_MAX_WIDTH_PX, availableWidth / count);
    const rowWidth = buttonWidth * count + BUTTON_GAP_PX * (count - 1);
    const startX = (width - rowWidth) / 2 + buttonWidth / 2;
    const y = height - BUTTON_BOTTOM_MARGIN_PX - BUTTON_HEIGHT_PX / 2;

    this.navButtons.forEach((button, index) => {
      button.width = buttonWidth;
      button.container.setPosition(startX + index * (buttonWidth + BUTTON_GAP_PX), y);
      button.container.setSize(buttonWidth, BUTTON_HEIGHT_PX);
      button.container.setInteractive(
        new Phaser.Geom.Rectangle(-buttonWidth / 2, -BUTTON_HEIGHT_PX / 2, buttonWidth, BUTTON_HEIGHT_PX),
        Phaser.Geom.Rectangle.Contains,
      );
      if (button.container.input) {
        button.container.input.cursor = 'pointer';
      }
    });
    this.updateSelectedButton();
  }

  private updateSelectedButton(): void {
    this.navButtons.forEach((button, index) => {
      const selected = index === this.currentIndex;
      button.background.clear();
      button.background.fillStyle(
        selected ? BUTTON_SELECTED_COLOR : BUTTON_COLOR,
        selected ? BUTTON_SELECTED_ALPHA : BUTTON_ALPHA,
      );
      button.background.fillRoundedRect(
        -button.width / 2,
        -BUTTON_HEIGHT_PX / 2,
        button.width,
        BUTTON_HEIGHT_PX,
        20,
      );
      button.background.lineStyle(3, BUTTON_STROKE_COLOR, selected ? 1 : BUTTON_STROKE_ALPHA);
      button.background.strokeRoundedRect(
        -button.width / 2,
        -BUTTON_HEIGHT_PX / 2,
        button.width,
        BUTTON_HEIGHT_PX,
        20,
      );
      button.label.setColor(selected ? '#ffe3a1' : BUTTON_TEXT_COLOR);
    });
  }
}
