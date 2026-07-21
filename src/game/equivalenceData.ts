/**
 * Pure data for the Pink Crystal equivalence puzzle: the four
 * fraction/decimal/percent groups, and the (deliberately different)
 * value order each of the three rings uses. Kept separate from
 * EquivalencePuzzle.ts's rendering/interaction code.
 */

/** A stable identifier for one fraction/decimal/percent equivalence group — the puzzle's own group IDs (A/B/C/D) already serve this role; this alias just names the concept for callers tracking solved groups. */
export type EquivalenceGroupId = string;

export interface EquivalenceGroup {
  id: EquivalenceGroupId;
  fraction: string;
  decimal: string;
  percent: string;
}

export type RingKind = 'fraction' | 'decimal' | 'percent';

export const EQUIVALENCE_GROUPS: EquivalenceGroup[] = [
  { id: 'A', fraction: '1/2', decimal: '0.5', percent: '50%' },
  { id: 'B', fraction: '1/4', decimal: '0.25', percent: '25%' },
  { id: 'C', fraction: '3/4', decimal: '0.75', percent: '75%' },
  { id: 'D', fraction: '1/5', decimal: '0.2', percent: '20%' },
];

// Each array lists group IDs clockwise from that ring's rest-position top
// slot (index 0). Deliberately different per ring so no group's three
// values start aligned at the marker.
export const INNER_RING_ORDER = ['A', 'B', 'C', 'D']; // fractions
export const MIDDLE_RING_ORDER = ['C', 'A', 'D', 'B']; // decimals
export const OUTER_RING_ORDER = ['D', 'C', 'B', 'A']; // percentages

export interface RoundDefinition {
  /**
   * The crystal-code digit revealed when this round's slot is filled.
   * Awarded strictly by progress order (1st new correct match -> index 0's
   * digit, 2nd -> index 1's, etc.) — NOT tied to any specific equivalence
   * group. Any of the four EQUIVALENCE_GROUPS may fill any round; see
   * EquivalencePuzzle.checkCurrentAlignment().
   */
  digit: number;
  /** Shown briefly after the digit is placed, before the next round begins (or, on the last round, before completion). */
  successMessage: string;
}

// Shown exactly once, before the first round — there is no longer a
// separate intro popup per round (rounds 2 and 3 go straight from
// correct-feedback into the next arrangement with no popup in between).
export const PUZZLE_INTRO_TITLE = 'חידת טבעות השוויון';
export const PUZZLE_INTRO_BODY =
  'לפניכם 3 חידות.\nבכל חידה סובבו את שלוש הטבעות כך ששבר, מספר עשרוני ואחוז בעלי אותו ערך יופיעו מתחת לסמן.\nכאשר מצאתם התאמה, לחצו על הגביש לבדיקה.';
export const ROUND_INTRO_BUTTON_LABEL = 'מתחילים';

// The three required rounds, in order, each revealing one digit of the
// crystal code (final code: 735) once its slot is filled. All four
// EQUIVALENCE_GROUPS (including D, 1/5 = 0.2 = 20%) are valid, awardable
// matches in every round — a round is a progress *slot*, not a fixed
// expected group. The player may solve any three of the four groups, in
// any order; the fourth stays on the rings as a still-valid but unneeded
// extra option.
export const PUZZLE_ROUNDS: RoundDefinition[] = [
  { digit: 7, successMessage: 'מצוין! נפתחה הספרה הראשונה.' },
  { digit: 3, successMessage: 'מעולה! נפתחה הספרה השנייה.' },
  { digit: 5, successMessage: 'הקוד הושלם.' },
];

export function labelFor(kind: RingKind, groupId: string): string {
  const group = EQUIVALENCE_GROUPS.find((g) => g.id === groupId);
  if (!group) {
    return '?';
  }
  if (kind === 'fraction') {
    return group.fraction;
  }
  if (kind === 'decimal') {
    return group.decimal;
  }
  return group.percent;
}
