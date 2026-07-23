import Phaser from 'phaser';
import mapBaseImageUrl from '../../assets/images/Room3/map-puzzle-base.png';
import { createRtlText } from './rtlText';
import { FONT_FAMILY } from './textStyle';
import { isRoom3PuzzleSolved, setRoom3PuzzleSolved, setCrystalCollected } from './GameState';
import type CrystalHolder from './CrystalHolder';

/**
 * Room 3 — fraction map puzzle. Only the wooden-framed map itself (an
 * empty title banner plus an 8-cell treasure map, map-puzzle-base.png)
 * is a baked image; the title, the 1-8 cell numbers, the glowing "lit
 * parts" zones, and the three answer cards (each a code-drawn vertical
 * fraction) are built here on top of it.
 *
 * A player must accumulate REQUIRED_CORRECT_ANSWERS correct answers,
 * drawn one at a time (never the same question twice in a row) from a
 * shuffled bank of QUESTIONS, to solve the puzzle. Every question lights
 * a random subset of the map's 8 cells and offers 3 candidate fractions
 * — sometimes the raw litParts/8 fraction is correct, sometimes a
 * reduced equivalent is. A wrong answer never loses accumulated
 * progress; both a correct (non-final) and a wrong answer show a brief,
 * map-anchored result message (never covering the code banner, the
 * room's crystal, or the stairwell) and then move on to a different
 * question.
 *
 * Follows the same structure as this project's other two rooms'
 * puzzles (EquivalencePuzzle.ts / LibraPuzzle.ts): a screen-fixed
 * "code" banner with one diamond slot per required correct answer,
 * filled in by a digit that flies in from the room's own crystal (see
 * MapFractionPuzzleConfig.getCrystalScreenPosition) and locks in with a
 * pop, and — once the code is complete — a small reward crystal that
 * rises out of that same crystal and flies into the shared, persistent
 * CrystalHolder's "green" slot.
 */

const TEXTURE_KEY = 'room3-map-puzzle-base';
const BADGE_TEXTURE_KEY = 'room3-map-cell-badge';
const GLOW_TEXTURE_KEY = 'room3-map-cell-glow';
const CARD_TEXTURE_KEY = 'room3-map-answer-card';
const SOFT_GLOW_TEXTURE_KEY = 'room3-map-soft-glow';
const FEEDBACK_FRAME_TEXTURE_KEY = 'room3-map-feedback-frame';
const CODE_BANNER_FRAME_TEXTURE_KEY = 'room3-code-banner-frame';
const CODE_BANNER_SLOT_TEXTURE_KEY = 'room3-code-banner-slot';
const REWARD_TEXTURE_KEY = 'room3-reward-crystal';

// Natural size of map-puzzle-base.png. If this asset is ever re-exported,
// re-measure and update this together with the grid rect below (both are
// in this same source-pixel coordinate space).
const NATURAL_WIDTH = 1353;
const NATURAL_HEIGHT = 896;

// Never upscale the art past this multiple of its native size, even if
// the available safe area is huge (avoids visibly soft/blurry art on
// very large viewports).
const MAX_DISPLAY_SCALE = 1.15;

// Source-pixel bounds of the 8-cell grid (4 columns x 2 rows), measured
// directly from map-puzzle-base.png.
const GRID_LEFT = 30;
const GRID_TOP = 165;
const GRID_RIGHT = 1325;
const GRID_BOTTOM = 850;
const GRID_COLS = 4;
const GRID_ROWS = 2;
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;
const CELL_WIDTH = (GRID_RIGHT - GRID_LEFT) / GRID_COLS;
const CELL_HEIGHT = (GRID_BOTTOM - GRID_TOP) / GRID_ROWS;

interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function cellRect(index: number): CellRect {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: GRID_LEFT + col * CELL_WIDTH,
    y: GRID_TOP + row * CELL_HEIGHT,
    w: CELL_WIDTH,
    h: CELL_HEIGHT,
  };
}

// Cell-number badges (1-8), one per grid cell, anchored near its
// top-left corner so the map art beneath stays mostly visible.
const BADGE_INSET_SRC = 52;
const BADGE_SIZE_SRC = 64;
const BADGE_FONT_SRC = 30;

// "Lit part" glow overlay, inset from the cell's own edges.
const GLOW_MARGIN_SRC = 14;
const GLOW_COLOR_LIT = 0xffd166;
const GLOW_BASE_ALPHA = 0.4;
const GLOW_PEAK_ALPHA = 0.62;
const GLOW_PULSE_MS = 900;

// ---- title strip ---------------------------------------------------------
// A screen-fixed strip above the map (own code-drawn plate, own fixed
// screen-px font size) rather than a title scaled down along with the
// map's own internal coordinate space — this is the one thing on the
// puzzle that must stay reliably legible (32-38px) regardless of how
// small the map itself gets on a cramped viewport. The map is shifted
// down by exactly this strip's height + gap (see layout()) to make room
// for it, so the two can never overlap.
const TITLE_TEXT = 'איזה חלק מהמפה מואר?';
const TITLE_STRIP_HEIGHT_PX = 64;
const TITLE_MAP_GAP_PX = 22; // >= the requested 20px minimum clearance
const TITLE_FONT_PX = 34; // fixed screen px, within the requested 32-38 range
const TITLE_PLATE_TEXTURE_KEY = 'room3-map-title-plate';

interface FractionValue {
  numerator: number;
  denominator: number;
}

interface QuestionDef {
  /** How many of the map's 8 cells are lit for this question. */
  litParts: number;
  /** Exactly 3 candidate fractions; correctIndex names which one matches litParts/8 (either directly or as a reduced equivalent). */
  answers: FractionValue[];
  correctIndex: number;
}

function f(numerator: number, denominator: number): FractionValue {
  return { numerator, denominator };
}

// At least 10 questions per the design brief — some testing the raw
// litParts/8 fraction, others its reduced equivalent — so memorizing "the
// correct answer is always N/8" doesn't work.
const QUESTIONS: QuestionDef[] = [
  { litParts: 6, answers: [f(6, 8), f(5, 8), f(2, 8)], correctIndex: 0 },
  { litParts: 6, answers: [f(2, 3), f(3, 4), f(4, 5)], correctIndex: 1 },
  { litParts: 4, answers: [f(4, 8), f(3, 8), f(5, 8)], correctIndex: 0 },
  { litParts: 4, answers: [f(1, 4), f(1, 2), f(3, 4)], correctIndex: 1 },
  { litParts: 2, answers: [f(2, 8), f(3, 8), f(4, 8)], correctIndex: 0 },
  { litParts: 2, answers: [f(1, 2), f(1, 4), f(1, 3)], correctIndex: 1 },
  { litParts: 3, answers: [f(3, 8), f(2, 8), f(5, 8)], correctIndex: 0 },
  { litParts: 5, answers: [f(3, 8), f(5, 8), f(7, 8)], correctIndex: 1 },
  { litParts: 7, answers: [f(6, 8), f(7, 8), f(5, 8)], correctIndex: 1 },
  { litParts: 1, answers: [f(1, 8), f(1, 4), f(1, 2)], correctIndex: 0 },
];

