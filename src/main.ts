import Phaser from 'phaser';
import CentralHallScene from './scenes/CentralHallScene';
import PuzzlePlaceholderScene from './scenes/PuzzlePlaceholderScene';
import HiddenPassageScene from './scenes/HiddenPassageScene';
import PinkRoomScene from './scenes/PinkRoomScene';
import LibraRoomScene from './scenes/LibraRoomScene';
import LibraStaircaseScene from './scenes/LibraStaircaseScene';
import Room3Scene from './scenes/Room3Scene';
import { isFullscreenSupported, isGameFullscreen, toggleGameFullscreen } from './fullscreen';

const ENTER_FULLSCREEN_ICON = '⛶';
const ENTER_FULLSCREEN_LABEL = 'מסך מלא';
const EXIT_FULLSCREEN_ICON = '⤡';
const EXIT_FULLSCREEN_LABEL = 'יציאה ממסך מלא';

// Pinch-zoom support while the Fullscreen API is active is entirely
// browser-dependent (some browsers restrict it) — this is shown once,
// right as fullscreen is entered, so the player isn't surprised if
// two-finger zoom stops responding there; it never blocks or delays the
// fullscreen request itself.
const FULLSCREEN_ZOOM_NOTE_TEXT = 'במסך מלא ייתכן שלא ניתן להגדיל בשתי אצבעות';
const FULLSCREEN_ZOOM_NOTE_DURATION_MS = 3000;
let fullscreenToastTimeoutId: number | undefined;

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
    // By default Phaser calls preventDefault() on every touch event over
    // the canvas — unconditionally, including for two-finger touches,
    // which would silently swallow pinch-zoom before the browser ever
    // sees it. The CSS `touch-action: pan-x pan-y pinch-zoom` rule in
    // index.html already declares the intended touch behavior correctly
    // (and leaves pinch-zoom alone), so Phaser's own JS-level capture is
    // redundant — disabling it is what actually lets two-finger zoom
    // reach the browser.
    input: {
      touch: {
        capture: false,
      },
    },
    scene: [
  CentralHallScene,
  PuzzlePlaceholderScene,
  HiddenPassageScene,
  PinkRoomScene,
  LibraStaircaseScene,
  LibraRoomScene,
  Room3Scene,
],
  });

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
}

// A small, always-present HTML button (not a per-scene Phaser control —
// see index.html) — the game always starts in normal browser view (where
// pinch-zoom is guaranteed to work), and this is the only way in or out
// of fullscreen, regardless of which scene is currently active.
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
    if (!isGameFullscreen()) {
      showFullscreenZoomNote();
    }
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

function showFullscreenZoomNote(): void {
  const toast = document.getElementById('fullscreen-toast');
  if (!toast) {
    return;
  }
  window.clearTimeout(fullscreenToastTimeoutId);
  toast.textContent = FULLSCREEN_ZOOM_NOTE_TEXT;
  toast.classList.add('visible');
  fullscreenToastTimeoutId = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, FULLSCREEN_ZOOM_NOTE_DURATION_MS);
}

void boot();
