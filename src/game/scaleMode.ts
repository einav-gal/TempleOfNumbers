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
