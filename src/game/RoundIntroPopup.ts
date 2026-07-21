import Phaser from 'phaser';
import { createRtlText } from './rtlText';

const POPUP_DEPTH = 60;

const FADE_MS = 260;
const SCALE_IN_FROM = 0.92;

// Hit area deliberately larger than the drawn button outline ("keep a
// clear hit area larger than the visible outline") — same margin for
// every variant.
const BUTTON_HIT_WIDTH_MARGIN_PX = 32;
const BUTTON_HIT_HEIGHT_MARGIN_PX = 24;

/**
 * Which sizing this instance uses. `'default'` is the original, larger
 * frame (still used by the Libra Room's one-time room-intro popup);
 * `'compact'` is a smaller, tighter frame for the Pink Room's one-time
 * puzzle-intro popup, which now only ever shows one short fixed
 * explanation rather than per-round content. Each variant gets its own
 * texture keys so the two never share (or fight over) a cached texture
 * of the wrong size.
 */
export type RoundIntroPopupVariant = 'default' | 'compact';

interface VariantConfig {
  widthPx: number;
  heightPx: number;
  paddingPx: number;
  titleFontSize: number;
  bodyFontSize: number;
  bodyLineSpacing: number;
  titleTopPaddingPx: number;
  gapTitleToBodyPx: number;
  gapBodyToButtonPx: number;
  buttonWidthPx: number;
  buttonHeightPx: number;
  buttonLabelFontSize: number;
}

const VARIANT_CONFIG: Record<RoundIntroPopupVariant, VariantConfig> = {
  default: {
    widthPx: 560,
    heightPx: 560,
    paddingPx: 44,
    titleFontSize: 38,
    bodyFontSize: 26,
    bodyLineSpacing: 14,
    titleTopPaddingPx: 40,
    gapTitleToBodyPx: 66,
    gapBodyToButtonPx: 44,
    buttonWidthPx: 168,
    buttonHeightPx: 52,
    buttonLabelFontSize: 19,
  },
  // Smaller/tighter throughout — this variant only ever displays one
  // short, fixed title + a 3-line body, never the long room-intro copy
  // the default variant was originally sized for.
  compact: {
    widthPx: 420,
    heightPx: 300,
    paddingPx: 30,
    titleFontSize: 28,
    bodyFontSize: 19,
    bodyLineSpacing: 8,
    titleTopPaddingPx: 26,
    // gapTitleToBodyPx is measured title-TOP to body-TOP, not title-
    // bottom to body-top — at the old value of 22 (title's own rendered
    // height is ~32px), the body's top edge actually landed *above* the
    // title's bottom edge, visually merging the two. 50 (title height +
    // ~18px of real breathing room) gives a clear, deliberate gap below
    // the title while leaving titleTopPaddingPx (so the title itself
    // stays put) and bodyLineSpacing (the tight, compact gap between the
    // body's own lines) untouched.
    gapTitleToBodyPx: 50,
    gapBodyToButtonPx: 24,
    buttonWidthPx: 150,
    buttonHeightPx: 46,
    buttonLabelFontSize: 17,
  },
};

export interface RoundIntroContent {
  title: string;
  body: string;
  buttonLabel: string;
}

/**
 * A centered, screen-fixed modal shown before a puzzle begins: an ancient
 * stone/bronze frame (not a modern dialog box) with a title, a body line,
 * and a single stone confirm button. Owns no puzzle logic — the
 * scene/puzzle supplies content via show() and reacts to onConfirm.
 * Screen-fixed (scrollFactor 0) rather than background-pixel-anchored
 * like the rest of the puzzle mechanism, since it must stay centered in
 * the viewport regardless of the background's cover-scale cropping.
 */
export default class RoundIntroPopup {
  private scene: Phaser.Scene;
  private config: VariantConfig;

  private frameTextureKey: string;
  private buttonTextureKey: string;
  private buttonHoverTextureKey: string;
  private buttonGlowTextureKey: string;
  private bodyWrapWidthPx: number;
  private buttonHitWidthPx: number;
  private buttonHitHeightPx: number;

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