const REQUIRED_CORRECT_ANSWERS = 3;

// TEMPORARY prototype "ancient code" — a fixed digit per code-banner
// slot (like the Pink Room's PUZZLE_ROUNDS digits), revealed in order by
// any correct answer regardless of which of the 10 questions produced
// it — the code's content isn't derived from the specific question, just
// its position in the sequence of correct answers.
const ROOM3_CODE_DIGITS = [7, 4, 1];

const CARDS_PER_QUESTION = 3;
const CARD_GAP_PX = 20;
const CARD_WIDTH_MAX_PX = 210;
const CARD_HEIGHT_MAX_PX = 118;
const CARD_ASPECT_RATIO = 1.35; // width = height * ratio, before caps

const CARDS_AREA_FRACTION_OF_HEIGHT = 0.26;
const CARDS_AREA_MIN_PX = 110;
const CARDS_AREA_MAX_PX = 170;
const GAP_BETWEEN_MAP_AND_CARDS_PX = 18;

const FRACTION_DIGIT_COLOR = '#3a2a17';
const FRACTION_LINE_COLOR = 0x3a2a17;

const CORRECT_COLOR = 0x4ade80; // matches the CrystalHolder's green-crystal tint
const CORRECT_COLOR_CSS = '#1f7a43'; // darker — used for the ✓ mark on a light parchment card
const WRONG_COLOR = 0xef4444;
const WRONG_COLOR_CSS = '#8f1d1d'; // darker — used for the ✗ mark on a light parchment card
const BRIGHT_CORRECT_CSS = '#4ade80'; // bright — used against the feedback overlay's dark frame
const BRIGHT_WRONG_CSS = '#f87171'; // bright — used against the feedback overlay's dark frame

// ---- answer feedback (screen-fixed, own fixed-px sizing) ----------------
// A large, clearly legible result message in its own screen-fixed
// container — like the title strip, its font sizes are fixed screen px,
// never scaled down with the map's own internal coordinate space.
// Positioned centered above the answer-card row every layout() call (see
// layout()), so it always sits in a clear central area that never
// reaches the title strip, the code banner, or the room's crystal.
const FEEDBACK_WIDTH_PX = 480;
const FEEDBACK_HEIGHT_PX = 250;
const FEEDBACK_ICON_OFFSET_Y_PX = -66;
const FEEDBACK_ICON_FONT_PX = 76;
const FEEDBACK_TITLE_OFFSET_Y_PX = 20;
const FEEDBACK_TITLE_FONT_PX = 40; // within the requested 36-44px range
const FEEDBACK_TITLE_MAX_WIDTH_PX = FEEDBACK_WIDTH_PX - 60;
const FEEDBACK_TITLE_MIN_FONT_PX = 30;
const FEEDBACK_SUB_OFFSET_Y_PX = 76;
const FEEDBACK_SUB_FONT_PX = 26;
const FEEDBACK_FADE_MS = 200;
const FEEDBACK_DEPTH_OFFSET = 3; // above the title strip (+2) and cards (+1)

const FEEDBACK_TEXT_CORRECT = 'נכון!';
const FEEDBACK_TEXT_WRONG_TITLE = 'לא נכון';
const FEEDBACK_TEXT_WRONG_SUB = 'עוברים לשאלה הבאה';
const FEEDBACK_TEXT_FINAL = 'כל הכבוד! הקוד הושלם';

const ANSWER_FEEDBACK_HOLD_MS = 900;
const FINAL_FEEDBACK_HOLD_MS = 2200;

const SHAKE_OFFSET_PX = 6;
const SHAKE_TWEEN_MS = 70;
const SHAKE_REPEATS = 2;

const SOLVED_GLOW_COLOR = 0x4ade80;
const SOLVED_GLOW_TWEEN_MS = 500;
const SOLVED_GLOW_OUTER_STRENGTH = 3;

// ---- screen-fixed code banner (matches LibraPuzzle's own top banner) ---
// Docked to the screen's top-right corner (near/above the room's own
// crystal, which also lives on the right) — compact enough that it can
// never reach the title strip (top-center) or the map (left side).
const CODE_BANNER_DEPTH = 70;
const CODE_BANNER_WIDTH_PX = 340;
const CODE_BANNER_HEIGHT_PX = 128;
const CODE_BANNER_TOP_MARGIN_PX = 20;
const CODE_BANNER_RIGHT_MARGIN_PX = 20;
const CODE_BANNER_TITLE_OFFSET_Y_PX = -42;
const CODE_BANNER_TITLE_FONT_PX = 16;
const CODE_BANNER_SLOT_ROW_OFFSET_Y_PX = 24;
const CODE_BANNER_SLOT_SIZE_PX = 46;
const CODE_BANNER_SLOT_SPACING_PX = 90;
const CODE_BANNER_SLOT_FONT_SIZE_PX = 22;
const CODE_BANNER_SLOT_DIGIT_Y_OFFSET_PX = 2;
const CODE_BANNER_SLOT_LOCK_POP_MS = 300;
const CODE_BANNER_SLOT_SOLVED_GLOW_ALPHA = 0.75;
const CODE_BANNER_TITLE_TEXT = 'קוד המפה';

// Digit reveal (at the room's crystal) + flight into its code-banner slot.
const CODE_REVEAL_DEPTH = 72;
const CODE_REVEAL_FONT_PX = 74;
const CODE_REVEAL_FADE_MS = 260;
const CODE_REVEAL_HOLD_MS = 500;
const CODE_REVEAL_FLIGHT_MS = 500;

// Final reward: a small green crystal rising out of the room's own
// crystal, then flying into the shared CrystalHolder's "green" slot —
// same technique as the Pink/Libra rooms' own reward reveal.
const REWARD_DEPTH = 85;
const REWARD_SIZE_PX = 56;
const REWARD_ICON_SIZE_PX = 34;
const REWARD_REVEAL_MS = 900;
const REWARD_FLIGHT_MS = 900;
const REWARD_TINT = 0x4ade80;
const REWARD_ICON_MARGIN_PX = 56;

export interface MapFractionPuzzleConfig {
  scene: Phaser.Scene;
  /** Depth for the whole puzzle (map + cards + glow). */
  depth: number;
  /** Optional: if provided, revealCollected('green') is called on solve so the holder pops immediately. */
  crystalHolder?: CrystalHolder;
  /** Fires exactly once, once the reward crystal actually reaches the holder (never on a restore). */
  onSolved?: () => void;
  /** Live screen position of the room's own big crystal — the code-digit reveal and the final reward crystal both animate from here. Falls back to the map's own center if not provided. */
  getCrystalScreenPosition?: () => { x: number; y: number };
  /** Fires the instant the reward crystal begins rising out of the room's crystal — e.g. so the scene can freeze the crystal's own idle hover animation before the reward has to fly out of its center. */
  onRewardSequenceStart?: () => void;
}

