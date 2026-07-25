import Phaser from 'phaser';
import CentralHallScene from './scenes/CentralHallScene';
import PuzzlePlaceholderScene from './scenes/PuzzlePlaceholderScene';
import HiddenPassageScene from './scenes/HiddenPassageScene';
import PinkRoomScene from './scenes/PinkRoomScene';
import LibraRoomScene from './scenes/LibraRoomScene';
import LibraStaircaseScene from './scenes/LibraStaircaseScene';
import Room3Scene from './scenes/Room3Scene';
import { isFullscreenSupported, isGameFullscreen, toggleGameFullscreen } from './fullscreen';

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
    // the canvas (to stop the browser's own scroll/pan gesture) — but it
    // does this unconditionally, including for two-finger touches, which
    // would silently swallow pinch-zoom before the browser ever sees it.
    // The CSS touch-action rules in index.html (pinch-zoom on #game/
    // canvas, manipulation on html/body) already do the same
    // single-finger-pan prevention declaratively and correctly leave
    // pinch-zoom alone, so Phaser's own JS-level capture is redundant —
    // disabling it is what actually lets two-finger zoom reach the browser.
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

  setUpFullscreenToggleButton();
}

// A small, always-present HTML button (not a per-scene Phaser control —
// see index.html) so the player can re-enter fullscreen after leaving it
// (browser UI, the OS back gesture, etc.) regardless of which scene is
// currently active. The intro overlay's own "כניסה למקדש" button also
// requests fullscreen once, on first entry (see IntroOverlay.dismiss());
// this button covers every case after that.
function setUpFullscreenToggleButton(): void {
  const button = document.getElementById('fullscreen-toggle');
  if (!button) {
    return;
  }
  if (!isFullscreenSupported()) {
    button.style.display = 'none';
    return;
  }
  button.addEventListener('click', () => {
    toggleGameFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    button.setAttribute('aria-pressed', String(isGameFullscreen()));
  });
}

void boot();
