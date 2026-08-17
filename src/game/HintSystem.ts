import Phaser from 'phaser';
import { createRtlText } from './rtlText';
import {
  getPinkRoomState,
  isLeftStatuePassageOpen,
  isFloorEntranceOpen,
  isWallWheelOpen,
  areAllCrystalsCollected,
  areAllCrystalsPlaced,
} from './GameState';
import { isEnvelopScaleMode, ENVELOP_TOP_SAFE_MARGIN_PX } from './scaleMode';
import { HOLDER_MARGIN_X_PX, HOLDER_MARGIN_Y_PX, HOLDER_HEIGHT_PX } from './CrystalHolder';

interface HintDefinition {
  id: string;
  /** The prerequisite for this hint to even be a candidate (e.g. the floor tile only matters once the Pink Room shard is held). */
  isAvailable: (registry: Phaser.Data.DataManager) => boolean;
  /** True once the player has already found this on their own — retires the hint regardless of isAvailable. */
  isDiscovered: (registry: Phaser.Data.DataManager) => boolean;
  tier1: string;
  tier2: string;
}

// Atmospheric guiding QUESTIONS, not literal instructions ("click the
// pot") — invites curiosity rather than spoiling the discovery. Math
// deliberately stays out of these (it belongs inside each room's own
// puzzle) — these three are pure navigation/discovery hints for Central
// Hall's three hidden entrances.
const HINTS: HintDefinition[] = [
  {
    id: 'pot',
    isAvailable: () => true,
    isDiscovered: (registry) => isLeftStatuePassageOpen(registry),
    tier1: 'מה משתנה כאשר מתקרבים מדי לשומר השמאלי של האולם?',
    tier2: 'האם ייתכן שהכלי העתיק לצד הפסל אינו יציב כפי שהוא נראה?',
  },
  {
    id: 'floorTile',
    isAvailable: (registry) => getPinkRoomState(registry).hasShard,
    isDiscovered: (registry) => isFloorEntranceOpen(registry),
    tier1: 'מאז שקיבלתם את שבר הגביש הוורוד, האם שמתם לב שמשהו ברצפה כבר אינו כפי שהיה?',
    tier2: 'חפשו אריח שאבק הזמן לא הצליח להסתיר את זוהרו.',
  },
  {
    id: 'wheel',
    isAvailable: () => true,
    isDiscovered: (registry) => isWallWheelOpen(registry),
    tier1: 'יש באולם עיגול שסובב במקום, אך מעולם לא השלים את מסלולו — מה יקרה אם תניעו אותו?',
    tier2: 'חפשו את הגלגל החרוט בקיר, הממתין ליד שלא פוחדת מהעבר.',
  },
  {
    // Not a guiding QUESTION like the three above — a direct instruction,
    // since by this point (all three crystals collected) the "discovery"
    // phase is over and the player is looking at an actual mechanism with
    // slots and a tray of crystals. Same text for both tiers: there is no
    // vaguer/more-specific escalation to offer here, only the one
    // instruction. Previously shown as a permanent floating line above the
    // mechanism (CrystalPlacementMode.ts's old guidanceText) — moved here
    // so it's opt-in like every other hint, not a fixture on screen.
    id: 'crystalMechanism',
    isAvailable: (registry) => areAllCrystalsCollected(registry),
    isDiscovered: (registry) => areAllCrystalsPlaced(registry),
    tier1: 'גררו כל גביש אל השקע המתאים במנגנון.',
    tier2: 'גררו כל גביש אל השקע המתאים במנגנון.',
  },
];

const BUTTON_SIZE_PX = 76;
const BUTTON_LABEL_FONT_PX = 26;
// Gap kept between the CrystalHolder pouch's bottom edge and this
// button's top edge, so the two read as one grouped cluster in the
// top-left corner rather than accidentally touching.
const BUTTON_GAP_BELOW_HOLDER_PX = 12;
const BUTTON_DEPTH = 80;
const POPUP_DEPTH = 150;
const TOGGLE_DEBOUNCE_MS = 300;
const VISIBILITY_POLL_MS = 1000;
const BUTTON_LABEL = 'רמז';
const CLOSE_HINT_TEXT = '— לחצו לסגירה —';

// Bumped up a second time (was 640/230/28/16, before that 560/200/22/13)
// — still reported too small on a laptop-sized window. The design canvas
// is fixed at 1536x1024 and scales uniformly to fit any real viewport, so
// a modest browser window renders every design-px measurement
// proportionally smaller; these are simply sized more generously to stay
// legible at that end of the range too.
const POPUP_PANEL_WIDTH_MAX_PX = 720;
const POPUP_PANEL_HEIGHT_PX = 280;
const POPUP_TEXT_FONT_PX = 34;
const POPUP_CLOSE_HINT_FONT_PX = 22;

