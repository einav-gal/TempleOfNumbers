import Phaser from 'phaser';
import introTorchUrl from '../../assets/images/central-hall/intro-torch.png';
import { FONT_FAMILY } from './textStyle';

const OVERLAY_ALPHA = 0.72;
const FADE_OUT_MS = 500;

// Matches the ring mechanism's carved-gold tone (sampled from the ring art).
const GOLD = 0xc99a46;
const GOLD_BRIGHT = 0xe6c987;

const PANEL_WIDTH_RATIO = 0.61;
const PANEL_MIN_WIDTH = 480;
const PANEL_MAX_WIDTH = 760;
// Text sits well clear of the in-panel torches on either side.
const PANEL_PADDING_X = 92;
const PANEL_PADDING_TOP = 34;
const PANEL_PADDING_BOTTOM = 34;
const EMBLEM_RADIUS = 15;
const EMBLEM_TITLE_GAP = 16;
const TITLE_BODY_GAP = 20;
const BODY_DIVIDER_GAP = 20;
const DIVIDER_BUTTON_GAP = 18;

const TITLE_TEXT = 'מקדש המספרים שקע בדממה.';
const BODY_TEXT = [
  'הגביש המרכזי איבד את כוחו,',
  'והחדרים הנסתרים ננעלו.',
  '',
  'חקרו את האולם.',
  'גלו את הכניסות.',
  'פתרו את האתגרים המתמטיים.',
  '',
  'כל אתגר שתשלימו',
  'ישיב לגביש חלק מכוחו.',
  '',
  'העירו את הגביש',
  'כדי לצאת מהמקדש.',
].join('\n');

const BUTTON_TEXT = 'כניסה למקדש';
const BUTTON_WIDTH = 130;
const BUTTON_HEIGHT = 40;

const DIVIDER_WIDTH_RATIO = 0.5;

const CORNER_INSET = 20;
const CORNER_ARM = 22;

const TORCH_KEY = 'intro-torch';
const TORCH_GLOW_KEY = 'intro-torch-glow';
// Native asset is 522x1374 (full flame + bracket, prepared with alpha).
const TORCH_DISPLAY_HEIGHT = 185;
const TORCH_ASPECT = 522 / 1374;
const TORCH_INSET = 24;

// Two glow layers per torch: a larger soft wash centered on the whole
// torch, and a smaller brighter core near the flame itself.
const OUTER_GLOW_SIZE = 112;
const INNER_GLOW_SIZE = 46;
const INNER_GLOW_Y_OFFSET_RATIO = -0.28;

// Torch "flame-breath": each side runs its own chain of one-off tweens with
// freshly randomized targets (scaleX/scaleY/alpha/y only — never rotation),
// so the flicker never repeats and the two torches never move in lockstep.
const TORCH_SCALE_Y_VAR = 0.03;
const TORCH_SCALE_X_VAR = 0.015;
const TORCH_ALPHA_MIN = 0.92;
const TORCH_ALPHA_MAX = 1;
const TORCH_DRIFT_Y_MIN = 1;
const TORCH_DRIFT_Y_MAX = 2;
const TORCH_BREATH_MIN_MS = 650;
const TORCH_BREATH_MAX_MS = 1300;
const TORCH_BREATH_INITIAL_DELAY_MAX_MS = 350;

// Glow "firelight-breath", same technique, independent from the torch's own
// breath cycle so the two never coincide either. The outer (soft/large)
// layer breathes within the "base" range; the inner (bright/small) layer
// breathes within the "peak" range — each layer gets its own random-tween
// chain, so inner/outer and left/right never move in sync.
const GLOW_BASE_ALPHA_MIN = 0.16;
const GLOW_BASE_ALPHA_MAX = 0.24;
const GLOW_PEAK_ALPHA_MIN = 0.28;
const GLOW_PEAK_ALPHA_MAX = 0.34;
const GLOW_SCALE_VAR = 0.05;
const GLOW_DRIFT_MIN = 1;
const GLOW_DRIFT_MAX = 3;
const GLOW_BREATH_MIN_MS = 650;
const GLOW_BREATH_MAX_MS = 1400;
const GLOW_BREATH_INITIAL_DELAY_MAX_MS = 450;

