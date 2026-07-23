import Phaser from 'phaser';
import backgroundUrl from '../../assets/images/Room3/room3-background.png.png';
import bigCrystalImageUrl from '../../assets/images/Room3/green-crystal.png';
import Doorway from '../game/Doorway';
import CrystalHolder from '../game/CrystalHolder';
import MapFractionPuzzle from '../game/MapFractionPuzzle';
import { createRtlText } from '../game/rtlText';

const BACKGROUND_KEY = 'room3-background';
const OVERLAY_DEPTH = 90;

// The staircase opening painted into the lower-right corner of the
// 1536x1024 attic background. It is the return path to the Central Hall.
const EXIT_CENTER_X = 1402;
const EXIT_CENTER_Y = 875;
const EXIT_SIZE = { widthBg: 210, heightBg: 250 };

// Clearance kept between the puzzle image's safe area and the exit
// hotspot above, so the puzzle can never visually or interactively
// overlap the stairwell — computed fresh every layout() call from the
// exit's real screen position, never a guessed fixed fraction.
const PUZZLE_EXIT_CLEARANCE_PX = 24;
const PUZZLE_SAFE_MARGIN_PX = 16;
const PUZZLE_DEPTH = 5;

// A visual hint above the stairwell exit — already fully interactive
// (Doorway.ts provides the hand cursor, idle glow, and hover intensify)
// both before and after the puzzle is solved; this just makes clear what
// it leads back to.
const EXIT_HINT_TEXT = 'חזרה לאולם הראשי';
const EXIT_HINT_GAP_BG = 40; // bg-px above the doorway's own hitbox
const EXIT_HINT_FONT_PX = 20;
const EXIT_HINT_DEPTH = 3;

// The room's own big green crystal (green-crystal.png) — placed to the
// right of the map, vertically centered on the same row, so it's always
// visible and never covered by the map panel. Its live screen position
// is handed to MapFractionPuzzle so the code-digit reveal and the final
// reward crystal can both animate from its center (see
// getCrystalScreenPosition in the puzzle config below).
const BIG_CRYSTAL_KEY = 'room3-big-crystal';
const BIG_CRYSTAL_NATURAL_WIDTH = 541;
const BIG_CRYSTAL_NATURAL_HEIGHT = 1137;
const BIG_CRYSTAL_DEPTH = 6;
const BIG_CRYSTAL_GLOW_COLOR = 0x4ade80;
const BIG_CRYSTAL_GLOW_PULSE_MS = 2600;
const BIG_CRYSTAL_GLOW_OUTER_STRENGTH = 3;

// Slow, gentle idle motion — vertical-only hover plus a barely-there
// scale breathe — stopped the instant the reward sequence begins (see
// stopCrystalHover(), wired to the puzzle's onRewardSequenceStart) so it
// never fights the reward shard's own flight out of the crystal's center.
const CRYSTAL_FLOAT_AMPLITUDE_PX = 7; // ~14px total top-to-bottom travel
const CRYSTAL_FLOAT_DURATION_MS = 2500; // per direction
const CRYSTAL_SCALE_PULSE_MAX = 1.02;

// A small octagonal stone pedestal beneath the crystal — the crystal's
// lowest hover point always rests CRYSTAL_HOVER_GAP_PX above its top
// surface, so it visibly floats rather than sitting on it.
const PEDESTAL_TEXTURE_KEY = 'room3-crystal-pedestal';
const PEDESTAL_TEX_WIDTH = 240;
const PEDESTAL_TEX_HEIGHT = 140;
const PEDESTAL_ASPECT = PEDESTAL_TEX_HEIGHT / PEDESTAL_TEX_WIDTH;
const PEDESTAL_WIDTH_FRACTION = 0.95; // of the crystal area's own width
const PEDESTAL_DEPTH = 4;
const PEDESTAL_SHADOW_DEPTH = 5;
const PEDESTAL_GLOW_COLOR = 0x4ade80;
const PEDESTAL_GLOW_OUTER_STRENGTH = 1; // weak, static — no pulse, unlike the crystal's own glow
const CRYSTAL_HOVER_GAP_PX = 10; // 8-12px clearance between the crystal's lowest bob and the pedestal's top

