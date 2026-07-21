import Phaser from 'phaser';
import RoundIntroPopup from './RoundIntroPopup';
import FeedbackPopup from './FeedbackPopup';
import { createRtlText } from './rtlText';
import { setLibraRoomState, setCrystalCollected } from './GameState';
import { FONT_FAMILY } from './textStyle';
import type CrystalHolder from './CrystalHolder';

export interface LibraQuestion {
  id: string;
  instruction: string;
  equation: string;
  choices: number[];
  correctAnswer: number;
}

const ORDER_INSTRUCTION = 'חשבו לפי סדר הפעולות וגררו את התשובה המתאימה אל המאזניים.';

// Exactly 5 fixed order-of-operations questions, always asked in this
// order (never randomized, never substituted) — the room requires all 5
// to be completed. A wrong answer does not skip to a different question;
// the same one is retried until solved (see finishIncorrectAnswer()).
const QUESTION_SEQUENCE: LibraQuestion[] = [
  { id: 'q1', instruction: ORDER_INSTRUCTION, equation: '5 × 4 + 3 = ?', choices: [17, 20, 23, 35], correctAnswer: 23 },
  { id: 'q2', instruction: ORDER_INSTRUCTION, equation: '2 + 1 × 0 = ?', choices: [0, 1, 2, 3], correctAnswer: 2 },
  { id: 'q3', instruction: ORDER_INSTRUCTION, equation: '4 ÷ 2 + 1 = ?', choices: [2, 3, 5, 6], correctAnswer: 3 },
  { id: 'q4', instruction: ORDER_INSTRUCTION, equation: '5 × 5 + 5 = ?', choices: [25, 30, 35, 50], correctAnswer: 30 },
  { id: 'q5', instruction: ORDER_INSTRUCTION, equation: '(2 + 2) × 10 = ?', choices: [20, 22, 40, 44], correctAnswer: 40 },
];

// Derived from the fixed sequence itself, never a separate literal — the
// room is complete once every question in QUESTION_SEQUENCE has been
// answered correctly.
const REQUIRED_CORRECT_ANSWERS = QUESTION_SEQUENCE.length;

// Shown exactly once, before the very first question of the room —
// every question after this loads directly (see startNextQuestion()),
// with no per-question intro popup at all.
const ROOM_INTRO_TITLE = 'היכל האיזון';
const ROOM_INTRO_BODY =
  'כדי להשלים את החדר, עליכם לפתור נכון את כל 5 החידות.\n\nחשבו לפי סדר הפעולות וגררו את אבן התשובה המתאימה אל כף המאזניים.\n\nאם תטעו, תוכלו לנסות שוב את אותה חידה.';
const ROOM_INTRO_BUTTON_LABEL = 'מתחילים';

const FEEDBACK_CORRECT_TITLE = 'נכון!';
const FEEDBACK_CORRECT_BODY = 'נמצאה תשובה נכונה.';
const FEEDBACK_WRONG_TITLE = 'תשובה שגויה';
const FEEDBACK_WRONG_BODY = 'נעבור לחידה הבאה.';
const FEEDBACK_COMPLETE_TITLE = 'האיזון הושב';
const FEEDBACK_COMPLETE_BODY = 'השלמתם את חידות המאזניים.';

const CORRECT_FEEDBACK_MS = 1900;
const INCORRECT_FEEDBACK_MS = 1500; // 1300-1700
const COMPLETE_FEEDBACK_MS = 2400;

// Background-pixel anchors (1536x1024 source), measured directly from
// assets/images/LibraRoom/Background_Libra.png: the two hanging bowls,
// the crossbar the chains hang from, the room's central (topmost) pink
// crystal, and the open foreground platform where the answer stones sit.
const LEFT_PAN_X = 475;
const LEFT_PAN_Y = 545;
const RIGHT_PAN_X = 1060;
const RIGHT_PAN_Y = 545;
const CRYSTAL_X = 768;
const CRYSTAL_Y = 195;
const BALANCE_LINE_LEFT_X = 455;
const BALANCE_LINE_RIGHT_X = 1075;
const BALANCE_LINE_Y = 235;
const STONE_ROW_Y = 800;
// Four evenly-spaced positions (220bg-px gaps, centered on the platform)
// — with the reduced stone radius below, edge-to-edge clearance between
// neighboring stones is ~100bg-px, comfortable for reliable dragging.
const STONE_X_POSITIONS = [438, 658, 878, 1098];

const TARGET_RADIUS_BG = 60;
const STONE_RADIUS_BG = 42;
const STONE_HIT_PADDING_BG = 18;

// Largest readable size that still fits inside the left pan without
// touching the chains/pan edges (44-56 design px range); a smaller
// fallback only kicks in for equations whose string is long enough to
// otherwise risk overflowing the pan's width.
const EQUATION_FONT_SIZE_BG = 52;
const EQUATION_LONG_FONT_SIZE_BG = 44;
const EQUATION_LONG_THRESHOLD = 17;

// Explicit drop zone covering the visible interior of the right pan
// bowl — measured directly from Background_Libra.png (wider than tall,
// matching the bowl's shape). Used purely as a getBounds() reference for
// manual overlap detection in onDragEnd(); never registered as a Phaser
// interactive drop zone (no setInteractive/dropZone), so there's no
// dependency on the pointer being exactly over it at release — a
// meaningful overlap between the stone and this rectangle is enough.
const RIGHT_PAN_ZONE_WIDTH_BG = 180;
const RIGHT_PAN_ZONE_HEIGHT_BG = 100;

const TARGET_PULSE_MS = 1400;
const TARGET_AMBER_TINT = 0xffb347;
const TARGET_PINK_TINT = 0xff8fce;
const TARGET_AMBER_FLASH_MS = 500;

const STONE_HOVER_LIFT_BG = 10;
const STONE_HOVER_TWEEN_MS = 160;

const CRYSTAL_GLOW_STEP_ALPHA = 0.16;
const CRYSTAL_PULSE_MS = 500;

const BALANCE_TILT_DEG = 4;
const BALANCE_LEVEL_TWEEN_MS = 600;
const BALANCE_SHAKE_DEG = 5;
const BALANCE_SHAKE_MS = 90;

