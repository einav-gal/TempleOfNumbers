import Phaser from 'phaser';
import CentralHallScene from './scenes/CentralHallScene';
import HiddenPassageScene from './scenes/HiddenPassageScene';
import PinkRoomScene from './scenes/PinkRoomScene';
import LibraRoomScene from './scenes/LibraRoomScene';
import LibraStaircaseScene from './scenes/LibraStaircaseScene';
import Room3Scene from './scenes/Room3Scene';
import { isFullscreenSupported, isGameFullscreen, toggleGameFullscreen } from './fullscreen';
import MobilePinchZoom from './game/MobilePinchZoom';
import {
  isDebugFinalStageRequested,
  isDebugResetRequested,
  applyDebugFinalStage,
  clearDebugState,
  isDebugModeActive,
} from './game/GameState';

const ZOOM_RESET_POLL_MS = 200;

const ENTER_FULLSCREEN_ICON = '⛶';
const ENTER_FULLSCREEN_LABEL = 'מסך מלא';
const EXIT_FULLSCREEN_ICON = '⤡';
const EXIT_FULLSCREEN_LABEL = 'יציאה ממסך מלא';

// A phone held sideways is short and very wide (e.g. 915x412) — much
// wider than the game's own 1536x1024 (1.5:1) design ratio. FIT would
// then be constrained by the (relatively short) height, leaving big
// black bars on both sides — exactly the "tiny centered game" look this
// query exists to avoid. ENVELOP instead fills the width completely,
// cropping a bit off the top/bottom (never stretching), which is the
// right trade-off specifically for this shape of screen. Desktop/tablet
// (anything not this short-and-landscape) keeps plain FIT.
const PHONE_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 600px)';

function scaleModeForViewport(): Phaser.Scale.ScaleModeType {
  return window.matchMedia(PHONE_LANDSCAPE_QUERY).matches ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
}

// Wait for the shared Bellefair font (see src/game/textStyle.ts) to
// actually be usable before any scene creates its first Phaser Text —
// otherwise the very first frame renders with a fallback system font
// and visibly swaps once the webfont arrives.
async function boot(): Promise<void> {
  await document.fonts.load('32px Bellefair');
  await document.fonts.ready;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    scale: {
      mode: scaleModeForViewport(),
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1536,
      height: 1024,
      expandParent: true,
    },
    // Phaser only tracks ONE pointer by default (input.activePointers
    // defaults to 1), so a second simultaneous touch wouldn't even get
    // its own Pointer object — meaning Phaser's own hit-testing couldn't
    // correctly track two fingers landing on different objects at once,
    // independent of anything MobilePinchZoom.ts does. 3 covers a
    // two-finger gesture plus a little headroom.
    input: {
      activePointers: 3,
    },
    scene: [
  CentralHallScene,
  HiddenPassageScene,
  PinkRoomScene,
  LibraStaircaseScene,
  LibraRoomScene,
  Room3Scene,
],
  });

  // Seeded synchronously, right after construction — Phaser's own scene
  // boot is asynchronous (runs on the next tick of its internal loop, not
  // inside this constructor call), so this always lands before
  // CentralHallScene.create() (the first scene in the array above, and
  // already the game's normal starting point either way) ever runs.
  // Reads/writes go through the exact same registry setters a real
  // playthrough uses — never a parallel state — so a normal visit with no
  // `?debug=...` query param is completely unaffected.
  if (isDebugResetRequested()) {
    clearDebugState(game.registry);
  } else if (isDebugFinalStageRequested()) {
    applyDebugFinalStage(game.registry);
  }
  setUpDebugStageTag(game);

  // Re-evaluate FIT vs ENVELOP whenever the device crosses the
  // phone-landscape threshold (a real rotation, or a desktop window
  // resize) — always by reconfiguring this one existing Scale Manager,
  // never by creating a second Phaser.Game.
  const applyScaleModeForViewport = () => {
    const mode = scaleModeForViewport();
    if (game.scale.scaleMode !== mode) {
      game.scale.scaleMode = mode;
      // The ROOT FIX: Phaser only ever reads `displaySize.aspectMode` (a
      // separate internal Size component) to decide whether to fit-inside
      // or cover-and-crop — and it only copies `scaleMode` into that
      // aspectMode once, during the Scale Manager's own one-time boot().
      // Setting `game.scale.scaleMode` alone (as this used to do) changes
      // a label that nothing downstream ever reads again; without this
      // line the game stayed visually stuck in whichever mode was active
      // at the very first page load — e.g. small/letterboxed FIT forever,
      // even after rotating into short-landscape and "switching" to
      // ENVELOP — which is exactly the "tiny in normal view, only big in
      // fullscreen" symptom (fullscreen just made the still-FIT layout
      // bigger, never actually enveloping/cropping to fill the width).
      game.scale.displaySize.setAspectMode(mode);
    }
    game.scale.refresh();
  };

  window.matchMedia(PHONE_LANDSCAPE_QUERY).addEventListener('change', applyScaleModeForViewport);
  // Belt-and-braces: some mobile browsers briefly report stale
  // innerWidth/innerHeight right as `orientationchange` fires, before the
  // matchMedia query above has settled — a short delay avoids refreshing
  // against those stale values.
  window.addEventListener('orientationchange', () => {
    window.setTimeout(applyScaleModeForViewport, 100);
  });

  setUpFullscreenToggleButton(game);
  setUpZoomResetButton();
}

