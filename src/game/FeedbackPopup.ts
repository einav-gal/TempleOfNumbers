import Phaser from 'phaser';
import { createRtlText } from './rtlText';
import { isMobileDevice } from './scaleMode';

const FRAME_TEXTURE_KEY = 'pink-puzzle-feedback-frame';
const HINT_FRAME_TEXTURE_KEY = 'pink-puzzle-feedback-frame-hint';
const GLOW_TEXTURE_KEY = 'pink-puzzle-feedback-glow';

// Below RoundIntroPopup's depth range (60-62) — the two are mutually
// exclusive by state (round intros only run during ROUND_INTRO; this
// popup only runs during a feedback state or ALIGNING_RINGS' inactivity
// hint) but kept visually distinct just in case of an edge-case frame
// overlap during a transition.
const POPUP_DEPTH = 58;

// Bumped up (font sizes and panel dimensions together) after real-device
// feedback that this popup's text read too small — bodies here are all
// short single lines (see each puzzle's own FEEDBACK_*_BODY constants),
// and the title already has its own auto-shrink safety net
// (fitTitleToFrame()), so there's comfortable headroom for this increase.
const NORMAL_WIDTH_PX = 460;
const NORMAL_HEIGHT_PX = 190;
const NORMAL_TITLE_FONT_PX = 42;
const NORMAL_BODY_FONT_PX = 29;
const NORMAL_TITLE_OFFSET_Y_PX = -36;
const NORMAL_BODY_OFFSET_Y_PX = 28;

const HINT_WIDTH_PX = 370;
const HINT_HEIGHT_PX = 145;
const HINT_TITLE_FONT_PX = 27;
const HINT_BODY_FONT_PX = 19;
const HINT_TITLE_OFFSET_Y_PX = -28;
const HINT_BODY_OFFSET_Y_PX = 19;

const NORMAL_BODY_WRAP_WIDTH_PX = NORMAL_WIDTH_PX - 60;
const HINT_BODY_WRAP_WIDTH_PX = HINT_WIDTH_PX - 50;
const NORMAL_TITLE_MAX_WIDTH_PX = NORMAL_WIDTH_PX - 40;
const HINT_TITLE_MAX_WIDTH_PX = HINT_WIDTH_PX - 40;
const TITLE_MIN_FONT_SIZE_PX = 30;

// Mobile-only (see isMobileDevice() below): same root cause/fix pattern
// as RoundIntroPopup.ts — the whole 1536x1024 design canvas gets
// uniformly CSS-scaled down to fit a real small phone screen (roughly
// 0.48-0.56x at the narrowest tested ENVELOP viewports), so the already-
// "bumped" desktop numbers above still render at barely half their
// design-px size in real physical pixels on mobile. Both bodies here stay
// single short lines regardless of device (see the comment above
// NORMAL_WIDTH_PX), and even the larger ~1.7x panel sizes below stay
// comfortably inside the ENVELOP-visible vertical band (644 logical px —
// see ENVELOP_TOP/BOTTOM_SAFE_MARGIN_PX) with wide margin to spare, so —
// unlike RoundIntroPopup's long-text 'default' variant — no runtime
// shrink-to-fit safety net is needed here.
const MOBILE_NORMAL_WIDTH_PX = 782;
const MOBILE_NORMAL_HEIGHT_PX = 323;
const MOBILE_NORMAL_TITLE_FONT_PX = 72;
const MOBILE_NORMAL_BODY_FONT_PX = 50;
const MOBILE_NORMAL_TITLE_OFFSET_Y_PX = -62;
const MOBILE_NORMAL_BODY_OFFSET_Y_PX = 48;

const MOBILE_HINT_WIDTH_PX = 629;
const MOBILE_HINT_HEIGHT_PX = 247;
const MOBILE_HINT_TITLE_FONT_PX = 46;
const MOBILE_HINT_BODY_FONT_PX = 32;
const MOBILE_HINT_TITLE_OFFSET_Y_PX = -48;
const MOBILE_HINT_BODY_OFFSET_Y_PX = 32;

const MOBILE_NORMAL_BODY_WRAP_WIDTH_PX = MOBILE_NORMAL_WIDTH_PX - 60;
const MOBILE_HINT_BODY_WRAP_WIDTH_PX = MOBILE_HINT_WIDTH_PX - 50;
const MOBILE_NORMAL_TITLE_MAX_WIDTH_PX = MOBILE_NORMAL_WIDTH_PX - 40;
const MOBILE_HINT_TITLE_MAX_WIDTH_PX = MOBILE_HINT_WIDTH_PX - 40;
// fitTitleToFrame()'s shrink floor on mobile — still well above the
// desktop title size (42px), so even a worst-case shrunk mobile title
// never renders smaller, design-px-wise, than desktop's unshrunk one.
const MOBILE_TITLE_MIN_FONT_SIZE_PX = 50;

