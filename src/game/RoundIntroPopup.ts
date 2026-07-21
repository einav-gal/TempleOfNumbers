import Phaser from 'phaser';
import { createRtlText } from './rtlText';

const FRAME_TEXTURE_KEY = 'pink-puzzle-popup-frame';
const BUTTON_TEXTURE_KEY = 'pink-puzzle-popup-button';
const BUTTON_HOVER_TEXTURE_KEY = 'pink-puzzle-popup-button-hover';
const BUTTON_GLOW_TEXTURE_KEY = 'pink-puzzle-popup-button-glow';

const POPUP_DEPTH = 60;
const POPUP_WIDTH_PX = 560;
const POPUP_HEIGHT_PX = 560;
const POPUP_PADDING_PX = 44;

// Title and body are separate Text objects (never mixed into one block)
// with top-anchored origins, stacked top-down with fixed minimum gaps —
// see repositionContent(). Body height varies a lot round to round (the
// very first round's body is a full room intro + instruction; every
// other round is a single short instruction line), so only the
// button's position is computed from the body's actual rendered height;
// title/body spacing stays fixed since the title is always one short
// line ("חידה N מתוך M") that never wraps.
const TITLE_TOP_PADDING_PX = 40;
const GAP_TITLE_TO_BODY_PX = 66; // 55-70
const GAP_BODY_TO_BUTTON_PX = 44; // 35-50
const BODY_WRAP_WIDTH_PX = POPUP_WIDTH_PX - POPUP_PADDING_PX * 2;

// The button's own drawn outline is deliberately smaller than its
// clickable Zone ("keep a clear hit area larger than the visible
// outline").
const BUTTON_WIDTH_PX = 168;
const BUTTON_HEIGHT_PX = 52;
const BUTTON_HIT_WIDTH_PX = BUTTON_WIDTH_PX + 32;
const BUTTON_HIT_HEIGHT_PX = BUTTON_HEIGHT_PX + 24;

const FADE_MS = 260;
const SCALE_IN_FROM = 0.92;

export interface RoundIntroContent {
  title: string;
  body: string;
  buttonLabel: string;
}

/**
 * A centered, screen-fixed modal shown before each puzzle round: an
 * ancient stone/bronze frame (not a modern dialog box) with a title, a
 * body line, and a single stone confirm button. Owns no puzzle logic —
 * the scene/puzzle supplies content via show() and reacts to onConfirm.
 * Screen-fixed (scrollFactor 0) rather than background-pixel-anchored
 * like the rest of the puzzle mechanism, since it must stay centered in
 * the viewport regardless of the background's cover-scale cropping.
 */
export default class RoundIntroPopup {
  private scene: Phaser.Scene;
  private lastWidth = 0;
  private lastHeight = 0;

  private dimmer?: Phaser.GameObjects.Rectangle;
  private frame?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;
  private bodyText?: Phaser.GameObjects.Text;
  private buttonGlow?: Phaser.GameObjects.Image;
  private buttonImage?: Phaser.GameObjects.Image;
  private buttonLabel?: Phaser.GameObjects.Text;
  private buttonZone?: Phaser.GameObjects.Zone;
  private buttonHoverTween?: Phaser.Tweens.Tween;

  private fadeTween?: Phaser.Tweens.Tween;
  private isOpen = false;

  /** Invoked once the player clicks the confirm button. */
  onConfirm?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    this.generateFrameTexture();
    this.generateButtonTexture();
    this.generateButtonHoverTexture();
    this.generateButtonGlowTexture();

