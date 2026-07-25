import Phaser from 'phaser';
import { FONT_FAMILY } from './textStyle';

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const CLICK_DRAG_THRESHOLD_PX = 8;
const POST_GESTURE_COOLDOWN_MS = 150;
const RESET_BUTTON_VISIBLE_ZOOM_THRESHOLD = 1.05;

const RESET_BUTTON_TEXTURE_KEY = 'mobile-pinch-zoom-reset-frame';
const RESET_BUTTON_SIZE_PX = 52;
const RESET_BUTTON_MARGIN_PX = 18;
// Comfortably above every other depth used anywhere in this project
// (the highest otherwise is CentralHallScene's own info popup at 100)
// so the reset button always sits on top of ordinary scene content.
const RESET_BUTTON_DEPTH = 5000;

interface TouchPoint {
  x: number;
  y: number;
}

/**
 * Shared, per-scene two-finger pinch-to-zoom + one-finger pan (while
 * zoomed in) + a small "100%" reset button — installed identically by
 * every interactive room scene instead of duplicating this logic (see
 * CentralHallScene/PinkRoomScene/LibraRoomScene/Room3Scene). Operates
 * purely on the scene's own main camera (camera.zoom/scrollX/scrollY) —
 * this is what actually keeps Phaser's own click hit-testing correctly
 * aligned with what's visually shown, since camera-based zoom/scroll is
 * natively accounted for by Phaser's input system (unlike a CSS/browser-
 * level zoom, which it has no way to know about).
 *
 * Deliberately NOT installed in LibraStaircaseScene — that scene is a
 * ~2s fully non-interactive scripted camera fly-through
 * (`input.enabled` is false for its whole lifetime, and its own camera
 * tweens already own zoom/scroll), so there is no gesture to serve there
 * and installing this would only risk fighting that scripted camera move.
 *
 * Respects `scene.input.enabled` (every scene here already uses this
 * exact flag to lock input during entry/exit camera transitions) plus
 * its own `setEnabled()` escape hatch (used by CentralHallScene to stay
 * off while the intro overlay — which isn't camera-scroll-independent —
 * is still showing), so it never needs to know about any scene's
 * specific transition/overlay logic.
 *
 * KNOWN LIMITATION: this project's buttons/zones fire on POINTER_DOWN
 * (not a clean click-with-no-movement), so the very first touch of a
 * gesture that turns out to be a drag can still trigger whatever is
 * directly underneath it, exactly as a plain tap there always would —
 * only the *rest* of a pinch/pan gesture (and a short cooldown after
 * release) actively suppresses further clicks. Changing every scene's
 * press-to-activate convention to a release-based click model instead is
 * out of scope here.
 */
export default class MobilePinchZoom {
  private scene: Phaser.Scene;
  private canvas?: HTMLCanvasElement;
  private enabled = true;

  private resetButtonContainer?: Phaser.GameObjects.Container;

  private touches = new Map<number, TouchPoint>();
  private mode: 'idle' | 'pinch' | 'pan' = 'idle';

  private pinchPrevDistance = 0;
  private pinchPrevMidpoint: TouchPoint = { x: 0, y: 0 };

  private panPrev: TouchPoint = { x: 0, y: 0 };
  private panTravelDistance = 0;

  private cooldownTimer?: Phaser.Time.TimerEvent;