interface CardSlot {
  image: Phaser.GameObjects.Image;
  numeratorText: Phaser.GameObjects.Text;
  denominatorText: Phaser.GameObjects.Text;
  fractionLine: Phaser.GameObjects.Graphics;
  markText: Phaser.GameObjects.Text;
  value: FractionValue;
  correct: boolean;
}

interface CodeBannerSlot {
  offsetX: number;
  frame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
}

interface CodeDigitReveal {
  text: Phaser.GameObjects.Text;
  glow: Phaser.GameObjects.Image;
  tween?: Phaser.Tweens.Tween;
}

export default class MapFractionPuzzle {
  private scene: Phaser.Scene;
  private config: MapFractionPuzzleConfig;

  private mapContainer?: Phaser.GameObjects.Container;
  private mainImage?: Phaser.GameObjects.Image;
  private cellGlows: Phaser.GameObjects.Image[] = [];
  private cellGlowTweens: (Phaser.Tweens.Tween | undefined)[] = [];

  private cardsContainer?: Phaser.GameObjects.Container;
  private cardSlots: CardSlot[] = [];
  private lastCardLayout = { cardWidth: 0, cardHeight: 0 };

  // Screen-fixed title strip, above the map — own fixed-px font, never
  // scaled down with the map's own internal coordinate space.
  private titleContainer?: Phaser.GameObjects.Container;
  private titlePlate?: Phaser.GameObjects.Image;
  private titleText?: Phaser.GameObjects.Text;

  // Screen-fixed answer feedback overlay.
  private feedbackContainer?: Phaser.GameObjects.Container;
  private feedbackGlow?: Phaser.GameObjects.Image;
  private feedbackFrame?: Phaser.GameObjects.Image;
  private feedbackIconText?: Phaser.GameObjects.Text;
  private feedbackTitleText?: Phaser.GameObjects.Text;
  private feedbackSubText?: Phaser.GameObjects.Text;
  private feedbackFadeInTween?: Phaser.Tweens.Tween;
  private feedbackFadeOutTween?: Phaser.Tweens.Tween;
  private feedbackHideTimer?: Phaser.Time.TimerEvent;

  // Screen-fixed code banner.
  private bannerContainer?: Phaser.GameObjects.Container;
  private bannerSlots: CodeBannerSlot[] = [];
  private codeDigitReveals: CodeDigitReveal[] = [];

  // Final reward crystal.
  private rewardSymbol?: Phaser.GameObjects.Image;
  private rewardFlightTween?: Phaser.Tweens.Tween;
  private rewardShown = false;

  private solved = false;
  private locked = false;

  /** Shuffled draw queue of QUESTIONS indices — refilled (and never starting with the just-played question) whenever it runs dry. */
  private questionQueue: number[] = [];
  private currentQuestionIndex = 0;
  private correctCount = 0;

  constructor(config: MapFractionPuzzleConfig) {
    this.scene = config.scene;
    this.config = config;
  }

  static preload(scene: Phaser.Scene): void {
    scene.load.image(TEXTURE_KEY, mapBaseImageUrl);
  }

  /**
   * Builds the puzzle centered at (centerX, centerY) inside a
   * (maxWidth x maxHeight) safe area — the owning scene is responsible
   * for choosing that safe area so it never overlaps the room's own
   * crystal or stairwell exit hotspot. Call layout() again on resize.
   */
  create(centerX: number, centerY: number, maxWidth: number, maxHeight: number): void {
    this.solved = isRoom3PuzzleSolved(this.scene.registry);
    this.correctCount = this.solved ? REQUIRED_CORRECT_ANSWERS : 0;
    this.questionQueue = [];

    this.generateBadgeTexture();
    this.generateGlowTexture();
    this.generateCardTexture();
    this.generateSoftGlowTexture();
    this.generateFeedbackFrameTexture();
    this.generateTitlePlateTexture();
    this.generateCodeBannerFrameTexture();
    this.generateCodeBannerSlotTexture();
    this.generateRewardTexture();

    const mapContainer = this.scene.add.container(centerX, centerY).setDepth(this.config.depth);
    this.mapContainer = mapContainer;

    const mainImage = this.scene.add.image(0, 0, TEXTURE_KEY).setOrigin(0.5, 0.5);
    mapContainer.add(mainImage);
    this.mainImage = mainImage;

    // Screen-fixed title strip — sized/positioned in layout(), width
    // tracks the map's own current display width so it always reads as
    // centered directly above it.
    const titleContainer = this.scene.add.container(centerX, centerY).setDepth(this.config.depth + 2);
    this.titleContainer = titleContainer;
    const titlePlate = this.scene.add.image(0, 0, TITLE_PLATE_TEXTURE_KEY).setOrigin(0.5);
    titleContainer.add(titlePlate);
    this.titlePlate = titlePlate;
    this.titleText = createRtlText(this.scene, 0, 0, TITLE_TEXT, {
      fontSize: `${TITLE_FONT_PX}px`,
      color: FRACTION_DIGIT_COLOR,
      align: 'center',
    }).setOrigin(0.5);
    titleContainer.add(this.titleText);

    for (let i = 0; i < TOTAL_CELLS; i++) {
      const rect = cellRect(i);

      const glowLocal = this.toLocal(rect.x + rect.w / 2, rect.y + rect.h / 2);
      const glow = this.scene.add
        .image(glowLocal.x, glowLocal.y, GLOW_TEXTURE_KEY)
        .setDisplaySize(rect.w - GLOW_MARGIN_SRC * 2, rect.h - GLOW_MARGIN_SRC * 2)
        .setTint(GLOW_COLOR_LIT)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setVisible(false);
      mapContainer.add(glow);
      this.cellGlows.push(glow);

      const badgeLocal = this.toLocal(rect.x + BADGE_INSET_SRC, rect.y + BADGE_INSET_SRC);
      const badgeImage = this.scene.add
        .image(badgeLocal.x, badgeLocal.y, BADGE_TEXTURE_KEY)
        .setDisplaySize(BADGE_SIZE_SRC, BADGE_SIZE_SRC);
      const badgeText = this.scene.add
        .text(badgeLocal.x, badgeLocal.y, String(i + 1), {
          fontFamily: FONT_FAMILY,
          fontSize: `${BADGE_FONT_SRC}px`,
          color: '#fff2e0',
        })
        .setOrigin(0.5);
      mapContainer.add(badgeImage);
      mapContainer.add(badgeText);
    }

    this.createAnswerFeedback();

    const cardsContainer = this.scene.add.container(centerX, centerY).setDepth(this.config.depth + 1);
    this.cardsContainer = cardsContainer;
    for (let i = 0; i < CARDS_PER_QUESTION; i++) {
      const image = this.scene.add.image(0, 0, CARD_TEXTURE_KEY).setOrigin(0.5);
      const numeratorText = this.scene.add
        .text(0, 0, '', { fontFamily: FONT_FAMILY, color: FRACTION_DIGIT_COLOR })
        .setOrigin(0.5);
      const denominatorText = this.scene.add
        .text(0, 0, '', { fontFamily: FONT_FAMILY, color: FRACTION_DIGIT_COLOR })
        .setOrigin(0.5);
      const fractionLine = this.scene.add.graphics();
      const markText = this.scene.add
        .text(0, 0, '', { fontFamily: FONT_FAMILY })
        .setOrigin(0.5)
        .setVisible(false);
      cardsContainer.add(image);
      cardsContainer.add(fractionLine);
      cardsContainer.add(numeratorText);
      cardsContainer.add(denominatorText);
      cardsContainer.add(markText);
      this.cardSlots.push({
        image,
        numeratorText,
        denominatorText,
        fractionLine,
        markText,
        value: { numerator: 0, denominator: 0 },
        correct: false,
      });
    }

    this.createCodeBanner();

    if (this.solved) {
      this.cellGlows.forEach((glow) => glow.setVisible(false));
      this.cardsContainer.setVisible(false);
      this.applyGlow(false);
      for (let i = 0; i < REQUIRED_CORRECT_ANSWERS; i++) {
        this.lockCodeDigitInstant(i, ROOM3_CODE_DIGITS[i]);
      }
      this.rewardShown = true;
    } else {
      this.currentQuestionIndex = this.drawNextQuestionIndex();
      this.renderQuestion(this.currentQuestionIndex);
      this.wireCardInteractionOnce();
    }

    this.layout(centerX, centerY, maxWidth, maxHeight);
  }