// Splits the puzzle's safe-area row between the map (left) and the
// crystal (right) — a gap plus an upper-bounded crystal width, never a
// rigid lower floor, so both shrink together proportionally on narrow
// viewports instead of ever overlapping.
const CRYSTAL_AREA_WIDTH_FRACTION = 0.26;
const CRYSTAL_AREA_MAX_WIDTH_PX = 150;
const MAP_CRYSTAL_GAP_FRACTION = 0.035;
const MAP_CRYSTAL_GAP_MIN_PX = 12;
const MAP_CRYSTAL_GAP_MAX_PX = 28;
const CRYSTAL_MAX_HEIGHT_FRACTION = 0.7;

const ENTRY_START_ZOOM = 1.35;
const ENTRY_START_OVERLAY_ALPHA = 0.72;
const ENTRY_SETTLE_DURATION_MS = 650;
const EXIT_FADE_MS = 400;

/**
 * Room 3: the attic background, entry settle, persistent crystal holder,
 * and working return exit (unchanged from the previous sprint), plus the
 * fraction map puzzle (MapFractionPuzzle) — laid out in a safe area
 * computed from the exit's real screen position every layout() call, so
 * it can never cover the stairwell at any viewport size.
 */
export default class Room3Scene extends Phaser.Scene {
  private background?: Phaser.GameObjects.Image;
  private exit?: Doorway;
  private exitHintText?: Phaser.GameObjects.Text;
  private crystalHolder?: CrystalHolder;
  private mapPuzzle?: MapFractionPuzzle;
  private mapPuzzleCreated = false;
  private bigCrystalImage?: Phaser.GameObjects.Image;
  private bigCrystalGlowTween?: Phaser.Tweens.Tween;
  private bigCrystalFloatTween?: Phaser.Tweens.Tween;
  private bigCrystalPulseTween?: Phaser.Tweens.Tween;
  private bigCrystalBaseY = 0;
  private bigCrystalBaseScaleX = 1;
  private bigCrystalBaseScaleY = 1;
  private pedestalImage?: Phaser.GameObjects.Image;
  private pedestalShadow?: Phaser.GameObjects.Graphics;
  private overlay?: Phaser.GameObjects.Rectangle;
  private backgroundScale = 1;
  private isReturning = false;

  constructor() {
    super('Room3Scene');
  }

  preload(): void {
    this.load.image(BACKGROUND_KEY, backgroundUrl);
    this.load.image(BIG_CRYSTAL_KEY, bigCrystalImageUrl);
    MapFractionPuzzle.preload(this);
  }