const FADE_MS = 220;
const PULSE_CYCLE_MS = 260;
const PULSE_REPEATS = 2;

export type FeedbackKind = 'correct' | 'incorrect' | 'duplicate' | 'completed' | 'hint';

export interface FeedbackContent {
  kind: FeedbackKind;
  title: string;
  body: string;
}

interface KindStyle {
  /** Glow tint — the one thing that visibly differs per outcome, since title/body colors stay neutral for readability. */
  tint: number;
  glowAlpha: number;
  /** incorrect/duplicate get a brief amber/red pulse; correct/completed/hint just glow steadily. */
  pulse: boolean;
}

const KIND_STYLES: Record<FeedbackKind, KindStyle> = {
  correct: { tint: 0xff9fd6, glowAlpha: 0.5, pulse: false },
  incorrect: { tint: 0xd97a52, glowAlpha: 0.42, pulse: true },
  duplicate: { tint: 0xffc266, glowAlpha: 0.48, pulse: true },
  completed: { tint: 0xffcf9e, glowAlpha: 0.78, pulse: false },
  hint: { tint: 0xe8c9a0, glowAlpha: 0.22, pulse: false },
};

/**
 * A compact, centered, screen-fixed feedback popup — replaces the
 * puzzle's old small in-panel text for correct/incorrect/duplicate/
 * completed results, plus a smaller variant for the delayed "click the
 * crystal" hint. No button (auto-hides after the given duration); a dark
 * translucent stone/bronze frame with a per-outcome tinted glow is the
 * only visual differentiator between outcomes — title/body stay a
 * neutral, highly-readable ivory. Screen-fixed (scrollFactor 0) like
 * RoundIntroPopup, for the same reason: it must stay centered regardless
 * of the background's cover-scale cropping.
 */
export default class FeedbackPopup {
  private scene: Phaser.Scene;
  /** Picked once (desktop never touches any MOBILE_* constant at all — byte-for-byte identical to before this file changed). */
  private isMobile: boolean;

  private glow?: Phaser.GameObjects.Image;
  private frame?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;
  private bodyText?: Phaser.GameObjects.Text;

  private fadeInTween?: Phaser.Tweens.Tween;
  private glowFadeTween?: Phaser.Tweens.Tween;
  private pulseTween?: Phaser.Tweens.Tween;
  private fadeOutTween?: Phaser.Tweens.Tween;
  private hideTimer?: Phaser.Time.TimerEvent;