    // A soft screen-wide dimmer behind the frame — helps the modal read
    // as blocking the scene, without a modern flat-white dialog look.
    this.dimmer = this.scene.add
      .rectangle(0, 0, 1, 1, 0x0a0605, 0.55)
      .setOrigin(0, 0)
      .setDepth(POPUP_DEPTH - 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.frame = this.scene.add
      .image(0, 0, FRAME_TEXTURE_KEY)
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Title: its own Text object (never mixed with the body), centered,
    // top-anchored so titleY is exactly its top edge. Mixed Hebrew text
    // with an embedded number ("חידה 1 מתוך 3") renders correctly as a
    // single native-bidi Text — Phaser's rtl mode keeps the digit in the
    // right visual position without ever needing the string reversed or
    // split into separate objects.
    this.titleText = createRtlText(this.scene, 0, 0, '', {
      fontSize: '38px',
      color: '#f0d9b8',
      align: 'center',
    })
      .setOrigin(0.5, 0)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Body: right-aligned (native rtl, never manually reversed), a fixed
    // wrap width narrower than the popup, and a top-anchored origin so
    // its measured .height can be used to place the button beneath it.
    this.bodyText = createRtlText(this.scene, 0, 0, '', {
      fontSize: '26px',
      color: '#e8dcc8',
      lineSpacing: 14,
      wordWrap: { width: BODY_WRAP_WIDTH_PX, useAdvancedWrap: true },
    })
      .setOrigin(1, 0)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Soft additive glow behind the (transparent-fill) button, boosted
    // on hover — the "soft inner or outer glow" hover response.
    this.buttonGlow = this.scene.add
      .image(0, 0, BUTTON_GLOW_TEXTURE_KEY)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf8a)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.buttonImage = this.scene.add
      .image(0, 0, BUTTON_TEXTURE_KEY)
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.buttonLabel = createRtlText(this.scene, 0, 0, '', {
      fontSize: '19px',
      color: '#fff2e0',
    })
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH + 2)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Hit area deliberately larger than the drawn outline ("keep a clear
    // hit area larger than the visible outline").
    this.buttonZone = this.scene.add
      .zone(0, 0, BUTTON_HIT_WIDTH_PX, BUTTON_HIT_HEIGHT_PX)
      .setDepth(POPUP_DEPTH + 2);
    this.buttonZone.on(Phaser.Input.Events.POINTER_OVER, () => this.setButtonHovered(true));
    this.buttonZone.on(Phaser.Input.Events.POINTER_OUT, () => this.setButtonHovered(false));
    this.buttonZone.on(Phaser.Input.Events.POINTER_DOWN, () => {
      if (this.isOpen) {
        this.onConfirm?.();
      }
    });
    // Interactivity is only enabled while the popup is actually open —
    // see show()/hide() — matching "close only after the button click"
    // and "popups lock all puzzle input" (nothing behind the modal can
    // be reached, and the modal itself can't be dismissed any other way).

    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  /**
   * Repositions everything to the current viewport center — screen-fixed,
   * not background-anchored. Title/body/button are stacked top-down
   * inside the frame (never centered on top of each other): title and
   * body use fixed minimum gaps (the title is always one short line that
   * never wraps), but the button's position is computed from the body
   * Text's actual rendered height, which varies a lot round to round —
   * "move it lower only if needed after the body is laid out."
   */
  layout(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const cx = width / 2;
    const cy = height / 2;
    const popupTop = cy - POPUP_HEIGHT_PX / 2;

    const titleY = popupTop + TITLE_TOP_PADDING_PX;
    const bodyY = titleY + GAP_TITLE_TO_BODY_PX;
    const bodyHeight = this.bodyText?.height ?? 0;
    const buttonCenterY = bodyY + bodyHeight + GAP_BODY_TO_BUTTON_PX + BUTTON_HEIGHT_PX / 2;

    this.dimmer?.setSize(width, height);
    this.frame?.setPosition(cx, cy);
    this.titleText?.setPosition(cx, titleY);
    // origin (1,0): x is the wrapped paragraph's RIGHT edge, so the
    // fixed-width wrap block stays centered under the title.
    this.bodyText?.setPosition(cx + BODY_WRAP_WIDTH_PX / 2, bodyY);
    this.buttonGlow?.setPosition(cx, buttonCenterY);
    this.buttonImage?.setPosition(cx, buttonCenterY);
    this.buttonLabel?.setPosition(cx, buttonCenterY);
    this.buttonZone?.setPosition(cx, buttonCenterY);
  }

  /** Fills in content and fades the modal in; enables the confirm button only once fully open. */
  show(content: RoundIntroContent): void {
    this.titleText?.setText(content.title);
    this.bodyText?.setText(content.body);
    this.buttonLabel?.setText(content.buttonLabel);
    // Body height (line count) depends on the content just set — button
    // position must be recomputed now, not just on the next resize.
    this.layout(this.lastWidth, this.lastHeight);

    const contentTargets = [this.frame, this.titleText, this.bodyText, this.buttonImage, this.buttonLabel];
    for (const target of [this.dimmer, this.buttonGlow, ...contentTargets]) {
      target?.setVisible(true);
    }
    this.frame?.setScale(SCALE_IN_FROM);
    // The button glow is hover-only — visible, but starts at alpha 0
    // regardless of the rest of the modal fading in.
    this.buttonGlow?.setAlpha(0);

    this.fadeTween?.stop();
    this.fadeTween = this.scene.tweens.add({
      targets: contentTargets,
      alpha: 1,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.scene.tweens.add({
      targets: this.dimmer,
      alpha: 0.55,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.scene.tweens.add({
      targets: this.frame,
      scale: 1,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Back.Out,
    });

    this.isOpen = true;
    this.buttonZone?.setInteractive({ useHandCursor: true });
  }

  /** Fades the modal out and disables its button; onHidden fires once the fade completes. */
  hide(onHidden?: () => void): void {
    this.isOpen = false;
    this.buttonZone?.disableInteractive();
    this.setButtonHovered(false);

    const targets = [this.dimmer, this.frame, this.titleText, this.bodyText, this.buttonImage, this.buttonLabel];
    this.fadeTween?.stop();
    this.fadeTween = this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.In,
      onComplete: () => {
        for (const target of [...targets, this.buttonGlow]) {
          target?.setVisible(false);
        }
        onHidden?.();
      },
    });
  }

  destroy(): void {
    this.fadeTween?.stop();
    this.buttonHoverTween?.stop();
    this.dimmer?.destroy();
    this.frame?.destroy();
    this.titleText?.destroy();
    this.bodyText?.destroy();
    this.buttonGlow?.destroy();
    this.buttonImage?.destroy();
    this.buttonLabel?.destroy();
    this.buttonZone?.destroy();
  }

  // Transparent-fill button, so "hover" reads through a brighter outline
  // texture swap plus a soft additive glow — not a scale bump, which
  // would read like a modern web button.
  private setButtonHovered(hovered: boolean): void {
    this.buttonImage?.setTexture(hovered ? BUTTON_HOVER_TEXTURE_KEY : BUTTON_TEXTURE_KEY);
    this.buttonHoverTween?.stop();
    this.buttonHoverTween = this.scene.tweens.add({
      targets: this.buttonGlow,
      alpha: hovered ? 0.6 : 0,
      duration: 150,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // TEMPORARY prototype art: a carved dark stone/bronze frame, wider
  // relief border than the crystal-code panel's (this is the "biggest"
  // piece of UI in the room), no flat modern dialog fill.
  private generateFrameTexture(): void {
    if (this.scene.textures.exists(FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = POPUP_WIDTH_PX;
    const h = POPUP_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(FRAME_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 22;

    const drawRoundedRect = (x: number, y: number, width: number, height: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    };

    const outerGrad = ctx.createLinearGradient(0, 0, 0, h);
    outerGrad.addColorStop(0, '#8a7050');
    outerGrad.addColorStop(0.5, '#5a4a35');
    outerGrad.addColorStop(1, '#2c2415');
    drawRoundedRect(1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = outerGrad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(214,178,112,0.7)';
    ctx.stroke();

    const inset = 16;
    const innerGrad = ctx.createLinearGradient(0, inset, 0, h - inset);
    innerGrad.addColorStop(0, '#221b13');
    innerGrad.addColorStop(1, '#120d08');
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 8);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Subtle pink reflected glow along the interior edge, echoing the
    // room's crystal light rather than a neutral UI border.
    ctx.save();
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,140,205,0.3)';
    ctx.stroke();
    ctx.restore();

    // Four small corner rivets, reinforcing the "carved stone plaque" feel.
    ctx.fillStyle = 'rgba(214,178,112,0.55)';
    const rivetR = 3.5;
    const rivetInset = 26;
    for (const [rx, ry] of [
      [rivetInset, rivetInset],
      [w - rivetInset, rivetInset],
      [rivetInset, h - rivetInset],
      [w - rivetInset, h - rivetInset],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, rivetR, 0, Math.PI * 2);
      ctx.fill();
    }

    canvas.refresh();
  }

  // An elongated rounded-pill OUTLINE only — no solid fill — matching
  // the room's carved-stone/bronze style without reading as a modern
  // filled UI button. Shared path builder so the hover variant (drawn
  // separately below) can't visually drift from this one.
  private drawButtonOutline(ctx: CanvasRenderingContext2D, strokeStyle: string, lineWidth: number): void {
    const w = BUTTON_WIDTH_PX;
    const h = BUTTON_HEIGHT_PX;
    const r = h / 2 - 1;
    const inset = lineWidth / 2 + 1;

    ctx.beginPath();
    ctx.moveTo(r + inset, inset);
    ctx.arcTo(w - inset, inset, w - inset, h - inset, r);
    ctx.arcTo(w - inset, h - inset, inset, h - inset, r);
    ctx.arcTo(inset, h - inset, inset, inset, r);
    ctx.arcTo(inset, inset, w - inset, inset, r);
    ctx.closePath();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }

  // TEMPORARY prototype art: default bronze/gold outline, transparent
  // interior.
  private generateButtonTexture(): void {
    if (this.scene.textures.exists(BUTTON_TEXTURE_KEY)) {
      return;
    }
    const canvas = this.scene.textures.createCanvas(BUTTON_TEXTURE_KEY, BUTTON_WIDTH_PX, BUTTON_HEIGHT_PX);
    if (!canvas) {
      return;
    }
    this.drawButtonOutline(canvas.getContext(), 'rgba(214,178,112,0.85)', 2.5);
    canvas.refresh();
  }

  // TEMPORARY: the hover state — a brighter, slightly thicker outline
  // (no fill added, staying true to "no solid filled button").
  private generateButtonHoverTexture(): void {
    if (this.scene.textures.exists(BUTTON_HOVER_TEXTURE_KEY)) {
      return;
    }
    const canvas = this.scene.textures.createCanvas(BUTTON_HOVER_TEXTURE_KEY, BUTTON_WIDTH_PX, BUTTON_HEIGHT_PX);
    if (!canvas) {
      return;
    }
    this.drawButtonOutline(canvas.getContext(), 'rgba(255,224,170,1)', 3);
    canvas.refresh();
  }

  // A soft radial glow, sized to sit just behind the button outline —
  // the hover-only "soft inner or outer glow."
  private generateButtonGlowTexture(): void {
    if (this.scene.textures.exists(BUTTON_GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = BUTTON_HEIGHT_PX * 2.2;
    const canvas = this.scene.textures.createCanvas(BUTTON_GLOW_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