  private readonly handleTouchStart = (event: TouchEvent) => this.onTouchStart(event);
  private readonly handleTouchMove = (event: TouchEvent) => this.onTouchMove(event);
  private readonly handleTouchEnd = (event: TouchEvent) => this.onTouchEnd(event);
  private readonly handleResize = () => this.resetCamera();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.canvas = this.scene.game.canvas;
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });

    this.createResetButton();

    // Any refresh — rotation, fullscreen toggle, or a generic resize (see
    // main.ts, which calls game.scale.refresh() for all three) — always
    // lands back on a clean zoom=1, centered camera.
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  /** Used by CentralHallScene to keep this off while the intro overlay (not camera-scroll-independent) is still showing. Every other scene stays at the default (always enabled, gated only by scene.input.enabled). */
  setEnabled(active: boolean): void {
    this.enabled = active;
    if (!active) {
      this.abortGesture();
    }
  }

  destroy(): void {
    this.canvas?.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas?.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas?.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas?.removeEventListener('touchcancel', this.handleTouchEnd);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.cooldownTimer?.remove();
    this.resetButtonContainer?.destroy();
  }

  // ---- gesture handling ---------------------------------------------

  private touchesFromEvent(event: TouchEvent): Map<number, TouchPoint> {
    const map = new Map<number, TouchPoint>();
    if (!this.canvas) {
      return map;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return map;
    }
    // Same conversion Phaser's own InputManager uses internally — CSS
    // touch-position -> the game's fixed 1536x1024 logical space —
    // so this always agrees with whatever camera.getWorldPoint() expects.
    const scaleX = this.scene.scale.width / rect.width;
    const scaleY = this.scene.scale.height / rect.height;
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      map.set(touch.identifier, {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      });
    }
    return map;
  }

  private onTouchStart(event: TouchEvent): void {
    if (!this.enabled || !this.scene.input.enabled) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.touches.size >= 2) {
      event.preventDefault();
      this.beginPinch();
    } else if (this.touches.size === 1) {
      const point = [...this.touches.values()][0];
      this.mode = 'idle';
      this.panPrev = point;
      this.panTravelDistance = 0;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.enabled || this.touches.size === 0) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.mode === 'pinch') {
      event.preventDefault();
      this.updatePinch();
      return;
    }

    if (this.touches.size === 1 && this.scene.cameras.main.zoom > MIN_ZOOM + 0.001) {
      const point = [...this.touches.values()][0];
      this.panTravelDistance += Phaser.Math.Distance.Between(this.panPrev.x, this.panPrev.y, point.x, point.y);
      if (this.mode === 'idle' && this.panTravelDistance > CLICK_DRAG_THRESHOLD_PX) {
        this.mode = 'pan';
        this.scene.input.enabled = false;
      }
      if (this.mode === 'pan') {
        event.preventDefault();
        this.panCameraBy(point.x - this.panPrev.x, point.y - this.panPrev.y);
      }
      this.panPrev = point;
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.enabled) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.touches.size >= 2) {
      // Still mid-pinch with the remaining fingers — re-anchor so the
      // next move isn't measured against a now-lifted touch.
      this.beginPinch();
      return;
    }
    if (this.touches.size === 1 && this.mode === 'pinch') {
      // Dropped from 2 fingers to 1 — settle into a single-finger pan
      // from here rather than ending the whole gesture outright.
      const point = [...this.touches.values()][0];
      this.mode = this.scene.cameras.main.zoom > MIN_ZOOM + 0.001 ? 'pan' : 'idle';
      this.panPrev = point;
      this.panTravelDistance = CLICK_DRAG_THRESHOLD_PX + 1; // already a real gesture, not a fresh tap candidate
      return;
    }
    if (this.touches.size === 0) {
      this.endGesture();
    }
  }

  private beginPinch(): void {
    const points = [...this.touches.values()];
    if (points.length < 2) {
      return;
    }
    this.mode = 'pinch';
    this.scene.input.enabled = false;
    this.cooldownTimer?.remove();
    this.pinchPrevDistance = Phaser.Math.Distance.Between(points[0].x, points[0].y, points[1].x, points[1].y);
    this.pinchPrevMidpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  private updatePinch(): void {
    const points = [...this.touches.values()];
    if (points.length < 2) {
      return;
    }
    const newDistance = Phaser.Math.Distance.Between(points[0].x, points[0].y, points[1].x, points[1].y);
    const newMidpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    const camera = this.scene.cameras.main;

    if (this.pinchPrevDistance > 0) {
      const ratio = newDistance / this.pinchPrevDistance;
      const newZoom = Phaser.Math.Clamp(camera.zoom * ratio, MIN_ZOOM, MAX_ZOOM);

      // Keep the world point that was under the fingers a moment ago
      // anchored at the SAME screen position — using Phaser's own
      // screen->world conversion both before and after the zoom change,
      // never a hand-derived formula, so this stays correct regardless
      // of camera rotation/DPR.
      const worldBefore = camera.getWorldPoint(this.pinchPrevMidpoint.x, this.pinchPrevMidpoint.y);
      camera.zoom = newZoom;
      const worldAfterZoomOnly = camera.getWorldPoint(this.pinchPrevMidpoint.x, this.pinchPrevMidpoint.y);
      camera.scrollX += worldBefore.x - worldAfterZoomOnly.x;
      camera.scrollY += worldBefore.y - worldAfterZoomOnly.y;

      // Then follow the midpoint's own translation (fingers moving
      // together, not just spreading/pinching) by the same screen
      // amount, converted to world units at the new zoom.
      camera.scrollX -= (newMidpoint.x - this.pinchPrevMidpoint.x) / newZoom;
      camera.scrollY -= (newMidpoint.y - this.pinchPrevMidpoint.y) / newZoom;
    }

    this.pinchPrevDistance = newDistance;
    this.pinchPrevMidpoint = newMidpoint;
    this.updateResetButtonVisibility();
  }

  private panCameraBy(dxScreen: number, dyScreen: number): void {
    const camera = this.scene.cameras.main;
    camera.scrollX -= dxScreen / camera.zoom;
    camera.scrollY -= dyScreen / camera.zoom;
  }

  private endGesture(): void {
    const wasGesture = this.mode !== 'idle';
    this.mode = 'idle';
    this.touches.clear();
    if (wasGesture) {
      // A trailing click, if any, can still land a moment after release
      // on some browsers — keep input suppressed a little past it.
      this.cooldownTimer?.remove();
      this.cooldownTimer = this.scene.time.delayedCall(POST_GESTURE_COOLDOWN_MS, () => {
        this.scene.input.enabled = true;
      });
    }
    this.updateResetButtonVisibility();
  }

  /** Cancels any in-flight gesture and restores scene.input immediately — used when this whole controller is disabled mid-gesture (see setEnabled()). */
  private abortGesture(): void {
    const wasGesture = this.mode !== 'idle';
    this.mode = 'idle';
    this.touches.clear();
    this.cooldownTimer?.remove();
    if (wasGesture) {
      this.scene.input.enabled = true;
    }
  }

  // ---- reset-to-100% button ------------------------------------------

  private createResetButton(): void {
    this.generateResetButtonTexture();

    const container = this.scene.add
      .container(0, 0)
      .setDepth(RESET_BUTTON_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    const bg = this.scene.add.image(0, 0, RESET_BUTTON_TEXTURE_KEY).setOrigin(0.5).setScrollFactor(0);
    const text = this.scene.add
      .text(0, 0, '100%', { fontFamily: FONT_FAMILY, fontSize: '16px', color: '#f2e9d8' })
      .setOrigin(0.5)
      .setScrollFactor(0);
    container.add([bg, text]);

    bg.setInteractive({ useHandCursor: true });
    bg.on(Phaser.Input.Events.POINTER_DOWN, () => this.resetCamera());

    this.resetButtonContainer = container;
    this.positionResetButton();
  }

  private positionResetButton(): void {
    if (!this.resetButtonContainer) {
      return;
    }
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    this.resetButtonContainer.setPosition(
      width - RESET_BUTTON_MARGIN_PX - RESET_BUTTON_SIZE_PX / 2,
      height - RESET_BUTTON_MARGIN_PX - RESET_BUTTON_SIZE_PX / 2,
    );
  }

  private updateResetButtonVisibility(): void {
    const visible = this.scene.cameras.main.zoom > RESET_BUTTON_VISIBLE_ZOOM_THRESHOLD;
    this.resetButtonContainer?.setVisible(visible);
  }

  private resetCamera(): void {
    const camera = this.scene.cameras.main;
    camera.setZoom(MIN_ZOOM);
    camera.centerOn(this.scene.scale.width / 2, this.scene.scale.height / 2);
    this.positionResetButton();
    this.updateResetButtonVisibility();
  }

  private generateResetButtonTexture(): void {
    if (this.scene.textures.exists(RESET_BUTTON_TEXTURE_KEY)) {
      return;
    }
    const size = RESET_BUTTON_SIZE_PX;
    const canvas = this.scene.textures.createCanvas(RESET_BUTTON_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,16,12,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.85)';
    ctx.stroke();

    canvas.refresh();
  }
}