  create(): void {
    this.input.enabled = false;
    this.isReturning = false;
    this.mapPuzzleCreated = false;
    this.cameras.main.setZoom(1).setScroll(0, 0);

    this.background = this.add.image(0, 0, BACKGROUND_KEY).setDepth(0);

    this.exit = new Doorway(this, EXIT_SIZE);
    this.exit.create();
    this.exit.setActive(true);
    this.exit.onActivate = () => this.returnToCentralHall();

    this.exitHintText = createRtlText(this, 0, 0, EXIT_HINT_TEXT, {
      fontSize: `${EXIT_HINT_FONT_PX}px`,
      color: '#ffe9c9',
      stroke: '#2a1508',
      strokeThickness: 4,
      align: 'center',
    })
      .setOrigin(0.5)
      .setDepth(EXIT_HINT_DEPTH);

    this.crystalHolder = new CrystalHolder(this);
    this.crystalHolder.create(OVERLAY_DEPTH - 10);

    this.generatePedestalTexture();
    this.pedestalImage = this.add.image(0, 0, PEDESTAL_TEXTURE_KEY).setOrigin(0.5).setDepth(PEDESTAL_DEPTH);
    this.pedestalImage.postFX?.addGlow(PEDESTAL_GLOW_COLOR, PEDESTAL_GLOW_OUTER_STRENGTH, 0, false, 0.1, 6);
    this.pedestalShadow = this.add.graphics().setDepth(PEDESTAL_SHADOW_DEPTH);

    // Sharp and fully opaque — the soft glow behind it (and its own gentle
    // idle motion) is layered on separately, never by dimming the crystal
    // body itself.
    this.bigCrystalImage = this.add
      .image(0, 0, BIG_CRYSTAL_KEY)
      .setOrigin(0.5)
      .setDepth(BIG_CRYSTAL_DEPTH)
      .setAlpha(1);
    const crystalGlowFx = this.bigCrystalImage.postFX?.addGlow(BIG_CRYSTAL_GLOW_COLOR, 0, 0, false, 0.15, 10);
    if (crystalGlowFx) {
      this.bigCrystalGlowTween = this.tweens.add({
        targets: crystalGlowFx,
        outerStrength: BIG_CRYSTAL_GLOW_OUTER_STRENGTH,
        duration: BIG_CRYSTAL_GLOW_PULSE_MS,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
    }

    this.mapPuzzle = new MapFractionPuzzle({
      scene: this,
      depth: PUZZLE_DEPTH,
      crystalHolder: this.crystalHolder,
      getCrystalScreenPosition: () =>
        this.bigCrystalImage ? { x: this.bigCrystalImage.x, y: this.bigCrystalImage.y } : { x: 0, y: 0 },
      onRewardSequenceStart: () => this.stopCrystalHover(),
    });

    this.overlay = this.add
      .rectangle(0, 0, 1, 1, 0x000000, 1)
      .setOrigin(0, 0)
      .setDepth(OVERLAY_DEPTH)
      .setAlpha(ENTRY_START_OVERLAY_ALPHA)
      .setScrollFactor(0);

    this.layout(this.scale.width, this.scale.height);
    this.startCrystalHover();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.crystalHolder?.destroy();
      this.mapPuzzle?.destroy();
      this.bigCrystalGlowTween?.stop();
      this.bigCrystalFloatTween?.stop();
      this.bigCrystalPulseTween?.stop();
    });

    this.playEntryAnimation();
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    this.layout(gameSize.width, gameSize.height);
  }

  private layout(width: number, height: number): void {
    if (!this.background) {
      return;
    }

    this.backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setScale(this.backgroundScale).setPosition(width / 2, height / 2);

    const toScreenX = (bgX: number) =>
      width / 2 + (bgX - this.background!.width / 2) * this.backgroundScale;
    const toScreenY = (bgY: number) =>
      height / 2 + (bgY - this.background!.height / 2) * this.backgroundScale;

    const exitScreenX = toScreenX(EXIT_CENTER_X);
    const exitScreenY = toScreenY(EXIT_CENTER_Y);
    this.exit?.layout(exitScreenX, exitScreenY, this.backgroundScale);

    const exitHintY = toScreenY(EXIT_CENTER_Y - EXIT_SIZE.heightBg / 2 - EXIT_HINT_GAP_BG);
    this.exitHintText
      ?.setPosition(exitScreenX, exitHintY)
      .setFontSize(EXIT_HINT_FONT_PX * this.backgroundScale);

    this.overlay?.setSize(width, height);

    if (this.mapPuzzle) {
      // The exit's real on-screen bounding box (never a guessed fraction),
      // so the puzzle's safe area is guaranteed clear of it at any
      // viewport size.
      const exitHalfWidth = (EXIT_SIZE.widthBg / 2) * this.backgroundScale;
      const exitHalfHeight = (EXIT_SIZE.heightBg / 2) * this.backgroundScale;
      const exitLeft = exitScreenX - exitHalfWidth;
      const exitTop = exitScreenY - exitHalfHeight;

      const safeLeft = PUZZLE_SAFE_MARGIN_PX;
      const safeTop = PUZZLE_SAFE_MARGIN_PX;
      const safeRight = Math.max(exitLeft - PUZZLE_EXIT_CLEARANCE_PX, width * 0.3);
      const safeBottom = Math.max(exitTop - PUZZLE_EXIT_CLEARANCE_PX, height * 0.3);
      const safeWidth = safeRight - safeLeft;
      const safeHeight = safeBottom - safeTop;

      // Splits that same safe row between the map (left) and the
      // crystal (right) — the crystal's width is capped, never floored,
      // so on a narrow viewport both shrink together rather than ever
      // overlapping or overflowing the safe area.
      const gap = Phaser.Math.Clamp(
        safeWidth * MAP_CRYSTAL_GAP_FRACTION,
        MAP_CRYSTAL_GAP_MIN_PX,
        MAP_CRYSTAL_GAP_MAX_PX,
      );
      const crystalAreaWidth = Math.min(safeWidth * CRYSTAL_AREA_WIDTH_FRACTION, CRYSTAL_AREA_MAX_WIDTH_PX);
      const mapAreaWidth = Math.max(1, safeWidth - crystalAreaWidth - gap);
      const rowCenterY = safeTop + safeHeight / 2;
      const mapCenterX = safeLeft + mapAreaWidth / 2;
      const crystalCenterX = safeLeft + mapAreaWidth + gap + crystalAreaWidth / 2;

      if (!this.mapPuzzleCreated) {
        this.mapPuzzle.create(mapCenterX, rowCenterY, mapAreaWidth, safeHeight);
        this.mapPuzzleCreated = true;
      } else {
        this.mapPuzzle.layout(mapCenterX, rowCenterY, mapAreaWidth, safeHeight);
      }

      this.layoutBigCrystal(crystalCenterX, rowCenterY, crystalAreaWidth, safeHeight);
    }
  }