// A small, unobtrusive on-screen tag — visible ONLY when ?debug=final
// actually applied this session (never in a normal playthrough, and never
// left showing after a plain page load with no debug query param at all).
function setUpDebugStageTag(game: Phaser.Game): void {
  const tag = document.getElementById('debug-stage-tag');
  if (!tag) {
    return;
  }
  tag.classList.toggle('visible', isDebugModeActive(game.registry));
}

// A small, always-present HTML button (never a Phaser object — see
// MobilePinchZoom.ts, which no longer creates any interactive Phaser
// object of its own) that resets whichever scene's camera is currently
// zoomed/panned. Only ever one scene is actually running at a time, so
// MobilePinchZoom.getActive() is unambiguous; a lightweight poll (rather
// than a bespoke event) is enough for a pure show/hide toggle like this.
function setUpZoomResetButton(): void {
  const button = document.getElementById('zoom-reset-toggle');
  if (!button) {
    return;
  }

  button.addEventListener('click', (event) => {
    // This is a real DOM sibling of the canvas (not an overlay Phaser
    // object), so a click here never reaches the canvas on its own — but
    // stop it explicitly anyway, defensively, rather than relying on that
    // DOM structure never changing.
    event.preventDefault();
    event.stopPropagation();
    MobilePinchZoom.getActive()?.reset();
    button.classList.remove('visible');
  });

  window.setInterval(() => {
    const active = MobilePinchZoom.getActive();
    button.classList.toggle('visible', !!active && active.isZoomedOrPanned());
  }, ZOOM_RESET_POLL_MS);
}

// A small, always-present HTML button (not a per-scene Phaser control —
// see index.html) — the intro's own "כניסה למקדש" button already requests
// fullscreen once on first entry (see IntroOverlay.dismiss()), and this
// is the only way back out of it (or back in, if it was ever left),
// regardless of which scene is currently active. Pinch-zoom no longer
// depends on staying out of fullscreen — see MobilePinchZoom.ts, which
// zooms via the Phaser camera instead of the browser.
function setUpFullscreenToggleButton(game: Phaser.Game): void {
  const button = document.getElementById('fullscreen-toggle');
  const icon = document.getElementById('fullscreen-toggle-icon');
  if (!button) {
    return;
  }
  if (!isFullscreenSupported()) {
    button.style.display = 'none';
    return;
  }

  const updateButtonForCurrentState = () => {
    const fullscreen = isGameFullscreen();
    if (icon) {
      icon.textContent = fullscreen ? EXIT_FULLSCREEN_ICON : ENTER_FULLSCREEN_ICON;
    }
    const label = fullscreen ? EXIT_FULLSCREEN_LABEL : ENTER_FULLSCREEN_LABEL;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(fullscreen));
  };

  button.addEventListener('click', () => {
    toggleGameFullscreen();
  });

  // Covers every way fullscreen can change — this button, the browser's
  // own UI/Escape key, or the OS — never just the click above, so the
  // icon/label and the game's own layout always stay in sync.
  document.addEventListener('fullscreenchange', () => {
    updateButtonForCurrentState();
    // Re-fit/re-center the canvas for the new (fullscreen or restored)
    // viewport — the same Scale Manager instance, never a new Phaser.Game.
    game.scale.refresh();
  });

  updateButtonForCurrentState();
}

void boot();
