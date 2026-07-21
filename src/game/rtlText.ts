import Phaser from 'phaser';
import { FONT_FAMILY } from './textStyle';

/**
 * Creates a Phaser Text object with correct RTL rendering for Hebrew —
 * this project's one shared solution, reused everywhere Hebrew UI text
 * appears rather than fixed per-string. Enables Phaser's built-in `rtl`
 * canvas-direction support (native browser bidi: right-to-left line
 * flow, correct punctuation placement, and natural left-to-right
 * ordering of embedded numbers/math expressions all come from this —
 * never from manually reversing strings, which this project never
 * does) and right-aligns wrapped multi-line text by default.
 */
export function createRtlText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: FONT_FAMILY,
    align: 'right',
    ...style,
    rtl: true,
  });
}
