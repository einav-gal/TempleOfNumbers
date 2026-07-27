import Phaser from 'phaser';

/**
 * The single shared game-state module: every persistent flag any scene
 * needs to read or write goes through here, backed by Phaser's own
 * `registry` (a game-wide key/value store that survives scene restarts —
 * the project's one established state mechanism, never a second,
 * competing system). Rooms get their own namespaced slice
 * (`pinkRoom`/`libraRoom`) so neither can accidentally read or overwrite
 * the other's progress, and the game-intro flag is tracked once here
 * rather than as a local Scene variable (which would reset every time a
 * Scene restarts).
 */

const STATE_KEY_HAS_SEEN_GAME_INTRO = 'hasSeenGameIntro';
const STATE_KEY_PINK_ROOM = 'pinkRoom';
const STATE_KEY_LIBRA_ROOM = 'libraRoom';
const STATE_KEY_CRYSTAL_COLLECTION = 'crystalCollection';
const STATE_KEY_ROOM3_PUZZLE_SOLVED = 'room3PuzzleSolved';
const STATE_KEY_CRYSTAL_PLACEMENT = 'crystalPlacement';
const STATE_KEY_DEBUG_MODE_ACTIVE = 'debugModeActive';

const DEBUG_QUERY_PARAM = 'debug';
const DEBUG_QUERY_VALUE_FINAL_STAGE = 'final';
const DEBUG_QUERY_VALUE_RESET = 'reset';

export interface PinkRoomState {
  completed: boolean;
  /** The crystal shard reward, collected once the puzzle is solved. */
  hasShard: boolean;
}

export interface LibraRoomState {
  completed: boolean;
  /** The red crystal reward, collected once the balance puzzle is solved. */
  hasRedCrystal: boolean;
}

// The player's cross-room crystal pouch (see CrystalHolder.ts) — a
// dedicated slice independent of any single room's own state shape
// (PinkRoomState.hasShard / LibraRoomState.hasRedCrystal), so the
// shared holder UI never needs to know which room produced which
// crystal, and a future third room's reward just adds one more flag
// here without touching the other two rooms at all.
export type CrystalId = 'pink' | 'red' | 'green';

// The one canonical crystal list/order — new code should read this rather
// than re-declaring its own copy of the three ids (CrystalHolder.ts
// predates this export and keeps its own local `CRYSTAL_ORDER`; left
// untouched since it already works and isn't part of this task).
export const CRYSTAL_IDS: readonly CrystalId[] = ['pink', 'red', 'green'];

export interface CrystalCollectionState {
  pink: boolean;
  red: boolean;
  green: boolean;
}

/** Which of the (already-collected) crystals have been placed into the Central Hall's mechanism slots — a separate, later stage of progress than collection itself. Same registry-backed pattern, not a parallel state system. */
export type CrystalPlacementState = Record<CrystalId, boolean>;

const DEFAULT_PINK_ROOM_STATE: PinkRoomState = { completed: false, hasShard: false };
const DEFAULT_LIBRA_ROOM_STATE: LibraRoomState = { completed: false, hasRedCrystal: false };
const DEFAULT_CRYSTAL_COLLECTION_STATE: CrystalCollectionState = { pink: false, red: false, green: false };
const DEFAULT_CRYSTAL_PLACEMENT_STATE: CrystalPlacementState = { pink: false, red: false, green: false };

// ---- game intro ---------------------------------------------------------

/** True only once the opening message has actually been shown/dismissed — never reset by a room transition. */
export function hasSeenGameIntro(registry: Phaser.Data.DataManager): boolean {
  return registry.get(STATE_KEY_HAS_SEEN_GAME_INTRO) === true;
}

export function markGameIntroSeen(registry: Phaser.Data.DataManager): void {
  registry.set(STATE_KEY_HAS_SEEN_GAME_INTRO, true);
}

// ---- Pink Room ------------------------------------------------------------

export function getPinkRoomState(registry: Phaser.Data.DataManager): PinkRoomState {
  const stored = registry.get(STATE_KEY_PINK_ROOM) as Partial<PinkRoomState> | undefined;
  return { ...DEFAULT_PINK_ROOM_STATE, ...stored };
}

export function setPinkRoomState(registry: Phaser.Data.DataManager, patch: Partial<PinkRoomState>): void {
  registry.set(STATE_KEY_PINK_ROOM, { ...getPinkRoomState(registry), ...patch });
}

// ---- Libra Room -------------------------------------------------------

export function getLibraRoomState(registry: Phaser.Data.DataManager): LibraRoomState {
  const stored = registry.get(STATE_KEY_LIBRA_ROOM) as Partial<LibraRoomState> | undefined;
  return { ...DEFAULT_LIBRA_ROOM_STATE, ...stored };
}

export function setLibraRoomState(registry: Phaser.Data.DataManager, patch: Partial<LibraRoomState>): void {
  registry.set(STATE_KEY_LIBRA_ROOM, { ...getLibraRoomState(registry), ...patch });
}

// ---- Room 3 (map fraction puzzle) --------------------------------------

/** True only once the map puzzle has actually been solved — never reset. */
export function isRoom3PuzzleSolved(registry: Phaser.Data.DataManager): boolean {
  return registry.get(STATE_KEY_ROOM3_PUZZLE_SOLVED) === true;
}

export function setRoom3PuzzleSolved(registry: Phaser.Data.DataManager): void {
  registry.set(STATE_KEY_ROOM3_PUZZLE_SOLVED, true);
}

// ---- crystal collection (pouch) ----------------------------------------