  private currentKind: FeedbackKind | null = null;
  private activeTitleOffsetY: number;
  private activeBodyOffsetY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.isMobile = isMobileDevice(scene);
    this.activeTitleOffsetY = this.normalTitleOffsetYPx;
    this.activeBodyOffsetY = this.normalBodyOffsetYPx;
  }

  get isOpen(): boolean {
    return this.currentKind !== null;
  }

  // Each pair below picks this instance's desktop or mobile constant,
  // decided once in the constructor (this.isMobile) — desktop paths are
  // completely untouched (identical to before MOBILE_* existed).
  private get normalWidthPx(): number {
    return this.isMobile ? MOBILE_NORMAL_WIDTH_PX : NORMAL_WIDTH_PX;
  }
  private get normalHeightPx(): number {
    return this.isMobile ? MOBILE_NORMAL_HEIGHT_PX : NORMAL_HEIGHT_PX;
  }
  private get normalTitleFontPx(): number {
    return this.isMobile ? MOBILE_NORMAL_TITLE_FONT_PX : NORMAL_TITLE_FONT_PX;
  }
  private get normalBodyFontPx(): number {
    return this.isMobile ? MOBILE_NORMAL_BODY_FONT_PX : NORMAL_BODY_FONT_PX;
  }
  private get normalTitleOffsetYPx(): number {
    return this.isMobile ? MOBILE_NORMAL_TITLE_OFFSET_Y_PX : NORMAL_TITLE_OFFSET_Y_PX;
  }
  private get normalBodyOffsetYPx(): number {
    return this.isMobile ? MOBILE_NORMAL_BODY_OFFSET_Y_PX : NORMAL_BODY_OFFSET_Y_PX;
  }
  private get normalBodyWrapWidthPx(): number {
    return this.isMobile ? MOBILE_NORMAL_BODY_WRAP_WIDTH_PX : NORMAL_BODY_WRAP_WIDTH_PX;
  }
  private get normalTitleMaxWidthPx(): number {
    return this.isMobile ? MOBILE_NORMAL_TITLE_MAX_WIDTH_PX : NORMAL_TITLE_MAX_WIDTH_PX;
  }
  private get hintWidthPx(): number {
    return this.isMobile ? MOBILE_HINT_WIDTH_PX : HINT_WIDTH_PX;
  }
  private get hintHeightPx(): number {
    return this.isMobile ? MOBILE_HINT_HEIGHT_PX : HINT_HEIGHT_PX;
  }
  private get hintTitleFontPx(): number {
    return this.isMobile ? MOBILE_HINT_TITLE_FONT_PX : HINT_TITLE_FONT_PX;
  }
  private get hintBodyFontPx(): number {
    return this.isMobile ? MOBILE_HINT_BODY_FONT_PX : HINT_BODY_FONT_PX;
  }
  private get hintTitleOffsetYPx(): number {
    return this.isMobile ? MOBILE_HINT_TITLE_OFFSET_Y_PX : HINT_TITLE_OFFSET_Y_PX;
  }
  private get hintBodyOffsetYPx(): number {
    return this.isMobile ? MOBILE_HINT_BODY_OFFSET_Y_PX : HINT_BODY_OFFSET_Y_PX;
  }
  private get hintBodyWrapWidthPx(): number {
    return this.isMobile ? MOBILE_HINT_BODY_WRAP_WIDTH_PX : HINT_BODY_WRAP_WIDTH_PX;
  }
  private get hintTitleMaxWidthPx(): number {
    return this.isMobile ? MOBILE_HINT_TITLE_MAX_WIDTH_PX : HINT_TITLE_MAX_WIDTH_PX;
  }
  private get titleMinFontSizePx(): number {
    return this.isMobile ? MOBILE_TITLE_MIN_FONT_SIZE_PX : TITLE_MIN_FONT_SIZE_PX;
  }

  create(): void {
    this.generateFrameTexture(FRAME_TEXTURE_KEY, this.normalWidthPx, this.normalHeightPx);
    this.generateFrameTexture(HINT_FRAME_TEXTURE_KEY, this.hintWidthPx, this.hintHeightPx);
    this.generateGlowTexture();

    this.glow = this.scene.add
      .image(0, 0, GLOW_TEXTURE_KEY)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
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

    // Bellefair ships a regular weight only — a stroke stands in for the
    // emphasis synthetic bold would otherwise fake.
    this.titleText = createRtlText(this.scene, 0, 0, '', {
      color: '#fff2e0',
      stroke: '#2a1508',
      strokeThickness: 3,
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.bodyText = createRtlText(this.scene, 0, 0, '', {
      color: '#e9ddc9',
      align: 'center',
      wordWrap: { width: this.normalBodyWrapWidthPx, useAdvancedWrap: true },
    })
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH + 1)
      .setScrollFactor(0)
      .setAlpha(0)
      .setVisible(false);

    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  /** Repositions to the current viewport center — screen-fixed, not background-anchored, same as RoundIntroPopup. */
  layout(width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2;
    this.glow?.setPosition(cx, cy);
    this.frame?.setPosition(cx, cy);
    this.titleText?.setPosition(cx, cy + this.activeTitleOffsetY);
    this.bodyText?.setPosition(cx, cy + this.activeBodyOffsetY);
  }

  /**
   * Shows content for approximately durationMs (fade-in + hold + fade-out
   * all included), then auto-hides. onHidden fires once fully faded out —
   * callers that need the puzzle to advance only after the popup clears
   * (e.g. into a digit reveal that shares the same screen area) hook it
   * there instead of racing a separate timer.
   */
  show(content: FeedbackContent, durationMs: number, onHidden?: () => void): void {
    this.hideTimer?.remove();
    this.fadeInTween?.stop();
    this.glowFadeTween?.stop();
    this.pulseTween?.stop();
    this.fadeOutTween?.stop();

    const isHint = content.kind === 'hint';
    const style = KIND_STYLES[content.kind];
    const frameKey = isHint ? HINT_FRAME_TEXTURE_KEY : FRAME_TEXTURE_KEY;
    const glowSize = (isHint ? this.hintWidthPx : this.normalWidthPx) * 1.3;

    this.currentKind = content.kind;
    this.activeTitleOffsetY = isHint ? this.hintTitleOffsetYPx : this.normalTitleOffsetYPx;
    this.activeBodyOffsetY = isHint ? this.hintBodyOffsetYPx : this.normalBodyOffsetYPx;

    this.frame?.setTexture(frameKey);
    this.glow?.setTint(style.tint).setDisplaySize(glowSize, glowSize);
    this.titleText?.setText(content.title).setFontSize(isHint ? this.hintTitleFontPx : this.normalTitleFontPx);
    this.fitTitleToFrame(isHint ? this.hintTitleMaxWidthPx : this.normalTitleMaxWidthPx);
    this.bodyText
      ?.setText(content.body)
      .setFontSize(isHint ? this.hintBodyFontPx : this.normalBodyFontPx)
      .setWordWrapWidth(isHint ? this.hintBodyWrapWidthPx : this.normalBodyWrapWidthPx);

    this.layout(this.scene.scale.width, this.scene.scale.height);

    const textTargets = [this.frame, this.titleText, this.bodyText];
    for (const target of textTargets) {
      target?.setVisible(true).setAlpha(0);
    }
    this.glow?.setVisible(true).setAlpha(0);

    this.fadeInTween = this.scene.tweens.add({
      targets: textTargets,
      alpha: 1,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.glowFadeTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: style.glowAlpha,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        if (style.pulse) {
          this.pulseTween = this.scene.tweens.add({
            targets: this.glow,
            alpha: style.glowAlpha * 0.5,
            duration: PULSE_CYCLE_MS,
            yoyo: true,
            repeat: PULSE_REPEATS,
            ease: Phaser.Math.Easing.Sine.InOut,
          });
        }
      },
    });

    const holdMs = Math.max(0, durationMs - FADE_MS * 2);
    this.hideTimer = this.scene.time.delayedCall(FADE_MS + holdMs, () => this.hide(onHidden));
  }

  /**
   * Dismisses immediately without waiting for the scheduled duration —
   * "clicking the crystal while the hint is visible should immediately
   * dismiss it." Deliberately does not invoke an onHidden callback: the
   * caller (checkCurrentAlignment()) is about to proceed on its own, not
   * waiting on this popup, and the hint's own reschedule-on-hide logic
   * must not fire here (that would immediately re-arm a new hint).
   */
  dismissImmediately(): void {
    if (!this.isOpen) {
      return;
    }
    this.hideTimer?.remove();
    this.hide();
  }

  destroy(): void {
    this.hideTimer?.remove();
    this.fadeInTween?.stop();
    this.glowFadeTween?.stop();
    this.pulseTween?.stop();
    this.fadeOutTween?.stop();
    this.glow?.destroy();
    this.frame?.destroy();
    this.titleText?.destroy();
    this.bodyText?.destroy();
  }

  /** Shrinks the title font (down to a readable floor) if the longest outcome string would otherwise overrun the frame's edges. */
  private fitTitleToFrame(maxWidth: number): void {
    if (!this.titleText) {
      return;
    }
    let fontSize = this.titleText.style.fontSize
      ? parseInt(String(this.titleText.style.fontSize), 10)
      : this.normalTitleFontPx;
    while (this.titleText.width > maxWidth && fontSize > this.titleMinFontSizePx) {
      fontSize -= 1;
      this.titleText.setFontSize(fontSize);
    }
  }

  private hide(onHidden?: () => void): void {
    this.pulseTween?.stop();
    const targets = [this.frame, this.titleText, this.bodyText, this.glow];
    this.fadeOutTween = this.scene.tweens.add({
      targets,
      alpha: 0,
      duration: FADE_MS,
      ease: Phaser.Math.Easing.Sine.In,
      onComplete: () => {
        for (const target of targets) {
          target?.setVisible(false);
        }
        this.currentKind = null;
        onHidden?.();
      },
    });
  }

  // TEMPORARY prototype art: a dark translucent stone/bronze panel —
  // baked-in partial alpha (not a modern flat dialog fill) so it reads
  // as "ancient and translucent" even at full display alpha.
  private generateFrameTexture(key: string, w: number, h: number): void {
    if (this.scene.textures.exists(key)) {
      return;
    }
    const canvas = this.scene.textures.createCanvas(key, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 20;

    const drawRoundedRect = (x: number, y: number, width: number, height: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + width, y, x + width, y + height, r);
      ctx.arcTo(x + width, y + height, x, y + height, r);
      ctx.arcTo(x, y + height, x, y, r);
      ctx.arcTo(x, y, x + width, y, r);
      ctx.closePath();
    };

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(120,98,70,0.9)');
    grad.addColorStop(0.5, 'rgba(56,45,31,0.92)');
    grad.addColorStop(1, 'rgba(28,22,15,0.94)');
    drawRoundedRect(1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(214,178,112,0.8)';
    ctx.stroke();

    // A soft pink inner-edge glint, echoing the room's crystal light.
    ctx.save();
    const inset = 8;
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 5);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,140,205,0.25)';
    ctx.stroke();
    ctx.restore();

    canvas.refresh();
  }

  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(GLOW_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
