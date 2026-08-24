import Phaser from 'phaser';

/**
 * True when the game's Scale Manager is currently using ENVELOP — the
 * mode reserved for short phone-landscape screens (see the
 * PHONE_LANDSCAPE_QUERY switch in src/main.ts), which fills the full
 * screen width by cropping some height off the top/bottom rather than
 * letterboxing like FIT does everywhere else.
 *
 * Lets individual UI pieces apply a small, targeted safe-margin/size
 * adjustment only in that specific case (content pinned near the very
 * top/bottom of the fixed 1536x1024 design canvas would otherwise fall
 * inside the cropped-off region), without touching the desktop/tablet
 * FIT layout at all.
 */
export function isEnvelopScaleMode(scene: Phaser.Scene): boolean {
  return scene.scale.scaleMode === Phaser.Scale.ENVELOP;
}

/**
 * How much of the fixed 1536x1024 design canvas ENVELOP crops off the
 * top and bottom edges on the shortest tested phone-landscape screens
 * (e.g. 915x412) — content that must stay visible should keep this much
 * clearance from y=0 and y=1024. A little more generous than the exact
 * worst-case measurement, for safety margin.
 */
export const ENVELOP_TOP_SAFE_MARGIN_PX = 190;
export const ENVELOP_BOTTOM_SAFE_MARGIN_PX = 190;

/**
 * Extra multiplier applied on top of each interactive scene's own
 * background cover-scale (`Math.max(width/bg.width, height/bg.height)`),
 * specifically in ENVELOP mode — requested after real-device feedback
 * that the game looked too small/distant on a short phone-landscape
 * screen, wanting the sides cropped in further too (ENVELOP's own
 * cover-scale already crops zero off the sides on a wide viewport, using
 * only enough scale to match the screen width exactly).
 *
 * Deliberately NOT done via `camera.setZoom()`: Phaser bakes camera zoom
 * into every object's render matrix regardless of `scrollFactor`, so a
 * `scrollFactor(0)` "screen-fixed" object (CrystalHolder, HintSystem's
 * button, every popup) is NOT actually zoom-independent — only scroll-
 * independent — and would shift/scale right along with a camera zoom,
 * breaking their careful corner-anchored positioning. Boosting each
 * scene's own `backgroundScale` instead only affects *world*-anchored
 * content (background, crystal, rings, doorways — everything positioned
 * via that scene's own `toScreenX`/`toScreenY`), leaving screen-fixed UI
 * completely untouched.
 *
 * A uniform scale-up like this can't crop ONLY the sides, though: it
 * enlarges world content symmetrically from its own center, so anything
 * already near the top/bottom edge of ENVELOP's existing
 * ENVELOP_TOP/BOTTOM_SAFE_MARGIN_PX gets pushed further out too,
 * proportionally. Kept modest (12%) for exactly that reason.
 */
export const ENVELOP_EXTRA_ZOOM_FACTOR = 1.12;

/**
 * True on an actual mobile OS (phone or tablet), regardless of current
 * viewport aspect ratio/orientation — unlike `isEnvelopScaleMode()`,
 * which only reflects the *current* short-landscape viewport shape.
 *
 * Real-device reports of a large, broken-looking light-streak artifact
 * on every `image.postFX.addGlow(...)` crystal/pedestal (see
 * `PinkCrystal.ts`/`HeartOfTheTemple.ts`/`Room3Scene.ts`/
 * `MapFractionPuzzle.ts`) kept recurring even after gating the fix on
 * `isEnvelopScaleMode()` — the reporting device's viewport apparently
 * wasn't narrow/short enough to actually trigger ENVELOP mode at the
 * time, meaning that gate silently never applied there. This points to
 * the real cause being a mobile-GPU/WebGL compatibility issue with
 * Phaser's Glow FX pipeline itself, not specifically an ENVELOP-viewport
 * mismatch — so the glow-skip is now gated on this (actual mobile OS)
 * instead, catching the bug on any phone/tablet regardless of the
 * viewport's current aspect ratio or scale mode.
 *
 * Also true when `window.FORCE_MOBILE` was set (see `main-mobile.ts`,
 * loaded only from the dedicated `/mobile/` entry point) — the OS sniff
 * above is known to be unreliable on some real devices (e.g. iPadOS
 * commonly reports as a plain Mac), so the dedicated mobile link forces
 * this on explicitly rather than depending on device detection at all.
 * This also makes every isMobileDevice()-gated behavior in the project
 * reachable from a desktop browser for testing, just by opening
 * `/mobile/` there.
 */
export function isMobileDevice(scene: Phaser.Scene): boolean {
  const os = scene.sys.game.device.os;
  const forced = (window as unknown as { FORCE_MOBILE?: boolean }).FORCE_MOBILE === true;
  return os.android || os.iOS || os.windowsPhone || forced;
}