  // Lays out the crystal + its stone pedestal as one vertically-stacked
  // group, centered at (cx, cy) within the crystal area: pedestal at the
  // bottom, crystal above it with CRYSTAL_HOVER_GAP_PX of clearance at
  // the LOWEST point of its hover (plus headroom reserved for the
  // highest point), preserving both assets' own aspect ratios. Also
  // records the base Y/scale the hover animations breathe around, so a
  // resize mid-hover never fights them.
  private layoutBigCrystal(cx: number, cy: number, maxWidth: number, maxHeight: number): void {
    if (!this.bigCrystalImage || !this.pedestalImage || !this.pedestalShadow) {
      return;
    }

    const pedestalWidth = maxWidth * PEDESTAL_WIDTH_FRACTION;
    const pedestalHeight = pedestalWidth * PEDESTAL_ASPECT;

    const crystalAspect = BIG_CRYSTAL_NATURAL_HEIGHT / BIG_CRYSTAL_NATURAL_WIDTH;
    let crystalW = maxWidth;
    let crystalH = crystalW * crystalAspect;

    const crystalMaxH = maxHeight * CRYSTAL_MAX_HEIGHT_FRACTION;
    if (crystalH > crystalMaxH) {
      crystalH = crystalMaxH;
      crystalW = crystalH / crystalAspect;
    }
    const reservedBelow = pedestalHeight + CRYSTAL_HOVER_GAP_PX + CRYSTAL_FLOAT_AMPLITUDE_PX;
    const availableForCrystal = Math.max(20, maxHeight - reservedBelow);
    if (crystalH > availableForCrystal) {
      crystalH = availableForCrystal;
      crystalW = crystalH / crystalAspect;
    }

    const comboHeight = crystalH + CRYSTAL_FLOAT_AMPLITUDE_PX + CRYSTAL_HOVER_GAP_PX + pedestalHeight;
    const comboTop = cy - comboHeight / 2;
    const pedestalCenterY = comboTop + comboHeight - pedestalHeight / 2;
    const pedestalTopY = pedestalCenterY - pedestalHeight / 2;
    const crystalRestY = pedestalTopY - CRYSTAL_HOVER_GAP_PX - crystalH / 2 - CRYSTAL_FLOAT_AMPLITUDE_PX;

    this.pedestalImage.setPosition(cx, pedestalCenterY).setDisplaySize(pedestalWidth, pedestalHeight);

    this.bigCrystalImage.setPosition(cx, crystalRestY).setDisplaySize(crystalW, crystalH);
    this.bigCrystalBaseY = crystalRestY;
    this.bigCrystalBaseScaleX = this.bigCrystalImage.scaleX;
    this.bigCrystalBaseScaleY = this.bigCrystalImage.scaleY;

    // Soft elliptical shadow resting on the pedestal's top surface,
    // directly beneath the crystal.
    const shadowCenterY = pedestalTopY + pedestalHeight * 0.22;
    const shadowWidth = crystalW * 0.75;
    const shadowHeight = shadowWidth * 0.32;
    this.drawPedestalShadow(cx, shadowCenterY, shadowWidth, shadowHeight);
  }