// ---- top banner ("תשובות האיזון") ---------------------------------------
// Screen-fixed (viewport px, not background-pixel anchored) — behaves
// like the Pink Room's own crystal-code panel (EquivalencePuzzle.ts: a
// carved frame + title + diamond slots that fill in automatically, each
// number flying in from the crystal and popping into place with a
// permanent glow), just docked to the top of the viewport instead of
// anchored to the crystal, and holding the actual collected answers
// instead of code digits.
// Widened from 420 (and slots pulled in from 110 to 96 apart) to
// comfortably fit 5 slots instead of the previous 3 — same frame
// texture/gradient technique, just larger canvas dimensions.
const BANNER_WIDTH_PX = 560;
const BANNER_HEIGHT_PX = 120;
const BANNER_TOP_MARGIN_PX = 20;
const BANNER_TITLE_OFFSET_Y_PX = -40;
const BANNER_SLOT_ROW_OFFSET_Y_PX = 22;
const BANNER_SLOT_SIZE_PX = 46;
const BANNER_SLOT_SPACING_PX = 96;
const BANNER_SLOT_FONT_SIZE_PX = 22;
const BANNER_SLOT_DIGIT_Y_OFFSET_PX = 2;
const BANNER_SLOT_LOCK_POP_MS = 300;
const BANNER_SLOT_SOLVED_GLOW_ALPHA = 0.75;

const BANNER_FRAME_TEXTURE_KEY = 'libra-banner-frame';
const BANNER_SLOT_TEXTURE_KEY = 'libra-banner-slot';

// The correct answer, projected as a large glowing number near the
// crystal, held long enough to read, then flown into its banner slot —
// same technique/timing shape as the Pink Room's own digit reveal.
const ANSWER_REVEAL_FONT_SIZE_BG = 80;
const ANSWER_REVEAL_FADE_MS = 300;
const ANSWER_REVEAL_HOLD_MS = 650;
const ANSWER_FLIGHT_DURATION_MS = 550;

// Room-completion reward crystal ("redCrystal"): reuses the exact
// technique from the Pink Room's own crystal-code reward
// (EquivalencePuzzle.ts's revealRewardSymbol()/flyRewardToHolder()) —
// rises out of the central crystal, flies a short curved path into the
// shared, persistent CrystalHolder's "red" slot (see LibraRoomScene,
// which assigns this.crystalHolder). Only the sequencing differs from
// Pink Room: here the completion feedback/exit are held back until the
// crystal actually arrives (see completeLibraRoom()).
const REWARD_TEXTURE_KEY = 'libra-puzzle-reward-TEMP';
const REWARD_DEPTH = 90;
const REWARD_SIZE_BG = 60;
const REWARD_RISE_BG = 40;
const REWARD_REVEAL_DURATION_MS = 900;
const REWARD_FLIGHT_DURATION_MS = 1100; // 900-1300
const REWARD_ARC_HEIGHT_PX = 130;
// Defensive fallback target only, for the (unexpected) case that
// crystalHolder is ever missing.
const REWARD_ICON_MARGIN_PX = 56;
const REWARD_ICON_SIZE_PX = 34;

interface StoneRuntime {
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  value: number;
  startBgX: number;
  startBgY: number;
  hovered: boolean;
  hoverTween?: Phaser.Tweens.Tween;
}

interface BannerSlotRuntime {
  offsetX: number;
  frame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
}

/**
 * The Libra Room's balance puzzle: a fixed sequence of exactly 5
 * order-of-operations questions (QUESTION_SEQUENCE), always asked in the
 * same order, all 5 required — no random draw, no substituting a
 * different question. Dragging a stone into the right pan validates it
 * immediately (no separate "check" step) — correct records the answer in
 * the top banner (flying in from the crystal, same technique as the Pink
 * Room's code-digit reveal) and loads the next question in sequence;
 * incorrect retries the *same* question (a brief popup, then the same
 * equation/stones reload) rather than skipping ahead. Only the one-time
 * room intro uses a popup — every question after that swaps the
 * equation/stones in place with no intro panel and no "continue" button.
 * All equations/stones/feedback/banner are dynamic Phaser objects laid
 * over the static Background_Libra.png art — nothing baked into the
 * background.
 */
export default class LibraPuzzle {
  private scene: Phaser.Scene;

  private toScreenX: (bgX: number) => number = (x) => x;
  private toScreenY: (bgY: number) => number = (y) => y;
  private scaleFactor = 1;
  private baseDepth = 0;

  private roundIntroPopup: RoundIntroPopup;
  private feedbackPopup: FeedbackPopup;

  private equationText?: Phaser.GameObjects.Text;
  private equationFontSizeBg = EQUATION_FONT_SIZE_BG;
  private targetOutline?: Phaser.GameObjects.Image;
  private targetPulseTween?: Phaser.Tweens.Tween;
  private rightPanDropZone?: Phaser.GameObjects.Zone;

  private balanceLine?: Phaser.GameObjects.Graphics;
  private crystalGlow?: Phaser.GameObjects.Image;
  private leftPanLight?: Phaser.GameObjects.Image;
  private rightPanLight?: Phaser.GameObjects.Image;
  private roomLightOverlay?: Phaser.GameObjects.Rectangle;

  private bannerContainer?: Phaser.GameObjects.Container;
  private bannerSlots: BannerSlotRuntime[] = [];
  private answerRevealText?: Phaser.GameObjects.Text;
  private answerRevealGlow?: Phaser.GameObjects.Image;
  private answerRevealTween?: Phaser.Tweens.Tween;

  private rewardSymbol?: Phaser.GameObjects.Image;
  private rewardFlightTween?: Phaser.Tweens.Tween;
  private rewardShown = false;
  /** Set by LibraRoomScene right after both are created — the reward crystal flies into this shared, persistent holder instead of parking in its own local corner icon. */
  crystalHolder?: CrystalHolder;

  private stones: StoneRuntime[] = [];
  private draggingStone?: StoneRuntime;

  // ---- explicit puzzle state -------------------------------------------
  private correctAnswerCount = 0;
  private currentQuestion?: LibraQuestion;
  private selectedAnswer?: number;
  private selectedStone?: StoneRuntime;
  private isChecking = false;
  private isCompleted = false;