export function getCrystalCollectionState(registry: Phaser.Data.DataManager): CrystalCollectionState {
  const stored = registry.get(STATE_KEY_CRYSTAL_COLLECTION) as Partial<CrystalCollectionState> | undefined;
  return { ...DEFAULT_CRYSTAL_COLLECTION_STATE, ...stored };
}

/** Marks one crystal as permanently collected — never un-collected. */
export function setCrystalCollected(registry: Phaser.Data.DataManager, id: CrystalId): void {
  registry.set(STATE_KEY_CRYSTAL_COLLECTION, { ...getCrystalCollectionState(registry), [id]: true });
}

/** True only once every crystal in CRYSTAL_IDS has been collected. */
export function areAllCrystalsCollected(registry: Phaser.Data.DataManager): boolean {
  const state = getCrystalCollectionState(registry);
  return CRYSTAL_IDS.every((id) => state[id]);
}

// ---- crystal placement (Central Hall mechanism slots) ------------------

export function getCrystalPlacementState(registry: Phaser.Data.DataManager): CrystalPlacementState {
  const stored = registry.get(STATE_KEY_CRYSTAL_PLACEMENT) as Partial<CrystalPlacementState> | undefined;
  return { ...DEFAULT_CRYSTAL_PLACEMENT_STATE, ...stored };
}

/** Marks one crystal as permanently placed into its mechanism slot — never un-placed. */
export function setCrystalPlaced(registry: Phaser.Data.DataManager, id: CrystalId): void {
  registry.set(STATE_KEY_CRYSTAL_PLACEMENT, { ...getCrystalPlacementState(registry), [id]: true });
}

/** True only once every crystal in CRYSTAL_IDS has been placed into its slot. */
export function areAllCrystalsPlaced(registry: Phaser.Data.DataManager): boolean {
  const state = getCrystalPlacementState(registry);
  return CRYSTAL_IDS.every((id) => state[id]);
}

// ---- debug mode (?debug=final / ?debug=reset query params) -------------
//
// An isolated testing shortcut, never active unless the URL explicitly
// asks for it — a normal player visiting the game with no `debug` query
// param is completely unaffected (every function below either reads the
// URL directly or is a no-op unless called). Reads/writes go through the
// exact SAME registry setters every real playthrough already uses
// (setCrystalCollected, setPinkRoomState, etc.) — never a parallel/fake
// state — so anything built on top of that state (CrystalPlacementMode,
// CrystalHolder, the room-completion flags) behaves identically whether
// the state came from actually playing or from this shortcut.

/** True when the current URL asks to jump straight to the final stage (?debug=final). Read once at boot, before any scene starts — see main.ts. */
export function isDebugFinalStageRequested(): boolean {
  return new URLSearchParams(window.location.search).get(DEBUG_QUERY_PARAM) === DEBUG_QUERY_VALUE_FINAL_STAGE;
}

/** True when the current URL asks to clear debug-applied progress (?debug=reset). */
export function isDebugResetRequested(): boolean {
  return new URLSearchParams(window.location.search).get(DEBUG_QUERY_PARAM) === DEBUG_QUERY_VALUE_RESET;
}

/** True once applyDebugFinalStage() has run this session — the only thing the small on-screen "DEBUG: FINAL STAGE" tag reads; never checked by real gameplay logic. */
export function isDebugModeActive(registry: Phaser.Data.DataManager): boolean {
  return registry.get(STATE_KEY_DEBUG_MODE_ACTIVE) === true;
}

/**
 * Debug-only shortcut (see main.ts's `?debug=final` handling): marks the
 * intro seen and every room completed/every crystal collected — using the
 * SAME setters a real playthrough calls — so the Central Hall (already the
 * first scene the game boots into) immediately shows its fully-unlocked
 * state and activates CrystalPlacementMode. Deliberately does NOT call
 * setCrystalPlaced() for any crystal, so the drag-into-slot stage itself
 * stays testable rather than already finished.
 */
export function applyDebugFinalStage(registry: Phaser.Data.DataManager): void {
  markGameIntroSeen(registry);
  setPinkRoomState(registry, { completed: true, hasShard: true });
  setLibraRoomState(registry, { completed: true, hasRedCrystal: true });
  setRoom3PuzzleSolved(registry);
  for (const id of CRYSTAL_IDS) {
    setCrystalCollected(registry, id);
  }
  registry.set(STATE_KEY_DEBUG_MODE_ACTIVE, true);
}

/**
 * Clears everything applyDebugFinalStage() (or a normal playthrough) may
 * have set. This project has no persistence layer (registry lives only in
 * memory for the current page load — confirmed no localStorage/
 * sessionStorage usage anywhere), so there is no separate "real save" a
 * normal player would lose beyond what's already gone the moment the page
 * reloads; this exists as an explicit, discoverable reset affordance
 * (rather than relying on "just remove the query param"), and stays
 * meaningful without further changes if persistence is ever added later.
 */
export function clearDebugState(registry: Phaser.Data.DataManager): void {
  registry.remove(STATE_KEY_HAS_SEEN_GAME_INTRO);
  registry.remove(STATE_KEY_PINK_ROOM);
  registry.remove(STATE_KEY_LIBRA_ROOM);
  registry.remove(STATE_KEY_ROOM3_PUZZLE_SOLVED);
  registry.remove(STATE_KEY_CRYSTAL_COLLECTION);
  registry.remove(STATE_KEY_CRYSTAL_PLACEMENT);
  registry.remove(STATE_KEY_DEBUG_MODE_ACTIVE);
}
