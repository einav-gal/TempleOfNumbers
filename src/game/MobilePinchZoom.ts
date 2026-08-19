import Phaser from 'phaser';

// TEMPORARY diagnostic — logs pointer/world/camera state and the
// clicked object's name on every pointerdown, to verify clicks actually
// reach game objects correctly after a pinch/pan. Same on/off-flag
// convention as EquivalencePuzzle.ts's DEBUG_LOG_SELECTION. Now verified
// on a real device — left here, off, in case it's needed again.
const DEBUG_LOG_CLICKS = false;

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const SUPPRESS_CLICKS_COOLDOWN_MS = 150; // within the requested 120-180ms range
const ZOOM_ACTIVE_THRESHOLD = 1.05;
const PAN_ACTIVE_THRESHOLD_PX = 4;
// Safety-net only: normally suppressClicks clears itself within
// SUPPRESS_CLICKS_COOLDOWN_MS of onTouchEnd() seeing zero remaining
// touches (see stopSuppressingClicksAfterCooldown()). But this class's
// listeners are attached to the canvas element specifically (see the
// class doc comment for why raw DOM listeners are used at all) — if a
// finger involved in a pinch lifts while positioned outside the canvas's
// current bounds (very easy to do mid-pinch, fingers spread wide, in
// fullscreen landscape), some mobile browsers can fail to deliver that
// touch's touchend/touchcancel to this element at all, leaving `touches`
// stuck with a phantom entry that never reaches zero — which would
// otherwise leave scene.input.enabled=false, and every click dead, for
// the rest of the session. This forces a clean recovery no matter why
// the normal path didn't fire, without changing that normal path at all.
const MAX_SUPPRESS_CLICKS_MS = 1500;

interface TouchPoint {
  x: number;
  y: number;
}