  private readonly handleDragStart = (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) =>
    this.onDragStart(gameObject);
  private readonly handleDrag = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
    dragX: number,
    dragY: number,
  ) => this.onDrag(gameObject, dragX, dragY);
  private readonly handleDragEnd = (
    _pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject,
  ) => this.onDragEnd(gameObject);

  /** Fired once the final correct answer's feedback clears — the scene wires this to activating the exit doorway. */
  onCompleted?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.roundIntroPopup = new RoundIntroPopup(scene);
    // The room intro is the only popup this puzzle ever shows before a
    // question — confirming it always just starts the first question.
    this.roundIntroPopup.onConfirm = () => this.roundIntroPopup.hide(() => this.startNextQuestion());
    this.feedbackPopup = new FeedbackPopup(scene);
  }

  createLibraPuzzle(depth: number): void {
    this.baseDepth = depth;
    this.generateTextures();

    this.roundIntroPopup.create();
    this.feedbackPopup.create();

    this.equationText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '30px',
        color: '#ffe9c9',
        stroke: '#2a1508',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(depth + 3);

    this.targetOutline = this.scene.add
      .image(0, 0, 'libra-target-outline')
      .setOrigin(0.5)
      .setTint(TARGET_PINK_TINT)
      .setDepth(depth + 2);

    // Geometry-only reference for manual overlap detection (see
    // onDragEnd()) — not registered as a Phaser dropZone, never visible.
    this.rightPanDropZone = this.scene.add.zone(0, 0, 1, 1);

    this.balanceLine = this.scene.add.graphics().setDepth(depth + 1);

    // Purely visual now — dropping a stone in the pan validates
    // immediately (see onDragEnd()), so the crystal is no longer a
    // separate "click to check" control. It still glows/intensifies on
    // a correct answer and is the reward crystal's spawn point.
    this.crystalGlow = this.scene.add
      .image(0, 0, 'libra-soft-glow')
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff9fd6)
      .setAlpha(0)
      .setDepth(depth + 1);

    this.leftPanLight = this.scene.add
      .image(0, 0, 'libra-soft-glow')
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf9e)
      .setAlpha(0)
      .setDepth(depth + 1);
    this.rightPanLight = this.scene.add
      .image(0, 0, 'libra-soft-glow')
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffcf9e)
      .setAlpha(0)
      .setDepth(depth + 1);

    // Full-screen, screen-fixed, very subtle — only brightened at final
    // completion ("intensify the room lighting"), restrained on purpose.
    this.roomLightOverlay = this.scene.add
      .rectangle(0, 0, 1, 1, 0xff8fce, 0)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth + 40)
      .setScrollFactor(0);

    this.createAnswerBanner(depth + 50);

    this.scene.input.on('dragstart', this.handleDragStart);
    this.scene.input.on('drag', this.handleDrag);
    this.scene.input.on('dragend', this.handleDragEnd);

    this.startTargetPulse();
    this.drawBalanceLine(BALANCE_TILT_DEG);
  }

  /** Call once the room's own entry transition has settled. No-op if already restored as completed. */
  beginPuzzle(): void {
    if (this.isCompleted) {
      return;
    }
    this.showRoomIntro();
  }

  /** Jumps straight to the finished state — banner fully lit, crystal/room lighting intensified, no puzzle replay. */
  restoreCompleted(): void {
    this.isCompleted = true;
    this.correctAnswerCount = REQUIRED_CORRECT_ANSWERS;
    for (let i = 0; i < this.bannerSlots.length; i++) {
      this.setBannerSlotInstant(i, '✓');
    }
    this.crystalGlow?.setAlpha(Math.min(1, CRYSTAL_GLOW_STEP_ALPHA * (REQUIRED_CORRECT_ANSWERS + 1)));
    this.roomLightOverlay?.setAlpha(0.12);
    this.drawBalanceLine(0);
    this.equationText?.setVisible(false);
    this.targetOutline?.setVisible(false);
    this.revealRewardAtRest();
  }

  layout(toScreenX: (bgX: number) => number, toScreenY: (bgY: number) => number, scale: number): void {
    this.toScreenX = toScreenX;
    this.toScreenY = toScreenY;
    this.scaleFactor = scale;

    this.roundIntroPopup.layout(this.scene.scale.width, this.scene.scale.height);
    this.feedbackPopup.layout(this.scene.scale.width, this.scene.scale.height);

    this.equationText
      ?.setPosition(toScreenX(LEFT_PAN_X), toScreenY(LEFT_PAN_Y))
      .setFontSize(this.equationFontSizeBg * scale);

    const targetDiameter = TARGET_RADIUS_BG * 2 * scale;
    this.targetOutline
      ?.setPosition(toScreenX(RIGHT_PAN_X), toScreenY(RIGHT_PAN_Y))
      .setDisplaySize(targetDiameter, targetDiameter);

    this.rightPanDropZone
      ?.setPosition(toScreenX(RIGHT_PAN_X), toScreenY(RIGHT_PAN_Y))
      .setSize(RIGHT_PAN_ZONE_WIDTH_BG * scale, RIGHT_PAN_ZONE_HEIGHT_BG * scale);

    this.crystalGlow
      ?.setPosition(toScreenX(CRYSTAL_X), toScreenY(CRYSTAL_Y))
      .setDisplaySize(220 * scale, 220 * scale);

    this.leftPanLight
      ?.setPosition(toScreenX(LEFT_PAN_X), toScreenY(LEFT_PAN_Y))
      .setDisplaySize(160 * scale, 160 * scale);
    this.rightPanLight
      ?.setPosition(toScreenX(RIGHT_PAN_X), toScreenY(RIGHT_PAN_Y))
      .setDisplaySize(160 * scale, 160 * scale);

    this.roomLightOverlay?.setSize(this.scene.scale.width, this.scene.scale.height);

    // Screen-fixed top banner — viewport px, not background-anchored, so
    // it always sits inside the safe viewport regardless of the
    // background's own cover-scale cropping.
    this.bannerContainer?.setPosition(this.scene.scale.width / 2, BANNER_TOP_MARGIN_PX + BANNER_HEIGHT_PX / 2);

    this.drawBalanceLine(this.isCompleted ? 0 : undefined);

    for (const stone of this.stones) {
      this.redrawStone(stone);
      if (stone !== this.draggingStone) {
        stone.container.setPosition(toScreenX(stone.startBgX), toScreenY(stone.startBgY));
      }
    }
  }

  destroy(): void {
    this.scene.input.off('dragstart', this.handleDragStart);
    this.scene.input.off('drag', this.handleDrag);
    this.scene.input.off('dragend', this.handleDragEnd);

    this.targetPulseTween?.stop();
    this.roundIntroPopup.destroy();
    this.feedbackPopup.destroy();

    this.equationText?.destroy();
    this.targetOutline?.destroy();
    this.rightPanDropZone?.destroy();
    this.balanceLine?.destroy();
    this.crystalGlow?.destroy();
    this.leftPanLight?.destroy();
    this.rightPanLight?.destroy();
    this.roomLightOverlay?.destroy();

    this.bannerContainer?.destroy();
    this.answerRevealTween?.stop();
    this.answerRevealText?.destroy();
    this.answerRevealGlow?.destroy();

    this.rewardFlightTween?.stop();
    this.rewardSymbol?.destroy();
    this.rewardSymbol = undefined;

    this.destroyStones();
  }

  // ---- intro popup -------------------------------------------------

  // Shown exactly once, before the very first question of the room —
  // "show the full instructions only once, when Libra Room begins."
  // Confirming it (see constructor's roundIntroPopup.onConfirm) goes
  // straight into the first question — no per-question popup exists.
  private showRoomIntro(): void {
    this.feedbackPopup.dismissImmediately();
    this.roundIntroPopup.show({
      title: ROOM_INTRO_TITLE,
      body: ROOM_INTRO_BODY,
      buttonLabel: ROOM_INTRO_BUTTON_LABEL,
    });
  }

  // ---- question selection ---------------------------------------------

  // Loads the next question in the fixed sequence — always
  // QUESTION_SEQUENCE[correctAnswerCount], since correctAnswerCount only
  // ever advances on a genuinely correct answer (a wrong answer leaves it
  // unchanged, so this naturally reloads the same question — see
  // finishIncorrectAnswer()). No random draw, no per-question intro
  // popup, no "continue" button — the top banner already communicates
  // progress.
  private startNextQuestion(): void {
    this.loadQuestion(QUESTION_SEQUENCE[this.correctAnswerCount]);
  }

  private loadQuestion(question: LibraQuestion): void {
    this.currentQuestion = question;
    this.selectedAnswer = undefined;
    this.selectedStone = undefined;
    this.isChecking = false;

    // A smaller fallback size only for equations long enough to risk
    // overflowing the pan; otherwise the full, largest readable size.
    this.equationFontSizeBg =
      question.equation.length > EQUATION_LONG_THRESHOLD ? EQUATION_LONG_FONT_SIZE_BG : EQUATION_FONT_SIZE_BG;

    // Replace the equation directly and let it fade briefly in, rather
    // than popping — "briefly fade the equation in."
    this.equationText
      ?.setText(question.equation)
      .setFontSize(this.equationFontSizeBg * this.scaleFactor)
      .setAlpha(0)
      .setVisible(true);
    this.scene.tweens.add({
      targets: this.equationText,
      alpha: 1,
      duration: 250,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    this.targetOutline?.setVisible(true).setTint(TARGET_PINK_TINT);
    this.startTargetPulse();

    // Replace the four answer stones — dragging one straight into the
    // pan is immediately live (see onDragEnd()/acceptAnswer()).
    const shuffledChoices = Phaser.Utils.Array.Shuffle([...question.choices]);
    this.createAnswerStones(shuffledChoices);
  }

  // ---- answer stones ------------------------------------------------

  private createAnswerStones(choices: number[]): void {
    this.destroyStones();
    for (let i = 0; i < choices.length; i++) {
      this.stones.push(this.createStone(choices[i], STONE_X_POSITIONS[i], STONE_ROW_Y));
    }
  }

  private createStone(value: number, bgX: number, bgY: number): StoneRuntime {
    const screenX = this.toScreenX(bgX);
    const screenY = this.toScreenY(bgY);
    const container = this.scene.add.container(screenX, screenY).setDepth(this.baseDepth + 10);

    const glow = this.scene.add
      .image(0, 0, 'libra-soft-glow')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd9ee)
      .setAlpha(0);
    container.add(glow);

    const bg = this.scene.add.graphics();
    container.add(bg);

    const label = this.scene.add
      .text(0, 0, String(value), {
        fontFamily: FONT_FAMILY,
        fontSize: '24px',
        color: '#fff2df',
      })
      .setOrigin(0.5);
    container.add(label);

    const stone: StoneRuntime = {
      container,
      glow,
      bg,
      label,
      value,
      startBgX: bgX,
      startBgY: bgY,
      hovered: false,
    };

    const hitRadius = (STONE_RADIUS_BG + STONE_HIT_PADDING_BG) * this.scaleFactor;
    container.setInteractive(new Phaser.Geom.Circle(0, 0, hitRadius), Phaser.Geom.Circle.Contains);
    if (container.input) {
      container.input.cursor = 'pointer';
    }
    container.on(Phaser.Input.Events.POINTER_OVER, () => this.setStoneHovered(stone, true));
    container.on(Phaser.Input.Events.POINTER_OUT, () => this.setStoneHovered(stone, false));
    this.scene.input.setDraggable(container, true);

    this.redrawStone(stone);
    return stone;
  }

  private redrawStone(stone: StoneRuntime): void {
    const r = STONE_RADIUS_BG * this.scaleFactor;
    stone.bg.clear();
    stone.bg.fillStyle(0x4a3826, 1);
    stone.bg.fillCircle(0, 0, r);
    stone.bg.fillStyle(0x5c4630, 1);
    stone.bg.fillCircle(0, 0, r * 0.9);
    stone.bg.lineStyle(Math.max(2, r * 0.06), 0xd8b878, 0.75);
    stone.bg.strokeCircle(0, 0, r * 0.96);
    stone.bg.lineStyle(Math.max(1, r * 0.03), 0xff9fd6, 0.35);
    stone.bg.strokeCircle(0, 0, r * 0.78);
    stone.label.setFontSize(24 * this.scaleFactor);
    stone.glow.setDisplaySize(r * 2.6, r * 2.6);

    const hitRadius = (STONE_RADIUS_BG + STONE_HIT_PADDING_BG) * this.scaleFactor;
    if (stone.container.input) {
      stone.container.input.hitArea = new Phaser.Geom.Circle(0, 0, hitRadius);
    }
  }

  private setStoneHovered(stone: StoneRuntime, hovered: boolean): void {
    if (hovered && (this.isChecking || this.isCompleted || !this.currentQuestion)) {
      return;
    }
    stone.hovered = hovered;
    stone.hoverTween?.stop();
    const liftPx = STONE_HOVER_LIFT_BG * this.scaleFactor;
    const atStart = stone !== this.selectedStone;
    stone.hoverTween = this.scene.tweens.add({
      targets: stone.container,
      y: hovered && atStart ? this.toScreenY(stone.startBgY) - liftPx : stone.container.y,
      duration: STONE_HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
    this.scene.tweens.add({
      targets: stone.glow,
      alpha: hovered ? 0.5 : 0,
      duration: STONE_HOVER_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  private findStone(gameObject: Phaser.GameObjects.GameObject): StoneRuntime | undefined {
    return this.stones.find((stone) => stone.container === gameObject);
  }

  private setStonesDraggable(draggable: boolean): void {
    for (const stone of this.stones) {
      this.scene.input.setDraggable(stone.container, draggable);
    }
  }

  private destroyStones(): void {
    for (const stone of this.stones) {
      stone.hoverTween?.stop();
      stone.container.destroy();
    }
    this.stones = [];
    this.draggingStone = undefined;
  }

  // ---- drag/drop (selection only — checking is a separate, explicit crystal click) --------

  private startStoneDrag(stone: StoneRuntime): void {
    this.draggingStone = stone;
    stone.hoverTween?.stop();
    // Above every other room object while dragging.
    stone.container.setDepth(this.baseDepth + 100);
    // Only the grabbed stone stays draggable — "only one stone may be
    // dragged at a time."
    for (const other of this.stones) {
      if (other !== stone) {
        this.scene.input.setDraggable(other.container, false);
      }
    }
  }

  private onDragStart(gameObject: Phaser.GameObjects.GameObject): void {
    const stone = this.findStone(gameObject);
    if (stone && !this.isChecking && !this.isCompleted && this.currentQuestion) {
      this.startStoneDrag(stone);
    }
  }

  private onDrag(gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number): void {
    const stone = this.findStone(gameObject);
    if (stone && stone === this.draggingStone) {
      stone.container.setPosition(dragX, dragY);
    }
  }

  // Decides drop success by explicit bounds overlap between the stone
  // and the right-pan drop zone — not by whether the pointer happened to
  // be exactly over a registered Phaser dropZone at release. Both
  // rectangles are computed in the same coordinate system (screen/world
  // space, since neither the stone container nor the zone are nested
  // inside any scrolled/scaled parent). Landing in the pan validates
  // immediately — "as soon as the stone is accepted in the pan, validate
  // the answer immediately."
  private onDragEnd(gameObject: Phaser.GameObjects.GameObject): void {
    const stone = this.findStone(gameObject);
    if (!stone || stone !== this.draggingStone) {
      return;
    }
    this.draggingStone = undefined;
    if (this.isStoneOverRightPan(stone)) {
      this.acceptAnswer(stone);
    } else {
      this.returnStoneToStart(stone);
      if (!this.isChecking) {
        this.setStonesDraggable(true);
      }
    }
  }

  private isStoneOverRightPan(stone: StoneRuntime): boolean {
    if (!this.rightPanDropZone) {
      return false;
    }
    const r = STONE_RADIUS_BG * this.scaleFactor;
    const stoneBounds = new Phaser.Geom.Rectangle(
      stone.container.x - r,
      stone.container.y - r,
      r * 2,
      r * 2,
    );
    const targetBounds = this.rightPanDropZone.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(stoneBounds, targetBounds);
  }

  private returnStoneToStart(stone: StoneRuntime): void {
    stone.container.setDepth(this.baseDepth + 10);
    this.scene.tweens.add({
      targets: stone.container,
      x: this.toScreenX(stone.startBgX),
      y: this.toScreenY(stone.startBgY),
      duration: 260,
      ease: Phaser.Math.Easing.Back.Out,
    });
  }

  // ---- checking (immediate on drop) -------------------------------------

  // Settles the stone exactly in the pan and validates it on the spot —
  // "do not require a second click on the crystal." Locks dragging for
  // the duration of the feedback/transition regardless of outcome.
  private acceptAnswer(stone: StoneRuntime): void {
    if (this.isChecking || this.isCompleted || !this.currentQuestion) {
      this.returnStoneToStart(stone);
      return;
    }
    const question = this.currentQuestion;
    this.selectedStone = stone;
    this.selectedAnswer = stone.value;

    this.isChecking = true;
    this.setStonesDraggable(false);

    stone.container.setDepth(this.baseDepth + 10);
    this.scene.tweens.add({
      targets: stone.container,
      x: this.toScreenX(RIGHT_PAN_X),
      y: this.toScreenY(RIGHT_PAN_Y),
      duration: 260,
      ease: Phaser.Math.Easing.Back.Out,
    });

    if (this.selectedAnswer === question.correctAnswer) {
      this.handleCorrectAnswer(question);
    } else {
      this.handleIncorrectAnswer();
    }
  }

  // ---- correct / incorrect -------------------------------------------

  private handleCorrectAnswer(question: LibraQuestion): void {
    this.levelBalanceLine();
    this.pulseCrystalGlow(true);
    this.flashPanLight(this.leftPanLight);
    this.flashPanLight(this.rightPanLight);

    this.targetPulseTween?.stop();
    this.targetOutline?.setAlpha(0);

    this.feedbackPopup.show(
      { kind: 'correct', title: FEEDBACK_CORRECT_TITLE, body: FEEDBACK_CORRECT_BODY },
      CORRECT_FEEDBACK_MS,
      () => this.finishCorrectAnswer(question),
    );
  }

  private finishCorrectAnswer(question: LibraQuestion): void {
    const value = question.correctAnswer;
    const index = this.correctAnswerCount;

    this.destroyStones();
    this.equationText?.setVisible(false);
    this.targetOutline?.setVisible(false);

    this.revealAnswerAtCrystal(value);
    this.scene.time.delayedCall(ANSWER_REVEAL_HOLD_MS, () => {
      this.animateAnswerToBannerSlot(index, () => {
        this.lockAnswerIntoBannerSlot(index, value);

        this.correctAnswerCount += 1;
        this.currentQuestion = undefined;
        this.selectedAnswer = undefined;
        this.selectedStone = undefined;
        this.isChecking = false;

        if (this.correctAnswerCount >= REQUIRED_CORRECT_ANSWERS) {
          this.completeLibraRoom();
        } else {
          this.startNextQuestion();
        }
      });
    });
  }

  private handleIncorrectAnswer(): void {
    if (this.selectedStone) {
      this.returnStoneToStart(this.selectedStone);
    }
    this.shakeBalanceLine();
    this.flashTargetAmber();

    this.feedbackPopup.show(
      { kind: 'incorrect', title: FEEDBACK_WRONG_TITLE, body: FEEDBACK_WRONG_BODY },
      INCORRECT_FEEDBACK_MS,
      () => this.finishIncorrectAnswer(),
    );
  }

  // Every question in the fixed 5-question sequence must eventually be
  // answered correctly — a wrong answer retries the *same* question
  // rather than skipping to a different one. correctAnswerCount is left
  // unchanged, so startNextQuestion() naturally reloads
  // QUESTION_SEQUENCE[correctAnswerCount], i.e. this same question.
  private finishIncorrectAnswer(): void {
    this.selectedAnswer = undefined;
    this.selectedStone = undefined;
    this.currentQuestion = undefined;
    this.isChecking = false;

    this.startNextQuestion();
  }

  // Only reached once correctAnswerCount has reached
  // REQUIRED_CORRECT_ANSWERS, i.e. all 5 of QUESTION_SEQUENCE answered
  // correctly, in order. Input is already locked here (isChecking/isCompleted both true, and
  // destroyStones() removes every draggable stone), and the crystal
  // glow intensifies immediately — but the completion feedback (and,
  // via onCompleted, the exit doorway) only appear once the reward
  // crystal actually reaches its inventory icon, never before.
  private completeLibraRoom(): void {
    this.isCompleted = true;
    this.destroyStones();
    this.equationText?.setVisible(false);
    this.targetOutline?.setVisible(false);

    this.pulseCrystalGlow(true);
    this.scene.tweens.add({
      targets: this.roomLightOverlay,
      alpha: 0.12,
      duration: 700,
      ease: Phaser.Math.Easing.Sine.Out,
    });

    setLibraRoomState(this.scene.registry, { completed: true });

    this.releaseRewardCrystal(() => {
      this.feedbackPopup.show(
        { kind: 'completed', title: FEEDBACK_COMPLETE_TITLE, body: FEEDBACK_COMPLETE_BODY },
        COMPLETE_FEEDBACK_MS,
        () => this.onCompleted?.(),
      );
    });
  }

  // ---- top banner (תשובות האיזון) ---------------------------------------

  private createAnswerBanner(depth: number): void {
    this.generateBannerFrameTexture();
    this.generateBannerSlotTexture();

    const container = this.scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);

    const frame = this.scene.add.image(0, 0, BANNER_FRAME_TEXTURE_KEY).setOrigin(0.5).setScrollFactor(0);
    container.add(frame);

    const title = createRtlText(this.scene, 0, BANNER_TITLE_OFFSET_Y_PX, 'תשובות האיזון', {
      fontSize: '20px',
      color: '#ffedd2',
      align: 'center',
    })
      .setOrigin(0.5)
      .setScrollFactor(0);
    container.add(title);

    const count = REQUIRED_CORRECT_ANSWERS;
    const startOffsetX = -((count - 1) / 2) * BANNER_SLOT_SPACING_PX;
    for (let i = 0; i < count; i++) {
      const offsetX = startOffsetX + i * BANNER_SLOT_SPACING_PX;
      const glow = this.scene.add
        .image(offsetX, BANNER_SLOT_ROW_OFFSET_Y_PX, 'libra-soft-glow')
        .setTint(0xffb6e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(BANNER_SLOT_SIZE_PX * 1.8, BANNER_SLOT_SIZE_PX * 1.8)
        .setAlpha(0)
        .setScrollFactor(0);
      const frameImg = this.scene.add
        .image(offsetX, BANNER_SLOT_ROW_OFFSET_Y_PX, BANNER_SLOT_TEXTURE_KEY)
        .setScrollFactor(0);
      // Centered inside its diamond slot — computed from each slot's own
      // center, never a hard-coded offset from the banner edge — with a
      // small baseline nudge since Phaser centers Text against its full
      // ascent+descent box, which sits a few px high for glyphs with no
      // descender (digits, ◇).
      const text = this.scene.add
        .text(offsetX, BANNER_SLOT_ROW_OFFSET_Y_PX + BANNER_SLOT_DIGIT_Y_OFFSET_PX, '◇', {
          fontFamily: FONT_FAMILY,
          fontSize: `${BANNER_SLOT_FONT_SIZE_PX}px`,
          color: '#d8b878',
        })
        .setOrigin(0.5)
        .setAlpha(0.6)
        .setScrollFactor(0);
      container.add(glow);
      container.add(frameImg);
      container.add(text);

      this.bannerSlots.push({ offsetX, frame: frameImg, glow, text });
    }

    this.bannerContainer = container;
  }

  // The screen-space position of a slot's center — used to fly the
  // revealed answer into it. Recomputed from the banner's own live
  // position rather than cached.
  private bannerSlotScreenPosition(index: number): { x: number; y: number } {
    const slot = this.bannerSlots[index];
    if (!slot || !this.bannerContainer) {
      return { x: this.scene.scale.width / 2, y: BANNER_TOP_MARGIN_PX };
    }
    return {
      x: this.bannerContainer.x + slot.offsetX,
      y: this.bannerContainer.y + BANNER_SLOT_ROW_OFFSET_Y_PX,
    };
  }

  // Projects the correct answer as a large glowing number near the
  // crystal — "the crystal released the correct value" — held just long
  // enough to read (see finishCorrectAnswer()'s delayedCall) before
  // animateAnswerToBannerSlot() flies it away. The player never types it.
  private revealAnswerAtCrystal(value: number): void {
    if (!this.answerRevealText) {
      this.answerRevealText = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          color: '#fff2fa',
          stroke: '#3a0f2a',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(REWARD_DEPTH - 2);
    }
    if (!this.answerRevealGlow) {
      this.answerRevealGlow = this.scene.add
        .image(0, 0, 'libra-soft-glow')
        .setTint(0xffb3e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(REWARD_DEPTH - 3);
    }

    const x = this.toScreenX(CRYSTAL_X);
    const y = this.toScreenY(CRYSTAL_Y);
    this.answerRevealText
      .setText(String(value))
      .setPosition(x, y)
      .setFontSize(ANSWER_REVEAL_FONT_SIZE_BG * this.scaleFactor)
      .setAlpha(0);
    this.answerRevealGlow
      .setPosition(x, y)
      .setDisplaySize(ANSWER_REVEAL_FONT_SIZE_BG * 1.6 * this.scaleFactor, ANSWER_REVEAL_FONT_SIZE_BG * 1.6 * this.scaleFactor)
      .setAlpha(0);

    this.answerRevealTween?.stop();
    this.answerRevealTween = this.scene.tweens.add({
      targets: [this.answerRevealText, this.answerRevealGlow],
      alpha: 1,
      duration: ANSWER_REVEAL_FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  // Flies the revealed answer from the crystal into its target slot,
  // shrinking and mostly fading as it goes — recomputes position/size
  // every frame from the crystal/slot anchors rather than tweening raw
  // properties, so it stays correct even if a resize happens mid-flight.
  private animateAnswerToBannerSlot(index: number, onComplete: () => void): void {
    if (!this.answerRevealText || !this.answerRevealGlow) {
      onComplete();
      return;
    }
    const text = this.answerRevealText;
    const glow = this.answerRevealGlow;
    const startX = this.toScreenX(CRYSTAL_X);
    const startY = this.toScreenY(CRYSTAL_Y);
    const target = this.bannerSlotScreenPosition(index);
    const startFontSize = ANSWER_REVEAL_FONT_SIZE_BG * this.scaleFactor;
    const endFontSize = BANNER_SLOT_FONT_SIZE_PX;
    const startGlowSize = ANSWER_REVEAL_FONT_SIZE_BG * 1.6 * this.scaleFactor;
    const endGlowSize = BANNER_SLOT_SIZE_PX * 0.6;

    const progress = { t: 0 };
    this.answerRevealTween?.stop();
    this.answerRevealTween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: ANSWER_FLIGHT_DURATION_MS,
      ease: Phaser.Math.Easing.Cubic.In,
      onUpdate: () => {
        const x = Phaser.Math.Linear(startX, target.x, progress.t);
        const y = Phaser.Math.Linear(startY, target.y, progress.t);
        text.setPosition(x, y).setFontSize(Phaser.Math.Linear(startFontSize, endFontSize, progress.t));
        glow.setPosition(x, y).setDisplaySize(
          Phaser.Math.Linear(startGlowSize, endGlowSize, progress.t),
          Phaser.Math.Linear(startGlowSize, endGlowSize, progress.t),
        );
        // Fades most of the way, not fully, so the hand-off to the
        // slot's own permanent glow (lockAnswerIntoBannerSlot()) doesn't
        // flash.
        const fadeAlpha = 1 - progress.t * 0.85;
        text.setAlpha(fadeAlpha);
        glow.setAlpha(fadeAlpha * 0.8);
      },
      onComplete: () => {
        text.setAlpha(0);
        glow.setAlpha(0);
        onComplete();
      },
    });
  }

  // The answer has arrived: pop it into place with a brief scale-bounce
  // and give the slot its permanent glow.
  private lockAnswerIntoBannerSlot(index: number, value: number): void {
    const slot = this.bannerSlots[index];
    if (!slot) {
      return;
    }
    slot.text.setText(String(value)).setAlpha(1).setColor('#ffd9f0');
    slot.glow.setAlpha(BANNER_SLOT_SOLVED_GLOW_ALPHA);

    const pop = { scale: 1.4 };
    this.scene.tweens.add({
      targets: pop,
      scale: 1,
      duration: BANNER_SLOT_LOCK_POP_MS,
      ease: Phaser.Math.Easing.Back.Out,
      onUpdate: () => {
        slot.frame.setScale(pop.scale);
        slot.text.setScale(pop.scale);
      },
    });
  }

  // restoreCompleted()'s version: no crystal-reveal/flight animation —
  // the exact 3 historical answers aren't persisted across a full scene
  // reload, so restored slots show a plain "collected" mark instead.
  private setBannerSlotInstant(index: number, display: string): void {
    const slot = this.bannerSlots[index];
    if (!slot) {
      return;
    }
    slot.frame.setScale(1);
    slot.text.setText(display).setAlpha(1).setColor('#ffd9f0').setScale(1);
    slot.glow.setAlpha(BANNER_SLOT_SOLVED_GLOW_ALPHA);
  }

  // ---- reward crystal (redCrystal) --------------------------------------
  //
  // Same technique as the Pink Room's own crystal-code reward
  // (EquivalencePuzzle.ts): rises out of the crystal (grow + fade in),
  // then flies into the shared, persistent CrystalHolder's "red" slot.
  // Here the rise also lifts slightly and rotates gently, and the
  // flight follows a curved (quadratic) path rather than a straight
  // line — the rest (scale-down while flying, guarded by rewardShown so
  // it can never replay) is the same pattern.

  // Rises out of the crystal, then hands off to flyRewardToInventory()
  // once fully revealed. onArrived fires only after the crystal is
  // actually resting in its inventory icon.
  private releaseRewardCrystal(onArrived: () => void): void {
    if (this.rewardShown) {
      onArrived();
      return;
    }
    this.rewardShown = true;
    this.generateRewardTexture();

    const startX = this.toScreenX(CRYSTAL_X);
    const startY = this.toScreenY(CRYSTAL_Y);
    const baseSize = REWARD_SIZE_BG * this.scaleFactor;
    const riseTargetY = startY - REWARD_RISE_BG * this.scaleFactor;

    this.rewardSymbol = this.scene.add
      .image(startX, startY, REWARD_TEXTURE_KEY)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(REWARD_DEPTH)
      .setDisplaySize(baseSize * 0.3, baseSize * 0.3);

    const reveal = { progress: 0, angle: 0 };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: reveal,
      progress: 1,
      angle: 35,
      duration: REWARD_REVEAL_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => {
        if (!this.rewardSymbol) {
          return;
        }
        const size = Phaser.Math.Linear(baseSize * 0.3, baseSize, reveal.progress);
        const y = Phaser.Math.Linear(startY, riseTargetY, reveal.progress);
        this.rewardSymbol.setPosition(startX, y).setDisplaySize(size, size).setAlpha(reveal.progress).setAngle(reveal.angle);
      },
      onComplete: () => this.flyRewardToInventory(startX, riseTargetY, reveal.angle, onArrived),
    });
  }

  // Flies the revealed crystal from its risen position above the
  // central crystal to the fixed inventory icon along a gentle curved
  // (quadratic-bezier) path, scaling down and continuing to rotate
  // gently, staying above every other room object throughout
  // (REWARD_DEPTH is fixed, never lowered mid-flight).
  private flyRewardToInventory(startX: number, startY: number, startAngle: number, onArrived: () => void): void {
    if (!this.rewardSymbol) {
      onArrived();
      return;
    }
    const startSize = this.rewardSymbol.displayWidth;
    const target = this.crystalHolder?.getSlotScreenPosition('red') ?? {
      x: REWARD_ICON_MARGIN_PX,
      y: REWARD_ICON_MARGIN_PX,
    };
    const endX = target.x;
    const endY = target.y;
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2((startX + endX) / 2, Math.min(startY, endY) - REWARD_ARC_HEIGHT_PX),
      new Phaser.Math.Vector2(endX, endY),
    );

    const flight = { t: 0, angle: startAngle };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: flight,
      t: 1,
      angle: startAngle + 320,
      duration: REWARD_FLIGHT_DURATION_MS,
      ease: Phaser.Math.Easing.Cubic.InOut,
      onUpdate: () => {
        if (!this.rewardSymbol) {
          return;
        }
        const point = curve.getPoint(flight.t);
        const size = Phaser.Math.Linear(startSize, REWARD_ICON_SIZE_PX, flight.t);
        this.rewardSymbol.setPosition(point.x, point.y).setDisplaySize(size, size).setAngle(flight.angle);
      },
      onComplete: () => {
        this.arriveRewardAtInventory();
        onArrived();
      },
    });
  }

  // The crystal has arrived: record it in the shared pouch, let the
  // holder itself pop the slot filled, and drop the temporary flying
  // sprite — the holder is the only persistent visual from here on.
  private arriveRewardAtInventory(): void {
    setLibraRoomState(this.scene.registry, { hasRedCrystal: true });
    setCrystalCollected(this.scene.registry, 'red');
    this.rewardSymbol?.destroy();
    this.rewardSymbol = undefined;
    this.crystalHolder?.revealCollected('red');
  }

  // restoreCompleted()'s version: the reward is already collected — the
  // holder's own refresh() (already re-run every time it's created)
  // shows it filled with no animation, so there's nothing left to do
  // here beyond guarding releaseRewardCrystal() against ever replaying.
  private revealRewardAtRest(): void {
    this.rewardShown = true;
  }

  // TEMPORARY completion reward art: a soft pink core behind an
  // elongated shard silhouette with a small loop near the top — same
  // shape/style as the Pink Room's own reward shard, standing in for a
  // real "red crystal" asset.
  private generateRewardTexture(): void {
    if (this.scene.textures.exists(REWARD_TEXTURE_KEY)) {
      return;
    }
    const size = 96;
    const canvas = this.scene.textures.createCanvas(REWARD_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, 'rgba(255,214,240,0.9)');
    glow.addColorStop(0.5, 'rgba(255,163,224,0.4)');
    glow.addColorStop(1, 'rgba(255,163,224,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.moveTo(0, -r * 0.95);
    ctx.lineTo(r * 0.32, -r * 0.35);
    ctx.lineTo(r * 0.24, r * 0.7);
    ctx.lineTo(0, r * 0.95);
    ctx.lineTo(-r * 0.24, r * 0.7);
    ctx.lineTo(-r * 0.32, -r * 0.35);
    ctx.closePath();
    const shardGrad = ctx.createLinearGradient(0, -r, 0, r);
    shardGrad.addColorStop(0, 'rgba(255,240,250,0.95)');
    shardGrad.addColorStop(1, 'rgba(255,150,210,0.85)');
    ctx.fillStyle = shardGrad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    canvas.refresh();
  }

  // ---- balance / crystal visual overlays -------------------------------

  private drawBalanceLine(angleDegOverride?: number): void {
    if (!this.balanceLine) {
      return;
    }
    const x1 = this.toScreenX(BALANCE_LINE_LEFT_X);
    const x2 = this.toScreenX(BALANCE_LINE_RIGHT_X);
    const y = this.toScreenY(BALANCE_LINE_Y);
    const angleDeg = angleDegOverride ?? (this.correctAnswerCount > 0 ? 0 : BALANCE_TILT_DEG);
    const angleRad = Phaser.Math.DegToRad(angleDeg);
    const halfLen = (x2 - x1) / 2;
    const midX = (x1 + x2) / 2;
    const dx = Math.cos(angleRad) * halfLen;
    const dy = Math.sin(angleRad) * halfLen;

    this.balanceLine.clear();
    this.balanceLine.lineStyle(3 * this.scaleFactor, 0xff9fd6, 0.5);
    this.balanceLine.lineBetween(midX - dx, y - dy, midX + dx, y + dy);
  }

  private levelBalanceLine(): void {
    const tween = { angle: this.isCompleted ? 0 : BALANCE_TILT_DEG };
    this.scene.tweens.add({
      targets: tween,
      angle: 0,
      duration: BALANCE_LEVEL_TWEEN_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => this.drawBalanceLine(tween.angle),
    });
  }

  private shakeBalanceLine(): void {
    const tween = { angle: BALANCE_TILT_DEG };
    this.scene.tweens.add({
      targets: tween,
      angle: BALANCE_TILT_DEG + BALANCE_SHAKE_DEG,
      duration: BALANCE_SHAKE_MS,
      yoyo: true,
      repeat: 2,
      ease: Phaser.Math.Easing.Sine.InOut,
      onUpdate: () => this.drawBalanceLine(tween.angle),
      onComplete: () => this.drawBalanceLine(BALANCE_TILT_DEG),
    });
  }

  private pulseCrystalGlow(permanentStep: boolean): void {
    if (permanentStep && this.crystalGlow) {
      const target = Math.min(1, (this.crystalGlow.alpha || 0) + CRYSTAL_GLOW_STEP_ALPHA * 2);
      this.scene.tweens.add({
        targets: this.crystalGlow,
        alpha: target,
        duration: CRYSTAL_PULSE_MS,
        ease: Phaser.Math.Easing.Sine.Out,
      });
    }
  }

  private flashPanLight(light?: Phaser.GameObjects.Image): void {
    if (!light) {
      return;
    }
    this.scene.tweens.add({
      targets: light,
      alpha: 0.55,
      duration: 260,
      yoyo: true,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  private flashTargetAmber(): void {
    this.targetOutline?.setTint(TARGET_AMBER_TINT);
    this.scene.tweens.add({
      targets: this.targetOutline,
      alpha: 0.9,
      duration: 140,
      yoyo: true,
      repeat: 1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
    this.scene.time.delayedCall(TARGET_AMBER_FLASH_MS, () => {
      this.targetOutline?.setTint(TARGET_PINK_TINT);
      this.startTargetPulse();
    });
  }

  private startTargetPulse(): void {
    this.targetPulseTween?.stop();
    this.targetOutline?.setAlpha(0.55);
    this.targetPulseTween = this.scene.tweens.add({
      targets: this.targetOutline,
      alpha: 0.9,
      duration: TARGET_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // ---- procedural textures -----------------------------------------------

  private generateTextures(): void {
    this.generateTargetOutlineTexture();
    this.generateSoftGlowTexture();
  }

  // A plain white ring (tintable at runtime — pink normally, amber on an
  // incorrect drop) — "subtle pink outline... no modern dashed web-style
  // box."
  private generateTargetOutlineTexture(): void {
    const key = 'libra-target-outline';
    if (this.scene.textures.exists(key)) {
      return;
    }
    const size = 160;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    canvas.refresh();
  }

  private generateSoftGlowTexture(): void {
    const key = 'libra-soft-glow';
    if (this.scene.textures.exists(key)) {
      return;
    }
    const size = 140;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }

  // A carved dark stone/bronze banner frame, same family as
  // RoundIntroPopup's own frame — wide enough for the title plus three
  // slots with comfortable side margins.
  private generateBannerFrameTexture(): void {
    if (this.scene.textures.exists(BANNER_FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = BANNER_WIDTH_PX;
    const h = BANNER_HEIGHT_PX;
    const canvas = this.scene.textures.createCanvas(BANNER_FRAME_TEXTURE_KEY, w, h);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const radius = 18;

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
    outerGrad.addColorStop(0, '#7a6448');
    outerGrad.addColorStop(0.5, '#5a4a35');
    outerGrad.addColorStop(1, '#332a1d');
    drawRoundedRect(1, 1, w - 2, h - 2, radius);
    ctx.fillStyle = outerGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,178,112,0.65)';
    ctx.stroke();

    const inset = 10;
    const innerGrad = ctx.createLinearGradient(0, inset, 0, h - inset);
    innerGrad.addColorStop(0, '#241d15');
    innerGrad.addColorStop(1, '#140f0a');
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 6);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    canvas.refresh();
  }

  // A carved diamond stone slot, empty at rest — one shared texture for
  // all three slots. "Active"/"solved" states are conveyed by the
  // separate glow image + text, not by recoloring this frame.
  private generateBannerSlotTexture(): void {
    if (this.scene.textures.exists(BANNER_SLOT_TEXTURE_KEY)) {
      return;
    }
    const size = BANNER_SLOT_SIZE_PX;
    const canvas = this.scene.textures.createCanvas(BANNER_SLOT_TEXTURE_KEY, size, size);
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
}