/**
 * A small, always-in-the-corner "hint" button for Central Hall's three
 * hidden discovery targets (pot/lever/statue passage, floor seal, wall
 * wheel) — hidden whenever nothing is currently pending (either already
 * discovered, or not yet available, e.g. the floor tile before the Pink
 * Room shard is held). Clicking it cycles through whichever targets are
 * still pending, showing a two-tier guiding QUESTION per target (a vaguer
 * one first, a more specific one if that same target comes up again) —
 * never a literal instruction, and never anything math-related (math
 * belongs inside each room's own puzzle, not in a "where do I click" hint).
 *
 * Reads only the shared registry (GameState.ts) for prerequisites/
 * discovery, and owns its own small popup rather than reusing
 * CentralHallScene's crystal-popup machinery — its only other coupling is
 * a few imported layout constants from CrystalHolder.ts (see layout()),
 * so its button positions itself directly beneath that pouch. Otherwise
 * it has no dependency on that scene's internals.
 */
export default class HintSystem {
  private scene: Phaser.Scene;
  private buttonContainer?: Phaser.GameObjects.Container;
  private popupContainer?: Phaser.GameObjects.Container;
  private visibilityTimer?: Phaser.Time.TimerEvent;
  /** 0 = only tier1 shown so far, 1 = tier2 reached (stays there — tier2 just repeats on further requests). */
  private hintTier: Record<string, number> = {};
  private rotationIndex = 0;
  private lastToggleAt = -Infinity;

  private readonly handleGlobalPointerDown = () => this.onGlobalPointerDown();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  create(): void {
    const bg = this.scene.add.graphics();
    this.drawButtonBg(bg, false);

    const label = createRtlText(this.scene, 0, 0, BUTTON_LABEL, {
      fontSize: `${BUTTON_LABEL_FONT_PX}px`,
      color: '#f2e9d8',
    }).setOrigin(0.5);

    this.buttonContainer = this.scene.add.container(0, 0, [bg, label]).setDepth(BUTTON_DEPTH).setScrollFactor(0);

    const half = BUTTON_SIZE_PX / 2;
    this.buttonContainer.setInteractive(new Phaser.Geom.Rectangle(-half, -half, BUTTON_SIZE_PX, BUTTON_SIZE_PX), Phaser.Geom.Rectangle.Contains);
    if (this.buttonContainer.input) {
      this.buttonContainer.input.cursor = 'pointer';
    }
    this.buttonContainer.on(Phaser.Input.Events.POINTER_OVER, () => this.drawButtonBg(bg, true));
    this.buttonContainer.on(Phaser.Input.Events.POINTER_OUT, () => this.drawButtonBg(bg, false));
    this.buttonContainer.on(Phaser.Input.Events.POINTER_DOWN, () => this.handleButtonClick());

    // Same "dismiss on any click" pattern CentralHallScene's own popup
    // uses — shares this class's own lastToggleAt debounce with the
    // button's click handler, so the same click that opens a hint can
    // never also immediately close it via this listener.
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handleGlobalPointerDown);