  /** Re-centers and re-scales everything — call on resize with the scene's current safe area. */
  layout(centerX: number, centerY: number, maxWidth: number, maxHeight: number): void {
    if (
      !this.mapContainer ||
      !this.cardsContainer ||
      !this.titleContainer ||
      !this.titlePlate ||
      !this.feedbackContainer
    ) {
      return;
    }

    const cardsAreaHeight = Phaser.Math.Clamp(
      maxHeight * CARDS_AREA_FRACTION_OF_HEIGHT,
      CARDS_AREA_MIN_PX,
      CARDS_AREA_MAX_PX,
    );
    const titleAreaHeight = TITLE_STRIP_HEIGHT_PX + TITLE_MAP_GAP_PX;
    const imageMaxHeight = Math.max(
      50,
      maxHeight - cardsAreaHeight - GAP_BETWEEN_MAP_AND_CARDS_PX - titleAreaHeight,
    );

    const fitScale = Math.min(maxWidth / NATURAL_WIDTH, imageMaxHeight / NATURAL_HEIGHT);
    const scale = Math.min(fitScale, MAX_DISPLAY_SCALE);

    const imageDisplayWidth = NATURAL_WIDTH * scale;
    const imageDisplayHeight = NATURAL_HEIGHT * scale;
    const cardHeight = Math.min(cardsAreaHeight * 0.8, CARD_HEIGHT_MAX_PX);
    const cardWidthFromRatio = cardHeight * CARD_ASPECT_RATIO;
    const cardWidthFromArea = (maxWidth - CARD_GAP_PX * (CARDS_PER_QUESTION - 1)) / CARDS_PER_QUESTION;
    const cardWidth = Math.min(cardWidthFromRatio, cardWidthFromArea, CARD_WIDTH_MAX_PX);
    this.lastCardLayout = { cardWidth, cardHeight };

    // Vertically stacked, top to bottom: title strip, gap, map image, gap,
    // cards row — the whole three-tier block centered at (centerX, centerY).
    const totalHeight = titleAreaHeight + imageDisplayHeight + GAP_BETWEEN_MAP_AND_CARDS_PX + cardHeight;
    const blockTop = centerY - totalHeight / 2;
    const titleCenterY = blockTop + TITLE_STRIP_HEIGHT_PX / 2;
    const imageCenterY = blockTop + titleAreaHeight + imageDisplayHeight / 2;
    const cardsCenterY =
      blockTop + titleAreaHeight + imageDisplayHeight + GAP_BETWEEN_MAP_AND_CARDS_PX + cardHeight / 2;

    this.titleContainer.setPosition(centerX, titleCenterY);
    this.titlePlate.setDisplaySize(Math.max(imageDisplayWidth, TITLE_STRIP_HEIGHT_PX * 3), TITLE_STRIP_HEIGHT_PX);

    this.mapContainer.setPosition(centerX, imageCenterY).setScale(scale);

    // Screen-fixed answer feedback — centered over the map, i.e. always
    // above the card row beneath it, in a clear area untouched by the
    // title strip, code banner, or crystal.
    this.feedbackContainer.setPosition(centerX, imageCenterY);

    this.cardsContainer.setPosition(centerX, cardsCenterY);
    const totalCardsWidth = cardWidth * CARDS_PER_QUESTION + CARD_GAP_PX * (CARDS_PER_QUESTION - 1);
    const startX = -totalCardsWidth / 2 + cardWidth / 2;
    this.cardSlots.forEach((slot, i) => {
      const x = startX + i * (cardWidth + CARD_GAP_PX);
      slot.image.setPosition(x, 0).setDisplaySize(cardWidth, cardHeight);
      this.layoutCardContent(slot, x, cardWidth, cardHeight);
    });

    // Screen-fixed top-right code banner — viewport px, not map-anchored,
    // near/above the room's own crystal (also on the right), comfortably
    // clear of both the title strip (top-center) and the map (left side).
    this.bannerContainer?.setPosition(
      this.scene.scale.width - CODE_BANNER_RIGHT_MARGIN_PX - CODE_BANNER_WIDTH_PX / 2,
      CODE_BANNER_TOP_MARGIN_PX + CODE_BANNER_HEIGHT_PX / 2,
    );
  }

  destroy(): void {
    this.feedbackHideTimer?.remove();
    this.feedbackFadeInTween?.stop();
    this.feedbackFadeOutTween?.stop();
    this.cellGlowTweens.forEach((tween) => tween?.stop());
    this.codeDigitReveals.forEach((reveal) => reveal.tween?.stop());
    this.rewardFlightTween?.stop();
    this.mapContainer?.destroy();
    this.cardsContainer?.destroy();
    this.titleContainer?.destroy();
    this.feedbackContainer?.destroy();
    this.bannerContainer?.destroy();
    this.rewardSymbol?.destroy();
  }

  // ---- internals ----------------------------------------------------------

