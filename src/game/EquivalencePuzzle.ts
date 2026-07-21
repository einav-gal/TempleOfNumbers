import Phaser from 'phaser';
import PinkCrystal from './PinkCrystal';
import RoundIntroPopup from './RoundIntroPopup';
import FeedbackPopup from './FeedbackPopup';
import { createRtlText } from './rtlText';
import { setPinkRoomState, setCrystalCollected } from './GameState';
import { FONT_FAMILY } from './textStyle';
import type CrystalHolder from './CrystalHolder';
import {
  EQUIVALENCE_GROUPS,
  INNER_RING_ORDER,
  MIDDLE_RING_ORDER,
  OUTER_RING_ORDER,
  PUZZLE_ROUNDS,
  ROUND_INTRO_BUTTON_LABEL,
  labelFor,
  type EquivalenceGroupId,
  type RingKind,
  type RoundDefinition,
} from './equivalenceData';

type RingId = 'inner' | 'middle' | 'outer';

interface RingRadii {
  inner: number;
  outer: number;
}

interface RingRuntime {
  id: RingId;
  kind: RingKind;
  order: string[];
  radii: RingRadii;
  image: Phaser.GameObjects.Image;
  container: Phaser.GameObjects.Container;
  /** Current rotation in degrees; the authoritative "value" state — not necessarily snapped mid-drag. */
  angle: number;
  isDragging: boolean;
  dragLastPointerAngleDeg: number;
  snapTween?: Phaser.Tweens.Tween;
  shakeTween?: Phaser.Tweens.Tween;
}

/**
 * Explicit puzzle phases, one at a time:
 * - ROUND_INTRO: the round's popup is open; rings/crystal fully inert.
 * - ALIGNING_RINGS: rings/crystal interactive — the only state either can be used in.
 * - CHECKING: the instant the crystal was clicked, before the
 *   correct/duplicate/incorrect branch is dispatched — mainly a re-entrancy guard.
 * - CORRECT_FEEDBACK: a genuinely new correct alignment; the digit
 *   reveal, its flight into the panel, and the slot lock-in all play out here.
 * - INCORRECT_FEEDBACK: the values aren't equal; brief shake + dim, then
 *   back to ALIGNING_RINGS.
 * - DUPLICATE_FEEDBACK: mathematically correct, but that group was
 *   already solved; brief amber vibration + a distinct message, then
 *   back to ALIGNING_RINGS.
 * - ROUND_TRANSITION: success message showing; next round is prepared
 *   behind the scenes, then either the next ROUND_INTRO opens or, on the
 *   final round, COMPLETED begins.
 * - COMPLETED: final, permanent — all interaction locked.
 */
type PuzzleState =
  | 'ROUND_INTRO'
  | 'ALIGNING_RINGS'
  | 'CHECKING'
  | 'CORRECT_FEEDBACK'
  | 'INCORRECT_FEEDBACK'
  | 'DUPLICATE_FEEDBACK'
  | 'ROUND_TRANSITION'
  | 'COMPLETED';

type CodeSlotState = 'empty' | 'active' | 'solved';

interface CodeSlotRuntime {
  offsetXBg: number;
  frame: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  state: CodeSlotState;
  pulseTween?: Phaser.Tweens.Tween;
}

interface RingBand {
  id: RingId;
  minBg: number;
  maxBg: number;
}

// Room completion / reward state now lives in the shared, namespaced
// GameState module (getPinkRoomState/setPinkRoomState) — kept entirely
// separate from Libra Room's own namespace so neither room's puzzle
// state can leak into or be shadowed by the other's.

// Temporary debug aid for verifying the marker/selected-index math live
// (logs ring name, snapped angle, calculated index, and selected value
// every time a ring finishes snapping). Leave false — flip locally only
// when re-diagnosing the marker.
const DEBUG_LOG_SELECTION = false;

const SOFT_TEXTURE_KEY = 'pink-puzzle-soft';
const REWARD_TEXTURE_KEY = 'pink-puzzle-reward-TEMP';
const PANEL_FRAME_TEXTURE_KEY = 'pink-puzzle-panel-frame';
const CODE_SLOT_TEXTURE_KEY = 'pink-puzzle-code-slot';

// Ring radii in background-image pixels, concentric around the crystal
// center. Comfortably clear of the crystal (~70bg-px radius at its
// current 140bg-px display height) so it's never covered. These are the
// VISUAL radii (texture size, label placement).
const INNER_RADII: RingRadii = { inner: 95, outer: 135 };
const MIDDLE_RADII: RingRadii = { inner: 150, outer: 190 };
const OUTER_RADII: RingRadii = { inner: 205, outer: 245 };

// Explicit, non-overlapping radial SELECTION bands (bg-px) — replaces
// per-ring visual-object hit testing entirely. A single mechanism-wide
// zone (see createMechanismZone()) reads the pointer's distance from the
// shared center and looks the ring up here, rather than relying on
// Phaser to pick the "right" one among several overlapping same-depth
// zones (which is what made the middle ring unreliable before: three
// same-depth objects meant Phaser's own object-picking was a second,
// unaudited source of ambiguity on top of the radial math). Each ring
// gets the full width of its neighboring gap as tolerance on the
// contested side, plus the same amount of open tolerance on its free
// side (toward the center for the inner ring, outward for the outer
// ring) — wider than the previous padding attempt.
const RING_OUTER_TOLERANCE_BG = 15;
const RING_BANDS: RingBand[] = [
  { id: 'inner', minBg: INNER_RADII.inner - RING_OUTER_TOLERANCE_BG, maxBg: (INNER_RADII.outer + MIDDLE_RADII.inner) / 2 },
  {
    id: 'middle',
    minBg: (INNER_RADII.outer + MIDDLE_RADII.inner) / 2,
    maxBg: (MIDDLE_RADII.outer + OUTER_RADII.inner) / 2,
  },
  { id: 'outer', minBg: (MIDDLE_RADII.outer + OUTER_RADII.inner) / 2, maxBg: OUTER_RADII.outer + RING_OUTER_TOLERANCE_BG },
];

// The crystal's own click radius, comfortably inside the inner ring's
// own band (RING_BANDS[0].minBg = 80) so the two never compete for the
// same pointer position.
const CRYSTAL_HIT_RADIUS_BG = 75;

// Offsets from the crystal's own depth. PinkCrystal internally occupies
// crystalDepth-2..crystalDepth+1 for its reflectedLight/glowBlob/image/
// glint+sparkles — these offsets stay well clear of that range (see the
// CRYSTAL_DEPTH bump in PinkRoomScene.ts) so the requested layer order
// (background < mechanism glow < outer < middle < inner < crystal <
// sparkles/glint < marker < feedback) holds without collisions.
const MECHANISM_GLOW_DEPTH_OFFSET = -7;
const OUTER_RING_DEPTH_OFFSET = -6;
const MIDDLE_RING_DEPTH_OFFSET = -5;
const INNER_RING_DEPTH_OFFSET = -4;
// The mechanism-wide selection zone sits at the lowest input-relevant
// tier; the crystal's own zone sits above it (+1, still below the
// crystal's glint layer at +1 relative to its own depth) so an
// overlapping click near the crystal's center always resolves to the
// crystal, never the mechanism zone's coarse bounding rectangle.
const MECHANISM_ZONE_DEPTH_OFFSET = MECHANISM_GLOW_DEPTH_OFFSET;
const CRYSTAL_ZONE_DEPTH_OFFSET = 1;
const MARKER_DEPTH_OFFSET = 2;
const PANEL_DEPTH_OFFSET = 2;
const DIGIT_REVEAL_DEPTH_OFFSET = 5;
// Fixed (not crystal-relative) — the reward becomes a screen-fixed
// corner icon partway through its life, so it needs a depth that reads
// correctly both while still near the crystal and once it's UI chrome.
// Below RoundIntroPopup's depth (60) so a popup always covers it; above
// the puzzle mechanism (max ~depth 16 relative to CRYSTAL_DEPTH).
const REWARD_DEPTH = 45;

const SNAP_ANGLE_DEG = 90;
const SNAP_DURATION_MS = 220;

const SHAKE_ANGLE_DEG = 3;
const SHAKE_STEP_MS = 55;
const SHAKE_REPEATS = 3;

// A mathematically-correct-but-already-solved alignment: distinct from
// incorrect (the values ARE equal — it's simply not a fresh match). A
// muted amber pulse + small ring vibration — both durations now driven
// by the feedback popup's own timing (DUPLICATE_FEEDBACK_POPUP_MS), not
// a separate lock timer.
const DUPLICATE_SHAKE_ANGLE_DEG = 1.5;
const DUPLICATE_TINT = 0xffd27a;

