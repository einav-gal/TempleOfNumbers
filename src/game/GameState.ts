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

export interface CrystalCollectionState {
  pink: boolean;
  red: boolean;
  green: boolean;
}

const DEFAULT_PINK_ROOM_STATE: PinkRoomState = { completed: false, hasShard: false };
const DEFAULT_LIBRA_ROOM_STATE: LibraRoomState = { completed: false, hasRedCrystal: false };
const DEFAULT_CRYSTAL_COLLECTION_STATE: CrystalCollectionState = { pink: false, red: false, green: false };

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

// ---- crystal collection (pouch) ----------------------------------------

export function getCrystalCollectionState(registry: Phaser.Data.DataManager): CrystalCollectionState {
  const stored = registry.get(STATE_KEY_CRYSTAL_COLLECTION) as Partial<CrystalCollectionState> | undefined;
  return { ...DEFAULT_CRYSTAL_COLLECTION_STATE, ...stored };
}

/** Marks one crystal as permanently collected — never un-collected. */
export function setCrystalCollected(registry: Phaser.Data.DataManager, id: CrystalId): void {
  registry.set(STATE_KEY_CRYSTAL_COLLECTION, { ...getCrystalCollectionState(registry), [id]: true });
}