/**
 * Shared, per-scene two-finger pinch-to-zoom + two-finger pan — installed
 * identically by every interactive room scene instead of duplicating this
 * logic (see CentralHallScene/PinkRoomScene/LibraRoomScene/Room3Scene).
 * All zoom is `camera.setZoom()` + direct `camera.scrollX`/`scrollY`
 * assignment — never CSS transform, never resizing the canvas element,
 * never a browser-level zoom. Phaser's own input system then hit-tests
 * every ordinary game object against that same camera automatically, so
 * nothing here does manual screen-coordinate hit testing, and this class
 * never creates ANY interactive Phaser object of its own (not even a
 * small one) — the single global "reset zoom" control is a plain HTML
 * button over the canvas (see index.html / main.ts), which reads/drives
 * this class only through `MobilePinchZoom.getActive()` (the
 * currently-active scene's instance) and never touches Phaser's input
 * system at all.
 *
 * DELIBERATELY NO SINGLE-FINGER PAN: an earlier version also let a single
 * finger drag-pan the camera once zoomed in, but that gesture is
 * indistinguishable, at the OS/DOM level, from the single-finger drag
 * this same touch would otherwise deliver to a draggable/rotatable game
 * object underneath it (e.g. the Pink Room's rings in EquivalencePuzzle,
 * which rotate via a plain single-pointer drag) — so once zoomed in,
 * trying to grab a ring instead panned the camera out from under it. A
 * single finger is therefore never touched by this class at all (it's
 * left entirely to Phaser's own, already camera-aware, pointer/drag
 * system); only a genuine two-finger touch is ever interpreted as a
 * camera gesture (pinch-to-zoom and/or pan, both handled together in
 * updatePinch() below, since two fingers can never simultaneously be
 * "a normal single-object interaction").
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
 * Click suppression model (isPinching / suppressClicks):
 * `suppressClicks` is the ONE flag that ever touches
 * `scene.input.enabled`, and it is only ever cleared from a SINGLE place
 * (`stopSuppressingClicksAfterCooldown()`), itself only ever called once
 * every touch has actually lifted (touches.size reaches 0). A pinch
 * dropping from 2 fingers to 1 only ever updates `isPinching`, never
 * `suppressClicks` directly — an earlier version of this file *did* reset
 * its gesture state straight to idle on that 2-to-1 transition without
 * also re-enabling input, which left every click in the scene permanently
 * dead the moment a pinch happened to end back near zoom=1. Routing every
 * re-enable through one function, gated on "zero touches remain", is what
 * closes that bug.
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
  /** The currently active scene's instance — the global HTML "reset zoom" button (see main.ts) reads/drives this, never a specific scene directly. Only ever one scene is actually running at a time in this game, so "the active instance" is unambiguous. */
  private static activeInstance: MobilePinchZoom | undefined;

  static getActive(): MobilePinchZoom | undefined {
    return MobilePinchZoom.activeInstance;
  }

  private scene: Phaser.Scene;
  private canvas?: HTMLCanvasElement;
  private isEnabled = true;

  private touches = new Map<number, TouchPoint>();

  /** True only while 2+ fingers are actively being interpreted as a pinch/pan. */
  private isPinching = false;
  /** The one flag that ever touches scene.input.enabled — see the class doc comment above for why it's only ever cleared in one place. */
  private suppressClicks = false;

  private pinchPrevDistance = 0;
  private pinchPrevMidpoint: TouchPoint = { x: 0, y: 0 };

  /** The camera's own centered scroll position at zoom=1, cached whenever resetCameraAndGestureState() runs — the baseline isZoomedOrPanned() compares against, since a two-finger pan-only gesture (fingers translating without spreading) changes scroll without ever changing zoom. */
  private defaultScrollX = 0;
  private defaultScrollY = 0;

  private suppressClicksTimer?: Phaser.Time.TimerEvent;
  /** Safety-net timer — see MAX_SUPPRESS_CLICKS_MS above. Reset every time a fresh pinch/pan begins, cleared whenever suppressClicks clears through any path. */
  private forceClearSuppressTimer?: Phaser.Time.TimerEvent;

  private readonly handleTouchStart = (event: TouchEvent) => this.onTouchStart(event);
  private readonly handleTouchMove = (event: TouchEvent) => this.onTouchMove(event);
  private readonly handleTouchEnd = (event: TouchEvent) => this.onTouchEnd(event);
  // Deliberately does NOT call scale.refresh() itself — it runs AS A
  // RESULT of one (see the RESIZE listener in create()), so doing so
  // again here would recurse. The public reset() below is the one that
  // also triggers a refresh, for external callers (the HTML button).
  private readonly handleResize = () => this.resetCameraAndGestureState();
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

    // This scene is now "the" active one for the global reset button.
    MobilePinchZoom.activeInstance = this;
    // Guarantees a clean starting camera regardless of any leftover state
    // from a previous visit to this same (Phaser-reused) Scene instance.
    this.resetCameraAndGestureState();
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

  /**
   * Whether the "reset zoom" control should currently be visible — the
   * global HTML button (see main.ts) polls this. Checks scroll drift as
   * well as zoom: a two-finger pan-only gesture (translating without
   * spreading) leaves zoom at exactly 1 while still moving the camera
   * away from its default centered framing, so zoom alone would miss it
   * and strand the player with no way back to center.
   */
  isZoomedOrPanned(): boolean {
    const camera = this.scene.cameras.main;
    if (camera.zoom > ZOOM_ACTIVE_THRESHOLD) {
      return true;
    }
    return (
      Math.abs(camera.scrollX - this.defaultScrollX) > PAN_ACTIVE_THRESHOLD_PX ||
      Math.abs(camera.scrollY - this.defaultScrollY) > PAN_ACTIVE_THRESHOLD_PX
    );
  }

  /**
   * Full reset, safe to call from anywhere (including the global HTML
   * button, entirely outside Phaser): stops any active pinch/pan, zeroes
   * isPinching/suppressClicks and every tracked pointer/gesture variable,
   * snaps the camera back to zoom=1 centered on the scene's original
   * framing, asks the Scale Manager to refresh, and THEN re-applies the
   * camera reset one more time against whatever the refresh settled on —
   * so the reset can never visibly "jump again" one frame later. In this
   * project's FIT/ENVELOP scale modes `scene.scale.width/height` (the
   * fixed logical game size) never actually changes from a refresh — only
   * the canvas's CSS display size does — so the two calls resolve
   * identically today, but the second one is what makes that guarantee
   * hold even if that ever stopped being true, rather than relying on it
   * by coincidence.
   */
  reset(): void {
    this.resetCameraAndGestureState();
    this.scene.scale.refresh();
    this.resetCameraAndGestureState();
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
    this.forceClearSuppressTimer?.remove();
    if (MobilePinchZoom.activeInstance === this) {
      MobilePinchZoom.activeInstance = undefined;
    }
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
      // A genuine two-finger gesture — the only case this class ever
      // acts on, and the only case allowed to preventDefault. A single
      // finger is never tracked or suppressed here at all — it's left
      // entirely to Phaser's own pointer/drag system (see the class doc
      // comment on why single-finger pan was removed).
      event.preventDefault();
      this.startPinch();
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isEnabled) {
      return;
    }
    this.touches = this.touchesFromEvent(event);

    if (!this.isPinching) {
      return;
    }
    if (this.touches.size >= 2) {
      event.preventDefault();
      this.updatePinch();
    } else {
      // A finger lifted mid-move, before its touchend fired — stop
      // treating this as a pinch/pan; suppressClicks is deliberately
      // left untouched here (see the class doc comment).
      this.isPinching = false;
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

    if (this.isPinching) {
      // Dropped below 2 fingers. isPinching ends here, but
      // `suppressClicks` is deliberately left untouched (it was already
      // true from startPinch() and is only ever cleared once ALL touches
      // are gone — see stopSuppressingClicksAfterCooldown()) — this is
      // exactly the fix for the bug described in the class doc comment.
      // The remaining single finger (if any) is simply left alone from
      // here on — no single-finger pan to hand it off to.
      this.isPinching = false;
    }

    if (this.touches.size === 0 && this.suppressClicks) {
      this.stopSuppressingClicksAfterCooldown();
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
  }

  // ---- click suppression (the ONLY code that ever touches scene.input.enabled) ----

  private startSuppressingClicks(): void {
    this.suppressClicksTimer?.remove();
    this.suppressClicks = true;
    this.scene.input.enabled = false;

    // Re-armed on every fresh pinch/pan start (a long continuous gesture
    // keeps pushing this out, which is fine — only a genuinely stuck
    // state should ever trip it). See MAX_SUPPRESS_CLICKS_MS above.
    this.forceClearSuppressTimer?.remove();
    this.forceClearSuppressTimer = this.scene.time.delayedCall(MAX_SUPPRESS_CLICKS_MS, () => {
      this.restoreClicks();
    });
  }

  /** The single place suppressClicks/scene.input.enabled are ever restored on the normal path — only ever called once every touch has actually lifted (see onTouchEnd()'s touches.size===0 branch and abortGesture()). */
  private stopSuppressingClicksAfterCooldown(): void {
    this.suppressClicksTimer?.remove();
    this.suppressClicksTimer = this.scene.time.delayedCall(SUPPRESS_CLICKS_COOLDOWN_MS, () => {
      this.restoreClicks();
    });
  }

  /** Actually clears suppressClicks/re-enables input, and cancels the safety-net timer since it's no longer needed — shared by the normal cooldown path and the MAX_SUPPRESS_CLICKS_MS safety net. */
  private restoreClicks(): void {
    this.forceClearSuppressTimer?.remove();
    this.forceClearSuppressTimer = undefined;
    this.suppressClicks = false;
    this.scene.input.enabled = true;
  }

  /** Cancels any in-flight gesture and restores input immediately (no cooldown) — used when this whole controller is disabled mid-gesture (see disable()) or fully reset (see reset()). */
  private abortGesture(): void {
    this.isPinching = false;
    // Every pointer/gesture-tracking variable this class owns — tracked
    // touch identifiers, the previous pinch distance, and the previous
    // pinch/pan midpoint — is zeroed here, not just isPinching, so a
    // reset leaves no stale gesture state behind for the next touch to
    // (harmlessly, since startPinch() always recomputes them, but
    // explicitly rather than by coincidence) pick up.
    this.touches.clear();
    this.pinchPrevDistance = 0;
    this.pinchPrevMidpoint = { x: 0, y: 0 };
    this.suppressClicksTimer?.remove();
    if (this.suppressClicks) {
      this.restoreClicks();
    }
  }

  /** Camera + gesture-state half of reset() — shared with the RESIZE handler, which must NOT also trigger another scale.refresh() (see handleResize's own comment). */
  private resetCameraAndGestureState(): void {
    this.abortGesture();
    const camera = this.scene.cameras.main;
    camera.setZoom(MIN_ZOOM);
    camera.centerOn(this.scene.scale.width / 2, this.scene.scale.height / 2);
    this.defaultScrollX = camera.scrollX;
    this.defaultScrollY = camera.scrollY;
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
}