interface TorchBase {
  y: number;
  scaleX: number;
  scaleY: number;
}

interface FireGlow {
  image: Phaser.GameObjects.Image;
  side: 'left' | 'right';
  layer: 'outer' | 'inner';
  alphaMin: number;
  alphaMax: number;
  base: { x: number; y: number; size: number };
  tween?: Phaser.Tweens.Tween;
}

/**
 * Full-screen Hebrew game-introduction overlay: a dark stone tablet with
 * carved-gold corner/top ornaments, flanked by two prepared torch sprites,
 * over a dim scrim. A bronze button fades everything out. No hints,
 * progress, or sound.
 */
export default class IntroOverlay {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private dim?: Phaser.GameObjects.Rectangle;
  private panel?: Phaser.GameObjects.Graphics;
  private textContainer?: Phaser.GameObjects.Container;
  private titleText?: Phaser.GameObjects.Text;
  private bodyText?: Phaser.GameObjects.Text;
  private buttonBg?: Phaser.GameObjects.Graphics;
  private buttonLabel?: Phaser.GameObjects.Text;
  private buttonHovered = false;

  private glows: FireGlow[] = [];

  private leftTorch?: Phaser.GameObjects.Image;
  private rightTorch?: Phaser.GameObjects.Image;
  private leftTorchBase: TorchBase = { y: 0, scaleX: 1, scaleY: 1 };
  private rightTorchBase: TorchBase = { y: 0, scaleX: 1, scaleY: 1 };
  private leftTorchTween?: Phaser.Tweens.Tween;
  private rightTorchTween?: Phaser.Tweens.Tween;

  private breathingStarted = false;