// Popup title/body pairs for the four check-result outcomes plus the
// delayed inactivity hint. Replaces the old single-line, easy-to-miss
// panel text entirely for these five cases (the per-round successMessage
// shown later, once a digit actually lands — see finishCorrectFeedback()
// — is a different, still-small, still-panel-hosted narrative beat and
// is unaffected).
const FEEDBACK_CORRECT_TITLE = 'נכון!';
const FEEDBACK_CORRECT_BODY = 'נמצאה התאמה חדשה.';
const FEEDBACK_INCORRECT_TITLE = 'לא בדיוק';
const FEEDBACK_INCORRECT_BODY = 'הערכים אינם שווים. נסו שוב.';
const FEEDBACK_DUPLICATE_TITLE = 'כבר פתרתם את ההתאמה הזאת';
const FEEDBACK_DUPLICATE_BODY = 'מצאו התאמה נכונה אחרת.';
const FEEDBACK_COMPLETED_TITLE = 'הקוד הושלם';
const FEEDBACK_COMPLETED_BODY = 'הגביש נפתח.';
const HINT_TITLE = 'הגביש ממתין';
const HINT_BODY = 'הגביש ממתין לאישורכם. לחצו עליו כדי לבדוק את ההתאמה.';

// Popup durations (fade-in + hold + fade-out combined), each within the
// task's requested ranges. Incorrect/duplicate ring shake+crystal dim
// still fire concurrently with their popup (they happen out at the
// rings, not at the popup's own screen position, so there's no visual
// clash) — but a correct answer's digit reveal and the completion
// sequence's reward reveal both happen at the crystal's screen position,
// which is close to where this popup sits, so those two are
// deliberately sequenced to start only once their popup's onHidden
// fires (see beginDigitRevealSequence()/playCompletionSequence()).
const CORRECT_FEEDBACK_POPUP_MS = 1600;
const INCORRECT_FEEDBACK_POPUP_MS = 1600;
const DUPLICATE_FEEDBACK_POPUP_MS = 1900;
const COMPLETED_FEEDBACK_POPUP_MS = 1900;
const HINT_POPUP_MS = 2100;
// "The player has not clicked the crystal for approximately 2.5-3
// seconds after the rings stop moving" — first hint per round. Any
// later re-arm within the same round (the player is still inactive)
// waits much longer, so the hint never nags every few seconds.
const HINT_DELAY_MS = 2800;
const HINT_REPEAT_DELAY_MS = 9000;

const PULSE_DURATION_MS = 650;
// "Intensify the crystal glow for approximately 600-900 ms" on a correct
// ring alignment — the delay before the round's code digit appears near
// the crystal.
const CORRECT_GLOW_DURATION_MS = 750;

const MARKER_WIDTH_BG = 26;
const MARKER_HEIGHT_BG = 30;
const MARKER_OFFSET_Y_BG = OUTER_RADII.outer + 10;

// Completion reward: a small procedural pink crystal shard/key rises out
// of the crystal, then flies into the persistent CrystalHolder's own
// "pink" slot (see PinkRoomScene, which assigns this.crystalHolder) —
// REWARD_ICON_MARGIN_PX is only a defensive fallback target for the
// (unexpected) case that reference is ever missing.
const REWARD_SIZE_BG = 60;
const REWARD_REVEAL_DURATION_MS = 900;
const REWARD_FLIGHT_DURATION_MS = 700;
const REWARD_ICON_MARGIN_PX = 56;
const REWARD_ICON_SIZE_PX = 34;

// ---- Crystal-code panel ------------------------------------------------
// A floating architectural panel above the rings showing the puzzle's
// three-stage progress as a growing code (e.g. ◇◇◇ -> 7◇◇ -> 73◇ -> 735),
// plus a title and a feedback-message line. Anchored to the crystal
// center like everything else in this mechanism.
//
// Vertical budget: the marker's own top extent sits at crystal-center-
// relative bg-px ~305 (see MARKER_OFFSET_Y_BG above), and this project's
// cover-scale background can crop as much as ~380bg-px off the *top* of
// a 1024-tall background on a wide (>1.5:1) viewport. -345 puts the
// panel center at bg-px Y~215 (top edge ~132, safely inside that crop
// budget) with a small but real gap before the marker's own top edge.
const PANEL_CENTER_OFFSET_Y_BG = -345;
const PANEL_WIDTH_BG = 460;
const PANEL_HEIGHT_BG = 166;
// Moved down 20bg-px from the previous -68 (within the requested 18-30
// range) — panel half-height is 83, so this now leaves ~35bg-px of
// clearance above the title instead of ~15, comfortably clear of the
// frame's own top border at any supported viewport size.
const PANEL_TITLE_OFFSET_Y_BG = -48;
const PANEL_INSTRUCTION_OFFSET_Y_BG = -20;
const PANEL_INSTRUCTION_WRAP_WIDTH_BG = PANEL_WIDTH_BG - 60;
const PANEL_SLOT_ROW_OFFSET_Y_BG = 32;

// Slot size/spacing widened (~1.36x spacing) so each digit has real
// breathing room inside its diamond instead of feeling cramped.
const SLOT_SIZE_BG = 58;
// Slightly smaller than before (was 38) — more surrounding space inside
// the diamond, per "slightly reduce the digit font size if needed."
const SLOT_DIGIT_FONT_SIZE_BG = 34;
// Phaser centers Text via origin(0.5,0.5) against its full ascent+
// descent bounding box, not the visible glyph — a digit has no
// descender, so at true origin-center it visually sits a few px too
// high inside the diamond. This nudges it down to compensate, applied
// identically to all three slots since each is positioned from its own
// slot center (never a hard-coded offset from the panel edge).
const SLOT_DIGIT_Y_OFFSET_BG = 3;
const SLOT_SPACING_BG = 150;
const SLOT_LOCK_POP_MS = 300;
const SLOT_PULSE_MS = 1100;
// Alpha range the current round's slot glow breathes within — a subtle,
// non-color "this is where progress lands" cue. Permanently solved slots
// use a static, stronger alpha instead (see SLOT_SOLVED_GLOW_ALPHA).
const SLOT_GLOW_IDLE_RANGE: [number, number] = [0.12, 0.28];
const SLOT_SOLVED_GLOW_ALPHA = 0.75;

// The digit revealed near the crystal on a correct ring alignment: fades
// in, holds long enough to read, then flies into its panel slot and is
// placed automatically — the player never types it.
const DIGIT_REVEAL_FONT_SIZE_BG = 90;
const DIGIT_REVEAL_FADE_MS = 300;
const DIGIT_REVEAL_HOLD_MS = 700;
const DIGIT_FLIGHT_DURATION_MS = 550;

// After the final round's digit locks in: rings settle into a slightly
// rotated final resting pose while the crystal and reward sequences run.
const FINAL_SETTLE_EXTRA_DEG = 12;
const FINAL_SETTLE_DURATION_MS = 700;
const FINAL_ROUND_SETTLE_MS = 400;
const ROUND_TRANSITION_DELAY_MS = 1500;

/**
 * The Pink Crystal equivalence puzzle: three independently-rotating
 * stone rings (fraction / decimal / percent) around the crystal — the
 * crystal itself is the submit control — a fixed top marker, a floating
 * crystal-code panel, and a per-round intro popup, driving a 3-round
 * sequence (PUZZLE_ROUNDS) that automatically places one digit of the
 * code per correct round and ends in a completion reward. Functional
 * prototype — no full question bank or room completion beyond this one
 * sequence. Ring/panel/reward textures are procedural Phaser Graphics/
 * canvas (no suitable assets exist in the project), isolated in their
 * own generate*Texture() methods so they're easy to swap for final art
 * later without touching interaction logic.
 */
export default class EquivalencePuzzle {
  private scene: Phaser.Scene;
  private crystal: PinkCrystal;

  private innerRing!: RingRuntime;
  private middleRing!: RingRuntime;
  private outerRing!: RingRuntime;
  private rings: RingRuntime[] = [];

  private mechanismGlow?: Phaser.GameObjects.Image;
  private mechanismZone?: Phaser.GameObjects.Zone;
  private marker?: Phaser.GameObjects.Graphics;
  private crystalZone?: Phaser.GameObjects.Zone;
  private pulseSprite?: Phaser.GameObjects.Image;

  private codePanelContainer?: Phaser.GameObjects.Container;
  private codePanelGlow?: Phaser.GameObjects.Image;
  private codeSlots: CodeSlotRuntime[] = [];
  private instructionText?: Phaser.GameObjects.Text;

  private digitRevealText?: Phaser.GameObjects.Text;
  private digitRevealGlow?: Phaser.GameObjects.Image;
  private digitRevealTween?: Phaser.Tweens.Tween;