    this.layout();
    this.refreshVisibility();
    this.visibilityTimer = this.scene.time.addEvent({
      delay: VISIBILITY_POLL_MS,
      loop: true,
      callback: () => this.refreshVisibility(),
    });
  }

  /**
   * Screen-fixed top-left corner, directly below the CrystalHolder pouch
   * (same left margin, so the two read as one grouped cluster rather than
   * two unrelated corner widgets) — safe to call anytime (e.g. on every
   * resize), reads current scale directly, no args needed. Reuses
   * CrystalHolder's own exported margin/size constants rather than a
   * second, driftable copy of those numbers. On short phone-landscape
   * screens (ENVELOP scale mode) the fixed 1536x1024 design canvas is
   * cropped along its top edge, so a plain fixed margin would fall inside
   * the cropped-off region — CrystalHolder itself already substitutes
   * `ENVELOP_TOP_SAFE_MARGIN_PX` for its own top margin in that case, and
   * this button's position is derived from that same (possibly
   * substituted) value, so it stays correctly anchored just below the
   * holder in both modes without needing its own separate branch.
   */
  layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    const holderTopMargin = isEnvelopScaleMode(this.scene) ? ENVELOP_TOP_SAFE_MARGIN_PX : HOLDER_MARGIN_Y_PX;
    const buttonY = holderTopMargin + HOLDER_HEIGHT_PX + BUTTON_GAP_BELOW_HOLDER_PX + BUTTON_SIZE_PX / 2;
    this.buttonContainer?.setPosition(HOLDER_MARGIN_X_PX + BUTTON_SIZE_PX / 2, buttonY);

    if (this.popupContainer) {
      this.popupContainer.setPosition(width / 2, height / 2);
    }
  }

  destroy(): void {
    this.visibilityTimer?.remove();
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handleGlobalPointerDown);
    this.buttonContainer?.destroy();
    this.popupContainer?.destroy();
  }

  private getPendingHints(): HintDefinition[] {
    const registry = this.scene.registry;
    return HINTS.filter((hint) => hint.isAvailable(registry) && !hint.isDiscovered(registry));
  }

  private refreshVisibility(): void {
    this.buttonContainer?.setVisible(this.getPendingHints().length > 0);
  }

  private handleButtonClick(): void {
    if (this.scene.time.now - this.lastToggleAt < TOGGLE_DEBOUNCE_MS) {
      return;
    }
    this.lastToggleAt = this.scene.time.now;

    const pending = this.getPendingHints();
    if (pending.length === 0) {
      return;
    }

    this.rotationIndex = this.rotationIndex % pending.length;
    const hint = pending[this.rotationIndex];
    this.rotationIndex += 1;

    const tier = this.hintTier[hint.id] ?? 0;
    const text = tier === 0 ? hint.tier1 : hint.tier2;
    this.hintTier[hint.id] = Math.min(tier + 1, 1);

    this.showHintPopup(text);
  }

  private onGlobalPointerDown(): void {
    if (!this.popupContainer) {
      return;
    }
    if (this.scene.time.now - this.lastToggleAt < TOGGLE_DEBOUNCE_MS) {
      return;
    }
    this.lastToggleAt = this.scene.time.now;
    this.closeHintPopup();
  }

  private showHintPopup(text: string): void {
    this.popupContainer?.destroy();

    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // Interactive (even with no listener of its own) so it actually
    // intercepts clicks at the Phaser hit-testing level, rather than
    // letting them pass through to whatever's underneath in world space
    // — this popup is screen-centered, roughly where the Heart of the
    // Temple's crystal sits too, so a click here (e.g. on the close-hint
    // line) could otherwise ALSO reach the crystal's own click handler
    // underneath and pop that popup open, on top of this one closing via
    // the scene-wide dismiss listener (onGlobalPointerDown, below).
    const overlay = this.scene.add
      .rectangle(-width / 2, -height / 2, width, height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setInteractive();

    const panelWidth = Math.min(width * 0.9, POPUP_PANEL_WIDTH_MAX_PX);
    const panelHeight = POPUP_PANEL_HEIGHT_PX;
    const backdrop = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x241f19, 0.96)
      .setStrokeStyle(2, 0xd6b270, 0.7);

    const label = createRtlText(this.scene, 0, -14, text, {
      fontSize: `${POPUP_TEXT_FONT_PX}px`,
      color: '#f2e9d8',
      align: 'center',
      wordWrap: { width: panelWidth - 80 },
    }).setOrigin(0.5);

    const closeHint = createRtlText(this.scene, 0, panelHeight / 2 - 32, CLOSE_HINT_TEXT, {
      fontSize: `${POPUP_CLOSE_HINT_FONT_PX}px`,
      color: '#8a8068',
    }).setOrigin(0.5);

    this.popupContainer = this.scene.add
      .container(width / 2, height / 2, [overlay, backdrop, label, closeHint])
      .setDepth(POPUP_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0);

    this.scene.tweens.add({ targets: this.popupContainer, alpha: 1, duration: 200 });
  }

  private closeHintPopup(): void {
    if (!this.popupContainer) {
      return;
    }
    const container = this.popupContainer;
    this.popupContainer = undefined;
    this.scene.tweens.add({
      targets: container,
      alpha: 0,
      duration: 150,
      onComplete: () => container.destroy(),
    });
  }

  // A small, gentle stone-plaque button — same visual family as this
  // project's other frames, just compact.
  private drawButtonBg(g: Phaser.GameObjects.Graphics, hovered: boolean): void {
    g.clear();
    const half = BUTTON_SIZE_PX / 2;
    g.fillStyle(0x241f19, 0.9);
    g.fillRoundedRect(-half, -half, BUTTON_SIZE_PX, BUTTON_SIZE_PX, 12);
    g.lineStyle(2, hovered ? 0xf2d9a0 : 0xd6b270, hovered ? 0.9 : 0.6);
    g.strokeRoundedRect(-half, -half, BUTTON_SIZE_PX, BUTTON_SIZE_PX, 12);
  }
}
