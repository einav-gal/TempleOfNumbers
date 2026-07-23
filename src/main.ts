import Phaser from 'phaser';
import CentralHallScene from './scenes/CentralHallScene';
import PuzzlePlaceholderScene from './scenes/PuzzlePlaceholderScene';
import HiddenPassageScene from './scenes/HiddenPassageScene';
import PinkRoomScene from './scenes/PinkRoomScene';
import LibraRoomScene from './scenes/LibraRoomScene';
import LibraStaircaseScene from './scenes/LibraStaircaseScene';
import Room3Scene from './scenes/Room3Scene';

// Wait for the shared Bellefair font (see src/game/textStyle.ts) to
// actually be usable before any scene creates its first Phaser Text —
// otherwise the very first frame renders with a fallback system font
// and visibly swaps once the webfont arrives.
async function boot(): Promise<void> {
  await document.fonts.load('32px Bellefair');
  await document.fonts.ready;

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1536,
      height: 1024,
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
}

void boot();