  // A soft-edged elliptical shadow faked with a few overlapping,
  // decreasingly-sized, increasingly-opaque ellipses (cheap blur) —
  // redrawn each layout() call since its size tracks the crystal's own
  // responsive width.
  private drawPedestalShadow(cx: number, cy: number, w: number, h: number): void {
    if (!this.pedestalShadow) {
      return;
    }
    this.pedestalShadow.clear();
    const layers = [
      { scale: 1, alpha: 0.12 },
      { scale: 0.75, alpha: 0.18 },
      { scale: 0.5, alpha: 0.24 },
    ];
    for (const layer of layers) {
      this.pedestalShadow.fillStyle(0x000000, layer.alpha);
      this.pedestalShadow.fillEllipse(cx, cy, w * layer.scale, h * layer.scale);
    }
  }

  // Slow vertical-only hover (never touching the crystal's own alpha —
  // only its position) plus a barely-there scale breathe layered on top
  // of whatever base scale layoutBigCrystal() last established (so it
  // never fights the crystal's own responsive sizing). Both read
  // bigCrystalBaseY/bigCrystalBaseScale* fresh every frame, so a resize
  // mid-hover reflows correctly with no restart needed.
  private startCrystalHover(): void {
    if (!this.bigCrystalImage) {
      return;
    }
    this.bigCrystalFloatTween?.stop();
    this.bigCrystalPulseTween?.stop();

    const floatState = { offset: -CRYSTAL_FLOAT_AMPLITUDE_PX };
    this.bigCrystalImage.setY(this.bigCrystalBaseY + floatState.offset);
    this.bigCrystalFloatTween = this.tweens.add({
      targets: floatState,
      offset: CRYSTAL_FLOAT_AMPLITUDE_PX,
      duration: CRYSTAL_FLOAT_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.bigCrystalImage?.setY(this.bigCrystalBaseY + floatState.offset),
    });

    const pulseState = { t: 0 };
    this.bigCrystalPulseTween = this.tweens.add({
      targets: pulseState,
      t: 1,
      duration: CRYSTAL_FLOAT_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => {
        if (!this.bigCrystalImage) {
          return;
        }
        const factor = Phaser.Math.Linear(1, CRYSTAL_SCALE_PULSE_MAX, pulseState.t);
        this.bigCrystalImage.setScale(this.bigCrystalBaseScaleX * factor, this.bigCrystalBaseScaleY * factor);
      },
    });
  }

  // Freezes the crystal at its plain base position/scale — called the
  // instant the reward sequence begins (see onRewardSequenceStart above)
  // so the reward shard's flight out of the crystal's center never has
  // to chase a moving target.
  private stopCrystalHover(): void {
    this.bigCrystalFloatTween?.stop();
    this.bigCrystalPulseTween?.stop();
    if (this.bigCrystalImage) {
      this.bigCrystalImage.setY(this.bigCrystalBaseY);
      this.bigCrystalImage.setScale(this.bigCrystalBaseScaleX, this.bigCrystalBaseScaleY);
    }
  }