  private toLocal(srcX: number, srcY: number): { x: number; y: number } {
    return { x: srcX - NATURAL_WIDTH / 2, y: srcY - NATURAL_HEIGHT / 2 };
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** A fresh shuffled draw order over every question, never starting with excludeIndex (the question just played) so a reshuffle boundary can't repeat it. */
  private buildShuffledQueue(excludeIndex?: number): number[] {
    const order = this.shuffle(QUESTIONS.map((_, i) => i));
    if (excludeIndex !== undefined && order.length > 1 && order[0] === excludeIndex) {
      const swapWith = order.findIndex((value, i) => i > 0 && value !== excludeIndex);
      if (swapWith !== -1) {
        [order[0], order[swapWith]] = [order[swapWith], order[0]];
      }
    }
    return order;
  }

  private drawNextQuestionIndex(excludeIndex?: number): number {
    if (this.questionQueue.length === 0) {
      this.questionQueue = this.buildShuffledQueue(excludeIndex);
    }
    return this.questionQueue.shift() as number;
  }

  private renderQuestion(index: number): void {
    const question = QUESTIONS[index];

    // Random N of the 8 cells light up — never just "the first N" — per
    // the design brief's anti-memorization requirement.
    const litCellIndices = new Set(this.shuffle([...Array(TOTAL_CELLS).keys()]).slice(0, question.litParts));

    this.cellGlows.forEach((glow, i) => {
      this.cellGlowTweens[i]?.stop();
      const lit = litCellIndices.has(i);
      if (!lit) {
        glow.setVisible(false).setAlpha(0);
        return;
      }
      glow.setVisible(true).setAlpha(GLOW_BASE_ALPHA);
      this.cellGlowTweens[i] = this.scene.tweens.add({
        targets: glow,
        alpha: GLOW_PEAK_ALPHA,
        duration: GLOW_PULSE_MS,
        yoyo: true,
        repeat: -1,
        ease: Phaser.Math.Easing.Sine.InOut,
      });
    });

    // Same 3 candidate fractions every time this question is drawn, but
    // shuffled into a fresh on-screen order.
    const options = question.answers.map((value, i) => ({ value, correct: i === question.correctIndex }));
    const shuffledOptions = this.shuffle(options);
    this.cardSlots.forEach((slot, i) => {
      const option = shuffledOptions[i];
      slot.value = option.value;
      slot.correct = option.correct;
      slot.numeratorText.setText(String(option.value.numerator));
      slot.denominatorText.setText(String(option.value.denominator));
      slot.image.clearTint();
      slot.markText.setVisible(false).setAlpha(0);
    });
    const { cardWidth, cardHeight } = this.lastCardLayout;
    if (cardWidth > 0) {
      this.cardSlots.forEach((slot) => this.layoutCardContent(slot, slot.image.x, cardWidth, cardHeight));
    }
  }

  /** Positions/sizes a card's vertical fraction (numerator / line / denominator) and its correct/wrong mark badge — called both from layout() and after renderQuestion() swaps in new digits. */
  private layoutCardContent(slot: CardSlot, x: number, cardWidth: number, cardHeight: number): void {
    const fontSize = Math.round(cardHeight * 0.32);
    const numeratorY = -cardHeight * 0.24;
    const denominatorY = cardHeight * 0.24;
    const lineHalfWidth = cardWidth * 0.22;

    slot.numeratorText.setPosition(x, numeratorY).setFontSize(fontSize);
    slot.denominatorText.setPosition(x, denominatorY).setFontSize(fontSize);

    slot.fractionLine.clear();
    slot.fractionLine.lineStyle(Math.max(2, cardHeight * 0.035), FRACTION_LINE_COLOR, 1);
    slot.fractionLine.beginPath();
    slot.fractionLine.moveTo(x - lineHalfWidth, 0);
    slot.fractionLine.lineTo(x + lineHalfWidth, 0);
    slot.fractionLine.strokePath();

    slot.markText.setPosition(x + cardWidth * 0.36, -cardHeight * 0.36).setFontSize(Math.round(cardHeight * 0.32));
  }

  private wireCardInteractionOnce(): void {
    for (const slot of this.cardSlots) {
      slot.image.setInteractive({ useHandCursor: true });
      slot.image.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleCardAnswer(slot));
    }
  }

  private enableCardInteraction(): void {
    for (const slot of this.cardSlots) {
      slot.image.setInteractive({ useHandCursor: true });
    }
  }

  private disableCardInteraction(): void {
    for (const slot of this.cardSlots) {
      slot.image.disableInteractive();
    }
  }

  private markCardOutcome(slot: CardSlot, isCorrect: boolean): void {
    slot.image.setTint(isCorrect ? CORRECT_COLOR : WRONG_COLOR);
    slot.markText
      .setText(isCorrect ? '✓' : '✗')
      .setColor(isCorrect ? CORRECT_COLOR_CSS : WRONG_COLOR_CSS)
      .setVisible(true)
      .setAlpha(1);
    if (!isCorrect) {
      this.shake(slot.image);
    }
  }

  private handleCardAnswer(slot: CardSlot): void {
    if (this.solved || this.locked) {
      return;
    }
    this.locked = true;
    // "Temporarily disable every answer card, prevent double-clicks" —
    // re-enabled explicitly once the next question is ready (see
    // advanceToNextQuestion()), not left to the `locked` flag alone.
    this.disableCardInteraction();

    if (slot.correct) {
      this.markCardOutcome(slot, true);

      const slotIndex = this.correctCount;
      this.correctCount += 1;
      this.revealCodeDigit(slotIndex, ROOM3_CODE_DIGITS[slotIndex]);

      if (this.correctCount >= REQUIRED_CORRECT_ANSWERS) {
        this.solved = true;
        setRoom3PuzzleSolved(this.scene.registry);
        this.showAnswerFeedback('final', () => this.beginRewardSequence());
        return;
      }

      this.showAnswerFeedback('correct', () => this.advanceToNextQuestion());
      return;
    }

    this.markCardOutcome(slot, false);
    this.showAnswerFeedback('wrong', () => this.advanceToNextQuestion());
  }

  private advanceToNextQuestion(): void {
    this.currentQuestionIndex = this.drawNextQuestionIndex(this.currentQuestionIndex);
    this.renderQuestion(this.currentQuestionIndex);
    this.enableCardInteraction();
    this.locked = false;
  }

  private shake(target: Phaser.GameObjects.Image): void {
    const originalX = target.x;
    this.scene.tweens.add({
      targets: target,
      x: { from: originalX - SHAKE_OFFSET_PX, to: originalX + SHAKE_OFFSET_PX },
      duration: SHAKE_TWEEN_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => target.setX(originalX),
    });
  }