  /** Invoked once the fade-out finishes and the overlay is destroyed. */
  onDismissed?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(TORCH_KEY, introTorchUrl);
  }

  create(): void {
    this.generateTextures();

    this.container = this.scene.add.container(0, 0).setDepth(1000);

    this.dim = this.scene.add.rectangle(0, 0, 1, 1, 0x000000, OVERLAY_ALPHA).setOrigin(0, 0);
    this.container.add(this.dim);

    this.panel = this.scene.add.graphics();
    this.container.add(this.panel);

    // Warm edge glow sits behind the torch sprite (outer soft layer first,
    // inner bright layer on top of it, both still below the torch); text
    // renders last so neither glow nor flame can ever reach over a word.
    for (const side of ['left', 'right'] as const) {
      for (const layer of ['outer', 'inner'] as const) {
        const size = layer === 'outer' ? OUTER_GLOW_SIZE : INNER_GLOW_SIZE;
        const image = this.scene.add
          .image(0, 0, TORCH_GLOW_KEY)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xff9944)
          .setDisplaySize(size, size)
          .setAlpha(layer === 'outer' ? GLOW_BASE_ALPHA_MIN : GLOW_PEAK_ALPHA_MIN);
        this.container.add(image);
        this.glows.push({
          image,
          side,
          layer,
          alphaMin: layer === 'outer' ? GLOW_BASE_ALPHA_MIN : GLOW_PEAK_ALPHA_MIN,
          alphaMax: layer === 'outer' ? GLOW_BASE_ALPHA_MAX : GLOW_PEAK_ALPHA_MAX,
          base: { x: 0, y: 0, size },
        });
      }
    }

    const torchWidth = TORCH_DISPLAY_HEIGHT * TORCH_ASPECT;
    this.leftTorch = this.scene.add.image(0, 0, TORCH_KEY).setDisplaySize(torchWidth, TORCH_DISPLAY_HEIGHT);
    // Mirrored so both torches' wall-mount plates point outward symmetrically.
    this.rightTorch = this.scene.add
      .image(0, 0, TORCH_KEY)
      .setDisplaySize(torchWidth, TORCH_DISPLAY_HEIGHT)
      .setFlipX(true);
    this.container.add(this.leftTorch);
    this.container.add(this.rightTorch);

    // All introduction text lives in one container so title/body always
    // share a single x — there is no per-line or per-element x offset to
    // drift out of alignment.
    this.textContainer = this.scene.add.container(0, 0);
    this.container.add(this.textContainer);

    this.titleText = this.scene.add
      .text(0, 0, TITLE_TEXT, {
        fontFamily: FONT_FAMILY,
        fontSize: '27px',
        color: '#e8cb84',
        align: 'center',
        rtl: true,
        shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 3, fill: true },
      })
      .setOrigin(0.5);
    this.textContainer.add(this.titleText);

    this.bodyText = this.scene.add
      .text(0, 0, BODY_TEXT, {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#ece0c4',
        align: 'center',
        rtl: true,
        lineSpacing: 18,
        shadow: { offsetX: 0, offsetY: 1, color: '#000000', blur: 2, fill: true },
      })
      .setOrigin(0.5);
    this.textContainer.add(this.bodyText);

    this.buttonBg = this.scene.add.graphics();
    this.buttonLabel = this.scene.add
      .text(0, 0, BUTTON_TEXT, {
        fontFamily: FONT_FAMILY,
        fontSize: '16px',
        color: '#f0dfa8',
        rtl: true,
      })
      .setOrigin(0.5);
    this.container.add(this.buttonBg);
    this.container.add(this.buttonLabel);
    this.drawButton();

    this.buttonBg.setInteractive(
      new Phaser.Geom.Rectangle(-BUTTON_WIDTH / 2, -BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT),
      Phaser.Geom.Rectangle.Contains,
    );
    this.buttonBg.input!.cursor = 'pointer';
    this.buttonBg.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.buttonHovered = true;
      this.drawButton();
    });
    this.buttonBg.on(Phaser.Input.Events.POINTER_OUT, () => {
      this.buttonHovered = false;
      this.drawButton();
    });
    this.buttonBg.on(Phaser.Input.Events.POINTER_DOWN, () => this.dismiss());

    this.refreshFontsWhenReady();
  }

  layout(width: number, height: number): void {
    this.dim?.setSize(width, height);

    const panelWidth = Phaser.Math.Clamp(
      width * PANEL_WIDTH_RATIO,
      PANEL_MIN_WIDTH,
      Math.min(PANEL_MAX_WIDTH, width - 40),
    );
    const textWidth = panelWidth - PANEL_PADDING_X * 2;

    this.titleText?.setWordWrapWidth(textWidth, true);
    this.bodyText?.setWordWrapWidth(textWidth, true);

    const titleHeight = this.titleText?.height ?? 0;
    const bodyHeight = this.bodyText?.height ?? 0;

    const panelHeight =
      PANEL_PADDING_TOP +
      EMBLEM_RADIUS * 2 +
      EMBLEM_TITLE_GAP +
      titleHeight +
      TITLE_BODY_GAP +
      bodyHeight +
      BODY_DIVIDER_GAP +
      DIVIDER_BUTTON_GAP +
      BUTTON_HEIGHT +
      PANEL_PADDING_BOTTOM;

    // Local Y offsets, relative to the panel's own center (0,0) — used both
    // to draw ornaments inside the panel Graphics and to position the text
    // container/button (converted to screen space below). Every element
    // that needs to be centered uses this same `centerX`.
    let cursor = -panelHeight / 2 + PANEL_PADDING_TOP;
    const emblemY = cursor + EMBLEM_RADIUS;
    cursor += EMBLEM_RADIUS * 2 + EMBLEM_TITLE_GAP;
    const titleY = cursor + titleHeight / 2;
    cursor += titleHeight + TITLE_BODY_GAP;
    const bodyY = cursor + bodyHeight / 2;
    cursor += bodyHeight + BODY_DIVIDER_GAP;
    const dividerY = cursor;
    cursor += DIVIDER_BUTTON_GAP;
    const buttonY = cursor + BUTTON_HEIGHT / 2;

    const centerX = width / 2;
    const centerY = height / 2;

    this.drawPanel(panelWidth, panelHeight, emblemY, dividerY, textWidth * DIVIDER_WIDTH_RATIO);
    this.panel?.setPosition(centerX, centerY);

    // The text container carries the shared x; title/body only ever set
    // their local x to 0, so they cannot drift apart horizontally.
    this.textContainer?.setPosition(centerX, centerY);
    this.titleText?.setPosition(0, titleY);
    this.bodyText?.setPosition(0, bodyY);

    this.buttonBg?.setPosition(centerX, centerY + buttonY);
    this.buttonLabel?.setPosition(centerX, centerY + buttonY);

    const leftX = centerX - panelWidth / 2 + TORCH_INSET;
    const rightX = centerX + panelWidth / 2 - TORCH_INSET;
    // Geometric middle of the whole title+body block (weighted by actual
    // extents, not just the two elements' centers).
    const textBlockTop = titleY - titleHeight / 2;
    const textBlockBottom = bodyY + bodyHeight / 2;
    const torchY = centerY + (textBlockTop + textBlockBottom) / 2;

    const baseScaleY = TORCH_DISPLAY_HEIGHT / 1374;
    const baseScaleX = (TORCH_DISPLAY_HEIGHT * TORCH_ASPECT) / 522;
    this.leftTorchBase = { y: torchY, scaleX: baseScaleX, scaleY: baseScaleY };
    this.rightTorchBase = { y: torchY, scaleX: baseScaleX, scaleY: baseScaleY };
    this.leftTorch?.setPosition(leftX, torchY).setScale(baseScaleX, baseScaleY);
    this.rightTorch?.setPosition(rightX, torchY).setScale(baseScaleX, baseScaleY);

    for (const glow of this.glows) {
      const x = glow.side === 'left' ? leftX : rightX;
      const y = glow.layer === 'outer' ? torchY : torchY + INNER_GLOW_Y_OFFSET_RATIO * TORCH_DISPLAY_HEIGHT;
      glow.base = { x, y, size: glow.base.size };
      glow.image.setPosition(x, y).setDisplaySize(glow.base.size, glow.base.size);
    }

    if (!this.breathingStarted) {
      this.breathingStarted = true;
      this.scene.time.delayedCall(Phaser.Math.Between(0, TORCH_BREATH_INITIAL_DELAY_MAX_MS), () =>
        this.scheduleTorchBreath('left'),
      );
      this.scene.time.delayedCall(Phaser.Math.Between(0, TORCH_BREATH_INITIAL_DELAY_MAX_MS), () =>
        this.scheduleTorchBreath('right'),
      );
      for (const glow of this.glows) {
        this.scene.time.delayedCall(Phaser.Math.Between(0, GLOW_BREATH_INITIAL_DELAY_MAX_MS), () =>
          this.scheduleGlowBreath(glow),
        );
      }
    }
  }

  // One "breath" of flame motion for the given torch: eases from its rest
  // scale/alpha/y to a freshly randomized target and back (yoyo) — never
  // rotation — then schedules the next breath with new randoms. Guarded by
  // `.active` so a destroyed torch (dismiss()) stops the chain.
  private scheduleTorchBreath(side: 'left' | 'right'): void {
    const torch = side === 'left' ? this.leftTorch : this.rightTorch;
    const base = side === 'left' ? this.leftTorchBase : this.rightTorchBase;
    if (!torch || !torch.active) {
      return;
    }

    const targetScaleY = base.scaleY * (1 + Phaser.Math.FloatBetween(-TORCH_SCALE_Y_VAR, TORCH_SCALE_Y_VAR));
    const targetScaleX = base.scaleX * (1 + Phaser.Math.FloatBetween(-TORCH_SCALE_X_VAR, TORCH_SCALE_X_VAR));
    const targetAlpha = Phaser.Math.FloatBetween(TORCH_ALPHA_MIN, TORCH_ALPHA_MAX);
    const sign = Math.random() < 0.5 ? -1 : 1;
    const targetY = base.y + sign * Phaser.Math.FloatBetween(TORCH_DRIFT_Y_MIN, TORCH_DRIFT_Y_MAX);
    const duration = Phaser.Math.Between(TORCH_BREATH_MIN_MS, TORCH_BREATH_MAX_MS);

    const tween = this.scene.tweens.add({
      targets: torch,
      scaleY: targetScaleY,
      scaleX: targetScaleX,
      alpha: targetAlpha,
      y: targetY,
      duration,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      onComplete: () => this.scheduleTorchBreath(side),
    });

    if (side === 'left') {
      this.leftTorchTween = tween;
    } else {
      this.rightTorchTween = tween;
    }
  }

  // Same idea as scheduleTorchBreath, applied to one glow layer's own
  // alpha/scale/position. Each of the 4 layers (left/right x outer/inner)
  // runs this independently, so none of them ever move in sync — left vs
  // right, or the soft wash vs the bright core.
  private scheduleGlowBreath(glow: FireGlow): void {
    if (!glow.image.active) {
      return;
    }

    const { base } = glow;
    const signX = Math.random() < 0.5 ? -1 : 1;
    const signY = Math.random() < 0.5 ? -1 : 1;
    const targetAlpha = Phaser.Math.FloatBetween(glow.alphaMin, glow.alphaMax);
    const targetSize = base.size * (1 + Phaser.Math.FloatBetween(-GLOW_SCALE_VAR, GLOW_SCALE_VAR));
    const targetX = base.x + signX * Phaser.Math.FloatBetween(GLOW_DRIFT_MIN, GLOW_DRIFT_MAX);
    const targetY = base.y + signY * Phaser.Math.FloatBetween(GLOW_DRIFT_MIN, GLOW_DRIFT_MAX);
    const duration = Phaser.Math.Between(GLOW_BREATH_MIN_MS, GLOW_BREATH_MAX_MS);

    glow.tween = this.scene.tweens.add({
      targets: glow.image,
      alpha: targetAlpha,
      displayWidth: targetSize,
      displayHeight: targetSize,
      x: targetX,
      y: targetY,
      duration,
      ease: Phaser.Math.Easing.Sine.InOut,
      yoyo: true,
      onComplete: () => this.scheduleGlowBreath(glow),
    });
  }

  private drawPanel(w: number, h: number, emblemY: number, dividerY: number, dividerWidth: number): void {
    if (!this.panel) {
      return;
    }
    const x = -w / 2;
    const y = -h / 2;
    this.panel.clear();

    this.panel.fillStyle(0x15110c, 0.96);
    this.panel.fillRoundedRect(x - 6, y - 6, w + 12, h + 12, 16);

    this.panel.fillStyle(0x362c22, 0.97);
    this.panel.fillRoundedRect(x, y, w, h, 12);

    this.panel.lineStyle(2, GOLD, 0.75);
    this.panel.strokeRoundedRect(x + 10, y + 10, w - 20, h - 20, 8);

    this.panel.lineStyle(1, 0x6b5a3c, 0.5);
    this.panel.strokeRoundedRect(x + 14, y + 14, w - 28, h - 28, 6);

    // Carved-gold corners, mirrored into a symmetrical frame.
    this.drawCornerOrnament(x + CORNER_INSET, y + CORNER_INSET, 1, 1);
    this.drawCornerOrnament(-x - CORNER_INSET, y + CORNER_INSET, -1, 1);
    this.drawCornerOrnament(x + CORNER_INSET, -y - CORNER_INSET, 1, -1);
    this.drawCornerOrnament(-x - CORNER_INSET, -y - CORNER_INSET, -1, -1);

    // Single symmetrical compass/star emblem, top center.
    this.drawEmblem(0, emblemY, EMBLEM_RADIUS);

    // Thin ornamental divider above the button.
    this.drawDivider(0, dividerY, dividerWidth);
  }

  private drawCornerOrnament(cx: number, cy: number, sx: number, sy: number): void {
    if (!this.panel) {
      return;
    }
    this.panel.lineStyle(1.5, GOLD, 0.8);
    this.panel.beginPath();
    this.panel.moveTo(cx, cy);
    this.panel.lineTo(cx + sx * CORNER_ARM, cy);
    this.panel.moveTo(cx, cy);
    this.panel.lineTo(cx, cy + sy * CORNER_ARM);
    this.panel.strokePath();
    this.drawDiamond(cx, cy, 6, GOLD, 0.9);
  }

  private drawEmblem(cx: number, cy: number, radius: number): void {
    if (!this.panel) {
      return;
    }
    this.panel.lineStyle(1.5, GOLD, 0.85);
    this.panel.strokeCircle(cx, cy, radius);
    this.panel.strokeCircle(cx, cy, radius * 0.5);
    for (let i = 0; i < 8; i++) {
      const angle = ((Math.PI * 2) / 8) * i;
      const innerR = radius * 0.62;
      const outerR = radius * 1.2;
      this.panel.lineBetween(
        cx + Math.cos(angle) * innerR,
        cy + Math.sin(angle) * innerR,
        cx + Math.cos(angle) * outerR,
        cy + Math.sin(angle) * outerR,
      );
    }
    this.drawDiamond(cx, cy, radius * 0.32, GOLD, 0.9);
  }

  private drawDivider(cx: number, y: number, width: number): void {
    if (!this.panel) {
      return;
    }
    const half = width / 2;
    this.panel.lineStyle(1.5, GOLD, 0.55);
    this.panel.lineBetween(cx - half, y, cx - 10, y);
    this.panel.lineBetween(cx + 10, y, cx + half, y);
    this.drawDiamond(cx, y, 6, GOLD, 0.85);
  }

  // A small rotated square, drawn via a local canvas-transform so callers
  // don't need their own trig for "just a diamond accent".
  private drawDiamond(cx: number, cy: number, size: number, color: number, alpha: number): void {
    if (!this.panel) {
      return;
    }
    this.panel.save();
    this.panel.translateCanvas(cx, cy);
    this.panel.rotateCanvas(Math.PI / 4);
    this.panel.fillStyle(color, alpha);
    this.panel.fillRect(-size / 2, -size / 2, size, size);
    this.panel.restore();
  }

  private drawButton(): void {
    if (!this.buttonBg) {
      return;
    }
    const w = BUTTON_WIDTH;
    const h = BUTTON_HEIGHT;
    const borderColor = this.buttonHovered ? GOLD_BRIGHT : GOLD;
    this.buttonBg.clear();

    this.buttonBg.fillStyle(0x1c1712, 1);
    this.buttonBg.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 10);

    this.buttonBg.fillStyle(this.buttonHovered ? 0x453824 : 0x362c22, 1);
    this.buttonBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);

    this.buttonBg.lineStyle(1.5, borderColor, 0.9);
    this.buttonBg.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 6);

    // Tiny corner ticks so the border reads as ornamental, not a flat box.
    const tick = 5;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = sx * (w / 2 - 2);
        const cy = sy * (h / 2 - 2);
        this.buttonBg.lineStyle(1.5, borderColor, 0.9);
        this.buttonBg.lineBetween(cx, cy, cx - sx * tick, cy);
        this.buttonBg.lineBetween(cx, cy, cx, cy - sy * tick);
      }
    }
  }

  private dismiss(): void {
    if (!this.container) {
      return;
    }
    this.buttonBg?.disableInteractive();
    for (const glow of this.glows) {
      glow.tween?.stop();
    }
    this.leftTorchTween?.stop();
    this.rightTorchTween?.stop();
    const container = this.container;
    this.container = undefined;
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      duration: FADE_OUT_MS,
      onComplete: () => {
        container.destroy();
        this.onDismissed?.();
      },
    });
  }

  // Canvas text is drawn with whichever font is available at that instant;
  // if the webfont finishes loading a moment later, force one redraw so the
  // intended typeface (not the serif fallback) is what the player sees.
  private refreshFontsWhenReady(): void {
    document.fonts.ready
      .then(() => {
        this.titleText?.updateText();
        this.bodyText?.updateText();
        this.buttonLabel?.updateText();
      })
      .catch(() => {});
  }

  // A single soft radial dot for the additive edge-glow (the torch itself
  // is the prepared intro-torch.png sprite, not a procedural texture).
  private generateTextures(): void {
    if (this.scene.textures.exists(TORCH_GLOW_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(TORCH_GLOW_KEY, size, size);
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