  // TEMPORARY prototype art: a small octagonal stone plinth — a darker
  // lower drum plus a lighter top surface (catching light), an etched
  // rune-circle with radiating tick marks ("ancient engravings"), and a
  // handful of fixed light/dark speckles for worn stone — matching the
  // temple's dark-stone, carved, slightly-weathered look. Reused as one
  // shared texture (only ever generated once).
  private generatePedestalTexture(): void {
    if (this.textures.exists(PEDESTAL_TEXTURE_KEY)) {
      return;
    }
    const w = PEDESTAL_TEX_WIDTH;
    const h = PEDESTAL_TEX_HEIGHT;
    const canvas = this.textures.createCanvas(PEDESTAL_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = w / 2;

    const octagonPath = (centerY: number, ow: number, oh: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i - Math.PI / 8;
        const x = cx + Math.cos(angle) * (ow / 2);
        const y = centerY + Math.sin(angle) * (oh / 2);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
    };

    // Lower drum — darker, in shadow.
    const baseCy = h * 0.62;
    const baseGrad = ctx.createLinearGradient(0, h * 0.3, 0, h);
    baseGrad.addColorStop(0, '#3a342c');
    baseGrad.addColorStop(0.6, '#26221c');
    baseGrad.addColorStop(1, '#161310');
    octagonPath(baseCy, w * 0.92, h * 0.62);
    ctx.fillStyle = baseGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // Top surface — lighter, catching the crystal's own glow.
    const topCy = h * 0.36;
    const topGrad = ctx.createRadialGradient(cx, topCy, 2, cx, topCy, w * 0.46);
    topGrad.addColorStop(0, '#5c5648');
    topGrad.addColorStop(0.7, '#403a30');
    topGrad.addColorStop(1, '#2a251e');
    octagonPath(topCy, w * 0.88, h * 0.5);
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.35)';
    ctx.stroke();

    // Ancient carved rune-circle etched into the top surface.
    ctx.save();
    ctx.strokeStyle = 'rgba(20,18,14,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, topCy, w * 0.3, h * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, topCy, w * 0.18, h * 0.095, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Short radiating tick marks around the outer ring.
    const aspectRatio = h / w;
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i;
      const rOuter = w * 0.3;
      const rInner = w * 0.24;
      const x1 = cx + Math.cos(angle) * rInner;
      const y1 = topCy + Math.sin(angle) * rInner * aspectRatio;
      const x2 = cx + Math.cos(angle) * rOuter;
      const y2 = topCy + Math.sin(angle) * rOuter * aspectRatio;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    // Worn/chipped speckle for age — fixed positions, not randomized on
    // every load, so the texture looks the same across sessions.
    const speckles = [
      { x: 0.28, y: 0.55, r: 3, color: 'rgba(0,0,0,0.35)' },
      { x: 0.62, y: 0.7, r: 2.5, color: 'rgba(0,0,0,0.3)' },
      { x: 0.72, y: 0.48, r: 2, color: 'rgba(255,255,255,0.12)' },
      { x: 0.4, y: 0.82, r: 2.5, color: 'rgba(0,0,0,0.3)' },
      { x: 0.18, y: 0.75, r: 2, color: 'rgba(255,255,255,0.1)' },
      { x: 0.58, y: 0.34, r: 1.8, color: 'rgba(255,255,255,0.15)' },
    ];
    for (const speckle of speckles) {
      ctx.beginPath();
      ctx.fillStyle = speckle.color;
      ctx.arc(w * speckle.x, h * speckle.y, speckle.r, 0, Math.PI * 2);
      ctx.fill();
    }

    canvas.refresh();
  }

  private playEntryAnimation(): void {
    const camera = this.cameras.main;
    camera.setZoom(ENTRY_START_ZOOM);

    this.tweens.add({
      targets: camera,
      zoom: 1,
      duration: ENTRY_SETTLE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: ENTRY_SETTLE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    this.time.delayedCall(ENTRY_SETTLE_DURATION_MS, () => {
      this.input.enabled = true;
    });
  }

  private returnToCentralHall(): void {
    if (this.isReturning) {
      return;
    }
    this.isReturning = true;
    this.input.enabled = false;
    this.exit?.setActive(false);

    this.cameras.main.fadeOut(EXIT_FADE_MS, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('CentralHallScene');
    });
  }
}
