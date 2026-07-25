import Phaser from 'phaser';
import { FONT_FAMILY } from './textStyle';

// TEMPORARY diagnostic — logs pointer/world/camera state and the
// clicked object's name on every pointerdown, to verify clicks actually
// reach game objects correctly after a pinch/pan. Same on/off-flag
// convention as EquivalencePuzzle.ts's DEBUG_LOG_SELECTION. Flip to
// false once verified on a real device.
const DEBUG_LOG_CLICKS = true;

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const CLICK_DRAG_THRESHOLD_PX = 10;
const SUPPRESS_CLICKS_COOLDOWN_MS = 150; // within the requested 120-180ms range
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
 * CentralHallScene/PinkRoomScene/LibraRoomScene/Room3Scene). All zoom is
 * `camera.setZoom()` + direct `camera.scrollX`/`scrollY` assignment —
 * never CSS transform, never resizing the canvas element, never a
 * browser-level zoom. Phaser's own input system then hit-tests every
 * ordinary game object against that same camera automatically, so
 * nothing here does manual screen-coordinate hit testing, and the only
 * interactive object this class ever creates is the small 52x52 reset
 * button (`scrollFactor(0)`) — never a full-viewport Zone/Rectangle that
 * could sit above (and swallow clicks meant for) ordinary scene content.
 *
 * WHY THIS LISTENS VIA RAW DOM TOUCH EVENTS, NOT `scene.input.on(...)`:
 * the natural design would be to track the pinch/pan gesture itself via
 * Phaser's own `scene.input.on('pointerdown'/'pointermove'/'pointerup')`
 * — but Phaser's InputPlugin gates its ENTIRE update pipeline on
 * `this.isActive()` (see `InputPlugin.update()` in Phaser's own source),
 * which returns false the instant `scene.input.enabled = false`. That
 * means the moment this class suppresses clicks on *other* objects by
 * disabling scene input, its OWN `scene.input.on(...)` listeners would
 * also stop firing — with no way left to detect "the gesture ended" and
 * re-enable input, permanently soft-locking every click in the scene.
 * Raw `touchstart/move/end` listeners on the canvas element are
 * unaffected by `scene.input.enabled` (they're plain DOM events, not
 * routed through Phaser's InputPlugin at all), so gesture tracking keeps
 * working right through the same window where clicks are suppressed.
 * `scene.input.on(...)` is still used below, but only for the temporary
 * read-only debug log — never for anything the suppression logic itself
 * depends on.
 *
 * Deliberately NOT installed in LibraStaircaseScene — that scene is a
 * ~2s fully non-interactive scripted camera fly-through
 * (`input.enabled` is false for its whole lifetime, and its own camera
 * tweens already own zoom/scroll), so there is no gesture to serve there
 * and installing this would only risk fighting that scripted camera move.
 *
 * Respects `scene.input.enabled` (every scene here already uses this
 * exact flag to lock input during entry/exit camera transitions) plus
 * its own `enable()`/`disable()` escape hatch (used by CentralHallScene
 * to stay off while the intro overlay — which isn't camera-scroll-
 * independent — is still showing), so it never needs to know about any
 * scene's specific transition/overlay logic.
 *
 * Click suppression model (isPinching / isDragging / suppressClicks):
 * `suppressClicks` is the ONE flag that ever touches
 * `scene.input.enabled`, and it is only ever cleared from a SINGLE place
 * (`stopSuppressingClicksAfterCooldown()`), itself only ever called once
 * every touch has actually lifted (touches.size reaches 0). Earlier
 * transitions (e.g. a pinch dropping from 2 fingers to 1) only ever
 * update `isPinching`/`isDragging`, never `suppressClicks` directly —
 * an earlier version of this file *did* reset its gesture state straight
 * to idle on that 2-to-1 transition without also re-enabling input, which
 * left every click in the scene permanently dead the moment a pinch
 * happened to end back near zoom=1. Routing every re-enable through one
 * function, gated on "zero touches remain", is what closes that bug.
 *
 * KNOWN LIMITATION: this project's buttons/zones fire on POINTER_DOWN
 * (not a clean click-with-no-movement), and Phaser dispatches a game
 * object's own pointerdown handler before this class's DOM-level touch
 * handler for that same physical event runs — so the very first touch of
 * a gesture that turns out to be a pinch/drag can still trigger whatever
 * is directly underneath it, exactly as a plain tap there always would.
 * Only the *rest* of the gesture (and a short cooldown after release)
 * actively suppresses further clicks. Changing every scene's press-to-
 * activate convention to a release-based click model instead is out of
 * scope here.
 */
export default class MobilePinchZoom {
  private scene: Phaser.Scene;
  private canvas?: HTMLCanvasElement;
  private isEnabled = true;

  private resetButtonContainer?: Phaser.GameObjects.Container;

  private touches = new Map<number, TouchPoint>();

  /** True only while 2+ fingers are actively being interpreted as a pinch. */
  private isPinching = false;
  /** True once a single-finger touch (while zoomed in) has crossed the drag threshold, or continues a pinch that dropped to one remaining finger. */
  private isDragging = false;
  /** The one flag that ever touches scene.input.enabled — see the class doc comment above for why it's only ever cleared in one place. */
  private suppressClicks = false;

  private pinchPrevDistance = 0;
  private pinchPrevMidpoint: TouchPoint = { x: 0, y: 0 };

  private panPrev: TouchPoint = { x: 0, y: 0 };
  private panTravelDistance = 0;

  private suppressClicksTimer?: Phaser.Time.TimerEvent;

  private readonly handleTouchStart = (event: TouchEvent) => this.onTouchStart(event);
  private readonly handleTouchMove = (event: TouchEvent) => this.onTouchMove(event);
  private readonly handleTouchEnd = (event: TouchEvent) => this.onTouchEnd(event);
  private readonly handleResize = () => this.reset();
  private readonly handleDebugPointerDown = (pointer: Phaser.Input.Pointer) => this.logDebugPointerDown(pointer);
  private readonly handleDebugGameObjectDown = (
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) => this.logDebugGameObjectDown(pointer, gameObject);

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

    if (DEBUG_LOG_CLICKS) {
      // Read-only diagnostics via Phaser's own input system — never part
      // of the suppression logic itself (see the class doc comment for
      // why that has to stay on raw DOM events instead).
      this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleDebugPointerDown);
      this.scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, this.handleDebugGameObjectDown);
    }
  }

  /** Re-arms gesture handling — the default state. Every scene except CentralHallScene never needs to call this (it's already the state `create()` leaves things in). */
  enable(): void {
    this.isEnabled = true;
  }

  /** Used by CentralHallScene to stay off while the intro overlay (not camera-scroll-independent) is still showing. Immediately aborts any in-flight gesture and restores input. */
  disable(): void {
    this.isEnabled = false;
    this.abortGesture();
  }

  /** Public so the reset button (and anything else that needs it) can trigger the same zoom=1, re-centered, scroll-reset state. */
  reset(): void {
    const camera = this.scene.cameras.main;
    camera.setZoom(MIN_ZOOM);
    camera.centerOn(this.scene.scale.width / 2, this.scene.scale.height / 2);
    this.positionResetButton();
    this.updateResetButtonVisibility();
  }

  destroy(): void {
    this.canvas?.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas?.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas?.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas?.removeEventListener('touchcancel', this.handleTouchEnd);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    if (DEBUG_LOG_CLICKS) {
      this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleDebugPointerDown);
      this.scene.input.off(Phaser.Input.Events.GAMEOBJECT_DOWN, this.handleDebugGameObjectDown);
    }
    this.suppressClicksTimer?.remove();
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
    // touch-position -> the game's fixed 1536x1024 logical space — used
    // here ONLY to measure pinch distance/midpoint in screen space
    // (which is what a scale-ratio gesture should be measured in). Actual
    // world-space anchoring is done exclusively via camera.getWorldPoint()
    // in updatePinch() below — never a hand-derived world formula, and
    // never a manual clientX/clientY-vs-object-bounds hit test (Phaser's
    // own setInteractive()/pointerdown pipeline owns all of that).
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
    if (!this.isEnabled || !this.scene.input.enabled) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.touches.size >= 2) {
      // A genuine two-finger gesture — the only case allowed to
      // preventDefault (a single-finger touchstart never does).
      event.preventDefault();
      this.startPinch();
    } else if (this.touches.size === 1) {
      const point = [...this.touches.values()][0];
      this.panPrev = point;
      this.panTravelDistance = 0;
      // Deliberately NOT suppressing clicks yet, and NOT calling
      // preventDefault — this might just be a plain tap; Phaser's own
      // pointerdown/click handling proceeds completely normally unless
      // and until this crosses the drag threshold below.
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isEnabled || this.touches.size === 0) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.isPinching) {
      event.preventDefault();
      this.updatePinch();
      return;
    }

    if (this.touches.size === 1 && this.scene.cameras.main.zoom > MIN_ZOOM + 0.001) {
      const point = [...this.touches.values()][0];
      this.panTravelDistance += Phaser.Math.Distance.Between(this.panPrev.x, this.panPrev.y, point.x, point.y);
      if (!this.isDragging && this.panTravelDistance > CLICK_DRAG_THRESHOLD_PX) {
        this.isDragging = true;
        this.startSuppressingClicks();
      }
      if (this.isDragging) {
        // No preventDefault here — CSS `touch-action: none` on the
        // canvas already keeps the browser from doing anything with a
        // single-finger drag; a genuine two-finger gesture is the only
        // case this class ever calls preventDefault for.
        this.panCameraBy(point.x - this.panPrev.x, point.y - this.panPrev.y);
      }
      this.panPrev = point;
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.isEnabled) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (this.touches.size >= 2) {
      // Still mid-pinch with the remaining fingers — re-anchor so the
      // next move isn't measured against a now-lifted touch.
      this.startPinch();
      return;
    }

    if (this.isPinching && this.touches.size === 1) {
      // Dropped from 2 fingers to 1. isPinching ends here, but
      // `suppressClicks` is deliberately left untouched (it was already
      // true from startPinch() and is only ever cleared once ALL touches
      // are gone — see stopSuppressingClicksAfterCooldown()) — this is
      // exactly the fix for the bug described in the class doc comment.
      this.isPinching = false;
      const point = [...this.touches.values()][0];
      this.panPrev = point;
      this.panTravelDistance = CLICK_DRAG_THRESHOLD_PX + 1; // already a real gesture, not a fresh tap candidate
      if (this.scene.cameras.main.zoom > MIN_ZOOM + 0.001) {
        this.isDragging = true;
      }
      return;
    }

    if (this.touches.size === 0) {
      this.isPinching = false;
      this.isDragging = false;
      if (this.suppressClicks) {
        this.stopSuppressingClicksAfterCooldown();
      }
      this.updateResetButtonVisibility();
    }
  }

  private startPinch(): void {
    const points = [...this.touches.values()];
    if (points.length < 2) {
      return;
    }
    this.isPinching = true;
    this.startSuppressingClicks();
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
      // screen->world conversion both before and after the zoom change
      // (camera.getWorldPoint()), never a hand-derived formula, so this
      // stays correct regardless of camera rotation/DPR. All zoom is
      // applied only via camera.setZoom() / camera.scrollX / scrollY —
      // never CSS transform, never canvas width/height.
      const worldBefore = camera.getWorldPoint(this.pinchPrevMidpoint.x, this.pinchPrevMidpoint.y);
      camera.setZoom(newZoom);
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

  // ---- click suppression (the ONLY code that ever touches scene.input.enabled) ----

  private startSuppressingClicks(): void {
    this.suppressClicksTimer?.remove();
    this.suppressClicks = true;
    this.scene.input.enabled = false;
  }

  /** The single place suppressClicks/scene.input.enabled are ever restored — only ever called once every touch has actually lifted (see onTouchEnd()'s touches.size===0 branch and abortGesture()). */
  private stopSuppressingClicksAfterCooldown(): void {
    this.suppressClicksTimer?.remove();
    this.suppressClicksTimer = this.scene.time.delayedCall(SUPPRESS_CLICKS_COOLDOWN_MS, () => {
      this.suppressClicks = false;
      this.scene.input.enabled = true;
    });
  }

  /** Cancels any in-flight gesture and restores input immediately (no cooldown) — used when this whole controller is disabled mid-gesture (see disable()). */
  private abortGesture(): void {
    this.isPinching = false;
    this.isDragging = false;
    this.touches.clear();
    this.suppressClicksTimer?.remove();
    if (this.suppressClicks) {
      this.suppressClicks = false;
      this.scene.input.enabled = true;
    }
  }

  // ---- temporary debug logging ----------------------------------------

  private logDebugPointerDown(pointer: Phaser.Input.Pointer): void {
    const camera = this.scene.cameras.main;
    // eslint-disable-next-line no-console
    console.log('[MobilePinchZoom] pointerdown', {
      scene: this.scene.scene.key,
      pointerX: pointer.x,
      pointerY: pointer.y,
      worldX: pointer.worldX,
      worldY: pointer.worldY,
      zoom: camera.zoom,
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
    });
  }

  private logDebugGameObjectDown(_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject): void {
    // eslint-disable-next-line no-console
    console.log('[MobilePinchZoom] hit object:', gameObject.name || gameObject.constructor.name);
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
    bg.on(Phaser.Input.Events.POINTER_DOWN, () => this.reset());

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