  private applyGlow(animateIn: boolean): void {
    if (!this.mainImage) {
      return;
    }
    // Reuses this project's established postFX glow technique (see the
    // Central Hall crystal's pulsing glow) — a steady green "solved" glow.
    const fx = this.mainImage.postFX?.addGlow(SOLVED_GLOW_COLOR, 0, 0, false, 0.1, 24);
    if (!fx) {
      return;
    }
    if (!animateIn) {
      fx.outerStrength = SOLVED_GLOW_OUTER_STRENGTH;
      return;
    }
    this.scene.tweens.add({
      targets: fx,
      outerStrength: SOLVED_GLOW_OUTER_STRENGTH,
      duration: SOLVED_GLOW_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  // ---- answer feedback ------------------------------------------------

  private createAnswerFeedback(): void {
    const container = this.scene.add.container(0, 0).setDepth(this.config.depth + FEEDBACK_DEPTH_OFFSET);
    this.feedbackContainer = container;

    this.feedbackGlow = this.scene.add
      .image(0, 0, SOFT_GLOW_TEXTURE_KEY)
      .setDisplaySize(FEEDBACK_WIDTH_PX * 1.3, FEEDBACK_HEIGHT_PX * 1.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setVisible(false);

    this.feedbackFrame = this.scene.add
      .image(0, 0, FEEDBACK_FRAME_TEXTURE_KEY)
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);

    this.feedbackIconText = this.scene.add
      .text(0, FEEDBACK_ICON_OFFSET_Y_PX, '', {
        fontFamily: FONT_FAMILY,
        fontSize: `${FEEDBACK_ICON_FONT_PX}px`,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);

    this.feedbackTitleText = createRtlText(this.scene, 0, FEEDBACK_TITLE_OFFSET_Y_PX, '', {
      fontSize: `${FEEDBACK_TITLE_FONT_PX}px`,
      color: BRIGHT_CORRECT_CSS,
      stroke: '#2a1508',
      strokeThickness: 4,
      align: 'center',
    })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);

    this.feedbackSubText = createRtlText(this.scene, 0, FEEDBACK_SUB_OFFSET_Y_PX, '', {
      fontSize: `${FEEDBACK_SUB_FONT_PX}px`,
      color: '#e9ddc9',
      align: 'center',
    })
      .setOrigin(0.5)
      .setAlpha(0)
      .setVisible(false);

    container.add([this.feedbackGlow, this.feedbackFrame, this.feedbackIconText, this.feedbackTitleText, this.feedbackSubText]);
  }

  private showAnswerFeedback(kind: 'correct' | 'wrong' | 'final', onHidden: () => void): void {
    if (
      !this.feedbackGlow ||
      !this.feedbackFrame ||
      !this.feedbackIconText ||
      !this.feedbackTitleText ||
      !this.feedbackSubText
    ) {
      onHidden();
      return;
    }
    this.feedbackHideTimer?.remove();
    this.feedbackFadeInTween?.stop();
    this.feedbackFadeOutTween?.stop();

    const isWrong = kind === 'wrong';
    const color = isWrong ? WRONG_COLOR : CORRECT_COLOR;
    const title = kind === 'wrong' ? FEEDBACK_TEXT_WRONG_TITLE : kind === 'final' ? FEEDBACK_TEXT_FINAL : FEEDBACK_TEXT_CORRECT;
    const sub = isWrong ? FEEDBACK_TEXT_WRONG_SUB : '';
    const holdMs = kind === 'final' ? FINAL_FEEDBACK_HOLD_MS : ANSWER_FEEDBACK_HOLD_MS;

    const brightColor = isWrong ? BRIGHT_WRONG_CSS : BRIGHT_CORRECT_CSS;
    this.feedbackGlow.setTint(color);
    this.feedbackIconText.setText(isWrong ? '✗' : '✓').setColor(brightColor);
    this.feedbackTitleText.setText(title).setColor(brightColor).setFontSize(FEEDBACK_TITLE_FONT_PX);
    this.fitFeedbackTitle();
    this.feedbackSubText.setText(sub).setVisible(sub.length > 0);

    const glow = this.feedbackGlow;
    const rest = [this.feedbackFrame, this.feedbackIconText, this.feedbackTitleText];
    if (sub.length > 0) {
      rest.push(this.feedbackSubText);
    }

    glow.setVisible(true).setAlpha(0);
    for (const target of rest) {
      target.setVisible(true).setAlpha(0);
    }

    this.feedbackFadeInTween = this.scene.tweens.add({
      targets: rest,
      alpha: 1,
      duration: FEEDBACK_FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.scene.tweens.add({
      targets: glow,
      alpha: 0.55,
      duration: FEEDBACK_FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    this.feedbackHideTimer = this.scene.time.delayedCall(holdMs, () => {
      const allTargets = [glow, ...rest];
      this.feedbackFadeOutTween = this.scene.tweens.add({
        targets: allTargets,
        alpha: 0,
        duration: FEEDBACK_FADE_MS,
        ease: Phaser.Math.Easing.Sine.In,
        onComplete: () => {
          for (const target of allTargets) {
            target.setVisible(false);
          }
          onHidden();
        },
      });
    });
  }

  /** Shrinks the feedback title font (down to a readable floor) if the longest outcome string would otherwise overrun the frame's edges. */
  private fitFeedbackTitle(): void {
    if (!this.feedbackTitleText) {
      return;
    }
    let fontSize = FEEDBACK_TITLE_FONT_PX;
    while (this.feedbackTitleText.width > FEEDBACK_TITLE_MAX_WIDTH_PX && fontSize > FEEDBACK_TITLE_MIN_FONT_PX) {
      fontSize -= 1;
      this.feedbackTitleText.setFontSize(fontSize);
    }
  }

  // ---- code banner + digit reveal -----------------------------------------

  private createCodeBanner(): void {
    const container = this.scene.add.container(0, 0).setDepth(CODE_BANNER_DEPTH).setScrollFactor(0);

    const frame = this.scene.add.image(0, 0, CODE_BANNER_FRAME_TEXTURE_KEY).setOrigin(0.5).setScrollFactor(0);
    container.add(frame);

    const title = createRtlText(this.scene, 0, CODE_BANNER_TITLE_OFFSET_Y_PX, CODE_BANNER_TITLE_TEXT, {
      fontSize: `${CODE_BANNER_TITLE_FONT_PX}px`,
      color: '#ffedd2',
      align: 'center',
    })
      .setOrigin(0.5)
      .setScrollFactor(0);
    container.add(title);

    const count = REQUIRED_CORRECT_ANSWERS;
    const startOffsetX = -((count - 1) / 2) * CODE_BANNER_SLOT_SPACING_PX;
    for (let i = 0; i < count; i++) {
      const offsetX = startOffsetX + i * CODE_BANNER_SLOT_SPACING_PX;
      const glow = this.scene.add
        .image(offsetX, CODE_BANNER_SLOT_ROW_OFFSET_Y_PX, SOFT_GLOW_TEXTURE_KEY)
        .setTint(0xffb6e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(CODE_BANNER_SLOT_SIZE_PX * 1.8, CODE_BANNER_SLOT_SIZE_PX * 1.8)
        .setAlpha(0)
        .setScrollFactor(0);
      const frameImg = this.scene.add
        .image(offsetX, CODE_BANNER_SLOT_ROW_OFFSET_Y_PX, CODE_BANNER_SLOT_TEXTURE_KEY)
        .setScrollFactor(0);
      const text = this.scene.add
        .text(offsetX, CODE_BANNER_SLOT_ROW_OFFSET_Y_PX + CODE_BANNER_SLOT_DIGIT_Y_OFFSET_PX, '◇', {
          fontFamily: FONT_FAMILY,
          fontSize: `${CODE_BANNER_SLOT_FONT_SIZE_PX}px`,
          color: '#d8b878',
        })
        .setOrigin(0.5)
        .setAlpha(0.6)
        .setScrollFactor(0);
      container.add(glow);
      container.add(frameImg);
      container.add(text);
      this.bannerSlots.push({ offsetX, frame: frameImg, glow, text });

      const revealText = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          color: '#fff2fa',
          stroke: '#3a0f2a',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(CODE_REVEAL_DEPTH);
      const revealGlow = this.scene.add
        .image(0, 0, SOFT_GLOW_TEXTURE_KEY)
        .setTint(0xffb3e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setDepth(CODE_REVEAL_DEPTH - 1);
      this.codeDigitReveals.push({ text: revealText, glow: revealGlow });
    }

    this.bannerContainer = container;
  }

  private bannerSlotScreenPosition(index: number): { x: number; y: number } {
    const slot = this.bannerSlots[index];
    if (!slot || !this.bannerContainer) {
      return { x: this.scene.scale.width / 2, y: CODE_BANNER_TOP_MARGIN_PX };
    }
    return {
      x: this.bannerContainer.x + slot.offsetX,
      y: this.bannerContainer.y + CODE_BANNER_SLOT_ROW_OFFSET_Y_PX,
    };
  }

  private getCrystalAnchor(): { x: number; y: number } {
    if (this.config.getCrystalScreenPosition) {
      return this.config.getCrystalScreenPosition();
    }
    if (this.mapContainer) {
      return { x: this.mapContainer.x, y: this.mapContainer.y };
    }
    return { x: 0, y: 0 };
  }

  /** Projects the digit as a large glowing number at the room's crystal, holds it, then flies it into its code-banner slot — one dedicated reveal object per slot, so a fast quiz pace can never interrupt an in-flight digit from an earlier answer. */
  private revealCodeDigit(slotIndex: number, digit: number): void {
    const reveal = this.codeDigitReveals[slotIndex];
    if (!reveal) {
      return;
    }
    const start = this.getCrystalAnchor();
    reveal.tween?.stop();

    reveal.text
      .setText(String(digit))
      .setPosition(start.x, start.y)
      .setFontSize(CODE_REVEAL_FONT_PX)
      .setAlpha(0)
      .setVisible(true);
    reveal.glow
      .setPosition(start.x, start.y)
      .setDisplaySize(CODE_REVEAL_FONT_PX * 1.6, CODE_REVEAL_FONT_PX * 1.6)
      .setAlpha(0)
      .setVisible(true);

    reveal.tween = this.scene.tweens.add({
      targets: [reveal.text, reveal.glow],
      alpha: 1,
      duration: CODE_REVEAL_FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onComplete: () => {
        this.scene.time.delayedCall(CODE_REVEAL_HOLD_MS, () => this.flyCodeDigitToSlot(slotIndex, digit, start));
      },
    });
  }

  private flyCodeDigitToSlot(slotIndex: number, digit: number, start: { x: number; y: number }): void {
    const reveal = this.codeDigitReveals[slotIndex];
    if (!reveal) {
      return;
    }
    const target = this.bannerSlotScreenPosition(slotIndex);
    const startFontSize = CODE_REVEAL_FONT_PX;
    const endFontSize = CODE_BANNER_SLOT_FONT_SIZE_PX;
    const startGlowSize = CODE_REVEAL_FONT_PX * 1.6;
    const endGlowSize = CODE_BANNER_SLOT_SIZE_PX * 0.6;

    const progress = { t: 0 };
    reveal.tween?.stop();
    reveal.tween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: CODE_REVEAL_FLIGHT_MS,
      ease: Phaser.Math.Easing.Cubic.In,
      onUpdate: () => {
        const x = Phaser.Math.Linear(start.x, target.x, progress.t);
        const y = Phaser.Math.Linear(start.y, target.y, progress.t);
        reveal.text.setPosition(x, y).setFontSize(Phaser.Math.Linear(startFontSize, endFontSize, progress.t));
        reveal.glow
          .setPosition(x, y)
          .setDisplaySize(
            Phaser.Math.Linear(startGlowSize, endGlowSize, progress.t),
            Phaser.Math.Linear(startGlowSize, endGlowSize, progress.t),
          );
        const fadeAlpha = 1 - progress.t * 0.85;
        reveal.text.setAlpha(fadeAlpha);
        reveal.glow.setAlpha(fadeAlpha * 0.8);
      },
      onComplete: () => {
        reveal.text.setAlpha(0).setVisible(false);
        reveal.glow.setAlpha(0).setVisible(false);
        this.lockCodeDigit(slotIndex, digit);
      },
    });
  }

  private lockCodeDigit(index: number, digit: number): void {
    const slot = this.bannerSlots[index];
    if (!slot) {
      return;
    }
    slot.text.setText(String(digit)).setAlpha(1).setColor('#ffd9f0');
    slot.glow.setAlpha(CODE_BANNER_SLOT_SOLVED_GLOW_ALPHA);

    const pop = { scale: 1.4 };
    this.scene.tweens.add({
      targets: pop,
      scale: 1,
      duration: CODE_BANNER_SLOT_LOCK_POP_MS,
      ease: Phaser.Math.Easing.Back.Out,
      onUpdate: () => {
        slot.frame.setScale(pop.scale);
        slot.text.setScale(pop.scale);
      },
    });
  }

  private lockCodeDigitInstant(index: number, digit: number): void {
    const slot = this.bannerSlots[index];
    if (!slot) {
      return;
    }
    slot.frame.setScale(1);
    slot.text.setText(String(digit)).setAlpha(1).setColor('#ffd9f0').setScale(1);
    slot.glow.setAlpha(CODE_BANNER_SLOT_SOLVED_GLOW_ALPHA);
  }

  // ---- final reward crystal -----------------------------------------------

  private beginRewardSequence(): void {
    this.config.onRewardSequenceStart?.();
    if (this.rewardShown) {
      this.finalizeReward();
      return;
    }
    this.rewardShown = true;

    const start = this.getCrystalAnchor();
    this.rewardSymbol = this.scene.add
      .image(start.x, start.y, REWARD_TEXTURE_KEY)
      .setTint(REWARD_TINT)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(REWARD_DEPTH)
      .setDisplaySize(REWARD_SIZE_PX * 0.3, REWARD_SIZE_PX * 0.3);

    const reveal = { progress: 0 };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: reveal,
      progress: 1,
      duration: REWARD_REVEAL_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => {
        if (!this.rewardSymbol) {
          return;
        }
        const size = Phaser.Math.Linear(REWARD_SIZE_PX * 0.3, REWARD_SIZE_PX, reveal.progress);
        this.rewardSymbol.setDisplaySize(size, size).setAlpha(reveal.progress);
      },
      onComplete: () => this.flyRewardToHolder(),
    });
  }

  private flyRewardToHolder(): void {
    if (!this.rewardSymbol) {
      this.finalizeReward();
      return;
    }
    const startX = this.rewardSymbol.x;
    const startY = this.rewardSymbol.y;
    const startSize = this.rewardSymbol.displayWidth;
    const target = this.config.crystalHolder?.getSlotScreenPosition('green') ?? {
      x: REWARD_ICON_MARGIN_PX,
      y: REWARD_ICON_MARGIN_PX,
    };

    const progress = { t: 0 };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: REWARD_FLIGHT_MS,
      ease: Phaser.Math.Easing.Cubic.InOut,
      onUpdate: () => {
        if (!this.rewardSymbol) {
          return;
        }
        const x = Phaser.Math.Linear(startX, target.x, progress.t);
        const y = Phaser.Math.Linear(startY, target.y, progress.t);
        const size = Phaser.Math.Linear(startSize, REWARD_ICON_SIZE_PX, progress.t);
        this.rewardSymbol.setPosition(x, y).setDisplaySize(size, size);
      },
      onComplete: () => this.finalizeReward(),
    });
  }

  private finalizeReward(): void {
    this.rewardSymbol?.destroy();
    this.rewardSymbol = undefined;
    setCrystalCollected(this.scene.registry, 'green');
    this.config.crystalHolder?.revealCollected('green');
    this.config.onSolved?.();
  }

  // TEMPORARY prototype art: procedural canvas textures for the cell
  // number badges, glows, answer cards, feedback frame, code banner, and
  // reward crystal — no suitable baked assets exist for these, and
  // generating them keeps the base map art swappable independent of this
  // interactive layer.

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  private generateBadgeTexture(): void {
    if (this.scene.textures.exists(BADGE_TEXTURE_KEY)) {
      return;
    }
    const size = 96;
    const canvas = this.scene.textures.createCanvas(BADGE_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, 'rgba(90,60,28,0.95)');
    grad.addColorStop(1, 'rgba(46,30,14,0.95)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(214,178,112,0.9)';
    ctx.stroke();

    canvas.refresh();
  }

  private generateGlowTexture(): void {
    if (this.scene.textures.exists(GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = 128;
    const canvas = this.scene.textures.createCanvas(GLOW_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 22;

    this.drawRoundedRect(ctx, 4, 4, size - 8, size - 8, radius);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fill();

    canvas.refresh();
  }

  private generateSoftGlowTexture(): void {
    if (this.scene.textures.exists(SOFT_GLOW_TEXTURE_KEY)) {
      return;
    }
    const size = 96;
    const canvas = this.scene.textures.createCanvas(SOFT_GLOW_TEXTURE_KEY, size, size);
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

  private generateCardTexture(): void {
    if (this.scene.textures.exists(CARD_TEXTURE_KEY)) {
      return;
    }
    const w = 220;
    const h = 160;
    const canvas = this.scene.textures.createCanvas(CARD_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 16;

    this.drawRoundedRect(ctx, 4, 4, w - 8, h - 8, radius);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(232,206,161,0.98)');
    grad.addColorStop(1, 'rgba(196,164,112,0.98)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(92,62,28,0.9)';
    ctx.stroke();

    canvas.refresh();
  }

  private generateFeedbackFrameTexture(): void {
    if (this.scene.textures.exists(FEEDBACK_FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = FEEDBACK_WIDTH_PX;
    const h = FEEDBACK_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(FEEDBACK_FRAME_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 24;

    // Dark, mostly-opaque (per "readable against the map beneath it")
    // stone/bronze plate — same family as this project's other frames.
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(90,74,53,0.95)');
    grad.addColorStop(0.5, 'rgba(40,32,22,0.96)');
    grad.addColorStop(1, 'rgba(18,14,10,0.97)');
    this.drawRoundedRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(214,178,112,0.8)';
    ctx.stroke();

    canvas.refresh();
  }

  // A wide parchment plate (generated once at a reference width, then
  // stretched via setDisplaySize to match the map's own current display
  // width every layout() call) — matches the baked map art's own
  // cream/wood-frame look so the screen-fixed title strip above it reads
  // as part of the same object rather than a mismatched overlay.
  private generateTitlePlateTexture(): void {
    if (this.scene.textures.exists(TITLE_PLATE_TEXTURE_KEY)) {
      return;
    }
    const w = 1200;
    const h = TITLE_STRIP_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(TITLE_PLATE_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 16;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(232,206,161,0.98)');
    grad.addColorStop(1, 'rgba(196,164,112,0.98)');
    this.drawRoundedRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(92,62,28,0.9)';
    ctx.stroke();

    canvas.refresh();
  }

  private generateCodeBannerFrameTexture(): void {
    if (this.scene.textures.exists(CODE_BANNER_FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = CODE_BANNER_WIDTH_PX;
    const h = CODE_BANNER_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(CODE_BANNER_FRAME_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 18;

    const outerGrad = ctx.createLinearGradient(0, 0, 0, h);
    outerGrad.addColorStop(0, '#7a6448');
    outerGrad.addColorStop(0.5, '#5a4a35');
    outerGrad.addColorStop(1, '#332a1d');
    this.drawRoundedRect(ctx, 1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = outerGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.65)';
    ctx.stroke();

    const inset = 10;
    const innerGrad = ctx.createLinearGradient(0, inset, 0, h - inset);
    innerGrad.addColorStop(0, '#241d15');
    innerGrad.addColorStop(1, '#140f0a');
    this.drawRoundedRect(ctx, inset, inset, w - inset * 2, h - inset * 2, radius - 6);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    canvas.refresh();
  }

  private generateCodeBannerSlotTexture(): void {
    if (this.scene.textures.exists(CODE_BANNER_SLOT_TEXTURE_KEY)) {
      return;
    }
    const size = CODE_BANNER_SLOT_SIZE_PX;
    const canvas = this.scene.textures.createCanvas(CODE_BANNER_SLOT_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, '#4a3d2c');
    grad.addColorStop(1, '#241d15');
    ctx.fillStyle = grad;
    ctx.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.7)';
    ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();

    canvas.refresh();
  }

  // A small neutral (near-white) faceted gem — tinted per use, same
  // "one shared shape, tinted at runtime" convention as CrystalHolder's
  // own gem texture.
  private generateRewardTexture(): void {
    if (this.scene.textures.exists(REWARD_TEXTURE_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(REWARD_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const r = size / 2 - 4;
    ctx.save();
    ctx.translate(size / 2, size / 2);

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.75, -r * 0.15);
    ctx.lineTo(0, r);
    ctx.lineTo(-r * 0.75, -r * 0.15);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(1, 'rgba(255,255,255,0.72)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();

    ctx.restore();
    canvas.refresh();
  }
}
