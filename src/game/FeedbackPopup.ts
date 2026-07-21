import Phaser from 'phaser';
import { createRtlText } from './rtlText';

const FRAME_TEXTURE_KEY = 'pink-puzzle-feedback-frame';
const HINT_FRAME_TEXTURE_KEY = 'pink-puzzle-feedback-frame-hint';
const GLOW_TEXTURE_KEY = 'pink-puzzle-feedback-glow';

// Below RoundIntroPopup's depth range (60-62) — the two are mutually
// exclusive by state (round intros only run during ROUND_INTRO; this
// popup only runs during a feedback state or ALIGNING_RINGS' inactivity
// hint) but kept visually distinct just in case of an edge-case frame
// overlap during a transition.
const POPUP_DEPTH = 58;

const NORMAL_WIDTH_PX = 420;
const NORMAL_HEIGHT_PX = 170;
const NORMAL_TITLE_FONT_PX = 38;
const NORMAL_BODY_FONT_PX = 26;
const NORMAL_TITLE_OFFSET_Y_PX = -34;
const NORMAL_BODY_OFFSET_Y_PX = 26;

const HINT_WIDTH_PX = 340;
const HINT_HEIGHT_PX = 130;
const HINT_TITLE_FONT_PX = 24;
const HINT_BODY_FONT_PX = 17;
const HINT_TITLE_OFFSET_Y_PX = -26;
const HINT_BODY_OFFSET_Y_PX = 18;

const NORMAL_BODY_WRAP_WIDTH_PX = NORMAL_WIDTH_PX - 60;
const HINT_BODY_WRAP_WIDTH_PX = HINT_WIDTH_PX - 50;
const NORMAL_TITLE_MAX_WIDTH_PX = NORMAL_WIDTH_PX - 40;
const HINT_TITLE_MAX_WIDTH_PX = HINT_WIDTH_PX - 40;
const TITLE_MIN_FONT_SIZE_PX = 28;

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
  private activeTitleOffsetY = NORMAL_TITLE_OFFSET_Y_PX;
  private activeBodyOffsetY = NORMAL_BODY_OFFSET_Y_PX;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get isOpen(): boolean {
    return this.currentKind !== null;
  }

  create(): void {
    this.generateFrameTexture(FRAME_TEXTURE_KEY, NORMAL_WIDTH_PX, NORMAL_HEIGHT_PX);
    this.generateFrameTexture(HINT_FRAME_TEXTURE_KEY, HINT_WIDTH_PX, HINT_HEIGHT_PX);
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
      wordWrap: { width: NORMAL_BODY_WRAP_WIDTH_PX, useAdvancedWrap: true },
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
    const glowSize = (isHint ? HINT_WIDTH_PX : NORMAL_WIDTH_PX) * 1.3;

    this.currentKind = content.kind;
    this.activeTitleOffsetY = isHint ? HINT_TITLE_OFFSET_Y_PX : NORMAL_TITLE_OFFSET_Y_PX;
    this.activeBodyOffsetY = isHint ? HINT_BODY_OFFSET_Y_PX : NORMAL_BODY_OFFSET_Y_PX;

    this.frame?.setTexture(frameKey);
    this.glow?.setTint(style.tint).setDisplaySize(glowSize, glowSize);
    this.titleText?.setText(content.title).setFontSize(isHint ? HINT_TITLE_FONT_PX : NORMAL_TITLE_FONT_PX);
    this.fitTitleToFrame(isHint ? HINT_TITLE_MAX_WIDTH_PX : NORMAL_TITLE_MAX_WIDTH_PX);
    this.bodyText
      ?.setText(content.body)
      .setFontSize(isHint ? HINT_BODY_FONT_PX : NORMAL_BODY_FONT_PX)
      .setWordWrapWidth(isHint ? HINT_BODY_WRAP_WIDTH_PX : NORMAL_BODY_WRAP_WIDTH_PX);

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
      : NORMAL_TITLE_FONT_PX;
    while (this.titleText.width > maxWidth && fontSize > TITLE_MIN_FONT_SIZE_PX) {
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