  private roundIntroPopup: RoundIntroPopup;
  private feedbackPopup: FeedbackPopup;
  private hintTimer?: Phaser.Time.TimerEvent;
  /** Whether the inactivity hint has already shown once this round — gates the delay tier (HINT_DELAY_MS vs. the much longer HINT_REPEAT_DELAY_MS), reset only when a new round's intro opens. */
  private hintShownThisRound = false;

  private rewardSymbol?: Phaser.GameObjects.Image;
  private rewardFlightTween?: Phaser.Tweens.Tween;
  private rewardShown = false;
  /** Set by PinkRoomScene right after both are created — the reward crystal flies into this shared, persistent holder instead of parking in its own local corner icon. */
  crystalHolder?: CrystalHolder;

  private centerX = 0;
  private centerY = 0;
  private scale = 1;
  private activeDragRingId: RingId | null = null;
  private roundReadyTimer?: Phaser.Time.TimerEvent;

  private rounds: RoundDefinition[] = PUZZLE_ROUNDS;
  /** Every equivalence group successfully solved this session — compared by group ID, never by visible text/order, and never awarded twice. */
  private solvedGroupIds = new Set<EquivalenceGroupId>();
  /** The group ID behind the most recently awarded digit — used only for the final decorative ring-settle pose, which has no fixed "last round's group" anymore now that any group can fill any round. */
  private lastSolvedGroupId?: EquivalenceGroupId;
  private currentRoundIndex = 0;
  private state: PuzzleState = 'ROUND_INTRO';

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer);
  private readonly handlePointerUp = () => this.onPointerUp();

  /** Invoked once the full 3-round sequence completes — e.g. to reveal the room's exit. */
  onComplete?: () => void;

  constructor(scene: Phaser.Scene, crystal: PinkCrystal) {
    this.scene = scene;
    this.crystal = crystal;
    this.roundIntroPopup = new RoundIntroPopup(scene);
    this.roundIntroPopup.onConfirm = () => this.onRoundIntroConfirmed();
    this.feedbackPopup = new FeedbackPopup(scene);
  }

  /** Builds the whole mechanism. depth is the crystal's own depth — rings/marker/panel are offset from it. Fully inert until beginPuzzle() or restoreCompleted() is called. */
  create(depth: number): void {
    this.createMechanismGlow(depth + MECHANISM_GLOW_DEPTH_OFFSET);
    this.createPuzzleRings(depth);
    this.createMechanismZone(depth + MECHANISM_ZONE_DEPTH_OFFSET);
    this.createAlignmentMarker(depth + MARKER_DEPTH_OFFSET);
    this.createCrystalSubmitZone(depth + CRYSTAL_ZONE_DEPTH_OFFSET);
    this.createCrystalCodePanel(depth + PANEL_DEPTH_OFFSET);
    this.roundIntroPopup.create();
    this.feedbackPopup.create();

    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);

    this.setPuzzleInputActive(false);
    this.setSlotActive(0);
  }

  /** Called once the room's own entry transition has settled — begins the puzzle with round 1's intro popup. No-op if the puzzle was already restored as completed. */
  beginPuzzle(): void {
    if (this.state === 'COMPLETED') {
      return;
    }
    this.showCurrentRoundIntro();
  }

  /**
   * Jumps straight to the finished state — all three digits placed, rings
   * in their final rest pose and permanently locked, reward already
   * settled at its icon — for re-entering an already-completed room
   * without replaying the whole puzzle. Same pattern as
   * Statue.restoreOpen()/Entrance.restoreRevealed() in the Central Hall.
   */
  restoreCompleted(): void {
    this.state = 'COMPLETED';
    // Which specific groups were solved isn't persisted (only the
    // completion flag is) — any `rounds.length` distinct groups produce an
    // identical completed state, so the first N of EQUIVALENCE_GROUPS
    // stand in for whatever the player actually solved.
    for (const group of EQUIVALENCE_GROUPS.slice(0, this.rounds.length)) {
      this.solvedGroupIds.add(group.id);
      this.lastSolvedGroupId = group.id;
    }
    for (let i = 0; i < this.codeSlots.length; i++) {
      this.setSlotSolvedVisual(i, this.rounds[i].digit);
    }
    this.setPuzzleInputActive(false);
    this.setRingsToFinalRestPoseInstant();
    this.crystal.playActivationSequence();
    this.setInstructionText('');
    this.revealRewardAtRest();
  }

  /** baseX/baseY: the crystal's center in screen space; scale: background cover-scale factor — same anchor/scale the crystal itself uses. */
  layout(baseX: number, baseY: number, scale: number): void {
    this.centerX = baseX;
    this.centerY = baseY;
    this.scale = scale;

    this.mechanismGlow?.setPosition(baseX, baseY).setDisplaySize(OUTER_RADII.outer * 2.3 * scale, OUTER_RADII.outer * 2.3 * scale);

    for (const ring of this.rings) {
      ring.container.setPosition(baseX, baseY).setScale(scale).setAngle(ring.angle);
    }

    const mechanismRadiusScreen = (OUTER_RADII.outer + RING_OUTER_TOLERANCE_BG) * scale;
    this.mechanismZone?.setPosition(baseX, baseY).setSize(mechanismRadiusScreen * 2, mechanismRadiusScreen * 2);

    this.marker?.setPosition(baseX, baseY - MARKER_OFFSET_Y_BG * scale).setScale(scale);

    const crystalRadiusScreen = CRYSTAL_HIT_RADIUS_BG * scale;
    this.crystalZone?.setPosition(baseX, baseY).setSize(crystalRadiusScreen * 2, crystalRadiusScreen * 2);

    const panelCenterY = baseY + PANEL_CENTER_OFFSET_Y_BG * scale;
    this.codePanelContainer?.setPosition(baseX, panelCenterY).setScale(scale);
    this.codePanelGlow
      ?.setPosition(baseX, panelCenterY)
      .setDisplaySize(PANEL_WIDTH_BG * 1.3 * scale, PANEL_HEIGHT_BG * 1.4 * scale);

    if (this.digitRevealText) {
      this.digitRevealText.setPosition(baseX, baseY).setFontSize(DIGIT_REVEAL_FONT_SIZE_BG * scale);
    }
    this.digitRevealGlow
      ?.setPosition(baseX, baseY)
      .setDisplaySize(DIGIT_REVEAL_FONT_SIZE_BG * 1.6 * scale, DIGIT_REVEAL_FONT_SIZE_BG * 1.6 * scale);

    this.roundIntroPopup.layout(this.scene.scale.width, this.scene.scale.height);
    this.feedbackPopup.layout(this.scene.scale.width, this.scene.scale.height);
  }

  /** Removes listeners, stops tweens/timers, destroys every GameObject. Call on scene shutdown. */
  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    this.hintTimer?.remove();
    this.roundReadyTimer?.remove();

    for (const ring of this.rings) {
      ring.snapTween?.stop();
      ring.shakeTween?.stop();
      ring.container.destroy();
    }
    this.rings = [];

    this.mechanismGlow?.destroy();
    this.mechanismZone?.destroy();
    this.marker?.destroy();
    this.crystalZone?.destroy();
    this.pulseSprite?.destroy();

    for (const slot of this.codeSlots) {
      slot.pulseTween?.stop();
    }
    this.codeSlots = [];
    this.codePanelContainer?.destroy();
    this.codePanelGlow?.destroy();

    this.digitRevealTween?.stop();
    this.digitRevealText?.destroy();
    this.digitRevealGlow?.destroy();

    this.roundIntroPopup.destroy();
    this.feedbackPopup.destroy();

    this.rewardFlightTween?.stop();
    this.rewardSymbol?.destroy();
    this.rewardSymbol = undefined;
  }

  // ---- construction -------------------------------------------------

  private createMechanismGlow(depth: number): void {
    this.generateSoftTexture();
    this.mechanismGlow = this.scene.add
      .image(0, 0, SOFT_TEXTURE_KEY)
      .setTint(0xff8fce)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.16)
      .setDepth(depth);
  }

  private createPuzzleRings(depth: number): void {
    this.innerRing = this.buildRing('inner', 'fraction', INNER_RADII, INNER_RING_ORDER, depth + INNER_RING_DEPTH_OFFSET);
    this.middleRing = this.buildRing('middle', 'decimal', MIDDLE_RADII, MIDDLE_RING_ORDER, depth + MIDDLE_RING_DEPTH_OFFSET);
    this.outerRing = this.buildRing('outer', 'percent', OUTER_RADII, OUTER_RING_ORDER, depth + OUTER_RING_DEPTH_OFFSET);
    this.rings = [this.outerRing, this.middleRing, this.innerRing];
  }

  private buildRing(
    id: RingId,
    kind: RingKind,
    radii: RingRadii,
    order: string[],
    depth: number,
  ): RingRuntime {
    const textureKey = `pink-puzzle-ring-${id}`;
    this.generateRingTexture(textureKey, radii.outer, radii.inner);

    const image = this.scene.add.image(0, 0, textureKey).setOrigin(0.5, 0.5);
    const container = this.scene.add.container(0, 0, [image]).setDepth(depth);

    const midRadius = (radii.inner + radii.outer) / 2;
    for (let i = 0; i < order.length; i++) {
      const label = labelFor(kind, order[i]);
      const angleRad = Phaser.Math.DegToRad(i * SNAP_ANGLE_DEG);
      const x = Math.sin(angleRad) * midRadius;
      const y = -Math.cos(angleRad) * midRadius;
      // Ring values (fractions/decimals/percents) are numbers/math
      // notation, not Hebrew words — left as plain LTR text.
      const text = this.scene.add
        .text(x, y, label, {
          fontFamily: FONT_FAMILY,
          fontSize: '20px',
          color: '#f5e8cc',
        })
        .setOrigin(0.5);
      container.add(text);
    }

    return {
      id,
      kind,
      order,
      radii,
      image,
      container,
      angle: 0,
      isDragging: false,
      dragLastPointerAngleDeg: 0,
    };
  }

  // One mechanism-wide invisible Zone (not three per-ring zones) —
  // pointer-down explicitly computes distance from the shared center and
  // looks the ring up via RING_BANDS itself (see onMechanismPointerDown()),
  // rather than leaning on Phaser to arbitrate between several
  // overlapping same-depth interactive objects.
  private createMechanismZone(depth: number): void {
    this.mechanismZone = this.scene.add.zone(0, 0, 1, 1).setDepth(depth);
    this.mechanismZone.setInteractive({ useHandCursor: true });
    this.mechanismZone.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) =>
      this.onMechanismPointerDown(pointer),
    );
  }

  private createAlignmentMarker(depth: number): void {
    const g = this.scene.add.graphics().setDepth(depth);
    const halfW = MARKER_WIDTH_BG / 2;
    // A small downward-pointing carved finial: dark stone body, thin gold
    // edge, pointing at the value currently under it.
    g.fillStyle(0x2a2118, 1);
    g.beginPath();
    g.moveTo(-halfW, 0);
    g.lineTo(halfW, 0);
    g.lineTo(0, MARKER_HEIGHT_BG);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xd8b878, 0.8);
    g.strokePath();
    g.fillStyle(0xffb6e6, 0.7);
    g.fillCircle(0, MARKER_HEIGHT_BG * 0.35, 3);
    this.marker = g;
  }

  // The crystal is the puzzle's submit control — this zone is purely
  // input (no new visual; PinkCrystal already renders the crystal
  // itself). Hover/pulse are owned by PinkCrystal (setHovered/
  // setSubmitReady) so this class never duplicates crystal-glow logic.
  private createCrystalSubmitZone(depth: number): void {
    this.crystalZone = this.scene.add.zone(0, 0, 1, 1).setDepth(depth);
    this.crystalZone.on(Phaser.Input.Events.POINTER_OVER, () => this.crystal.setHovered(true));
    this.crystalZone.on(Phaser.Input.Events.POINTER_OUT, () => this.crystal.setHovered(false));
    this.crystalZone.on(Phaser.Input.Events.POINTER_DOWN, () => this.checkCurrentAlignment());
  }

  // ---- crystal-code panel ----------------------------------------------

  // A floating architectural panel above the rings: a carved dark stone/
  // bronze frame with a subtle pink reflected glow, a title, and three
  // diamond code slots that fill in automatically as rounds are solved —
  // the player's clear "three rounds" indicator. Built as one Container
  // (visual-only children, positioned in local background-pixel units,
  // scaled as a whole in layout() — same technique buildRing() uses).
  private createCrystalCodePanel(depth: number): void {
    this.generatePanelFrameTexture();
    this.generateCodeSlotTexture();
    this.generateSoftTexture();

    this.codePanelGlow = this.scene.add
      .image(0, 0, SOFT_TEXTURE_KEY)
      .setTint(0xff8fce)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.14)
      .setDepth(depth - 1);

    const container = this.scene.add.container(0, 0).setDepth(depth);
    const frame = this.scene.add.image(0, 0, PANEL_FRAME_TEXTURE_KEY).setOrigin(0.5, 0.5);
    container.add(frame);

    // Stronger warm-ivory tone (was a dimmer tan) plus moved-down offset
    // (PANEL_TITLE_OFFSET_Y_BG) — "increase contrast or brightness" and
    // clear the frame's top border.
    const title = createRtlText(this.scene, 0, PANEL_TITLE_OFFSET_Y_BG, 'קוד הגביש', {
      fontSize: '20px',
      color: '#ffedd2',
    }).setOrigin(0.5);
    container.add(title);

    // Shows correct/duplicate/incorrect feedback and each round's
    // success message — blank at rest.
    this.instructionText = createRtlText(this.scene, 0, PANEL_INSTRUCTION_OFFSET_Y_BG, '', {
      fontSize: '15px',
      wordWrap: { width: PANEL_INSTRUCTION_WRAP_WIDTH_BG, useAdvancedWrap: true },
      color: '#f5d9b8',
    }).setOrigin(0.5);
    container.add(this.instructionText);

    const count = this.rounds.length;
    const startOffsetBg = -((count - 1) / 2) * SLOT_SPACING_BG;
    for (let i = 0; i < count; i++) {
      const offsetXBg = startOffsetBg + i * SLOT_SPACING_BG;
      const glow = this.scene.add
        .image(offsetXBg, PANEL_SLOT_ROW_OFFSET_Y_BG, SOFT_TEXTURE_KEY)
        .setTint(0xffb6e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(SLOT_SIZE_BG * 1.8, SLOT_SIZE_BG * 1.8)
        .setAlpha(0);
      const frameImg = this.scene.add.image(offsetXBg, PANEL_SLOT_ROW_OFFSET_Y_BG, CODE_SLOT_TEXTURE_KEY);
      // Same slot-center coordinates as frameImg, plus a small baseline
      // compensation (SLOT_DIGIT_Y_OFFSET_BG) — origin(0.5,0.5) centers
      // Phaser Text against its full ascent+descent box, which visually
      // sits a few px high for glyphs with no descender (digits, ◇).
      // Computed the same way for all three slots, from each slot's own
      // center — never a hard-coded offset from the panel edge.
      const text = this.scene.add
        .text(offsetXBg, PANEL_SLOT_ROW_OFFSET_Y_BG + SLOT_DIGIT_Y_OFFSET_BG, '◇', {
          fontFamily: FONT_FAMILY,
          fontSize: `${SLOT_DIGIT_FONT_SIZE_BG}px`,
          color: '#d8b878',
        })
        .setOrigin(0.5)
        .setAlpha(0.6);
      container.add(glow);
      container.add(frameImg);
      container.add(text);

      this.codeSlots.push({ offsetXBg, frame: frameImg, glow, text, state: 'empty' });
    }

    this.codePanelContainer = container;
  }

  // The screen-space position of a slot's center — used to fly the
  // revealed digit into it. Recomputed from the panel's own live
  // position/scale rather than cached, matching how everything else in
  // this class derives screen position from centerX/centerY/scale.
  private slotScreenPosition(index: number): { x: number; y: number } {
    const slot = this.codeSlots[index];
    const panelCenterY = this.centerY + PANEL_CENTER_OFFSET_Y_BG * this.scale;
    return {
      x: this.centerX + (slot?.offsetXBg ?? 0) * this.scale,
      y: panelCenterY + PANEL_SLOT_ROW_OFFSET_Y_BG * this.scale,
    };
  }

  // ---- ring interaction -----------------------------------------------

  // The mechanism zone's one pointer-down handler: convert to the shared
  // center's local coordinate system, compute the radial distance, and
  // look up which ring's band (if any) contains it — steps 1-3 of the
  // requested explicit radial selection.
  private onMechanismPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activeDragRingId !== null) {
      // A ring is already locked for this drag — never switch mid-drag.
      return;
    }
    const dx = pointer.x - this.centerX;
    const dy = pointer.y - this.centerY;
    const distBg = Math.sqrt(dx * dx + dy * dy) / this.scale;

    const band = RING_BANDS.find((b) => distBg >= b.minBg && distBg <= b.maxBg);
    if (!band) {
      return;
    }
    this.onRingPointerDown(this.ringById(band.id), pointer);
  }

  private ringById(id: RingId): RingRuntime {
    if (id === 'inner') {
      return this.innerRing;
    }
    if (id === 'middle') {
      return this.middleRing;
    }
    return this.outerRing;
  }

  private onRingPointerDown(ring: RingRuntime, pointer: Phaser.Input.Pointer): void {
    this.activeDragRingId = ring.id;
    ring.isDragging = true;
    ring.snapTween?.stop();
    ring.dragLastPointerAngleDeg = this.pointerAngleDeg(pointer.x, pointer.y);
    this.setRingActiveHighlight(ring, true);
    // "dragging: crystal temporarily disabled until pointer up" — and,
    // per the marker-accuracy fix, not just until pointer up but until
    // the ring has actually finished snapping; see snapRingToPosition().
    this.setCrystalInteractive(false);
    // "do not show [the hint] while the player is dragging a ring" —
    // cancel any pending timer and dismiss one already showing.
    this.cancelHintTimer();
    this.feedbackPopup.dismissImmediately();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.activeDragRingId) {
      return;
    }
    const ring = this.rings.find((r) => r.id === this.activeDragRingId);
    if (!ring || !ring.isDragging) {
      return;
    }
    const currentAngle = this.pointerAngleDeg(pointer.x, pointer.y);
    const step = Phaser.Math.Angle.WrapDegrees(currentAngle - ring.dragLastPointerAngleDeg);
    ring.angle += step;
    ring.dragLastPointerAngleDeg = currentAngle;
    ring.container.setAngle(ring.angle);
  }

  private onPointerUp(): void {
    if (!this.activeDragRingId) {
      return;
    }
    const ring = this.rings.find((r) => r.id === this.activeDragRingId);
    this.activeDragRingId = null;
    if (!ring) {
      return;
    }
    ring.isDragging = false;
    this.setRingActiveHighlight(ring, false);
    this.snapRingToPosition(ring);
  }

  // Do not derive the selected value from the pointer position after
  // snapping — the ring's own angle property (updated here, and only
  // here, once the tween genuinely finishes) is the single source of
  // truth selectedGroupId() reads. The crystal is only re-enabled once
  // that's true, closing the race that let a mid-tween angle produce a
  // marker/index mismatch.
  private snapRingToPosition(ring: RingRuntime): void {
    const targetAngle = Math.round(ring.angle / SNAP_ANGLE_DEG) * SNAP_ANGLE_DEG;
    ring.snapTween?.stop();
    ring.snapTween = this.scene.tweens.add({
      targets: ring,
      angle: targetAngle,
      duration: SNAP_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => ring.container.setAngle(ring.angle),
      onComplete: () => {
        // Normalize into 0-360 so the number stays bounded over a long
        // session; equivalent angle, same visual result.
        ring.angle = Phaser.Math.Wrap(targetAngle, 0, 360);
        ring.container.setAngle(ring.angle);
        this.logSelectionDebug(ring);
        if (this.state === 'ALIGNING_RINGS') {
          this.setCrystalInteractive(true);
          // "Restart the inactivity timer after every ring interaction" —
          // counted from when the rings actually stop moving.
          this.scheduleHintTimer();
        }
      },
    });
  }

  private logSelectionDebug(ring: RingRuntime): void {
    if (!DEBUG_LOG_SELECTION) {
      return;
    }
    const steps = (((Math.round(ring.angle / SNAP_ANGLE_DEG) % 4) + 4) % 4);
    const groupId = this.selectedGroupId(ring);
    // eslint-disable-next-line no-console
    console.debug(
      `[ring-select] ${ring.id} snappedAngle=${ring.angle} index=${steps} groupId=${groupId}`,
    );
  }

  // A subtle warm-pink tint cast over whichever ring is actively being
  // dragged — cleared on pointer up. Distinct from the amber
  // duplicate-feedback tint (playDuplicateRingVibration()).
  private setRingActiveHighlight(ring: RingRuntime, active: boolean): void {
    if (active) {
      ring.image.setTint(0xffc9ea);
    } else {
      ring.image.clearTint();
    }
  }

  // Pointer angle relative to the mechanism's center, in degrees,
  // clockwise from straight up (matching the rings' own label layout).
  private pointerAngleDeg(px: number, py: number): number {
    const dx = px - this.centerX;
    const dy = py - this.centerY;
    return Phaser.Math.RadToDeg(Math.atan2(dx, -dy));
  }

  // ---- input gating -----------------------------------------------------

  // The single place ring/crystal interactivity turns on or off — active
  // only during ALIGNING_RINGS, per the puzzle's input rules. Also owns
  // the crystal's ambient "expecting a submission" pulse and the
  // instruction line's visibility, since both must track the exact same
  // window.
  private setPuzzleInputActive(active: boolean): void {
    if (this.mechanismZone) {
      if (active) {
        this.mechanismZone.setInteractive({ useHandCursor: true });
      } else {
        this.mechanismZone.disableInteractive();
      }
    }
    this.setCrystalInteractive(active);
    this.crystal.setSubmitReady(active);
  }

  private setCrystalInteractive(active: boolean): void {
    if (!this.crystalZone) {
      return;
    }
    if (active) {
      this.crystalZone.setInteractive({ useHandCursor: true });
    } else {
      this.crystalZone.disableInteractive();
      this.crystal.setHovered(false);
    }
  }

  // ---- delayed contextual hint --------------------------------------------

  // (Re)schedules the "click the crystal" hint — a no-op outside
  // ALIGNING_RINGS. Uses the longer repeat delay once the hint has
  // already shown this round, so it nags at most once quickly and any
  // further reminder only after a much longer silence.
  private scheduleHintTimer(): void {
    this.hintTimer?.remove();
    if (this.state !== 'ALIGNING_RINGS') {
      return;
    }
    const delay = this.hintShownThisRound ? HINT_REPEAT_DELAY_MS : HINT_DELAY_MS;
    this.hintTimer = this.scene.time.delayedCall(delay, () => this.showInactivityHint());
  }

  // Cancelled whenever a popup opens, the crystal is clicked, feedback
  // begins, the round changes, or the room completes — every case
  // listed in the input rules. Does not touch an already-visible hint;
  // callers that also need to dismiss one call feedbackPopup.dismissImmediately()
  // alongside this (see onRingPointerDown()/checkCurrentAlignment()).
  private cancelHintTimer(): void {
    this.hintTimer?.remove();
    this.hintTimer = undefined;
  }

  private showInactivityHint(): void {
    if (this.state !== 'ALIGNING_RINGS') {
      return;
    }
    this.hintShownThisRound = true;
    this.feedbackPopup.show({ kind: 'hint', title: HINT_TITLE, body: HINT_BODY }, HINT_POPUP_MS, () =>
      // Still inactive once the hint itself finishes fading — re-arm at
      // the longer interval rather than just stopping, so a genuinely
      // stuck player gets a second nudge eventually without being
      // nagged every few seconds in between.
      this.scheduleHintTimer(),
    );
  }

  // ---- puzzle logic ---------------------------------------------------

  private getSelectedEquivalenceValues(): { inner: string; middle: string; outer: string } {
    return {
      inner: this.selectedGroupId(this.innerRing),
      middle: this.selectedGroupId(this.middleRing),
      outer: this.selectedGroupId(this.outerRing),
    };
  }

  // Shared by selectedGroupId() (an actual ring's current angle),
  // rotateRingsToUnsolvedArrangement() (a hypothetical angle, before
  // committing to it), and angleForGroup() (the inverse lookup) so the
  // "which group is at the marker" math lives in exactly one place. One
  // shared reference frame throughout: the marker is a fixed -90°
  // (straight up) in screen terms, ring labels are laid out at
  // `i*90°` clockwise from that same reference at rest, and container
  // rotation is applied in the same clockwise-positive degrees Phaser
  // itself uses — degrees only, normalized via Wrap/modulo, never mixed
  // with radians outside the one DegToRad call needed for the initial
  // label placement's sin/cos.
  private groupIdAtAngle(order: string[], angle: number): string {
    const steps = (((Math.round(angle / SNAP_ANGLE_DEG) % 4) + 4) % 4);
    const topIndex = (4 - steps) % 4;
    return order[topIndex];
  }

  private angleForGroup(order: string[], groupId: string): number {
    const topIndex = order.indexOf(groupId);
    const steps = topIndex === -1 ? 0 : (4 - topIndex) % 4;
    return steps * SNAP_ANGLE_DEG;
  }

  private selectedGroupId(ring: RingRuntime): string {
    return this.groupIdAtAngle(ring.order, ring.angle);
  }

  // The crystal's only click handler — active only in ALIGNING_RINGS
  // (both by state and by the crystal zone's own disabled-elsewhere
  // interactivity), so this can never fire twice for the same round.
  //
  // Validation order (any of the four EQUIVALENCE_GROUPS is a valid
  // target in any round — a round is a progress slot, not a fixed
  // expected group; see equivalenceData.ts):
  //   a. read the selected fraction/decimal/percent ring values — these
  //      are already stable group IDs (ring.order only ever contains
  //      EQUIVALENCE_GROUPS ids), never visible text.
  //   b. a real match requires all three to agree on one group ID.
  //   c. no match -> incorrect.
  //   d. match, but that group ID is already in solvedGroupIds -> duplicate.
  //   e. match, not yet solved -> accept: record the group ID and award
  //      the next code digit purely by progress order (currentRoundIndex),
  //      never by which specific group was solved.
  private checkCurrentAlignment(): void {
    if (this.state !== 'ALIGNING_RINGS') {
      return;
    }
    this.state = 'CHECKING';
    this.setPuzzleInputActive(false);
    this.cancelHintTimer();
    // Clicking the crystal dismisses a visible hint immediately, then
    // proceeds with the normal check — harmless no-op if none was showing.
    this.feedbackPopup.dismissImmediately();

    const { inner, middle, outer } = this.getSelectedEquivalenceValues();
    const isEquivalent = inner === middle && middle === outer;
    const matchedGroupId = isEquivalent ? inner : undefined;

    if (!matchedGroupId) {
      this.enterIncorrectFeedback();
      return;
    }
    if (this.solvedGroupIds.has(matchedGroupId)) {
      this.enterDuplicateFeedback();
      return;
    }
    this.enterCorrectFeedback(matchedGroupId);
  }

  private enterIncorrectFeedback(): void {
    this.state = 'INCORRECT_FEEDBACK';
    this.playIncorrectFeedback();
    this.feedbackPopup.show(
      { kind: 'incorrect', title: FEEDBACK_INCORRECT_TITLE, body: FEEDBACK_INCORRECT_BODY },
      INCORRECT_FEEDBACK_POPUP_MS,
      () => {
        this.state = 'ALIGNING_RINGS';
        this.setPuzzleInputActive(true);
        this.scheduleHintTimer();
      },
    );
  }

  // Mathematically correct, but this exact group was already awarded in
  // an earlier round — do not award a digit, advance the round, or
  // update progress; just explain what happened and let the player try
  // a different match. Deliberately distinct feedback from a wrong
  // alignment (amber tint + smaller vibration vs. the plain incorrect
  // shake, and its own popup style).
  private enterDuplicateFeedback(): void {
    this.state = 'DUPLICATE_FEEDBACK';
    this.playDuplicateFeedback();
    this.feedbackPopup.show(
      { kind: 'duplicate', title: FEEDBACK_DUPLICATE_TITLE, body: FEEDBACK_DUPLICATE_BODY },
      DUPLICATE_FEEDBACK_POPUP_MS,
      () => {
        this.state = 'ALIGNING_RINGS';
        this.setPuzzleInputActive(true);
        this.scheduleHintTimer();
      },
    );
  }

  // Correct alignment: record it immediately (so a rapid re-check can
  // never double-award it), then show the "נכון!" popup. The rest of the
  // correct-answer sequence — crystal intensify/highlight, digit reveal,
  // flight into the slot — is deferred to beginDigitRevealSequence(),
  // which only starts once this popup has fully faded: both it and the
  // digit reveal happen at the crystal's own screen position, so running
  // them concurrently would visually clash.
  private enterCorrectFeedback(groupId: EquivalenceGroupId): void {
    this.state = 'CORRECT_FEEDBACK';
    this.solvedGroupIds.add(groupId);
    this.lastSolvedGroupId = groupId;
    this.feedbackPopup.show(
      { kind: 'correct', title: FEEDBACK_CORRECT_TITLE, body: FEEDBACK_CORRECT_BODY },
      CORRECT_FEEDBACK_POPUP_MS,
      () => this.beginDigitRevealSequence(),
    );
  }

  // Highlight + intensify (playCorrectFeedback, unchanged pulse + glow),
  // then reveal the digit, hold it long enough to read, fly it into its
  // panel slot, and lock it in — all fully automatic, no player action
  // needed to "enter" it.
  private beginDigitRevealSequence(): void {
    this.playCorrectFeedback();

    const round = this.rounds[this.currentRoundIndex];
    const roundIndex = this.currentRoundIndex;
    this.roundReadyTimer?.remove();
    this.roundReadyTimer = this.scene.time.delayedCall(CORRECT_GLOW_DURATION_MS, () => {
      this.revealRoundDigit(round.digit);
      this.roundReadyTimer = this.scene.time.delayedCall(DIGIT_REVEAL_HOLD_MS, () => {
        this.animateDigitToSlot(roundIndex, () => {
          this.lockDigitIntoSlot(roundIndex, round.digit);
        });
      });
    });
  }

  // Projects the round's digit as a large glowing number near the
  // crystal — "the crystal released part of an ancient code" — and
  // holds it just long enough to read before animateDigitToSlot() flies
  // it away.
  private revealRoundDigit(digit: number): void {
    if (!this.digitRevealText) {
      // NORMAL blend + a dark stroke, not ADD — the crystal's own core is
      // already near-white, and an additive digit washed out completely
      // against it in testing. The stroke keeps it readable against any
      // backdrop brightness.
      this.digitRevealText = this.scene.add
        .text(this.centerX, this.centerY, '', {
          fontFamily: FONT_FAMILY,
          color: '#fff2fa',
          stroke: '#3a0f2a',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth((this.crystalZone?.depth ?? 0) + DIGIT_REVEAL_DEPTH_OFFSET);
    }
    if (!this.digitRevealGlow) {
      this.generateSoftTexture();
      this.digitRevealGlow = this.scene.add
        .image(this.centerX, this.centerY, SOFT_TEXTURE_KEY)
        .setTint(0xffb3e6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth((this.digitRevealText?.depth ?? 0) - 1);
    }

    this.digitRevealText
      .setText(String(digit))
      .setPosition(this.centerX, this.centerY)
      .setFontSize(DIGIT_REVEAL_FONT_SIZE_BG * this.scale)
      .setAlpha(0);
    this.digitRevealGlow
      .setPosition(this.centerX, this.centerY)
      .setDisplaySize(DIGIT_REVEAL_FONT_SIZE_BG * 1.6 * this.scale, DIGIT_REVEAL_FONT_SIZE_BG * 1.6 * this.scale)
      .setAlpha(0);

    this.digitRevealTween?.stop();
    this.digitRevealTween = this.scene.tweens.add({
      targets: [this.digitRevealText, this.digitRevealGlow],
      alpha: 1,
      duration: DIGIT_REVEAL_FADE_MS,
      ease: Phaser.Math.Easing.Sine.Out,
    });
  }

  // Flies the revealed digit from the crystal into its target slot,
  // shrinking and fading as it goes — "the digit moves from the crystal
  // into its correct slot." Recomputes position/size every frame from
  // the crystal/slot anchors rather than tweening raw properties, so it
  // stays correct even if a resize happens mid-flight.
  private animateDigitToSlot(index: number, onComplete: () => void): void {
    if (!this.digitRevealText || !this.digitRevealGlow) {
      onComplete();
      return;
    }
    const text = this.digitRevealText;
    const glow = this.digitRevealGlow;
    const startX = this.centerX;
    const startY = this.centerY;
    const target = this.slotScreenPosition(index);
    const startFontSize = DIGIT_REVEAL_FONT_SIZE_BG * this.scale;
    const endFontSize = SLOT_DIGIT_FONT_SIZE_BG * this.scale;
    const startGlowSize = DIGIT_REVEAL_FONT_SIZE_BG * 1.6 * this.scale;
    const endGlowSize = SLOT_SIZE_BG * this.scale * 0.6;

    const progress = { t: 0 };
    this.digitRevealTween?.stop();
    this.digitRevealTween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: DIGIT_FLIGHT_DURATION_MS,
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
        // slot's own permanent glow (lockDigitIntoSlot()) doesn't flash.
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

  private setInstructionText(message: string): void {
    this.instructionText?.setText(message);
  }

  // Marks a slot as the current round's slot and (re)starts its subtle
  // breathing highlight — a non-color "progress lands here next" cue.
  private setSlotActive(index: number): void {
    const slot = this.codeSlots[index];
    if (!slot) {
      return;
    }
    slot.state = 'active';
    slot.pulseTween?.stop();

    const [minAlpha, maxAlpha] = SLOT_GLOW_IDLE_RANGE;
    slot.glow.setAlpha(minAlpha);
    slot.pulseTween = this.scene.tweens.add({
      targets: slot.glow,
      alpha: maxAlpha,
      duration: SLOT_PULSE_MS,
      yoyo: true,
      repeat: -1,
      ease: Phaser.Math.Easing.Sine.InOut,
    });
  }

  // Places a digit permanently into a slot with no further animation —
  // shared by the live lock-in (after its pop tween) and restoreCompleted().
  private setSlotSolvedVisual(index: number, digit: number): void {
    const slot = this.codeSlots[index];
    if (!slot) {
      return;
    }
    slot.state = 'solved';
    slot.pulseTween?.stop();
    slot.frame.setScale(1);
    slot.text.setText(String(digit)).setAlpha(1).setColor('#ffd9f0').setScale(1);
    slot.glow.setAlpha(SLOT_SOLVED_GLOW_ALPHA);
  }

  // The digit has arrived: pop it into place with a brief scale-bounce,
  // give the slot its permanent glow, then hand off to
  // finishCorrectFeedback() once the pop settles — sequential, not
  // overlapping, with the flight tween that led here.
  private lockDigitIntoSlot(index: number, digit: number): void {
    const slot = this.codeSlots[index];
    if (!slot) {
      return;
    }
    slot.state = 'solved';
    slot.pulseTween?.stop();
    slot.text.setText(String(digit)).setAlpha(1).setColor('#ffd9f0');
    slot.glow.setAlpha(SLOT_SOLVED_GLOW_ALPHA);

    const pop = { scale: 1.4 };
    this.scene.tweens.add({
      targets: pop,
      scale: 1,
      duration: SLOT_LOCK_POP_MS,
      ease: Phaser.Math.Easing.Back.Out,
      onUpdate: () => {
        slot.frame.setScale(pop.scale);
        slot.text.setScale(pop.scale);
      },
      onComplete: () => this.finishCorrectFeedback(index),
    });
  }

  // Shows the round's success message, then either starts ROUND_TRANSITION
  // toward the next round's intro popup, or — once all three are solved —
  // settles briefly into completeCrystalCode().
  private finishCorrectFeedback(index: number): void {
    const round = this.rounds[index];
    this.setInstructionText(round?.successMessage ?? '');
    this.state = 'ROUND_TRANSITION';

    this.roundReadyTimer?.remove();
    // Three new correct matches found, regardless of which groups they
    // were — not "these three specific groups."
    if (this.solvedGroupIds.size >= this.rounds.length) {
      this.roundReadyTimer = this.scene.time.delayedCall(FINAL_ROUND_SETTLE_MS, () => this.completeCrystalCode());
      return;
    }

    this.roundReadyTimer = this.scene.time.delayedCall(ROUND_TRANSITION_DELAY_MS, () => {
      this.advanceToNextPuzzleRound();
    });
  }

  private playIncorrectFeedback(): void {
    this.crystal.playDim();
    for (const ring of this.rings) {
      this.shakeRing(ring);
    }
  }

  private shakeRing(ring: RingRuntime): void {
    ring.shakeTween?.stop();
    const base = ring.angle;
    ring.shakeTween = this.scene.tweens.add({
      targets: ring.container,
      angle: base + SHAKE_ANGLE_DEG,
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => ring.container.setAngle(base),
    });
  }

  // "Correct but already solved": a muted crystal dim (not the brighter
  // intensify) plus a small amber-tinted vibration on all three rings —
  // "briefly highlight the already-used values" — visibly different in
  // both color and amplitude from playIncorrectFeedback()'s plain shake.
  private playDuplicateFeedback(): void {
    this.crystal.playDim();
    for (const ring of this.rings) {
      this.playDuplicateRingVibration(ring);
    }
  }

  private playDuplicateRingVibration(ring: RingRuntime): void {
    ring.shakeTween?.stop();
    const base = ring.angle;
    ring.image.setTint(DUPLICATE_TINT);
    ring.shakeTween = this.scene.tweens.add({
      targets: ring.container,
      angle: base + DUPLICATE_SHAKE_ANGLE_DEG,
      duration: SHAKE_STEP_MS,
      yoyo: true,
      repeat: SHAKE_REPEATS,
      ease: Phaser.Math.Easing.Sine.InOut,
      onComplete: () => {
        ring.container.setAngle(base);
        ring.image.clearTint();
      },
    });
  }

  // Prepares the next round — rotates the rings to a fresh, not-already-
  // solved arrangement (real dial-turning left to do, and the reset
  // reads as deliberate rather than a leftover position), clears the
  // instruction text, then opens that round's intro popup. Rings/crystal
  // stay locked (ROUND_INTRO) until the popup's own button is clicked —
  // see onRoundIntroConfirmed() — so the next round never begins before
  // the previous digit was placed correctly.
  private advanceToNextPuzzleRound(): void {
    this.currentRoundIndex++;
    this.rotateRingsToUnsolvedArrangement();
    this.setSlotActive(this.currentRoundIndex);
    this.setInstructionText('');
    this.showCurrentRoundIntro();
  }

  // Snaps each ring to a random one of its 4 positions, re-rolling if the
  // result would already solve the *next* round outright — a deliberate
  // "the mechanism reset" cue, not left wherever the player last dragged
  // it. Instant, like the rings' own initial angle=0 at room load; no
  // animation was requested for this reset.
  private rotateRingsToUnsolvedArrangement(): void {
    let innerAngle = 0;
    let middleAngle = 0;
    let outerAngle = 0;
    let wouldAutoSolve: boolean;
    do {
      innerAngle = Phaser.Math.Between(0, 3) * SNAP_ANGLE_DEG;
      middleAngle = Phaser.Math.Between(0, 3) * SNAP_ANGLE_DEG;
      outerAngle = Phaser.Math.Between(0, 3) * SNAP_ANGLE_DEG;
      const innerGroup = this.groupIdAtAngle(this.innerRing.order, innerAngle);
      const middleGroup = this.groupIdAtAngle(this.middleRing.order, middleAngle);
      const outerGroup = this.groupIdAtAngle(this.outerRing.order, outerAngle);
      // Re-roll only if the fresh arrangement would hand over a free,
      // unearned new match (any still-unsolved group) — landing on an
      // already-solved group's equivalence is harmless (would just read
      // as "duplicate" if checked) and isn't worth re-rolling for.
      wouldAutoSolve =
        innerGroup === middleGroup && middleGroup === outerGroup && !this.solvedGroupIds.has(innerGroup);
    } while (wouldAutoSolve);

    this.innerRing.angle = innerAngle;
    this.middleRing.angle = middleAngle;
    this.outerRing.angle = outerAngle;
    for (const ring of this.rings) {
      ring.container.setAngle(ring.angle);
    }
  }

  // ---- round intro popup ------------------------------------------------

  private showCurrentRoundIntro(): void {
    const round = this.rounds[this.currentRoundIndex];
    if (!round) {
      return;
    }
    this.state = 'ROUND_INTRO';
    this.cancelHintTimer();
    this.feedbackPopup.dismissImmediately();
    // A fresh round gets its own first-tier hint delay again.
    this.hintShownThisRound = false;
    this.roundIntroPopup.show({
      title: round.introTitle,
      body: round.introBody,
      buttonLabel: ROUND_INTRO_BUTTON_LABEL,
    });
  }

  private onRoundIntroConfirmed(): void {
    if (this.state !== 'ROUND_INTRO') {
      return;
    }
    this.roundIntroPopup.hide(() => {
      this.state = 'ALIGNING_RINGS';
      this.setPuzzleInputActive(true);
      this.scheduleHintTimer();
    });
  }

  // ---- completion ---------------------------------------------------

  // All three digits placed correctly: lock the rings for good in a
  // slightly rotated final resting pose, intensify/raise the crystal,
  // reveal the reward, and mark the whole puzzle (and the reward)
  // complete in the shared registry (same pattern as
  // STATE_KEY_LEFT_STATUE_OPEN in CentralHallScene.ts). Does not build or
  // reference the next room; the completed code stays visible.
  private completeCrystalCode(): void {
    this.state = 'COMPLETED';
    this.setPuzzleInputActive(false);
    this.cancelHintTimer();
    this.playFinalRingSettleAnimation();
    // The reward reveal grows out from the crystal's own screen
    // position, same conflict as the correct-answer digit reveal — shown
    // first, then the rest of the completion sequence starts only once
    // it's fully faded (see playCompletionSequence()).
    this.feedbackPopup.show(
      { kind: 'completed', title: FEEDBACK_COMPLETED_TITLE, body: FEEDBACK_COMPLETED_BODY },
      COMPLETED_FEEDBACK_POPUP_MS,
      () => this.playCompletionSequence(),
    );
  }

  private playCompletionSequence(): void {
    if (this.codePanelGlow) {
      this.scene.tweens.add({
        targets: this.codePanelGlow,
        alpha: 0.32,
        duration: PULSE_DURATION_MS,
        ease: Phaser.Math.Easing.Sine.Out,
      });
    }

    this.crystal.playActivationSequence();
    this.revealRewardSymbol();

    setPinkRoomState(this.scene.registry, { completed: true });
    this.onComplete?.();
  }

  // "Rotate the rings slightly into a final aligned resting position" —
  // a small decorative flourish on top of the (already-correct) round-3
  // alignment; purely visual, since rings are already permanently locked
  // by the time this runs.
  private playFinalRingSettleAnimation(): void {
    const lastGroupId = this.lastSolvedGroupId;
    if (!lastGroupId) {
      return;
    }
    for (const ring of this.rings) {
      const target = this.angleForGroup(ring.order, lastGroupId) + FINAL_SETTLE_EXTRA_DEG;
      ring.snapTween?.stop();
      ring.snapTween = this.scene.tweens.add({
        targets: ring,
        angle: target,
        duration: FINAL_SETTLE_DURATION_MS,
        ease: Phaser.Math.Easing.Sine.InOut,
        onUpdate: () => ring.container.setAngle(ring.angle),
      });
    }
  }

  // Instant version of the same final pose, for restoreCompleted() —
  // no flourish/tween needed on room re-entry.
  private setRingsToFinalRestPoseInstant(): void {
    const lastGroupId = this.lastSolvedGroupId;
    if (!lastGroupId) {
      return;
    }
    for (const ring of this.rings) {
      ring.angle = this.angleForGroup(ring.order, lastGroupId) + FINAL_SETTLE_EXTRA_DEG;
      ring.container.setAngle(ring.angle);
    }
  }

  private playCorrectFeedback(): void {
    this.crystal.playIntensify(PULSE_DURATION_MS);
    this.playEnergyPulse();
  }

  // A brief expanding, fading pink ring of light traveling out through
  // the mechanism — reuses the shared soft-glow texture, stretched into a
  // ring shape via display size and low fill. "Highlight the three
  // aligned values."
  private playEnergyPulse(): void {
    this.generateSoftTexture();
    this.pulseSprite?.destroy();
    this.pulseSprite = this.scene.add
      .image(this.centerX, this.centerY, SOFT_TEXTURE_KEY)
      .setTint(0xffb3e6)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth((this.outerRing?.container.depth ?? 0) + 1)
      .setAlpha(0.75)
      .setDisplaySize(OUTER_RADII.inner * 2 * this.scale, OUTER_RADII.inner * 2 * this.scale);

    this.scene.tweens.add({
      targets: this.pulseSprite,
      alpha: 0,
      duration: PULSE_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: (tween) => {
        if (!this.pulseSprite) {
          return;
        }
        const t = tween.progress;
        const size = Phaser.Math.Linear(OUTER_RADII.inner * 2, OUTER_RADII.outer * 2.6, t) * this.scale;
        this.pulseSprite.setDisplaySize(size, size);
      },
      onComplete: () => {
        this.pulseSprite?.destroy();
        this.pulseSprite = undefined;
      },
    });
  }

  // ---- reward -----------------------------------------------------------

  // Rises out of the crystal (grow + fade in), then flies into the
  // shared, persistent crystal-collection holder's "pink" slot —
  // "animate the reward toward the inventory."
  private revealRewardSymbol(): void {
    if (this.rewardShown) {
      return;
    }
    this.rewardShown = true;
    this.generateRewardTexture();

    const baseSize = REWARD_SIZE_BG * this.scale;
    this.rewardSymbol = this.scene.add
      .image(this.centerX, this.centerY, REWARD_TEXTURE_KEY)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setScrollFactor(0)
      .setDepth(REWARD_DEPTH)
      .setDisplaySize(baseSize * 0.3, baseSize * 0.3);

    const reveal = { progress: 0 };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: reveal,
      progress: 1,
      duration: REWARD_REVEAL_DURATION_MS,
      ease: Phaser.Math.Easing.Sine.Out,
      onUpdate: () => {
        if (!this.rewardSymbol) {
          return;
        }
        const size = Phaser.Math.Linear(baseSize * 0.3, baseSize, reveal.progress);
        this.rewardSymbol.setDisplaySize(size, size).setAlpha(reveal.progress);
      },
      onComplete: () => this.flyRewardToHolder(),
    });

    setPinkRoomState(this.scene.registry, { hasShard: true });
  }

  private flyRewardToHolder(): void {
    if (!this.rewardSymbol) {
      return;
    }
    const startX = this.rewardSymbol.x;
    const startY = this.rewardSymbol.y;
    const startSize = REWARD_SIZE_BG * this.scale;
    const target = this.crystalHolder?.getSlotScreenPosition('pink') ?? {
      x: REWARD_ICON_MARGIN_PX,
      y: REWARD_ICON_MARGIN_PX,
    };

    const progress = { t: 0 };
    this.rewardFlightTween?.stop();
    this.rewardFlightTween = this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: REWARD_FLIGHT_DURATION_MS,
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
      onComplete: () => this.arriveRewardAtHolder(),
    });
  }

  // The crystal has arrived: record it in the shared pouch, let the
  // holder itself pop the slot filled, and drop the temporary flying
  // sprite — the holder is the only persistent visual from here on.
  private arriveRewardAtHolder(): void {
    this.rewardSymbol?.destroy();
    this.rewardSymbol = undefined;
    setCrystalCollected(this.scene.registry, 'pink');
    this.crystalHolder?.revealCollected('pink');
  }

  // restoreCompleted()'s version: the reward is already collected — the
  // holder's own refresh() (already re-run every time it's created)
  // shows it filled with no animation, so there's nothing left to do
  // here beyond guarding revealRewardSymbol() against ever replaying.
  private revealRewardAtRest(): void {
    this.rewardShown = true;
  }

  // ---- procedural textures ---------------------------------------------

  // TEMPORARY prototype ring art: a carved stone/bronze annulus with a
  // pink inner-rim highlight (catching the crystal's glow) and gold tick
  // dividers between values. Swap for final transparent ring images later
  // — nothing outside this method needs to change.
  private generateRingTexture(key: string, outerR: number, innerR: number): void {
    if (this.scene.textures.exists(key)) {
      return;
    }
    const size = outerR * 2;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.closePath();
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, '#8c7554');
    grad.addColorStop(0.55, '#6b5a44');
    grad.addColorStop(1, '#362b1d');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Inner rim: soft pink highlight, as if catching the crystal's glow.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerR + 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,140,205,0.4)';
    ctx.stroke();
    ctx.restore();

    // Outer rim: dark shadow edge.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 1, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
    ctx.restore();

    // Gold tick dividers between each of the 4 value slots.
    ctx.save();
    ctx.strokeStyle = 'rgba(214,178,112,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = Phaser.Math.DegToRad(i * 90 + 45);
      const x1 = cx + Math.sin(angle) * innerR;
      const y1 = cy - Math.cos(angle) * innerR;
      const x2 = cx + Math.sin(angle) * outerR;
      const y2 = cy - Math.cos(angle) * outerR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    canvas.refresh();
  }

  // TEMPORARY prototype panel art: a carved dark stone/bronze frame with
  // a recessed interior and a soft pink inner-rim highlight (echoing the
  // ring texture's own inner rim), standing in for a final asset.
  private generatePanelFrameTexture(): void {
    if (this.scene.textures.exists(PANEL_FRAME_TEXTURE_KEY)) {
      return;
    }
    const w = PANEL_WIDTH_BG;
    const h = PANEL_HEIGHT_BG;
    const canvas = this.scene.textures.createCanvas(PANEL_FRAME_TEXTURE_KEY, w, h);
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

    // Outer carved stone frame.
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

    // Recessed dark interior.
    const inset = 10;
    const innerGrad = ctx.createLinearGradient(0, inset, 0, h - inset);
    innerGrad.addColorStop(0, '#241d15');
    innerGrad.addColorStop(1, '#140f0a');
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 6);
    ctx.fillStyle = innerGrad;
    ctx.fill();

    // Subtle pink reflected glow along the interior's inner edge.
    ctx.save();
    drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, radius - 6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,140,205,0.35)';
    ctx.stroke();
    ctx.restore();

    canvas.refresh();
  }

  // A larger carved diamond stone slot, empty at rest — one shared
  // texture for all three slots (enlarged this sprint so each digit has
  // real room inside its frame — see SLOT_SIZE_BG). "Active"/"solved"
  // states are conveyed by the separate glow image + digit text, not by
  // recoloring this frame (a multiply-tint can't brighten a dark base
  // texture).
  private generateCodeSlotTexture(): void {
    if (this.scene.textures.exists(CODE_SLOT_TEXTURE_KEY)) {
      return;
    }
    const size = SLOT_SIZE_BG;
    const canvas = this.scene.textures.createCanvas(CODE_SLOT_TEXTURE_KEY, size, size);
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

  // TEMPORARY completion reward art: a soft pink core behind an
  // elongated shard silhouette with a small loop near the top — reading
  // as "a shard of the crystal" and "an ancient key" at once, standing in
  // for a real reward asset.
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

    // Shard body: a tall, tapered hexagon.
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

    // A small key-loop near the top, reading as "ancient pink key."
    ctx.beginPath();
    ctx.arc(0, -r * 0.62, r * 0.14, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    canvas.refresh();
  }

  private generateSoftTexture(): void {
    if (this.scene.textures.exists(SOFT_TEXTURE_KEY)) {
      return;
    }
    const size = 64;
    const canvas = this.scene.textures.createCanvas(SOFT_TEXTURE_KEY, size, size);
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
