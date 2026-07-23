# Room 3 — Fraction Map Puzzle: Integration Notes

## Status
`MapFractionPuzzle.ts` and the `GameState.ts` update are written, type-checked
(`tsc --noEmit`, strict mode), and bundle-verified with a real `vite build`
against the actual `map.png` asset, in an isolated sandbox mirroring this
project's real folder depth (`src/game/*.ts`, `assets/` at repo root).

**`Room3Scene.ts` itself was never provided**, so it has NOT been touched —
per project rules, I'm not going to guess at or recreate a file I can't see
(risk of clobbering the existing stairwell-exit wiring). The two files below
are ready to drop in; only a few lines need adding to your real
`Room3Scene.ts`.

## Files
- `MapFractionPuzzle.ts` → place at `src/game/MapFractionPuzzle.ts`
  (same folder as `HeartOfTheTemple.ts`, `CrystalHolder.ts`, etc. — the
  `../../assets/...` import path assumes this exact depth).
- `GameState.ts` → replaces your existing `src/game/GameState.ts`. The only
  change is one new key (`room3PuzzleSolved`) and two new functions
  (`isRoom3PuzzleSolved` / `setRoom3PuzzleSolved`); everything else
  (`hasSeenGameIntro`, Pink/Libra room state, crystal collection) is
  untouched, byte-for-byte the same logic.
- `Room3/map.png` → place at `assets/images/Room3/map.png` (already the
  exact path you specified).

## What you still need to add to Room3Scene.ts

```ts
import MapFractionPuzzle from './MapFractionPuzzle'; // adjust path to match your scenes folder

// in preload():
MapFractionPuzzle.preload(this);

// in create(), after your background/CrystalHolder/exit are set up:
this.mapPuzzle = new MapFractionPuzzle({
  scene: this,
  depth: /* pick a depth above your background, below any popups */ 20,
  crystalHolder: this.crystalHolder, // if Room3Scene has one, like the other rooms
  onSolved: () => {
    // optional: anything else you want to trigger once, e.g. a fly-in
    // reward animation into the CrystalHolder's green slot
  },
});

// Choose a safe area that leaves your existing stairwell exit hotspot
// fully clear — you know its real screen position, I don't. Example:
const { width, height } = this.scale;
this.mapPuzzle.create(width / 2, height / 2 - 20, width * 0.8, height * 0.75);

// wherever Room3Scene currently handles resize:
this.mapPuzzle.layout(width / 2, height / 2 - 20, width * 0.8, height * 0.75);
```

Adjust the safe-area numbers to whatever keeps the puzzle clear of your
actual exit — I don't have visibility into where that hotspot sits on
screen in the real scene.

## Verified
- `npx tsc --noEmit` (strict): clean, zero errors, for `MapFractionPuzzle.ts`
  and the updated `GameState.ts` against the rest of the existing codebase.
- `npx vite build`: succeeded end-to-end with the real `map.png`, producing
  a working bundle (image import resolved, no bundler errors).
- **Not verified**: the full game build (`Room3Scene.ts` doesn't exist in
  what I have, so it can't be part of a real `npm run build` here). Once you
  drop these files in and wire the few lines above, please run
  `npx tsc --noEmit` and `npm run build` yourself and let me know if
  anything surfaces — happy to fix immediately.

## Design decisions made (documented so nothing is silently invented)
- **Contain-fit, not cover-fit**: unlike the hall's background convention,
  this image is never cropped — it's scaled to fit fully inside the given
  safe area (capped at 1.15x native size to avoid blur on huge screens),
  because it has functional baked-in buttons that must never be cut off.
- **Shake technique**: since the three answer cards are baked into the
  flat image (not separate sprites), each card gets a duplicate
  crop-of-the-same-texture overlay sitting exactly on top of the baked
  pixels (invisible when static). Only that overlay tweens on a wrong
  answer, so the shake is real and localized instead of shaking the whole
  image or being purely cosmetic.
- **Glow**: reuses this project's existing `postFX.addGlow` technique
  (same one used for the Central Hall crystal) rather than a new
  hand-rolled texture, tweened in once at correct-answer time, and shown
  already-on with no replay when restoring a previously solved room.
- **Registry**: `room3PuzzleSolved` is a flat top-level boolean (matching
  the existing `hasSeenGameIntro` pattern) since the sprint asked for that
  exact key name, rather than a nested per-room state object like Pink/Libra.
  `green` crystal collection reuses `setCrystalCollected` — no new
  GameState surface needed there, it already existed.