  constructor(scene: Phaser.Scene, variant: RoundIntroPopupVariant = 'default') {
    this.scene = scene;
    this.config = VARIANT_CONFIG[variant];
    this.frameTextureKey = `pink-puzzle-popup-frame-${variant}`;
    this.buttonTextureKey = `pink-puzzle-popup-button-${variant}`;
    this.buttonHoverTextureKey = `pink-puzzle-popup-button-hover-${variant}`;
    this.buttonGlowTextureKey = `pink-puzzle-popup-button-glow-${variant}`;
    this.bodyWrapWidthPx = this.config.widthPx - this.config.paddingPx * 2;
    this.buttonHitWidthPx = this.config.buttonWidthPx + BUTTON_HIT_WIDTH_MARGIN_PX;
    this.buttonHitHeightPx = this.config.buttonHeightPx + BUTTON_HIT_HEIGHT_MARGIN_PX;
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
      .image(0, 0, this.frameTextureKey)
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Title: its own Text object (never mixed with the body), centered,
    // top-anchored so titleY is exactly its top edge.
    this.titleText = createRtlText(this.scene, 0, 0, '', {
      fontSize: `${this.config.titleFontSize}px`,
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
      fontSize: `${this.config.bodyFontSize}px`,
      color: '#e8dcc8',
      lineSpacing: this.config.bodyLineSpacing,
      wordWrap: { width: this.bodyWrapWidthPx, useAdvancedWrap: true },
    })
      .setOrigin(1, 0)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    // Soft additive glow behind the (transparent-fill) button, boosted
    // on hover — the "soft inner or outer glow" hover response.
    this.buttonGlow = this.scene.add
      .image(0, 0, this.buttonGlowTextureKey)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf8a)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.buttonImage = this.scene.add
      .image(0, 0, this.buttonTextureKey)
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.buttonLabel = createRtlText(this.scene, 0, 0, '', {
      fontSize: `${this.config.buttonLabelFontSize}px`,
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
      .zone(0, 0, this.buttonHitWidthPx, this.buttonHitHeightPx)
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
   * body use fixed minimum gaps, but the button's position is computed
   * from the body Text's actual rendered height — "move it lower only if
   * needed after the body is laid out."
   */
  layout(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const cx = width / 2;
    const cy = height / 2;
    const popupTop = cy - this.config.heightPx / 2;

    const titleY = popupTop + this.config.titleTopPaddingPx;
    const bodyY = titleY + this.config.gapTitleToBodyPx;
    const bodyHeight = this.bodyText?.height ?? 0;
    const buttonCenterY = bodyY + bodyHeight + this.config.gapBodyToButtonPx + this.config.buttonHeightPx / 2;

    this.dimmer?.setSize(width, height);
    this.frame?.setPosition(cx, cy);
    this.titleText?.setPosition(cx, titleY);
    // origin (1,0): x is the wrapped paragraph's RIGHT edge, so the
    // fixed-width wrap block stays centered under the title.
    this.bodyText?.setPosition(cx + this.bodyWrapWidthPx / 2, bodyY);
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
    this.buttonImage?.setTexture(hovered ? this.buttonHoverTextureKey : this.buttonTextureKey);
    this.buttonHoverTween?.stop();
    this.buttonHoverTween = this.scene.tweens.add({
      targets: this.buttonGlow,
      alpha: hovered ? 0.6 : 0,
      duration: 150,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // TEMPORARY prototype art: a carved dark stone/bronze frame, wider
  // relief border than the crystal-code panel's, no flat modern dialog
  // fill.
  private generateFrameTexture(): void {
    if (this.scene.textures.exists(this.frameTextureKey)) {
      return;
    }
    const w = this.config.widthPx;
    const h = this.config.heightPx;
    const canvas = this.scene.textures.createCanvas(this.frameTextureKey, w, h);
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
    const w = this.config.buttonWidthPx;
    const h = this.config.buttonHeightPx;
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
    if (this.scene.textures.exists(this.buttonTextureKey)) {
      return;
    }
    const canvas = this.scene.textures.createCanvas(
      this.buttonTextureKey,
      this.config.buttonWidthPx,
      this.config.buttonHeightPx,
    );
    if (!canvas) {
      return;
    }
    this.drawButtonOutline(canvas.getContext(), 'rgba(214,178,112,0.85)', 2.5);
    canvas.refresh();
  }

  // TEMPORARY: the hover state — a brighter, slightly thicker outline
  // (no fill added, staying true to "no solid filled button").
  private generateButtonHoverTexture(): void {
    if (this.scene.textures.exists(this.buttonHoverTextureKey)) {
      return;
    }
    const canvas = this.scene.textures.createCanvas(
      this.buttonHoverTextureKey,
      this.config.buttonWidthPx,
      this.config.buttonHeightPx,
    );
    if (!canvas) {
      return;
    }
    this.drawButtonOutline(canvas.getContext(), 'rgba(255,224,170,1)', 3);
    canvas.refresh();
  }

  // A soft radial glow, sized to sit just behind the button outline —
  // the hover-only "soft inner or outer glow."
  private generateButtonGlowTexture(): void {
    if (this.scene.textures.exists(this.buttonGlowTextureKey)) {
      return;
    }
    const size = this.config.buttonHeightPx * 2.2;
    const canvas = this.scene.textures.createCanvas(this.buttonGlowTextureKey, size, size);
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
