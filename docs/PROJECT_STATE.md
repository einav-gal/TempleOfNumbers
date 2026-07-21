# Project State — Temple of the Lost Numbers

> Update this file at the end of each sprint: move the current sprint into
> Completed Work, set the new current/next sprint, and log any new decisions.

## Current Stage

Central Hall vertical slice: the room is rendered, atmospheric, and the Heart
of the Temple (crystal + astrolabe rings) is assembled and interactive.
No gameplay systems yet (no inventory, navigation, or puzzles).

## Completed Work

- **Sprint 1 — Project setup**: Vite + TypeScript + Phaser 3.90 scaffold
  (`npm run dev`, port 5173).
- **Sprint 2 — Central Hall background**: `CentralHallScene` shows
  `background.png` fullscreen with cover-scaling (aspect ratio preserved,
  crop instead of stretch), resize-aware, with a fade-in on scene start.
- **Sprint 3 — Crystal**: crystal sprite anchored to the pedestal, slow
  float animation, pulsing blue glow (postFX), click opens the ancient stone
  popup: "The Heart of the Temple is dormant."
- **Sprint 4 — Crystal interaction polish**: hover effect (6% swell +
  faster glow pulse + hand cursor); popup open/close hardened against
  duplicate pointer events.
- **Sprint 5 — Heart of the Temple**: three rune rings assembled around the
  crystal in a modular `HeartOfTheTemple` class; refined into an astrolabe
  composition (vertical back ring, diagonal middle, flat front) matching the
  concept sheets, with subtle sway instead of full rotation.
- **Sprint 6 — Atmosphere**: floating dust, blue sparkles around the
  crystal, animated torch flames with flickering glow, breathing light rays
  from the oculus, gentle ambient flicker, and synthesized WebAudio temple
  ambience (starts on first click).

## Current Sprint

Documentation setup: `docs/` folder created (CLAUDE.md, game-design.md,
art-style.md, central-hall.md, sprint-log.md — currently empty) and this
PROJECT_STATE.md.

## Next Sprint

Not yet defined. Likely candidates based on the roadmap so far: filling in
the docs, first gameplay hotspots beyond the crystal, or a second room.

## Important Project Decisions

- **Anchor everything in background-image pixels** (1536×1024 source).
  Positions (pedestal, torches, oculus) are measured in the artwork and
  mapped through the cover-scale transform, so the scene stays glued to the
  art at any window size. Never position scene objects by screen fractions.
- **Cover-scaling background**: proportional fill with crop; never stretch.
- **Modular scene composition**: `CentralHallScene` owns background, anchor
  mapping, and the popup; `HeartOfTheTemple` owns crystal + rings and their
  animations; `Atmosphere` owns environmental effects; `AmbienceAudio` owns
  sound. New features should follow this pattern.
- **Ring motion (final)**: subtle sine oscillation around each pair's
  approved base angle, computed fresh each frame (never accumulated).
  Continuous rotation is forbidden — it exposes the front/rear split
  masking of the ring PNGs. The two diagonals share one speed with a
  half-cycle phase offset so they always counter-swing. No ring exceeds
  ~1° from its base angle.
- **No Phaser containers for interactive objects**: crystal hit-testing
  proved unreliable inside containers; shared-pivot math with plain scene
  children + explicit depths is used instead.
- **Pointer-event debounce**: popup open/close share a 300 ms guard because
  some environments synthesize several pointerdown events per click.
- **Assets**: ring PNGs keep their exact filenames (`ring_back.png`,
  `ring_middle.png`, `ring_front.png` = front views; side views live in the
  concept-sheet images for future use). Crystal asset is
  `OBJ_001-crystal.png`. Ambience is synthesized, no audio file needed yet.
- **Tooling note**: Node is not on PATH on the dev machine; the portable
  install at `%LOCALAPPDATA%\Programs\nodejs-portable\node-v24.18.0-win-x64`
  is used (see `.claude/launch.json` for the dev-server command).
# TempleOfNumbers – Project State

## Project Overview

TempleOfNumbers is a digital educational escape room game for sixth-grade students.

The game is being developed as a focused, high-quality pilot.

The player explores an ancient mathematical temple, solves puzzles, restores energy to a central crystal, and eventually unlocks the exit.

---

## Technology Stack

- Phaser 3
- TypeScript
- Vite
- VS Code
- Claude Code

---

## Working Method

Development is divided into small, focused sprints.

Rules:

- Each sprint adds one capability only.
- Do not add unrequested features.
- Do not refactor working code without a clear reason.
- Every change must be testable.
- Existing working elements should remain unchanged unless required.
- Update this document after meaningful progress.
- Update `sprint-log.md` after every completed sprint.

---

## Documentation

Project documentation is located in:

`docs/`

Current documentation files:

- `CLAUDE.md`
- `PROJECT_STATE.md`
- `game-design.md`
- `art-style.md`
- `central-hall.md`
- `sprint-log.md`

Claude Code must read the relevant documentation before making changes.

---

## Current Development Status

### Working

- Development environment is working
- Vite is working
- Phaser 3 is working
- TypeScript is working
- The project runs in the browser
- Central Hall scene exists
- Central Hall background exists
- Central crystal asset exists
- Ring assets exist
- Claude Code is configured

### Current Scene

The Central Hall currently contains:

- Ancient temple background
- Central circular platform
- Blue crystal
- Multiple ring assets
- Left doorway
- Right doorway
- Temple statues and environmental lighting

---

## Current Visual Issue

Resolved in Sprint 005.

The rings are now split into rear/front PNG layers
(`assets/images/central-hall/Rings/`): rear arcs render behind the crystal
(depths 6–8), the crystal at depth 9, front arcs in front (depths 10–12).
Each pair shares one identical transform, so the rings genuinely wrap
around the crystal and its silhouette stays readable top to bottom.

The old full-ring assets (`ring_back.png`, `ring_middle.png`,
`ring_front.png`) are no longer loaded but remain on disk.

---

## Current Priority

Sprint 005 (ring placement) is complete. The next sprint is not yet
defined.

The previous task description is kept below for reference.

**Arrange the existing ring assets so they frame the crystal without obscuring it.**

This task is limited to ring placement and visual hierarchy.

Do not add:

- Puzzle logic
- Door interaction
- New UI
- Sound
- New visual assets
- Progress tracking
- Crystal state logic
- Additional effects

---

## Ring Placement Requirements

The final placement must meet the following requirements:

- The crystal remains clearly visible.
- The crystal is the main focal point.
- Thick ring sections do not cross the crystal’s central body.
- The rings appear to surround the crystal.
- Each ring has a visually distinct angle.
- The rings do not appear stacked on the same plane.
- The composition feels balanced.
- Existing assets are reused.
- Existing working scene elements remain unchanged.

---

## Technical Consideration

The current ring assets may not support correct front-and-back depth as single images.

If a ring needs to appear behind the crystal in one area and in front of it in another, one of the following may be required:

- Splitting the ring into front and rear assets
- Using a mask
- Using separate cropped layers

This should only be implemented if simple position, scale, angle, and depth changes are insufficient.

---

## Approved Visual Foundation

The following are approved as the current visual foundation:

- Central Hall background
- Central platform
- Blue crystal
- Existing ring assets
- Left and right doorways
- Overall ancient magical temple style
- Warm torch lighting and cool crystal lighting

The ring assets are approved, but their current placement is not approved.

---

## Decisions Not Yet Final

The following decisions remain open:

- Final number of puzzles
- Mathematical topics
- Puzzle types
- Puzzle order
- Doorway interaction
- Puzzle access flow
- Ring rotation
- Rotation speed
- Progress states
- Crystal activation states
- Hint system
- Sound and music
- Ending sequence

Do not make these decisions without explicit instruction.

---

## Last Completed Documentation Work

The following documents were created or updated:

- `game-design.md`
- `art-style.md`
- `central-hall.md`

These documents define:

- Game purpose and scope
- Visual style
- Central Hall structure
- Ring placement rules
- Current visual priority

---

## Next Action

Before making code changes:

1. Read `CLAUDE.md`.
2. Read `PROJECT_STATE.md`.
3. Read `art-style.md`.
4. Read `central-hall.md`.
5. Inspect the current Central Hall scene code.
6. Identify how the ring assets are currently positioned and layered.
7. Propose the smallest possible change for improving ring placement.
8. Do not implement unrelated changes.

## Current Sprint

Sprint 005 – Ring Motion

Current status:
- Ring placement is approved.
- Ring assets use front/rear split PNG layers.
- Full rotation was rejected.
- Required motion: gentle sine oscillation only.
- Current issue: the rings appear static.

Next task:
Fix only the visible oscillation.

Constraints:
- Do not change position, scale, assets, depth, or crystal.
- Keep front/rear layers synchronized.
## Current Sprint

Fire Shadows and Ambient Particles

### Current status

- Central Hall composition is approved.
- Crystal and ring layout are approved.
- Rings use split front/rear PNG layers.
- Ring motion is subtle oscillation only.
- Foil-like particles exist in the upper light beam.
- Fire-shadow assets were created:
  - assets/images/central-hall/fire/fire-shadow-left.png
  - assets/images/central-hall/fire/fire-shadow-right.png

### Current issue

The fire-shadow images are still not visible in the scene.

Possible causes:
- incorrect preload path
- texture not loaded
- PNG transparency problem
- wrong position
- wrong depth
- scale too small

### Next task

Run a strict visibility test:

- place both fire-shadow images in the screen center
- alpha 1
- NORMAL blend mode
- high depth
- no animation
- large visible scale

Do not change any other scene element.

### Visibility test — implemented

Added an isolated debug block in `Atmosphere.layout()` (`src/game/Atmosphere.ts`):
both `fire-shadow-left`/`-right` textures rendered side-by-side at screen
center, alpha 1, `BlendModes.NORMAL`, depth 9999, static scale 1.5, no
animation — separate from the real (still MULTIPLY/low-alpha) overlay code,
which is untouched. `npx tsc --noEmit` passes.

Could not confirm the visual result in-session: the sandboxed browser tool's
screenshot action timed out consistently (on this page and a blank tab), and
manual canvas pixel readback (via WebGL `preserveDrawingBuffer` and even the
Canvas2D renderer) came back uniformly black despite the scene reporting an
active camera and 27 rendered children — pointing at a rendering/capture
limitation in this environment rather than the game itself. Those diagnostic
renderer tweaks in `main.ts` were reverted; only the debug images in
`Atmosphere.ts` remain. Next: view `npm run dev` in a real browser and report
whether the two debug squares are visible at screen center.

### Fire shadows — real placement (debug removed)

PNGs re-exported with true transparency; debug center-screen test removed.
Real overlays anchored near each matching torch (unchanged anchors), MULTIPLY
blend, depth 1 (above background, below crystal/rings/particles at 5+),
width 130 background-px (down from 160), base alpha 0.23 breathing 0.18-0.28,
plus small no-flash drift/scale motion (`src/game/Atmosphere.ts`). Center of
scene stays clear. `npx tsc --noEmit` passes; dev server loads both PNGs with
no console errors.

### Fire shadows — darker Photoshop re-export, NORMAL blend

PNGs updated again in Photoshop (darker); no debug objects existed to remove.
Switched overlay blend from MULTIPLY to NORMAL (`src/game/Atmosphere.ts`),
same anchors/depth/scale as before. Alpha now breathes within 0.28-0.42
(center 0.35, amplitude 0.07) instead of the previous 0.18-0.28. Drift/scale
motion amplitudes unchanged (already within the requested 2-4px/1-2px/±2%
ranges). `npx tsc --noEmit` passes; dev server loads both updated PNGs with
no console errors.

### Fire shadows — placement debug pass (animation stripped, bounds shown)

All shadow animation removed (no tween, no scale/alpha/position drift) —
overlays are now fully static at alpha 1, NORMAL blend, depth 1. Added a
per-side red stroked-rectangle outline at the image's exact screen bounds
plus a "LEFT SHADOW"/"RIGHT SHADOW" text label, both at depth 2 (still below
torches/rings/crystal at 5+). Each shadow's textureKey/x/y/displayWidth/
displayHeight/origin/depth/visible/alpha is logged to console on every
layout() call. Debug rectangles and labels are intentionally left in place
per instruction; nothing else in the scene was touched. `npx tsc --noEmit`
passes; dev console shows the two debug logs with no errors.

### Fire shadows — four instances (rear + front), debug removed, re-animated

Confirmed visible; removed all debug rectangles/labels/console logging.
Kept the two rear shadows (inner wall torches, background-px anchors
395,480 / 1138,488) unchanged in position/width. Added two front shadows on
the foreground edge torches (110,395 / 1427,398), reusing the same
fire-shadow-left/right textures, width 1.2x the rear width, lower base
alpha. All four: NORMAL blend, depth 1 (above background, below
crystal/rings/particles at 5+), origin (0.5,1). All four now animate
independently (own freq/phase) with alpha ±0.05, x drift 2.5-3.8px, y drift
1.4-2.6px, scale ±2%, no synchronized flicker (`src/game/Atmosphere.ts`).
`npx tsc --noEmit` passes; dev console clean (no errors, no leftover debug
logs).
## Current Status

- Central Hall composition is approved.
- Crystal and ring placement are approved.
- Rings use split front/rear PNG layers.
- Ring motion is subtle oscillation.
- Foil-like particles are visible in the upper light beam.
- Four fire-shadow instances exist and animate independently.
- Fire-shadow motion is subtle and may be refined later.
- The left doorway is interactive (hover glow, hand cursor, click transition
  to a temporary placeholder puzzle scene). The right doorway is untouched.

## Current Sprint

Left doorway interaction — completed.

New module `src/game/Doorway.ts`: an invisible interactive zone anchored
over the left doorway opening (background-image pixels, same anchor
pattern as the pedestal/torches), with a soft warm hover glow (procedural
radial-gradient texture, ADD blend) and hand cursor. New scene
`src/scenes/PuzzlePlaceholderScene.ts`: minimal placeholder ("A puzzle
awaits here." / click to return), no puzzle logic. `CentralHallScene`
wires the doorway's `onActivate` to a camera fade-out then
`scene.start('PuzzlePlaceholderScene')`; the doorway disables itself once
activated to prevent double-transitions. Registered in `main.ts`. Only the
left doorway was touched; the right doorway, crystal, rings, and
atmosphere are unchanged.

`npx tsc --noEmit` passes. Verified the dev server serves all new/changed
modules with no transform errors (curl against the Vite dev endpoint); the
in-session Browser pane's screenshot/navigate tools timed out again in
this environment (same limitation logged during the fire-shadow sprint),
so the visual result was not confirmed by screenshot this session.

## Next Sprint

Not yet defined.
## Current Status

### Central Hall

- Central Hall background is working.
- Crystal placement is approved.
- Ring composition is approved.
- Rings use separate front/rear PNG layers.
- Ring motion uses subtle oscillation only.
- Foil-like particles are active in the upper light beam.
- Four fire-shadow instances exist around the wall torches.
- Fire-shadow motion is subtle and may be refined later.

### Introduction Flow

- Hebrew introduction overlay exists.
- Central Hall remains dimmed and non-interactive while the overlay is open.
- The introduction text explains the game goal.
- The introduction panel includes:
  - dark brown temple-style panel
  - Hebrew serif typography
  - decorative gold elements
  - two torch images
  - animated warm light glows
  - button: כניסה למקדש
- Clicking the button closes the overlay and enables Central Hall interaction.
- Introduction visuals may still receive minor refinement later.

### Hidden Entrance 1

Planned interaction flow:

1. The player investigates the pot beside the left statue.
2. Clicking the pot causes it to tilt and fall to the floor.
3. A hidden handle is revealed near the base of the statue.
4. Clicking the handle will move the statue.
5. A hidden passage will be revealed behind the statue.
6. Clicking the passage will open a temporary room.
7. Mathematical room-opening questions will be added only after all entrances are implemented.

### Interactive Pot

- A separate transparent pot asset exists at:

  `assets/images/central-hall/Pot/pot.png`

- The pot has been darkened in Photoshop to match the scene.
- The pot is positioned beside the left statue.
- The painted background pot was removed as much as possible.
- The pot is clickable.
- The hand cursor should not be used.
- Hover feedback should remain very subtle.
- On click, the pot tilts, slides, and falls to the floor.
- The pot remains in its final fallen position.

### Hidden Handle

- A separate transparent handle asset exists.
- The handle is placed close to the base of the left statue.
- It remains hidden until the pot clears the area.
- It becomes interactive only after the pot-fall animation finishes.
- The handle does not move the statue yet.

### Statue Asset — left statue sprite fitted to the updated background (completed)

The background was replaced with an updated version containing an empty
left wall niche and a painted right-side reference statue. The separate
left statue sprite (`Statue` class, `src/game/Statue.ts`) was recalibrated
against that reference, measured directly from the new background art:

- Position: `STATUE_CENTER_X` 482→504, `STATUE_BASE_Y` 705→695
  (`CentralHallScene.ts`), matching the niche center and the reference
  statue's pedestal-bottom line.
- Scale: `STATUE_HEIGHT_BG` 457→415, matching the reference statue's
  measured visible height (spike-tip to pedestal-bottom ≈400–410 bg-px).
  Aspect ratio is preserved (single uniform scale, as before).
- New warm tint (`0xB3A283`, muted gray-brown) via `setTint`, darkening/
  warming the source art's brighter highlights to match the background
  lighting. Alpha stays at `1` (fully opaque) — tint, not transparency, is
  the blending method.
- New soft elliptical contact shadow beneath the pedestal (procedural
  radial-gradient canvas texture, MULTIPLY blend, depth `STATUE_DEPTH - 1`
  = 1), grounding the statue against the floor.
- Depth order unchanged (`STATUE_DEPTH` = 2: above background/fire-shadows,
  below handle/pot), already satisfying "behind interactive elements,
  above background."

Only statue position/scale/tint/shadow were touched; pot, handle, crystal,
rings, particles, fire shadows, and the intro overlay are unchanged.

`npx tsc --noEmit` passes. The in-session Browser pane's screenshot/
read_page tools failed again this session (same recurring environment
limitation noted in the fire-shadow, doorway, and prior statue sprints),
but the Vite dev server's HMR log confirmed a connected browser client
live-reloaded both changed files with no errors, and curling the dev
server directly confirmed `CentralHallScene.ts`/`Statue.ts`/`statue.png`
all serve correctly with the new values in place. Final visual comparison
against the right-side statue still needs a look in a real browser.

A second image also exists in the statue folder
(`ChatGPT Image Jul 16, 2026, 04_22_22 PM.png`) but is unused/unreferenced
in code; left as-is per the "never rename/replace assets without asking"
rule.

### Statue Asset — second pass: recede into the niche (completed)

Feedback: the statue still read as sharper, higher-contrast, and closer to
camera than the right-side reference (deeper blacks, harder edges, a wider
dominant pedestal, slightly too large).

Since a runtime tint alone cannot fix contrast/sharpness, a new
non-destructive preprocessed asset variant was created:
`assets/images/central-hall/statue/left-statue-background-blended.png`
(reduced contrast + lifted shadows via a linear remap, ~22% desaturation,
a subtle warm brown-gray cast, and a light 35%-blended 3x3 box blur for
edge softening, done alpha-premultiplied to avoid black fringing at the
cutout edge). Luminance range compressed from [0–246] to [16–172] (closer
to the reference statue's measured [18–88] dark low-key range), mean
brightness essentially unchanged (~42→~45). The original `statue.png` is
untouched on disk; `CentralHallScene` now loads the blended variant.

On top of that: `STATUE_HEIGHT_BG` 415→382 (−8% scale), `STATUE_CENTER_X`
504→516 (+12px), `STATUE_BASE_Y` 695→688 (−7px) — all in
`CentralHallScene.ts`. In `Statue.ts`: tint lightened to a near-white warm
cream (`0xE4D8BC`, was `0xB3A283`) since the blended art now carries the
warmth/contrast itself; alpha stays `1`. The contact shadow's gradient and
opacity were both roughly halved (0.5→0.28 display alpha; gradient peak
0.95→0.55). Added a very subtle `postFX.addBlur` on the statue image,
reusing Phaser's existing FX pipeline (same one `HeartOfTheTemple` uses
for the crystal's glow) rather than a new rendering system.

Known open item: the source asset's pedestal is proportionally wider
relative to its height than the reference statue's. Because the display
system only allows a single uniform scale (no stretch, aspect ratio always
preserved), this can't be fully closed without actually re-cropping/
re-editing the pedestal geometry in the source art — flagged for a future
pass rather than attempted here.

### Statue Asset — third pass: too blurred/faded, corrected (completed)

Feedback: the second pass overcorrected — the blur (both the baked 35%
box-blur mix and the runtime `postFX.addBlur`) plus the aggressive
contrast/shadow-lift (contrast ×0.68, black lift +16, desaturation 22%)
made the statue read as soft and washed out rather than a solid physical
object.

New variant `assets/images/central-hall/statue/left-statue-background-blended-v2.png`,
generated from the untouched original `statue.png` (not from the
over-processed first variant, which was deleted — it was a Claude-authored
intermediate asset, not designer art, and left unreferenced/broken code
would only be clutter):

- No blur at all — alpha and edges copied through unchanged.
- Contrast reduction ~8% with a small shadow lift (linear remap ×0.92 +6,
  down from ×0.68 +16).
- Desaturation ~5% (down from 22%).
- Subtle warm cast only (R×1.015, G×1.0, B×0.965, down from
  R×1.04/G×1.0/B×0.9).
- Result: luminance range [6–232] (mean ~44.5), close to the original
  asset's own range/mean — a mild grade, not a re-grade.

`Statue.ts`: removed the runtime `setTint` and `postFX.addBlur` entirely
— the (now much lighter) contrast/saturation/warmth live only in the
baked asset, so there's a single source of truth and no risk of the two
adjustments stacking into over-softening again. Contact shadow left
unchanged (alpha 0.28, gradient peak 0.55) since it wasn't flagged as an
issue this round. Position/scale unchanged (`STATUE_CENTER_X` 516,
`STATUE_BASE_Y` 688, `STATUE_HEIGHT_BG` 382) per instruction to keep them
unless comparison showed a clear issue.

### Statue Asset — fourth pass: swapped to Photoshop-matched asset (completed)

A hand-graded, Photoshop-matched statue variant was supplied:
`assets/images/central-hall/statue/left-statue-background-matched.png`.
`CentralHallScene.ts` now loads this file under the same texture key
(`STATUE_KEY = 'central-hall-statue'`) in place of the previous
procedurally-blended `left-statue-background-blended-v2.png`. `Statue.ts`
already had no tint or postFX blur (removed in the third pass) and no
`setAlpha` call (default `1`), so no code changes were needed there.
Position (`STATUE_CENTER_X` 516, `STATUE_BASE_Y` 688), scale
(`STATUE_HEIGHT_BG` 382), and depth (`STATUE_DEPTH` 2) are unchanged.
Original `statue.png` remains untouched on disk; the two earlier
procedural variants are superseded (the working one,
`left-statue-background-blended-v2.png`, is left on disk unreferenced for
now in case of rollback).

`npx tsc --noEmit` passes. Browser pane screenshot still fails in this
environment (same recurring limitation); verified via direct HTTP request
to the dev server that the new asset and updated code serve correctly.

### Statue Asset — fifth pass: fixed anchor/padding mismatch (completed)

Feedback: placement no longer matched the Photoshop reference — a
positioning/origin issue, not image processing.

Inspected `left-statue-background-matched.png` (145×423 RGBA): the
pedestal's solid, full-opacity content ends around row 402, but rows
403–420 are a soft, low-opacity Photoshop cutout feather (alpha fading
~250→~1, narrowing in width) trailing beneath it, out to the canvas's
literal bottom edge at row 423. With `origin(0.5, 1)` anchored at that
literal edge (as required), the visible pedestal was floating ~20px of
source-image height above wherever it was placed — explaining why it read
as too high/misaligned no matter the x/y tweaks in earlier passes.
Horizontal padding is negligible (content spans x:[2,142] of 145, centered
almost exactly on the canvas).

Fix, per the "compensate explicitly" option: `Statue.ts` gained a
`BOTTOM_FEATHER_PX = 20` constant (asset-specific) and now offsets only
the statue *image* downward by that amount (scaled) before positioning —
the contact shadow stays anchored at the true floor line. `origin(0.5,1)`
itself is unchanged (required, not a workaround). `CentralHallScene.ts`'s
`STATUE_CENTER_X`/`STATUE_BASE_Y` were reset to `504`/`695` — the true
niche floor-contact point from the original Photoshop measurement,
independent of any particular statue asset's own padding quirks — instead
of the values tuned in earlier passes for a different-shaped asset.
`STATUE_HEIGHT_BG` (382) was left unchanged; alpha (1), no tint, no blur
were already correct from the previous pass and remain so.

`npx tsc --noEmit` passes. Browser pane screenshot still fails in this
environment (same recurring limitation); verified via direct HTTP request
that the dev server serves the updated code with the new values.

### Lever → statue-turn → entrance reveal (completed)

The hidden `Handle` (`src/game/Handle.ts`) now acts as the lever: on
click it disables further input immediately (`activated` guard +
`disableInteractive()`), rotates to `angle = -32°` over 500ms with a
small `Back.Out` overshoot (custom overshoot `0.6`, gentler than Phaser's
default bounce), then — 120ms after the rotation starts, not after it
finishes — fires `onActivate` so the statue's turn reads as caused by the
lever rather than simultaneous with it.

`Statue.ts` gained an `open(durationMs, onComplete)` method simulating a
vertical-axis turn without a Z-axis spin (which would look like the flat
sprite rotating in-plane): a `scaleX`-only tween down to `0.11` (scaleY
untouched) plus a `-14` background-px sideways shift toward the
handle/mechanism side, `Sine.InOut`, 1100ms. Guarded by
`isOpening`/`isOpen` so repeated calls can't stack tweens. Position/scale
math for both the resting and mid-turn states is refactored through a
shared `applyTransform()` so window resizes mid-animation (or after
opening) stay correct — `layout()` always re-derives the base transform
in background-pixel space and re-applies whatever turn progress is
current, never resetting it.

New `Entrance` class (`src/game/Entrance.ts`): no dedicated
entrance/doorway asset exists for this location (checked the assets
tree), so it procedurally draws a TEMPORARY dark arched opening with a
soft inner-shadow gradient and blurred edges (clearly marked in code as a
placeholder to replace later) — no new detailed artwork was invented.
Starts fully transparent and non-interactive; `reveal()` fades it in
alongside the statue's turn, `setActive(true)` (called only once the
turn completes) makes it hoverable/clickable via an invisible Zone
(same pattern as `Doorway`), but its `onActivate` is left unwired —
entering the new room is explicitly out of scope for this sprint.

`CentralHallScene.ts`: new `isStatueOpening`/`isStatueOpen` flags and a
dedicated `openStatueEntrance()` method (not inline in a pointer
callback) orchestrate the hand-off: `entrance.reveal()` +
`statue.open()` together, entrance interactivity enabled in the statue's
completion callback. Layer order: background (0) → entrance (depth 1,
created before the statue so it always renders behind it) → statue's
contact shadow (depth 1, created after entrance so it draws on top of
the opening) → statue (depth 2) → handle (3) → pot (4), matching the
requested background/entrance/statue/foreground ordering. Scene shutdown
now also stops the statue's in-flight tween (`this.statue?.destroy()`);
no other new persistent listeners were added, so nothing else needed
manual cleanup beyond what Phaser's scene teardown already handles.

Only `Handle.ts`, `Statue.ts`, `CentralHallScene.ts`, and the new
`Entrance.ts` were touched — pot behavior, crystal, rings, atmosphere,
intro overlay, and the right doorway are unchanged.

`npx tsc --noEmit` passes. Browser pane screenshot still fails in this
environment (same recurring limitation logged throughout this project);
verified via direct HTTP request that the dev server serves all
new/changed modules with no transform errors.

### Camera transition into the hidden passage (completed)

`Entrance.onActivate` is now wired to a new `enterStatueRoom()` method in
`CentralHallScene.ts`: the camera pans+zooms toward the opening
(`CAMERA_ENTER_ZOOM` 1.6x, 900ms, `Sine.InOut`, using the same
background-pixel→screen mapping as everything else — `toScreenX`/
`toScreenY` were promoted from local functions inside `layout()` to
reusable private methods for this), then fades to black and starts a new
`HiddenPassageScene`. Guarded by the existing `leavingHall` flag (shared
with the left doorway) so only one transition can run at a time.

New `HiddenPassageScene.ts` (registered in `main.ts`): a minimal
placeholder room — message text and a back button fading to
`CentralHallScene` — with no puzzle logic. Kept deliberately separate
from `PuzzlePlaceholderScene`, which turned out to already contain real
puzzle content (an order-of-operations question) for the left doorway;
reusing it here would have duplicated that puzzle behind an unrelated
entrance.

Only `CentralHallScene.ts`, `main.ts`, and the new `HiddenPassageScene.ts`
were touched — the lever/statue-turn/entrance-reveal sequence, pot,
crystal, rings, atmosphere, intro overlay, and the left doorway's own
puzzle are unchanged.

`npx tsc --noEmit` passes. Browser pane screenshot still fails in this
environment (same recurring limitation); verified via direct HTTP request
that the dev server serves all new/changed modules with no transform
errors.

### Entrance visual + camera transition — reverted

The entrance placeholder and the camera transition into it were reported
as not correct and reverted, keeping the lever and statue-turn animations
(both validated as working). Removed entirely: `src/game/Entrance.ts`,
`src/scenes/HiddenPassageScene.ts`, their registration in `main.ts`, and
all related code in `CentralHallScene.ts` (`entrance` property,
`isStatueOpening`/`isStatueOpen` scene-level flags, entrance
creation/layout/reveal, `openStatueEntrance()`, `enterStatueRoom()`, the
`toScreenX`/`toScreenY` class methods promoted only for the camera pan
target). `handle.onActivate` now calls `this.statue?.open(STATUE_TURN_DURATION_MS)`
directly — the lever still rotates and the statue still turns on click,
just with nothing revealed behind it yet. `Handle.ts` and `Statue.ts`
were untouched (no entrance-specific code lived in either).

`npx tsc --noEmit` passes. This project has no `.git`, so the revert was
done from this session's own record of the exact changes rather than
`git diff`.

### Visible entrance behind the statue — retried with a proper arch (completed)

Checked `assets/images/central-hall` and every subfolder (`Pot/`,
`Rings/`, `Torch/`, `handle/`, `statue/`, `fire/`, `effects/`, `New
folder/` — both empty) for a door/arch/passage/corridor/entrance/room/
tunnel/opening asset; none exists. New `Entrance` class
(`src/game/Entrance.ts`) procedurally draws a proper layered placeholder
instead of the earlier flat rectangle: an outer warm stone arch frame
(blurred edge blending into the wall, faint worn-gold trim), an inset
near-black recessed interior with a radial gradient and a blurred inner-
shadow stroke where the frame's lip meets the dark passage, two faint
nested-arch strokes hinting at recession, and a separate cool cyan glow
sprite (ADD blend) standing in for light from deeper inside. Frame and
glow both start at alpha 0 (fully hidden while the statue is closed).

`reveal(durationMs)` fades both in over the same duration as the statue's
turn — called alongside `statue.open()` from a reinstated
`openStatueEntrance()` in `CentralHallScene.ts`, so it reads as
progressively revealed rather than popping in. `setActive(true)` (wired
to the statue's turn-completion callback, same as before) makes the
opening interactive only once the statue is fully open — hand cursor via
an invisible `Zone`, hover boosts just the inner glow's alpha (not a
scale pulse or full frame brightness, to avoid fighting alpha-clamping).
Position/size: anchored at the same `STATUE_CENTER_X`/`STATUE_BASE_Y`
floor line as the statue (`ENTRANCE_SIZE` 145×300 bg-px, `ENTRANCE_DEPTH`
1 — below the statue's depth 2, above background/fire-shadows, matching
the requested background→entrance→statue→foreground ordering).

Click now calls a dedicated `enterLeftRoom()` (renamed from the earlier
`enterStatueRoom()`) — no destination room Scene exists yet
(`HiddenPassageScene` was removed in the prior revert, and
`PuzzlePlaceholderScene` already belongs to the left doorway's own
puzzle), so this is intentionally just a clearly-commented placeholder
(`console.log`, no `scene.start`) rather than a real transition or a
newly-built room scene, ready to swap in once a real room Scene exists.

Only `CentralHallScene.ts` and the new `Entrance.ts` were touched —
`Handle.ts`/`Statue.ts` (lever rotation, statue turn) are unchanged, as
are pot, crystal, rings, atmosphere, intro overlay, and the left
doorway's own puzzle.

`npx tsc --noEmit` passes. Verified live in the Browser pane this
session (not just via HTTP curl): the page loads with zero console
errors, `Entrance.ts` and all assets return 200 in the network log, and
the served source confirms the exact wiring above. Full click-through
(lever → statue turn → entrance hover/click) still needs a manual look
since this environment's screenshot tool remains unavailable.

### Room entry through the revealed entrance (completed)

`enterLeftRoom()` in `CentralHallScene.ts` now actually transitions
instead of just logging. Reused the project's existing transition
pattern verbatim (the same one `enterLeftDoorway()` already used):
`camera.fadeOut(DOORWAY_FADE_OUT_MS=400ms, 0,0,0)` → on
`FADE_OUT_COMPLETE` → `scene.start(...)`. New `isEnteringRoom` flag
guards against repeated clicks/overlapping transitions; `enterLeftRoom()`
also sets the existing `leavingHall` flag (shared with the left doorway)
so the two entrances can't both start a transition at once. The entrance
is disabled (`entrance.setActive(false)`) immediately on click, before
the fade starts.

No code changed for "not clickable while closed/moving" or hover — both
were already correct from the previous sprint (`entrance.setActive(true)`
only fires from inside `statue.open()`'s completion callback; hover
already showed a hand cursor and boosted the inner glow). `Entrance.ts`,
`Handle.ts`, and `Statue.ts` are untouched this sprint.

No destination room Scene existed, so — per this task's explicit
fallback instructions — a new minimal placeholder Scene was created
rather than inventing a real room: `HiddenPassageScene.ts` (registered
in `main.ts`), just a message and a back-to-hall button, no puzzle
logic. This is the same scene name/shape used in an earlier (reverted)
attempt, recreated fresh here using the simple fade pattern rather than
the camera pan/zoom that attempt also included.

Only `CentralHallScene.ts`, `main.ts`, and the new `HiddenPassageScene.ts`
were touched.

`npx tsc --noEmit` passes. Verified live in the Browser pane: all three
scene modules load with 200 OK, zero console errors, and the served
source confirms the exact wiring (`isEnteringRoom`, `enterLeftRoom`,
`HiddenPassageScene` all present as expected).

### Walk-through-the-doorway transition (completed)

The entrance click hand-off (renamed `enterLeftRoom()` → `enterThroughLeftDoor()`
per this task) no longer cuts to a plain fade — it now reads as physically
entering the passage:

1. Entrance disabled immediately on click (the lever is already
   permanently disabled after its own one-time click, since the entrance
   can't become interactive before the statue fully opens anyway — no
   extra code needed for that half of "disable lever and entrance during
   the transition").
2. Camera `pan()` + `zoomTo()` run concurrently (`Cubic.In`, 1100ms)
   toward the doorway's actual on-screen bounds — target X/Y and the
   target zoom are computed at click-time from `ENTRANCE_SIZE`/
   `STATUE_CENTER_X`/`STATUE_BASE_Y` and the current viewport/
   `backgroundScale` (not fixed constants), so it's responsive and uses
   the entrance's real bounds as requested. Target zoom aims for the
   doorway to fill ~82% of viewport height, clamped to `[1, 3.2]`.
3. A new screen-space vignette (`scrollFactor(0)`, procedural radial
   gradient, depth 90) darkens in over roughly the final third of that
   movement (delayed tween starting at 65% of the pan/zoom duration).
4. Only once `PAN_COMPLETE` fires (movement fully done) does a brief
   `camera.fadeOut()` (280ms) run, and only on `FADE_OUT_COMPLETE` does
   `scene.start('HiddenPassageScene')` happen — the scene never switches
   mid-movement.

New `isEnteringRoom` flag guards repeated clicks/overlapping tweens,
alongside the existing `leavingHall` (shared with the left doorway).
`toScreenX`/`toScreenY` were promoted from local `layout()` closures back
to reusable private methods (needed to compute the pan target/zoom
outside of `layout()`) — same promotion made and then reverted in earlier
attempts, reinstated here because this task explicitly requires it.

Entrance artwork/position, the statue's opening animation, and the lever
are all unchanged — `Entrance.ts`, `Statue.ts`, and `Handle.ts` were not
touched. `HiddenPassageScene` itself (the destination) was not
redesigned. Only `CentralHallScene.ts` changed.

`npx tsc --noEmit` passes. Verified live in the Browser pane: the page
loads with zero console errors, and the served source confirms the exact
constants/wiring above.

### True "pass through the doorway" transition, two-phase (completed)

Feedback: the previous single zoom+pan+fade still read as "camera zoom,
then scene change," not physically walking through. Replaced with a
two-phase approach in `enterThroughLeftDoor()`:

- **Phase 1 (approach, 800ms, `Sine.InOut`):** pans/zooms to the
  doorway's actual dark **opening** (not the whole frame image — see
  below), until it fills ~60% of viewport height, clamped so the outer
  stone frame's width still fits on-screen (frame stays visible, as
  required).
- **Phase 2 (cross the threshold, 500ms, `Cubic.In`):** continues
  zooming, more aggressively, until the frame's width exceeds the
  viewport by 25% — pushing its stone edges off both sides of the screen,
  leaving only the dark opening filling the view. A brief overlay (150ms,
  peak alpha 0.8 — never fully opaque, never held) is timed to land
  exactly as this phase's zoom completes, then `scene.start()` fires.

`Entrance.ts` gained `getOpeningBounds(baseX, baseY, scale)`, returning
the *actual dark opening's* center/size (inset from the full frame by the
same fractions `generateFrameTexture()` draws with — extracted to shared
named constants so the two can't drift apart). This is the real camera
target now, not `ENTRANCE_SIZE` (the whole arch image), per this task's
explicit requirement. No visual/behavioral change to the entrance
artwork itself.

`HiddenPassageScene.ts`: previously just a flat background color, which
made a seamless reveal impossible (checked and reported before
implementing, per this task's instructions) — added a small TEMPORARY
interior preview (procedural dark-stone gradient backdrop + a
continuation of the same cool glow color visible through the doorway, no
designed room/furniture) so the arrival has something to land on. The
scene now starts pre-zoomed (`1.5x`) and darkened (overlay alpha `0.8`,
matching the hall's phase-2 peak for continuity across the cut), settling
to normal (`zoom 1`, `overlay 0`) over 550ms, `Sine.Out` — no separate
plain `fadeIn()`, since that would double up with the overlay settle.

`this.input.enabled = false` locks all pointer input for the full
transition (previously only the entrance itself was disabled).
`isEnteringRoom`/`leavingHall` still guard against repeated
clicks/overlapping tweens. Statue/lever animations, entrance appearance/
position, and `PuzzlePlaceholderScene` are all unchanged.

Files changed: `CentralHallScene.ts`, `Entrance.ts`,
`HiddenPassageScene.ts`.

`npx tsc --noEmit` passes (after fixing one syntax slip: a JSDoc comment
containing the literal text "PHASE1_*/" closed the comment block early —
reworded). Verified live in the Browser pane: zero console errors, and
the served source confirms all constants/wiring above.

### Room behind the left statue — environment + navigation shell (completed)

Checked `game-design.md`, `central-hall.md`, and `PROJECT_STATE.md`: none
define a name, educational topic, or puzzle type for this room — all
explicitly leave that open pending "explicit instruction." Found early
(Jul 11) concept-art mood boards under `assets/images/` sketching an
unrelated generic 15-room temple sitemap; not adopted (predates the
actual statue-passage mechanic, not referenced by current docs). Kept the
room topic-agnostic, matching this task's own "environment + navigation
only" scope.

`HiddenPassageScene.ts` already existed (registered, already the wired
destination) — enhanced in place rather than creating a competing scene.
Restructured into `createRoomEnvironment()` / `createExitToCentralHall()`
/ `playEntryAnimation()` / `returnToCentralHall()`, replacing the old flat
inline `create()`.

**Environment:** a temporary procedural stone-chamber backdrop (1536×1024
virtual canvas, same cover-scale responsive convention as
`CentralHallScene`) — converging side walls, a back wall holding a
carved circular emblem (decorative-only placeholder for a future puzzle
mechanism — no hit area, so nothing here can end up "broken"), and a
floor with a faint radiating medallion echoing the hall's own motifs.
Two torches reuse the already-approved `intro-torch.png` asset (only
previously used in `IntroOverlay`) rather than new art.

**Exit doorway:** reuses the `Entrance` class directly (same procedural
stone-arch-with-dark-interior already built for the hall's own hidden
entrance) as the "return to hall" architecture element, avoiding
duplicating that drawing code and giving the two doorways a matching
motif. `Entrance` gained `restoreRevealed()` — shows it fully visible/
interactive with no fade, since this doorway is part of the room from
the start rather than something to discover.

**Entry animation:** arrives pre-zoomed (`1.5x`) and darkened (overlay
alpha `0.8`, matching the hall's own phase-2 peak), settles to normal
framing over `600ms` (`Sine.Out`, within the requested 500–800ms). Input
locked (`this.input.enabled = false`) from the first line of `create()`
until the settle completes.

**Return transition:** short, single-phase (not a replay of the hall's
two-phase approach) — zoom to `1.6x` + overlay to `0.85` over `450ms`,
`scene.start('CentralHallScene')` only once that completes.

**State preservation:** the project had no shared state system (searched
and confirmed). `scene.start()` fully recreates a Scene, so without this
the statue/lever/pot/entrance would silently reset on return. Used
Phaser's own `registry` (game-wide, survives scene restarts) rather than
building a second system — a single flag (`leftStatueOpen`) set when the
statue finishes opening, checked in `CentralHallScene.create()` to jump
straight to the fully-open end state before the first `layout()` (no
flash of the closed state). Required small additions: `Pot.restoreFallen()`,
`Handle.restoreActivated()`, `Statue.restoreOpen()`,
`Entrance.restoreRevealed()` — each reuses the class's own existing
layout/render logic rather than duplicating position math. Also fixed a
latent bug this surfaced: `Pot.setActive(true)` would re-enable hover/
cursor on an already-fallen pot (harmless — `handleClick()` already
no-ops — but now guarded properly).

Files created: none (scene already existed). Files modified:
`HiddenPassageScene.ts` (full rewrite), `CentralHallScene.ts`, `Pot.ts`,
`Handle.ts`, `Statue.ts`, `Entrance.ts`.

`npx tsc --noEmit` and `npm run build` both pass. Browser pane
screenshot/click automation remains unavailable in this environment (the
same limitation logged throughout this project); verified instead via
zero console errors on load, all assets/scenes returning 200, and the
served source matching every intended method/constant.

### Pink Room — new scene + animated crystal (completed)

**Important mismatch found and flagged before implementing:** the task
assumed a "Pink Room Scene" already existed to inspect/modify. It did
not — only the assets did (`assets/images/PinkRoom/pink.png`, the
crystal, and `Background_Room2.png`, the room background); no
`src/scenes/*PinkRoom*` file existed and nothing was registered in
`main.ts`. Asked the user how to proceed via `AskUserQuestion`; got no
response. Given both assets were clearly prepared together for this
exact purpose, proceeded with the most conservative reasonable reading:
built the minimal Pink Room Scene needed to host the crystal (background
+ responsive layout + shutdown cleanup, no navigation/entrance/exit
wiring, no puzzle logic — none of that was asked for) rather than leaving
the task undoable.

New `PinkRoomScene.ts` (key `'PinkRoomScene'`, registered in `main.ts`):
mirrors `CentralHallScene`'s cover-scale/background-pixel-anchor
convention exactly, using `Background_Room2.png` (1536×1024, matching the
same design resolution as the Central Hall). Not reachable from any
existing navigation yet — that wasn't requested.

**Crystal placement:** `Background_Room2.png` does **not** contain a real
crystal object — only a thin placeholder pink light beam with a bright
tip standing in for one (confirmed by visual inspection and pixel
cropping). Measured that beam's tip / the pedestal's glow center directly
from the background: `(768, 560)` in background-pixels is where the new
crystal now sits (center origin, since `pink.png` is a round floating gem
with no natural "bottom" to anchor, unlike the Central Hall's tall
crystal spike), at `CRYSTAL_HEIGHT_BG = 140` (aspect-preserved from the
153×152 source). No tint, no blur, alpha stays at the default 1.

New `PinkCrystal.ts` (`src/game/`), following the same modular
scene-owns-layout / component-owns-effects pattern as
`HeartOfTheTemple.ts`/`Atmosphere.ts`, reusing their established
techniques rather than inventing new ones: a shared `breathT` tween
(0.99–1.015 scale, 2100ms, `Sine.InOut`, yoyo, repeat -1) drives the
crystal's pulse, a postFX rim glow's `outerStrength` (2.2–4, same
`postFX.addGlow` technique as the Central Hall crystal), a soft ADD-blend
glow blob behind the crystal (alpha 0.28–0.48), and a reflected-light
pool on the pedestal (alpha 0.1–0.2) — all four locked in sync since
they're driven by the one shared tween value rather than independent
timers. Sparse sparkles reuse the exact particle-emitter technique from
`Atmosphere.ts`'s existing crystal sparkles (small pink/white dots, ADD
blend, short lifespan, gentle upward drift, irregular `frequency`+random
`delay` spawn timing). An occasional glint (every 3–6s, re-randomized
each cycle so it never becomes a fixed loop) adds a temporary *boost* on
top of the breathing glow's current value rather than a competing writer
to the same property, plus a brief bright flash sprite.

Only `PinkRoomScene.ts`, `PinkCrystal.ts`, and `main.ts` were touched —
no existing scene, asset, or unrelated file was modified.

`npx tsc --noEmit` and `npm run build` both pass. Browser pane
screenshot/interaction remains unavailable in this environment (logged
throughout this project); verified via zero console errors on load, all
assets/scenes returning 200, and the served source matching every
intended constant/method. Since `PinkRoomScene` isn't reachable from any
navigation yet, an in-browser look also requires deciding how the player
is meant to reach it.

### Central Hall doorway now leads to the Pink Room (completed)

`CentralHallScene.enterThroughLeftDoor()`'s two-phase threshold-crossing
transition (unchanged) now ends with `scene.start('PinkRoomScene')`
instead of `'HiddenPassageScene')` (both the normal end-of-phase-2 path
and the defensive fallback if the entrance's opening bounds aren't
available). `HiddenPassageScene.ts` itself is untouched and still
registered in `main.ts` — just no longer reachable from this doorway;
removing/deregistering it wasn't asked for, so it was left alone.

`PinkRoomScene.ts` gained the pieces this task required, restructured
into `createRoomEnvironment()` / `createExitToCentralHall()` /
`playEntryAnimation()` / `returnToCentralHall()` (mirroring
`HiddenPassageScene`'s established organization):

- **Entry:** arrives at `1.4x` zoom with a `0.7`-alpha screen-fixed
  overlay, settles to normal framing over `650ms` (`Sine.Out`, within
  500–800ms) — background and crystal are already fully visible from the
  first frame; only the camera/overlay animate. Input locked
  (`this.input.enabled = false`) from the first line of `create()` until
  the settle completes.
- **Exit:** the background already has a lit archway with steps painted
  in (top-left) — reused as the real exit rather than drawing a new
  doorway, using the same `Doorway` class (invisible zone + soft hover
  glow + hand cursor) already used for the Central Hall's own doorway.
  Measured directly from the archway opening: center `(193, 338)`, size
  190×480 bg-px. Click → short `400ms` fade → `scene.start('CentralHallScene')`.
- **State:** no new state code needed — `CentralHallScene`'s existing
  `leftStatueOpen` registry flag is read unconditionally on `create()`
  regardless of which scene sent the player back, so the statue stays
  open automatically. Confirms the "no competing state manager" choice
  from the previous sprint generalizes correctly to a second destination
  room without modification.

`PinkCrystal.ts` unchanged — it already implemented every requested
effect (pulse, glow, sparkles, glint, reflected light) in the prior
sprint.

Files changed: `CentralHallScene.ts` (destination only),
`PinkRoomScene.ts` (entry animation + exit doorway added).

`npx tsc --noEmit` and `npm run build` both pass. Verified live: zero
console errors on load, and the served source confirms every constant/
method (`createRoomEnvironment`, `createExitToCentralHall`,
`playEntryAnimation`, `returnToCentralHall`, both `scene.start`
call sites) matches intent.

### Current Development Priority

Not yet defined — the full sequence (pot → lever → statue turn →
doorway reveal → two-phase crossing → Pink Room entry → animated
crystal → exit archway → Central Hall with statue still open) is wired
end to end. The crystal isn't clickable and there's no puzzle content
yet.

### Future Entrance Plan

The pilot should eventually include different entrance-discovery mechanisms:

1. Pot → hidden handle → moving statue → hidden passage
2. Wall symbol or visible doorway mechanism
3. Progress-based entrance connected to the crystal or rings

Only the first entrance is currently under development.

### Development Rules

- Work in small sprints.
- Add one capability only.
- Do not add unrequested features.
- Keep responses brief.
- Do not refactor unrelated working code.
- Update `PROJECT_STATE.md` and `sprint-log.md` after completing a sprint.
## Current State — Central Hall Left Statue Entrance

### Completed

- The separate left statue asset has been added to the Central Hall.
- The active statue asset is:

  `assets/images/central-hall/statue/left-statue-background-matched.png`

- The statue was visually adjusted in Photoshop to match the Central Hall background.
- Runtime blur, tint, transparency, and other visual-processing effects were removed.
- The statue is displayed at full opacity and uses the edited PNG as-is.
- The statue position, scale, and origin were corrected so it aligns with the left wall niche.
- The statue uses a bottom-based anchor so its pedestal remains correctly aligned with the floor.

### Lever Interaction

- The lever is interactive.
- Clicking the lever:
  1. disables repeated clicks during the animation;
  2. rotates the lever into its activated position;
  3. triggers the left statue opening animation.

- Repeated or overlapping activation is prevented.

### Statue Opening Animation

- The statue opening animation is working and visually approved.
- The statue does not rotate as a flat 2D image around the Z-axis.
- A simulated vertical-axis rotation is used, primarily through horizontal scaling and position movement.
- The statue remains in its open state after the animation.
- The opening behind the statue is revealed correctly.

### Entrance

- A hidden entrance is now visible behind the statue after the lever animation.
- The current entrance appearance and reveal are visually approved.
- Earlier incorrect entrance implementation changes were reverted without affecting the working lever or statue animation.

### Current Task

Enable the player to enter the room through the revealed entrance.

Required behavior:

- The entrance must remain inactive while the statue is closed or opening.
- It should become interactive only after the statue-opening animation finishes.
- Hovering over the entrance should show a pointer cursor and a subtle visual indication.
- Clicking the entrance should:
  - immediately prevent additional clicks;
  - start a short camera fade;
  - transition to the correct destination Scene.

Before implementation:

- Inspect the existing Scenes and identify the correct destination room.
- Reuse the project’s existing transition pattern if one exists.
- Do not guess the destination Scene name.
- Do not redesign the destination room as part of this task.
- Preserve the current lever animation, statue animation, entrance appearance, positioning, and depth order.

### Important Constraints

- Do not modify the approved statue asset or its visual treatment.
- Do not reintroduce blur, tint, or reduced alpha.
- Do not change the lever mechanics unless necessary for the room transition.
- Do not alter unrelated rooms or question logic.
- Keep responsive positioning consistent with the Central Hall design-coordinate system.
- Run the TypeScript/build check after every implementation change.

### Pink Crystal equivalence puzzle — interactive prototype (completed)

First interactive content in the Pink Room: three concentric rotating
stone rings around the crystal (inner = fractions, middle = decimals,
outer = percentages), independently drag-to-rotate with snap-to-90°, a
fixed alignment marker at top, and a temporary check control. New pure-data
module `equivalenceData.ts` (four fraction/decimal/percent groups, a
deliberately different value order per ring so no group starts aligned)
and new `EquivalencePuzzle.ts`, both owned by `PinkRoomScene` the same way
`PinkCrystal` is. Ring/marker/check art is procedural canvas (no matching
assets exist), isolated in `generate*Texture()` methods. Pointer
interaction uses plain top-level `Zone`s with custom annulus hit-testing
(not Containers — hit-testing inside Containers was already flagged
unreliable for the Central Hall crystal) driving a separate `Container`
that only handles visual rotation. `PinkRoomScene.CRYSTAL_DEPTH` raised
3→8 so the ring band has room below the crystal's own internal effect
layers without colliding with them.

`npx tsc --noEmit` and `npm run build` both pass.

### Pink Crystal puzzle — three-round sequence, progress symbols, completion reward (completed)

The prototype's correct-answer feedback (a brief crystal flash) was too
subtle. `EquivalencePuzzle.ts` now runs a real 3-round sequence using
`ROUND_SEQUENCE = ['A','B','C']` from `equivalenceData.ts` (1/2=0.5=50%,
then 1/4=0.25=25%, then 3/4=0.75=75%; group D, 1/5=0.2=20%, stays on the
rings as a distractor but is never a target).

**Round state** lives entirely in `EquivalencePuzzle` instance fields —
`solvedGroupIds: Set<string>`, `currentRoundIndex`, `isCompleted` — not the
shared registry; only final completion is global state (see below).
`checkCurrentAlignment()` now only accepts the current round's target
group (`ROUND_SEQUENCE[currentRoundIndex]`), so re-aligning an
already-solved group is treated as a normal incorrect answer (subtle
vibration + crystal dim, unchanged, and does not reset `solvedGroupIds`).

**Correct-answer sequence** (`handleCorrectAlignment()`): locks all three
rings (`setRingsInteractive(false)`), plays the existing pink energy pulse
+ crystal intensify (`playCorrectFeedback()`, 650ms pulse / crystal
glow-boost within the requested 600–900ms), records the group as solved,
and lights the next progress symbol (`updatePuzzleProgress()`). After a
750ms window (`CORRECT_GLOW_DURATION_MS`) a timer fires either
`advanceToNextRound()` (increments the round, re-enables rings — the only
place rings are unlocked, so interaction never resumes before the next
target is ready) or, once all three are solved, `completePinkRoomPuzzle()`.

**Progress symbols:** three small stone medallions in a row between the
outer ring and the check control (`PROGRESS_SYMBOL_OFFSET_Y_BG`, between
`OUTER_RADII.outer` and the check control's own offset). Each starts dim;
`updatePuzzleProgress()` lights the next one permanently with a pop-scale
tween plus a persistent additive pink glow (a multiply-tint can't brighten
an already-dark base texture, so "lit" is conveyed by the glow + pop, not
by recoloring the medallion itself).

**Completion** (`completePinkRoomPuzzle()`): permanently locks the rings
and the check control (`checkZone.disableInteractive()` — no future
unlock, unlike the per-round lock), calls
`PinkCrystal.playActivationSequence()` (new: a stronger/longer glow boost
plus the crystal rising ~18bg-px and scaling up ~8% over 900ms — additive
on top of the existing breathing tween via the same `glintBoost`-style
pattern, not a competing writer), reveals a TEMPORARY procedural reward
(a small ancient rune rising out of the crystal, additive blend, then
idling with a gentle breathing pulse forever — clearly marked as a
placeholder for real reward art/interaction), and sets
`STATE_KEY_PINK_ROOM_PUZZLE_COMPLETE` (`'pinkRoomPuzzleComplete'`) in the
shared Phaser `registry` — same pattern as `leftStatueOpen`, not a new
state system. The Pink Room stays visible and does not build or reference
a next room.

Files changed: `equivalenceData.ts` (added `ROUND_SEQUENCE`),
`PinkCrystal.ts` (added `playActivationSequence()` and the rise/scale
mechanism), `EquivalencePuzzle.ts` (round state, progress symbols, reward,
all five new methods). `PinkRoomScene.ts` unchanged — this task's logic is
entirely internal to the two game classes it already owns.

`npx tsc --noEmit` and `npm run build` both pass (only the pre-existing,
unrelated chunk-size warning). Verified the dev server serves the updated
source with all new methods present (`handleCorrectAlignment`,
`advanceToNextRound`, `updatePuzzleProgress`, `completePinkRoomPuzzle`)
and zero console errors on load; the Browser pane's screenshot/computer
tools were unreliable again this session (same recurring environment
limitation logged throughout this project), so the visual result of a
full three-round playthrough still needs a manual look in a real browser.

### Pink Crystal puzzle — floating crystal-code panel (735), digit reveal, keyboard entry (completed)

The prior sprint's progress dots (dim medallions near the rings) were too
subtle to read as "three rounds." Replaced entirely with a floating
architectural panel — "קוד הגביש" — above the rings, showing the puzzle's
three-stage progress as a growing code (◇◇◇ → 7◇◇ → 73◇ → 735). Removed:
`ProgressSymbol`/`createProgressSymbols()`/`updatePuzzleProgress()`/
`generateProgressSymbolTexture()` and their constants — fully superseded,
not left dead.

**Data:** `equivalenceData.ts`'s `ROUND_SEQUENCE` (string[]) replaced with
a typed `PUZZLE_ROUNDS: { groupId, digit }[]` (A→7, B→3, C→5, final code
735) — "keep the code digits in typed puzzle data, not scattered through
rendering logic." `EquivalencePuzzle.ts` wraps this into runtime
`PuzzleRound[]` (adds `solved: boolean` per round) on construction.

**Panel:** anchored to the crystal center exactly like the rings
(`PANEL_CENTER_OFFSET_Y_BG = -410`, i.e. ~150bg-px from the top of the
1536×1024 background), comfortably above the marker's own top extent
(~305bg-px above the crystal) so it never overlaps the mechanism. Built
as one `Container` (frame + title + 3 slots, all positioned in local
bg-px units, scaled as a whole in `layout()` — the same technique
`buildRing()` already used) plus a separate top-level confirm-rune `Zone`
(interactive Zones inside Containers are unreliable, per this project's
established crystal-hit-testing lesson). All art is procedural canvas
(carved stone/bronze frame, diamond slot medallions, a small rune-style
confirm button), isolated in `generatePanelFrameTexture()` /
`generateCodeSlotTexture()` / `generateConfirmTexture()`.

**Correct-answer sequence** (`handleCorrectAlignment()` →
`revealRoundDigit()` → `activateCodeSlot()` → `handleDigitInput()`/
`submitPendingDigit()` → `lockDigitIntoSlot()` →
`advanceToNextPuzzleRound()`/`completeCrystalCode()`): unchanged ring
lock + pulse/intensify feedback, then — after the existing 750ms glow
window — a large digit fades in centered on the crystal, holds ~900ms,
fades out (`scene.tweens.chain()`, new to this codebase but standard
Phaser 3.90 API), then hands off to activating the matching panel slot
for entry. Rings and the check control stay locked through this entire
window; the only place they unlock is `advanceToNextPuzzleRound()`, so
interaction can never resume before the next round (and its slot) is
actually ready.

**Digit entry:** direct keyboard only (0-9 set a pending digit shown
dimmed in the slot, Backspace clears it, Enter submits — with
`preventDefault()` on handled keys so Backspace can't trigger the
browser's own back-navigation) plus the panel's stone confirm rune as an
alternate submit control. No on-screen numpad — nothing in the project
targets touch yet, and the task's own numpad requirement was conditional
on that. Correct digit: locks permanently into the slot with a pop-scale
+ persistent soft pink glow, no more pulsing. Incorrect digit: brief
shake + dim on just that slot, pending digit cleared, previous rounds
untouched, another attempt allowed. A slot's active state is conveyed by
a breathing glow *and* a pop-scale on lock-in — motion/shape cues, not
color alone, per the accessibility requirement — with a stronger glow
range once actually awaiting input (`SLOT_GLOW_AWAITING_RANGE`) versus
merely being the current round (`SLOT_GLOW_IDLE_RANGE`, already active
on slot 1 from the moment the room loads, satisfying "first slot subtly
highlighted").

**Completion** (`completeCrystalCode()`): unchanged from the prior
sprint's `PinkCrystal.playActivationSequence()` + reward reveal +
`STATE_KEY_PINK_ROOM_PUZZLE_COMPLETE` registry flag, now additionally
locks the confirm rune and gives the panel's own glow a one-time boost.
All three digits stay visible, locked, in the panel afterward.

**Bug found and fixed during verification:** the digit reveal originally
used `Phaser.BlendModes.ADD` (matching this project's usual glow
convention) — but against the crystal's own near-white core, an additive
digit washed out completely and was invisible, failing "digits are large
and readable." Fixed by switching to `NORMAL` blend with a dark stroke
(`strokeThickness: 8`) instead; confirmed legible via direct scene
inspection (see below). The soft glow behind the digit stays ADD-blended
— only the digit's own readability needed the fix.

Files changed: `equivalenceData.ts` (`PUZZLE_ROUNDS`), `EquivalencePuzzle.ts`
(panel, round state, keyboard input, digit-reveal fix). No changes to
`PinkCrystal.ts` or `PinkRoomScene.ts`.

`npx tsc --noEmit` and `npm run build` both pass. This session the
Browser pane's screenshot tool worked intermittently but well enough for
a real functional pass: loaded the room, confirmed the panel's static
appearance (frame, title, three ◇ slots, slot 1 pre-highlighted) matches
spec, then drove the actual puzzle logic directly via the scene's own
instance methods (ring angles + `checkCurrentAlignment()`/
`submitPendingDigit()`/etc. — bypassing only pointer-drag simulation,
which this automated tool doesn't reliably support, and Phaser's
timer/tween clock, which appeared stalled in this headless tab) to
verify, with screenshots, the full chain: correct alignment → readable
digit reveal → slot activation → wrong-digit dim feedback → correct-digit
lock-in with glow → round 2 → round 3 → final panel showing "7 3 5" →
rings/check permanently disabled → registry flag set → reward revealed.
A temporary `window.__game` exposure added to `main.ts` for this
verification was reverted immediately after (confirmed via a final
`tsc`/`build` pass post-revert).

### Pink Crystal puzzle — explicit states, "hold digit until entered," panel clipping fix (completed)

Feedback: after a correct ring alignment the player couldn't tell *which*
digit had been revealed, that it needed typing into the panel, or how
many rounds were left — the digit auto-faded on its own timer regardless
of whether the player had acted, and the panel itself was clipped at the
top of the viewport.

**Explicit state machine:** replaced the prior ad-hoc boolean flags
(`checkLocked`+`waitingForDigitInput`+`isCompleted`) with one
`PuzzleState = 'ALIGNING_RINGS' | 'ENTERING_CODE' | 'ROUND_TRANSITION' |
'COMPLETED'` field, the single source of truth `checkCurrentAlignment()`/
`handleDigitInput()`/`submitPendingDigit()` all gate on. `checkLocked`
survives only as a narrow debounce *within* ALIGNING_RINGS (the check
button's own short incorrect-answer cooldown) — a UI debounce, not a
puzzle phase, so it stays separate from `state` deliberately.

**Digit now waits for the player, not a timer:** `revealRoundDigit()` no
longer auto-fades after a hold — it fades in and *stays* for the entire
ENTERING_CODE window. New `hideRevealedDigit()` is called only from
`lockDigitIntoSlot()`, i.e. only once the player actually enters the
correct digit. The required message
`"הספרה שגיליתם היא {digit}. הזינו אותה בקוד הגביש."` is set in the panel's
new instruction-text line at the same moment the digit appears and the
slot begins pulsing (`activateCodeSlot()`), so reveal → instruction →
pulse → keyboard-enabled happen in the required order, all still gated
behind the existing `CORRECT_GLOW_DURATION_MS` (600-900ms) crystal-
intensify window from the prior sprint.

**Round-transition messaging:** on a correct digit, `lockDigitIntoSlot()`
computes rounds-remaining and either (a) if none remain, briefly settles
(`FINAL_ROUND_SETTLE_MS`) straight into `completeCrystalCode()` — no
"rounds remain" message applies to the final round — or (b) enters
`ROUND_TRANSITION`, shows one of the task's two exact literal strings via
new `remainingRoundsMessage()` (2 remaining: `"מצוין! נשארו עוד 2
חידות."`; 1 remaining: `"מצוין! נשארה עוד חידה אחת."` — hardcoded rather
than a generic pluralizer, since a fixed 3-round sequence only ever needs
these two forms and Hebrew's plural/singular verb forms here don't share
a mechanical pattern worth generalizing), then after
`ROUND_TRANSITION_DELAY_MS` (1500ms, per spec) calls
`advanceToNextPuzzleRound()`.

**Round init now rotates the rings:** new `rotateRingsToUnsolvedArrangement()`
snaps each ring to a random one of its 4 positions (instant, like the
rings' own initial angle=0 — no animation was requested), re-rolling if
the result would trivially already solve the *next* round, so a fresh
round always has real dial-turning left to do rather than sitting on the
previous round's leftover position. Shares its "which group is at the
marker for a given angle" math with the existing `selectedGroupId()` via
a new `groupIdAtAngle(order, angle)` helper (extracted so the two don't
duplicate the same formula).

**Panel layout/clipping fix:** `PANEL_CENTER_OFFSET_Y_BG` moved -410→-345
(bg-px Y ~150→~215) — the previous position clipped on any viewport
wider than ~1.5:1 (this project's cover-scale background can crop up to
~380bg-px off the *top* on wide viewports; see the new comment above the
constant for the exact budget), while staying 15bg-px clear of the
marker's own top edge (560-255=305bg-px). Panel widened 380→460bg-px and
shortened 170→150bg-px to trade the freed vertical room for a wider,
shorter shape that now fits title + a new instruction-text line (with
word-wrap) + the 3 slots + the confirm control, re-tuned
(`PANEL_TITLE_OFFSET_Y_BG`, new `PANEL_INSTRUCTION_OFFSET_Y_BG`/
`_WRAP_WIDTH_BG`, `PANEL_SLOT_ROW_OFFSET_Y_BG`, `SLOT_SPACING_BG`,
`CONFIRM_OFFSET_Y_BG`) to all fit within the new, smaller frame without
overlap.

Files changed: `EquivalencePuzzle.ts` only (state machine, panel
instruction text, digit-hold/hide, round-transition messaging, ring
rotation, panel dimensions). No changes to `equivalenceData.ts`,
`PinkCrystal.ts`, or `PinkRoomScene.ts`.

`npx tsc --noEmit` and `npm run build` both pass. This session the
Browser pane regressed partway through verification: a fresh tab's
Phaser game booted (`isBooted: true`) but its `SceneManager` never
registered any scenes and `document.hidden` stayed `true` even on a
brand-new tab/navigation, so no scene ever ran, no timer ever fired, and
screenshots timed out — a deeper version of this project's
already-repeatedly-logged screenshot/automation limitation, not
something forcing `document.hidden`/`game.loop.focus()`/manual
`game.step()` calls could work around this time. Fell back to this
project's established alternative: confirmed via a temporary standalone
dev server + `curl` that the served source contains every new
state/method exactly as written (`PuzzleState`, all four state string
literals, `rotateRingsToUnsolvedArrangement`, `remainingRoundsMessage`,
`hideRevealedDigit`, `setInstructionText`, the exact Hebrew strings), and
re-verified the full logic by re-reading the final file end to end. A
real interactive/visual playthrough of this specific sprint's changes
(panel no longer clipped, digit-hold behavior, round-transition
messages) still needs a manual look in a real browser.

### Pink Crystal puzzle — round-intro popups, easier ring grab, obvious diamond, automatic code placement, full completion sequence (completed)

The largest sprint on this puzzle yet: a round-intro popup, a fix for
the middle ring being hard to grab, an obviously-interactive check
diamond, fully automatic digit placement (typing removed), and a real
completion sequence (final ring pose, reward, exit gating). New file
`RoundIntroPopup.ts`; `EquivalencePuzzle.ts` was substantially rewritten;
`equivalenceData.ts` and `PinkRoomScene.ts` both changed.

**Round-intro popup (`RoundIntroPopup.ts`, new):** a screen-fixed
(scrollFactor 0, not background-anchored — it must stay centered
regardless of the background's cover-scale cropping), centered modal
with a carved stone/bronze frame (rounded corners, corner rivets, a
recessed dark interior, a pink reflected-glow edge — no flat white
dialog), title, word-wrapped RTL Hebrew body, and one stone rune button.
Content lives in `equivalenceData.ts`'s `PUZZLE_ROUNDS[i].introTitle`/
`introBody` (exact literal strings for all three rounds) plus a shared
`ROUND_INTRO_BUTTON_LABEL = 'מתחילים'`. The button's `Zone` is only ever
made interactive while the popup is actually open (`show()`/`hide()`),
and `hide()` only reports done via its `onHidden` callback once the
fade-out tween completes — so the popup can only be dismissed by its own
button, and nothing behind it (rings, check) reads as usable until then.

**Ring grab fix:** the three rings' visual radii (`INNER/MIDDLE/OUTER_RADII`)
are unchanged, but hit-testing now uses a separately padded range
(`RING_HIT_PADDING_BG = 7`), eating into the existing 15bg-px gaps
between rings: inner hit 88-142 (visual 95-135), middle hit 143-197
(visual 150-190), outer hit 198-252 (visual 205-245) — still
non-overlapping (1bg-px buffer at each boundary). The middle ring was
hard to grab not because of any overlap bug but because it's flanked by
another ring's *own valid range* on both sides (the inner/outer rings
each have empty space on one side to be forgiving into); padding the
band gives all three, especially the middle one, more forgiving edges
without changing what's drawn. Also added: a warm-pink tint on whichever
ring is actively being dragged (`RingRuntime` gained an `image` field to
allow this — previously only the container was tracked), applied on
pointer-down and cleared on pointer-up, independent of hover (dragging
routinely moves the pointer outside the ring's own hit area mid-drag).
"Select exactly one ring on pointer down, never switch mid-drag" and
"drag from anywhere on the visible ring" were already correct in the
existing `activeDragRingId` guard and annulus hit-test — unchanged.

**Obvious diamond:** the check control gained a "בדיקה" label above it
and a continuous gentle breathing pulse (button scale + a soft pink
glow) that runs only while `state === 'ALIGNING_RINGS'` — started/stopped
in the one place ring/check interactivity itself toggles
(`setPuzzleInputActive()`), so "stop pulsing during feedback or popups"
falls out automatically from already-correct state gating rather than
needing separate tracking. The ambient glow and the existing hover-glow
boost are combined additively (`applyCheckGlow()`, reusing the
"recompute from a base plus a boost" technique `PinkCrystal.ts` already
established) rather than fighting over the same `checkGlow.alpha`
property. Found and fixed in passing: clicking the diamond disables its
zone while the pointer is still over it, so `POINTER_OUT` never fires to
clear the hover boost — without an explicit reset in
`stopCheckAmbientPulse()`, a residual glow would have lingered through
every round's feedback.

**Automatic digit placement:** all manual entry is gone — the keydown
listener, `pendingDigit`/`setPendingDigit()`/`validateCurrentDigit()`/
`submitPendingDigit()`'s typing role, and the confirm rune button/zone
entirely (nothing left for the player to confirm once digits place
themselves; the ring-check diamond is the puzzle's only control now).
`enterCorrectFeedback()` reveals the digit (unchanged NORMAL-blend +
stroke fix from the previous sprint — still needed, still correct),
holds it `DIGIT_REVEAL_HOLD_MS` (700ms) to read, then
`animateDigitToSlot()` flies it from the crystal into its panel slot —
recomputing position/size/alpha every frame from the crystal and slot
anchors via a plain progress tween (not raw property tweening), so it
stays correct even across a mid-flight resize. `lockDigitIntoSlot()`
only pops the digit into its permanent place once the flight fully
completes (sequential, never overlapping tweens), then
`finishCorrectFeedback()` shows the round's exact `successMessage` and
either starts `ROUND_TRANSITION` (rotate rings to a fresh unsolved
arrangement, then the next round's intro popup) or, on the final round,
settles briefly into `completeCrystalCode()`.

**Explicit states:** `PuzzleState` now has all seven required values —
`ROUND_INTRO | ALIGNING_RINGS | CHECKING | CORRECT_FEEDBACK |
INCORRECT_FEEDBACK | ROUND_TRANSITION | COMPLETED`. The old separate
`checkLocked` debounce is gone (`CHECKING`/`CORRECT_FEEDBACK`/
`INCORRECT_FEEDBACK` inherently block re-entry via the state check
itself); the incorrect-path's own short timer (`checkLockTimer`) is kept
distinct from the correct-path's longer timer chain (`roundReadyTimer`)
since they're conceptually different waits, never concurrent.

**Completion sequence** (`completeCrystalCode()`): rings/check already
permanently locked (state itself gates them, `setPuzzleInputActive(false)`
called explicitly too); `playFinalRingSettleAnimation()` rotates each
ring an extra `FINAL_SETTLE_EXTRA_DEG` (12°) past its already-correct
round-3 position — "rotate the rings slightly into a final aligned
resting position," purely decorative since they're already locked;
`PinkCrystal.playActivationSequence()` (unchanged, from an earlier
sprint) handles the intensify/rise/"open"; `revealRewardSymbol()` grows
a redesigned shard/key-shaped icon (an elongated hexagon + a small loop,
reading as both "crystal shard" and "ancient key") out of the crystal,
then `flyRewardToIcon()` sends it to a small fixed screen-corner icon
(56,56px, scrollFactor 0) where `startRewardIdlePulseAtIcon()` gives it
a permanent gentle breathing idle — "toward a small inventory/progress
location," standing in for a real inventory system that doesn't exist
yet. Registry: `STATE_KEY_PINK_ROOM_PUZZLE_COMPLETE` (room-completion,
unchanged from earlier sprints) and a new
`STATE_KEY_PINK_CRYSTAL_SHARD = 'pinkCrystalShard'` (reward-possession,
set the moment the reward is revealed) are both set. `onComplete?: () =>
void` is a new public callback field (same pattern as `Doorway.onActivate`)
that `PinkRoomScene.ts` uses to reveal its exit.

**State preservation / room re-entry** (`PinkRoomScene.ts`): the exit
`Doorway` is now created *inactive* and only enabled via the puzzle's
`onComplete` callback — previously it was always usable regardless of
puzzle progress, which no longer made sense once "reveal or enable the
room exit" became an explicit completion step. New
`EquivalencePuzzle.restoreCompleted()` (same pattern as
`Statue.restoreOpen()`/`Entrance.restoreRevealed()` in the Central Hall)
jumps straight to the finished visual state — all three digits placed,
rings in their final rest pose, reward already settled at its icon, no
animations replayed — for re-entering an already-completed room;
`PinkRoomScene.createEquivalencePuzzle()` calls it when
`STATE_KEY_PINK_ROOM_PUZZLE_COMPLETE` is already `true` in the registry,
and `createExitToCentralHall()` checks the same flag directly so the
exit is open immediately on that return visit rather than waiting for a
callback that will never fire again. `beginPuzzle()` (called from
`playEntryAnimation()`'s settle, replacing the previous direct
`input.enabled = true`) is a no-op if already `COMPLETED`.

Files changed: `equivalenceData.ts` (intro/success copy),
`EquivalencePuzzle.ts` (rewritten), `RoundIntroPopup.ts` (new),
`PinkRoomScene.ts` (exit gating, `beginPuzzle()`/`restoreCompleted()`
wiring).

`npx tsc --noEmit` and `npm run build` both pass. Verified live this
session — the Browser pane's screenshot tool worked intermittently, and
its pointer-drag simulation still doesn't reach Phaser's input system
(same limitation noted in earlier sprints), but real interaction was
driven directly through the scene's own puzzle instance (ring angles +
`checkCurrentAlignment()`/`roundIntroPopup.onConfirm()`, with Phaser's
game loop manually stepped via `game.step()` since this automated tab's
`requestAnimationFrame` doesn't advance its timers/tweens on its own).
Confirmed with screenshots at each stage: the round-1 popup's exact
title/body/button; the popup closing only on confirm and unlocking rings
only then; the revealed "7" reading clearly next to the crystal; the
digit caught mid-flight glowing directly over its slot; the exact
`successMessage` after each round; round 2 and round 3's popups opening
with the previous digits already visible and lit; the final panel
showing "7 3 5"; the rings visibly rotated into their final settled
pose; and the pink shard/key icon settled and idling in the top-left
corner. Also confirmed via direct state inspection: registry flags
`pinkRoomPuzzleComplete` and `pinkCrystalShard` both `true`, rings and
the check zone permanently disabled, and the room's exit zone enabled.
Not covered this session: actual mouse-drag ring rotation (the
automation limitation above) and the incorrect-ring-answer shake/dim
path (logic unchanged from the prior working sprint, only re-gated
behind the new state machine, but not re-exercised live). A temporary
`window.__game` exposure added to `main.ts` for this verification was
reverted immediately after, confirmed via a final `tsc`/`build` pass
post-revert.

### Pink Room puzzle — RTL text, crystal as submit control, explicit ring bands, marker-race fix, duplicate-answer detection (completed)

The largest UI/interaction pass on this puzzle: proper Hebrew RTL
rendering everywhere, the crystal itself replaces the bottom diamond as
the submit control, ring hit-testing was rearchitected from three
overlapping per-ring zones into one explicit radial-band lookup, a real
timing bug behind the "marker doesn't match the selection" complaint was
found and fixed, and a full duplicate-equivalence-group detection system
was added. New `rtlText.ts`; `EquivalencePuzzle.ts` rewritten again;
`PinkCrystal.ts`, `RoundIntroPopup.ts`, `equivalenceData.ts` all changed.
No `PinkRoomScene.ts` changes needed — it already just passes the
crystal reference through.

**RTL (`rtlText.ts`, new):** a single `createRtlText(scene, x, y, text,
style)` helper used for every Hebrew UI string in the puzzle (popup
title/body/button, panel title, all feedback/instruction messages, the
new crystal instruction) — sets Phaser's built-in `rtl: true` text style
(native browser bidi: correct right-to-left line flow, punctuation
placement, and natural left-to-right ordering of embedded numbers/math
expressions, confirmed live — "1/2", "0.75" etc. all read correctly
embedded in RTL sentences) and defaults `align: 'right'` for wrapped
multi-line text. Never manually reverses strings (confirmed none ever
did). Ring value labels (fractions/decimals/percents) are deliberately
left as plain LTR text — they're numbers/math notation, not Hebrew
words.

**Crystal as submit control:** the diamond control (`checkButton`/
`checkGlow`/`checkLabel`/`checkZone` and all its pulse/hover logic) is
gone entirely. `PinkCrystal.ts` gained `setSubmitReady(active)` (a
slower, clearly-visible extra breathing pulse layered on the idle
breath via the same additive-boost mechanism as `glintBoost`, active
only during `ALIGNING_RINGS`) and `setHovered(hovered)` (small glow +
scale boost). `EquivalencePuzzle.ts` owns only a `crystalZone` (click →
`checkCurrentAlignment()`, hover → `crystal.setHovered()`) and a new
static Hebrew instruction line, "לבדיקה, לחצו על הגביש", positioned
where the old check control used to sit. Verified live: ambient pulse
visibly brighter during `ALIGNING_RINGS`, zone correctly enabled/disabled
across every state transition.

**Ring hit-testing rearchitected:** replaced three separate same-depth
interactive `Zone`s (each with its own `hitAreaCallback`) with **one**
mechanism-wide zone and a single explicit handler
(`onMechanismPointerDown`) that computes `dist = sqrt(dx²+dy²)` from the
shared center and looks the ring up in an ordered `RING_BANDS` table —
removing Phaser's own multi-object hit-test picking as a second,
unaudited source of ambiguity on top of the radial math (the likely
reason the middle ring stayed unreliable even after the previous
sprint's padding fix). Bands widened further, using the *entire*
15bg-px gap between neighbors as tolerance, plus the same amount of open
tolerance on each ring's free side: inner 80–142.5, middle 142.5–197.5,
outer 197.5–260 (all bg-px). Verified live at both representative
distances and exact boundaries (79.9/80, 142.49/142.5/142.51, 197.5,
260/260.1) — no gaps, no overlap, fully deterministic. The crystal's own
zone (75bg-px radius, comfortably inside the inner band's 80bg-px floor)
sits at a higher input depth than the mechanism zone specifically so an
overlapping click at the shared center always resolves to the crystal.
`RingRuntime` lost its per-ring `zone`/`hoverTween`/screen-radius fields
entirely — simpler than before, not just padded differently.

**Marker/index accuracy — real bug found and fixed:** the selection math
itself (`groupIdAtAngle`) was already correct for a *settled* ring — one
shared reference frame throughout (marker fixed at screen-up, labels
laid out at `i*90°` at rest, rotation in the same clockwise-positive
degrees Phaser uses, normalized via `Wrap`/modulo, never mixed with
radians outside the one label-placement `DegToRad` call). The actual bug
was a **timing race**: the crystal was previously re-enabled immediately
on ring pointer-up, but the ring itself keeps animating toward its
snapped angle for another `SNAP_DURATION_MS` (220ms) after that. A click
in that window read `ring.angle` mid-tween. Fixed by moving the
crystal's re-enable from `onPointerUp()` into `snapRingToPosition()`'s
own `onComplete` — the crystal now only becomes clickable once the ring
has *actually* finished snapping, so `selectedGroupId()` always reads a
settled value. Verified live by directly reproducing the race (drag to
73°, release, inspect immediately): crystal zone was correctly disabled
mid-tween and only re-enabled after the ring settled to 90°, at which
point the marker's screen position and the ring's own reported selected
group (`D`, for that specific rotation) matched exactly in a screenshot.
A temporary `DEBUG_LOG_SELECTION` flag (default `false`) logs ring
name/snapped angle/index/group on every snap-complete for any future
re-diagnosis; left disabled.

**Duplicate-answer detection:** `checkCurrentAlignment()` now computes
whether the alignment is mathematically an equivalence (`inner===middle
===outer`) *and* whether that shared group ID belongs to one of the
puzzle's real target groups — compared by group ID (`A`/`B`/`C`), never
by visible text or ring order — then branches three ways: not an
equivalence (or not the current round's specific target) →
`INCORRECT_FEEDBACK` (new message: "הערכים אינם שווים. נסו שוב.");
equivalent and already in the new `solvedGroupIds: Set<EquivalenceGroupId>`
→ new `DUPLICATE_FEEDBACK` state ("את ההתאמה הזאת כבר פתרתם. מצאו התאמה
נכונה אחרת.", ~1.9s, amber ring tint + a smaller vibration than the
plain incorrect shake — deliberately distinct feedback, verified via
screenshot showing all three rings amber-tinted); equivalent, matches
the current round's target, and not yet solved → `CORRECT_FEEDBACK`
(new immediate message "מצוין! נמצאה התאמה חדשה.", shown before the
existing per-round `successMessage` that follows once the digit lands).
The redundant `PuzzleRound.solved` boolean was removed in favor of this
one `Set` as the single source of truth (`equivalenceData.ts`'s
`RoundDefinition[]` is used directly as `EquivalencePuzzle`'s round
list now, no wrapper interface). Verified live end-to-end: solved round
1 (group A), then deliberately re-aligned to group A during round 2 —
got the duplicate message and amber vibration, `solvedGroupIds`
stayed `['A']` (not duplicated, not incorrectly re-added), slot 1 stayed
"7," and the puzzle returned cleanly to `ALIGNING_RINGS` with the
crystal re-enabled.

**Popup (`RoundIntroPopup.ts`):** button redesigned to a transparent-fill,
outline-only pill (bronze/gold stroke, brighter stroke + soft additive
glow on hover — no fill added at any state), moved up slightly inside
the frame (`BUTTON_OFFSET_Y_PX` 92→78), with a click `Zone` sized larger
than the visible outline (`BUTTON_HIT_WIDTH/HEIGHT_PX` = outline size +
32/24px). Body text now right-aligned via `createRtlText`. Round content
updated to reference "the glowing crystal" instead of "the glowing
diamond" throughout (`equivalenceData.ts`), matching the crystal-as-
submit-control change; round 2's text is the task's primary worked
example, rounds 1 and 3 given their own distinct bodies.

**Crystal-code panel spacing:** `PANEL_HEIGHT_BG` 150→166 and
`PANEL_TITLE_OFFSET_Y_BG` -60→-68, giving the title real clearance from
the frame's own top border (previously ~3bg-px, now ~15bg-px) — this was
about the panel's own drawn border, not viewport cropping (already fixed
in an earlier sprint). Slots widened from `SLOT_SPACING_BG` 110→150
(~1.36x, within the requested 1.3-1.5x) and enlarged from `SLOT_SIZE_BG`
50→58 with a larger digit font (34→38), giving each digit real room
inside its diamond. Panel bottom edge still stays clear of the ring
marker's own top edge (non-overlapping, per the explicit requirement),
though with a smaller margin than before — a deliberate trade-off to
keep the panel's vertical viewport-safety position unchanged from the
already-verified previous fix.

Files changed: `EquivalencePuzzle.ts` (rewritten), `PinkCrystal.ts`
(hover/submit-pulse), `RoundIntroPopup.ts` (RTL + button redesign),
`equivalenceData.ts` (new round body text, `EquivalenceGroupId` type
alias), `rtlText.ts` (new).

`npx tsc --noEmit` and `npm run build` both pass. Verified live and
extensively this session — the Browser pane's screenshot tool worked
well enough throughout, and the game clock was manually stepped via
`game.step()` as in prior sessions (this automated tab's own RAF loop
doesn't advance timers/tweens on its own). Confirmed with screenshots:
correct RTL popup body/button style/title spacing across all three
rounds; the crystal's brighter ambient pulse; wider/larger code slots;
the exact duplicate-feedback message with all three rings visibly amber;
and the marker sitting precisely over "1/5" (group D) after a
non-90°-released drag settled — a direct visual confirmation of the
marker-accuracy fix. Confirmed via direct state/method inspection: every
radial band boundary (interior and exact edges), the crystal-disabled-
during-snap timing fix, and the full three-message feedback flow
(correct-new / duplicate / incorrect). Not covered live: actual
mouse-drag simulation (this environment's automation still can't
generate pointer events Phaser's input system receives — verified the
underlying handlers directly instead, the established pattern all
session). A temporary `window.__game` exposure added to `main.ts` for
this verification was reverted immediately after, confirmed via a final
`tsc`/`build` pass post-revert.

### Pink Room puzzle — popup-based feedback, digit-centering fix, panel-title spacing, hint-on-inactivity, permanent-instruction removal (completed)

Replaced the puzzle's small in-panel feedback text with a reusable,
kind-parametrized popup; fixed a font-baseline artifact making code-slot
digits look off-center; gave the "קוד הגביש" panel title more breathing
room from the frame's top edge; removed the permanent "לבדיקה, לחצו על
הגביש" crystal label; and added a delayed contextual hint shown once
per round if the player stalls after the rings settle. New
`FeedbackPopup.ts`; `EquivalencePuzzle.ts` rewritten again.

**`FeedbackPopup.ts` (new):** one screen-fixed, centered popup class
covering five outcomes (`correct` / `incorrect` / `duplicate` /
`completed` / `hint`) via a `KindStyle` table (glow tint + whether it
pulses) rather than five separate popup implementations. Same
dark-stone/bronze-frame convention as `RoundIntroPopup` (procedural
canvas texture, gradient fill, gold stroke, soft pink inner-edge glint),
depth 58-59 (below `RoundIntroPopup`'s 60-62 — the two are state-
mutually-exclusive so this only matters for a stray overlap during
manual testing, never in real gameplay). `show(content, durationMs,
onHidden)` fades in (220ms), holds, fades out (220ms), auto-hides, and
calls `onHidden` once fully faded — callers that need the puzzle to
advance only after the popup clears (a digit reveal sharing the same
screen position) hook there instead of racing a separate timer.
`dismissImmediately()` skips straight to fade-out with no `onHidden`
call, used when the crystal is clicked while the hint is showing (must
not immediately re-arm a new hint) and whenever a new ring drag/check
begins. Two size variants: normal (420×170px, title 38px, body 26px) for
the four result outcomes, and a smaller hint variant (340×130px, title
24px, body 17px).

**Two real bugs found and fixed during live verification (not from the
original design):**
1. The body text's `wordWrap.width` was set once at construction
   (360px, sized for the normal 420px frame) and never adjusted for the
   hint variant's narrower 340px frame, so the hint body text overflowed
   past its own frame edge. Fixed by adding
   `NORMAL_BODY_WRAP_WIDTH_PX`/`HINT_BODY_WRAP_WIDTH_PX` and calling
   `.setWordWrapWidth(...)` per-kind inside `show()`.
2. The title has no wrap (single line, centered) and the longest of the
   four outcome strings ("כבר פתרתם את ההתאמה הזאת", the duplicate
   title) measured 431px at 38px bold — 11px wider than the 420px
   frame, overrunning its edges. Fixed with a new `fitTitleToFrame(maxWidth)`
   helper: after setting the title text/font size, shrinks the font
   1px at a time (floor `TITLE_MIN_FONT_SIZE_PX = 28`) until the
   measured `Text.width` fits within `frameWidth - 40`. Verified live:
   the duplicate title now renders at 33px, width 374px, comfortably
   inside its frame; the other three (shorter) titles stay at the full
   38px since they never trigger the loop.

**Digit-centering "bug" — diagnosed as a font-baseline artifact, not a
coordinate bug:** the code-slot digit `Text` and its diamond frame
`Image` were already positioned identically (both at the slot's own
computed center, origin 0.5/0.5) — the visual "sitting high" complaint
was Phaser centering the text against its full ascent+descent bounding
box, which a glyph with no descender (a bare digit) doesn't fill
evenly. Fixed with a small compensating offset,
`SLOT_DIGIT_Y_OFFSET_BG = 3`, added only to the digit text's Y (the
diamond frame image is untouched), plus `SLOT_DIGIT_FONT_SIZE_BG`
38→34 for a bit more breathing room inside the diamond. Verified live:
a solved round's revealed digit ("7") renders visibly centered inside
its diamond slot.

**Panel title spacing:** `PANEL_TITLE_OFFSET_Y_BG` -68→-48 (panel
half-height is 83bg-px, so top clearance goes from ~15 to ~35bg-px);
title gained `fontStyle: 'bold'` and a brighter color (`#e8c9a0` →
`#ffedd2`). `PANEL_HEIGHT_BG` (166) and slot layout are unchanged.
Verified live: "קוד הגביש" sits with clear, even padding from the
frame's top border.

**Permanent instruction removed:** `createCrystalInstruction()`, the
`crystalInstructionText` field, its layout/destroy wiring, and the
now-unused offset/font-size/depth constants are all deleted. The
crystal itself keeps its existing hover/submit-ready pulse — only the
static label is gone.

**Delayed contextual hint:** new `hintTimer`/`hintShownThisRound` state.
`scheduleHintTimer()` is called after every ring finishes snapping (in
`ALIGNING_RINGS` only) and after a round's intro popup closes; it
schedules `showInactivityHint()` after `HINT_DELAY_MS = 2800`ms the
first time in a round, or `HINT_REPEAT_DELAY_MS = 9000`ms on any
repeat within the same round (satisfies "show once per round unless
inactivity is much longer, don't nag"). `cancelHintTimer()` +
`feedbackPopup.dismissImmediately()` are called on every ring
pointer-down, on `checkCurrentAlignment()`, and when a new round's intro
begins — so dragging a ring, clicking the crystal, or a round change all
immediately clear any visible or pending hint. The hint itself is the
smaller popup variant, Hebrew: title "הגביש ממתין", body "הגביש ממתין
לאישורכם. לחצו עליו כדי לבדוק את ההתאמה." (the story-like variant, as
preferred), shown for `HINT_POPUP_MS = 2100`ms and — critically — its
`onHidden` callback re-arms `scheduleHintTimer()` rather than looping
independently, so the repeat cadence stays driven by the same
schedule/cancel logic as the first hint. Verified live end-to-end
through the real state machine (not a manual override): confirmed the
full chain — round-intro confirmed → `ALIGNING_RINGS` → timer scheduled
→ (clock advanced via `game.step()`) → `showInactivityHint()` fires →
`feedbackPopup.show({kind:'hint', ...})` — all wired correctly with no
manual intervention beyond advancing the clock.

**Popup feedback wiring:** `enterCorrectFeedback()` /
`enterIncorrectFeedback()` / `enterDuplicateFeedback()` /
`completeCrystalCode()` all now show the popup with the task's exact
required Hebrew title/body pairs before proceeding — correct's flow is
staged sequentially (popup fully hides via `onHidden`, *then*
`beginDigitRevealSequence()` starts the glow/digit-reveal/slot-lock
animation) rather than run concurrently, since both would otherwise
occupy the same viewport-centered screen area at once.
`finishCorrectFeedback()` (the small in-panel per-round
`successMessage`, e.g. "מצוין! נפתחה הספרה הראשונה.") is unchanged — a
deliberately separate, later narrative beat, not replaced by the popup.

**Verification method note:** this session's live testing reconfirmed
the same environment quirk logged in earlier sprints, with one
refinement: the Browser pane tab is not a fully inert canvas needing
`game.step()` for everything — its own RAF loop does run, but
inconsistently (likely background-tab throttling), so timer/tween
completion measured against wall-clock `wait` calls was unreliable
(observed a `FeedbackPopup`'s alpha reading as both `1` and `0` across
two back-to-back queries with no explicit hide call between them).
Manually driving `game.step(t, delta)` remains the reliable way to
cross a specific delay deterministically; for a stable screenshot of a
transient (auto-hiding) popup, directly forcing its display objects'
alpha/visible/texture/text (bypassing the tween/timer entirely) proved
the most reliable technique and is how each of the four outcome
popups plus the hint variant were individually confirmed this session.

Files changed: `FeedbackPopup.ts` (new), `EquivalencePuzzle.ts`
(rewritten). `PinkCrystal.ts`, `RoundIntroPopup.ts`, `equivalenceData.ts`
untouched this sprint.

`npx tsc --noEmit` and `npm run build` both pass. Verified live: all
four result-popup kinds plus the hint variant screenshotted individually
with correct per-kind tint/pulse/sizing and correctly-wrapped text after
the two wrap-width fixes above; the hint-timer chain fired end-to-end
through the real state machine; the digit-centering and panel-title
fixes confirmed via screenshot during normal round-1-solved gameplay. A
temporary `window.__game` exposure added to `main.ts` for this
verification was reverted immediately after, confirmed via a final
`tsc`/`build` pass post-revert.

### Pink Room puzzle — bug fix: any valid equivalence group now accepted in any round (completed)

Reported bug: the mathematically-correct alignment 3/4 = 0.75 = 75%
(group C) was rejected as incorrect in round 2, but the exact same
alignment was accepted in the final round.

Root cause, confirmed by reading `checkCurrentAlignment()`: correctness
was checked against `this.rounds[this.currentRoundIndex]?.groupId` — a
fixed expected group hard-coded per round index (round 1 → group A,
round 2 → group B, round 3 → group C) — instead of accepting any
mathematically valid, not-yet-solved group. A second, related bug in the
same method further restricted matches to
`this.rounds.some((r) => r.groupId === inner)`, silently excluding group
D (1/5 = 0.2 = 20%) from ever being accepted at all, in any round.

**Fix — `EquivalencePuzzle.checkCurrentAlignment()` rewritten to the
requested order:** (a) read the selected fraction/decimal/percent ring
values — these were already stable group IDs, not visible text, so no
change needed there; (b) a match requires all three to agree on one
group ID (no filtering against a specific round's expected group); (c)
no match → incorrect; (d) match already in `solvedGroupIds` → duplicate;
(e) otherwise → accept, record the group ID in `solvedGroupIds`, and
`enterCorrectFeedback(groupId)` now takes the *actually-matched* group
ID as a parameter rather than reading a fixed one off the current round.

**Digit-by-progress, not by-group:** already worked this way structurally
(`beginDigitRevealSequence()` reads `this.rounds[this.currentRoundIndex].digit`,
and `currentRoundIndex` only ever advances by count of correct matches) —
confirmed unchanged: 1st new correct match → 7, 2nd → 3, 3rd → 5,
regardless of which of the four groups produced each one.

**`RoundDefinition.groupId` removed entirely** (`equivalenceData.ts`) —
it no longer maps to anything real once a round is a progress *slot*
rather than a fixed expected answer; `PUZZLE_ROUNDS` entries now carry
only `digit`/`introTitle`/`introBody`/`successMessage`. Three call sites
that read `round.groupId` for other purposes were updated to no longer
assume a fixed per-round group:
- `finishCorrectFeedback()`'s completion check: `this.rounds.every((r) =>
  solvedGroupIds.has(r.groupId))` → `solvedGroupIds.size >=
  rounds.length` (any three of the four groups completes the puzzle, not
  three specific ones).
- `rotateRingsToUnsolvedArrangement()`'s "don't reset onto an outright
  free win" reroll check: was comparing against the current round's
  fixed target group; now rerolls whenever the fresh random arrangement
  would land on *any* still-unsolved group (landing on an
  already-solved one is left alone — that's a harmless "duplicate", not
  a free win).
- `playFinalRingSettleAnimation()` / `setRingsToFinalRestPoseInstant()`
  (the small decorative ring-settle flourish after the last digit
  locks): previously read the fixed 3rd round's group; now use a new
  `lastSolvedGroupId` field, set whenever a correct match is accepted,
  so the decorative pose reflects whichever group was actually solved
  last. `restoreCompleted()` (re-entering an already-completed room, no
  live solve history to read) sets both `solvedGroupIds` and
  `lastSolvedGroupId` from the first three `EQUIVALENCE_GROUPS` entries
  as a stand-in, since which specific groups were solved isn't
  persisted — only the completion flag is (unchanged from before).

Files changed: `EquivalencePuzzle.ts`, `equivalenceData.ts`. No other
files touched.

`npx tsc --noEmit` and `npm run build` both pass. Verified live via
direct method calls on a running `PinkRoomScene` instance (temporary
`window.__game` exposure, reverted after): forced `currentRoundIndex =
1` (round 2) and aligned all three rings to group C (3/4 = 0.75 = 75%)
— `checkCurrentAlignment()` now correctly produces `state:
'CORRECT_FEEDBACK'` and adds `'C'` to `solvedGroupIds` (previously this
exact scenario, the bug report's own repro, produced
`INCORRECT_FEEDBACK`). Separately confirmed group D (1/5 = 0.2 = 20%,
previously never accepted in any round) is now also accepted as a valid
new match. Confirmed the completion condition is purely count-based by
directly testing `solvedGroupIds` sets of size 1/2/3 — a 3-element set
of `{A, C, D}` (deliberately skipping B) correctly evaluates as complete,
proving completion no longer depends on which three specific groups were
solved. A final `tsc`/`build` pass after reverting the debug hook
confirms the reverted state is still clean.

### Central Hall — hidden floor entrance to the new Libra Room (completed)

New narrative branch, entirely separate from the existing pot → lever →
statue → entrance sequence and never reachable through the Pink Room:
once the player holds `pinkCrystalShard` (set by `EquivalencePuzzle.ts`
on Pink Room completion), an ancient circular stone seal on the Central
Hall's floor lights up; clicking it opens to reveal a dark passage with
carved steps; clicking that passage transitions into a new
`LibraRoomScene`, which uses an already-existing background asset found
at `assets/images/LibraRoom/Background_Libra.png` (1536x1024, a painted
chamber centered on a giant crystal balance scale, with a lit archway +
stairway back to the hall on the right side of the frame) — not built
from scratch or procedurally.

**Placement (measured from `background.png`, then corrected once live):**
initial pick was (1300, 930) bg-px — clear of the pedestal/rings cluster
(762, 775) and the left-statue cluster, based on visual inspection of
the background art. Live-testing in the Browser pane's narrower preview
viewport showed this fell outside the visible cropped region at that
aspect ratio (cover-scale crops left/right on any viewport narrower than
the source's 1536:1024), so it was pulled in to **(1150, 930)**,
diameter 130bg-px — still ~470bg-px from the pedestal (well outside its
~200bg-px reserved radius) and clear of the doorway/statue x-bands via
depth (y) separation, but reachable across a wider range of viewport
shapes.

**`FloorEntrance.ts` (new):** a three-stage component (`dormant` →
`closed` → `open`), all-procedural textures (no seal/passage asset
exists anywhere under `assets/images/central-hall`) generated the same
way `Entrance.ts` draws its arch:
- **Dormant** (before the shard): rendered at alpha 1 with a
  deliberately low-contrast engraved-stone texture — concentric rings
  plus a central compass/star motif echoing the medallion already
  carved into the hall's own back wall — so it reads as part of the
  floor rather than an obvious hotspot. Not interactive.
- **`activate()`** (shard detected, not yet open): one-time fade-in of a
  separate pink ADD-blend glow sprite to a subtle idle alpha, then a
  slow breathing pulse (yoyo, repeat -1) — "subtle pink glow," not a
  beacon. Zone becomes interactive. Idempotent/no-op if called outside
  the dormant stage, so `CentralHallScene.create()` can call it
  unconditionally without an extra guard.
- **Click (closed → open):** locks input on the seal's *own* zone only
  (granular self-lock, matching `Handle.ts`'s convention, not a
  whole-scene lock — this is a same-scene cutscene beat, not yet a
  scene transition) while the seal rotates (55°) and shrinks/fades away
  (reads as sinking/spinning down) as a second "open" texture — a dark
  hole with a few carved stone-step arcs and a faint baked-in pink rim —
  scales/fades in underneath. Pure tweens, no masks, ~950ms, same
  "fake it with a believable 2D transform" approach as `Statue.ts`'s
  simulated turn. `onOpened` fires once the crossfade completes.
- **Click (open):** locks the zone, fires `onActivate` — `CentralHallScene`
  owns the camera transition and scene start from here, same
  separation of concerns as `Entrance.ts`/`onActivate`.
- **`restoreOpen()`:** instant jump to the open state (seal hidden, hole
  fully visible, glow at its open-state alpha, zone active) — no
  animation, for re-entering the hall after the seal was already opened
  on a previous visit.

**`CentralHallScene.ts` changes:** new `STATE_KEY_LIBRA_ENTRANCE_OPEN =
'libraFloorEntranceOpen'` local const, same registry pattern as the
existing `STATE_KEY_LEFT_STATUE_OPEN` — checked in `create()`,
independently of `STATE_KEY_LEFT_STATUE_OPEN`, before the first
`layout()`: if already open, `floorEntrance.restoreOpen()`; else if
`STATE_KEY_PINK_CRYSTAL_SHARD` (imported from `EquivalencePuzzle.ts`) is
set, `floorEntrance.activate()`; else the seal stays fully dormant. New
`enterLibraRoomFromFloor()` mirrors `enterThroughLeftDoor()`'s
lock-input/camera-transition/scene-start shape but simplified to a
single pan+zoom toward the seal's own screen position (no walk-through
phases — there's no frame to push off-screen, just a hole to descend
into) with the same never-fully-opaque threshold-crossing overlay
technique, reusing the scene's existing `overlay` object. Guarded by a
new `isEnteringLibra` flag alongside the existing shared `leavingHall`.
`floorEntrance.onOpened` sets the registry flag; `floorEntrance.destroy()`
added to the existing `SHUTDOWN` cleanup block alongside `statue.destroy()`.

**`LibraRoomScene.ts` (new):** loads the real `Background_Libra.png`
asset directly (no procedural backdrop needed, unlike
`HiddenPassageScene`'s first pass) with the same cover-scale
anchor-in-background-pixels convention as every other scene. The exit
back to the hall reuses `Doorway.ts` (invisible zone + hover glow over
the background's own painted archway+stairs, measured at (1360, 420)
bg-px) — same technique `PinkRoomScene.ts` already uses for its own
painted exit, rather than drawing a new doorway or reusing `Entrance.ts`.
Entry/return transitions (zoomed-and-darkened arrival settling to
normal framing; short zoom+fade-out on return) copy
`PinkRoomScene.ts`'s own entry/return pattern exactly. Registered in
`main.ts`.

Files changed: `main.ts` (registered `LibraRoomScene`),
`CentralHallScene.ts`. Files created: `FloorEntrance.ts`,
`LibraRoomScene.ts`. Not touched, per the task's explicit constraints:
`Statue.ts`, `Handle.ts`, `Pot.ts`, the existing `Entrance.ts`,
`PinkRoomScene.ts`, `EquivalencePuzzle.ts` — no connection from the Pink
Room, no changes to the right statue (which remains purely painted
background art), one registry (`this.registry`), no second state system.

`npx tsc --noEmit` and `npm run build` both pass. Verified live via a
temporary `window.__game` exposure (reverted after, confirmed clean by a
final `tsc`/`build` pass): the dormant seal renders low-contrast and
non-interactive with no shard in the registry; setting
`pinkCrystalShard` and calling `activate()` produces a visible pink glow
and makes the seal clickable; clicking it drives the real opening tween
to completion (confirmed via `tweenProgress: 1`) which correctly reveals
the dark hole + carved steps and sets `libraFloorEntranceOpen` in the
registry through the unmodified `onOpened` callback (not a test
shortcut); clicking the open passage correctly locks input, sets
`isEnteringLibra`/`leavingHall`, and starts the camera pan/zoom;
`LibraRoomScene` renders the real balance-scale background correctly;
its exit doorway's `onActivate` correctly locks input and begins the
fade-out back to `CentralHallScene`; and restarting `CentralHallScene`
with `libraFloorEntranceOpen` already set jumps straight to the fully-
open visual state (seal hidden, hole visible, zone interactive) with no
animation replayed, confirming the "preserve state, don't replay
activation" requirement end-to-end.

### Intro overlay — readability pass (completed)

Body text was hard to read and the entry button felt small. In
`IntroOverlay.ts` only: body font `18px→22px`; body `lineSpacing`
`18→6` (this one value governs the blank-line paragraph gaps in the
Hebrew copy, so tightening it actually shrank the total body block
despite the larger font — measured ~366px vs. an estimated ~488px
before); button `130×40px→190×56px` with label font `16px→22px` (the
button's hit-rectangle and drawing already derive from the same
`BUTTON_WIDTH`/`BUTTON_HEIGHT` constants, so both grew together with no
separate edit). Panel height is already computed dynamically from the
actual text/button extents, so it kept fitting without a manual resize.
Text content, colors, panel ornaments, torches, and RTL alignment are
all unchanged; no other scene or game-logic file was touched.

Verified via a temporary `window.__game` exposure (reverted after,
confirmed clean by a final `tsc`/`build` pass): at 1366×768 the panel is
~624px tall with ~72px clear top/bottom; re-checked at a tighter
1280×700/640 via direct `IntroOverlay.layout()` calls — still fits with
no clipping. `npx tsc --noEmit` and `npm run build` both pass.

### Pink Room puzzle — single intro popup, direct round flow (completed)

Replaced the equivalence puzzle's per-round intro popups with one
compact, general Hebrew explanation shown only once (before round 1);
rounds 2 and 3 now begin immediately after each correct answer, with no
popup in between.

`equivalenceData.ts`: removed `introTitle`/`introBody` from
`RoundDefinition`/`PUZZLE_ROUNDS`; added `PUZZLE_INTRO_TITLE`/
`PUZZLE_INTRO_BODY` (the one shared explanation; `ROUND_INTRO_BUTTON_LABEL`
unchanged). `EquivalencePuzzle.ts`: `beginPuzzle()` shows the general
popup once (renamed `showIntroPopup()`); `advanceToNextPuzzleRound()` —
run after every correct answer's feedback + digit reveal/flight/lock-in —
no longer opens a popup at all, going straight from rotating the rings to
a fresh unsolved arrangement into `state = 'ALIGNING_RINGS'` with
interaction re-enabled. Duplicate-detection, "any valid unsolved group is
accepted," completion, the pink-slot crystal reward, the code panel, and
exit unlocking are all untouched.

`RoundIntroPopup.ts` (shared with the Libra Room's own one-time
room-intro) gained a `variant: 'default' | 'compact'` constructor param —
`'default'` is byte-for-byte the original sizing (so `LibraPuzzle.ts`'s
existing call site is unaffected), `'compact'` (used only by
`EquivalencePuzzle.ts` now) is a smaller frame (560×560→420×300) with
smaller fonts/gaps and its own suffixed texture keys, so the two variants
never collide in the shared texture cache.

`npx tsc --noEmit` and `npm run build` both pass. Verified live via a
temporary `window.__game` exposure (reverted after, confirmed clean by a
final `tsc`/`build` pass): the compact popup renders the exact required
title/body/button text on the `-compact` texture with the button ~74px
clear of the frame's bottom edge; simulating a correct round-1 answer via
`advanceToNextPuzzleRound()` confirmed the state goes straight to
`ALIGNING_RINGS` with the popup staying closed and rings/crystal already
interactive for round 2.

### Libra Room — fixed 5-question sequence, exit attention glow (completed)

Replaced the Libra Room's random 10-question pool (3 correct needed, any
wrong question permanently skipped) with a fixed, ordered sequence of
exactly 5 order-of-operations questions (`5×4+3=23`, `2+1×0=2`,
`4÷2+1=3`, `5×5+5=30`, `(2+2)×10=40`), all 5 required. `LibraPuzzle.ts`:
`QUESTION_SEQUENCE` replaces `QUESTION_POOL`;
`REQUIRED_CORRECT_ANSWERS` is now derived from its length; the unused
`'missing'` question type is gone. A wrong answer now retries the same
question (`startNextQuestion()` always loads
`QUESTION_SEQUENCE[correctAnswerCount]`, which a wrong answer leaves
unchanged) instead of permanently skipping to a different one — the only
way the fixed sequence can be satisfied. The answer banner widened
(`BANNER_WIDTH_PX` 420→560, slot spacing 110→96) to fit 5 slots instead
of 3; the room-intro copy was updated to say "all 5" and describe the
retry behavior instead of "3 correct" / skip-on-wrong.

`Doorway.ts` (shared with the Pink Room's exit) gained an opt-in
`startAttentionPulse()`/`stopAttentionPulse()` pair: a clearly visible,
continuously breathing glow layered on top of the existing idle/hover
glow, stopped automatically the instant the doorway is clicked (wired
into the zone's own `POINTER_DOWN` handler, so no scene has to remember
to stop it). Off by default — the Pink Room's doorway never calls these,
so it's unaffected. `LibraRoomScene.ts` starts the pulse right after the
puzzle's `onCompleted` unlocks the exit, and also on the already-completed
restore path (re-entering the room later), so the doorway is both
unlocked and glowing immediately, with no animation replay. Room
background, `CrystalHolder`, the reward's red-slot destination, the
registry system, and the return transition are all unchanged.

`npx tsc --noEmit` and `npm run build` both pass. Verified live via a
temporary `window.__game` exposure (reverted after, confirmed clean by a
final `tsc`/`build` pass): question 1 loads as `5 × 4 + 3 = ?` with 5
banner slots; a simulated wrong answer reloads the same question with
`correctAnswerCount` unchanged; driving all 5 to completion reaches
`isCompleted: true`; the completion callback activates the exit and
starts the attention pulse in the same step; a simulated real click on
the doorway's zone stops the pulse; and a fresh scene start with the
completed registry flag already set shows the exit already active and
pulsing on load.

## Current State Summary (verified against source)

The entries above are the chronological sprint log. This section is a
standing summary of where each system actually stands right now — update
it (don't just append below it) whenever one of these systems changes.

### Central Hall

- Background, animated Heart of the Temple (crystal + 3 astrolabe rings),
  atmosphere (dust, sparkles, fire shadows, oculus light), and the Hebrew
  intro overlay are all complete and unchanged since their sprints above.
- **Entrance 1 (statue passage):** pot → hidden handle/lever → statue
  turns open → arched entrance reveals → two-phase walk-through camera
  transition → `PinkRoomScene`. State persisted via registry flag
  `leftStatueOpen`.
- **Entrance 2 (floor seal):** dormant until the player holds
  `pinkCrystalShard` (granted by the Pink Room puzzle) → seal glows and
  becomes clickable → click opens it to a dark stairwell → click again →
  pan/zoom transition → `LibraRoomScene`. State persisted via registry
  flag `libraFloorEntranceOpen`. Entirely separate from Entrance 1; not
  reachable from the Pink Room.
- Persistent `CrystalHolder` UI (see below) is mounted here too, so
  collected crystals stay visible while in the hall.

### Pink Room (`PinkRoomScene.ts`)

- Reached only via Entrance 1. Animated `PinkCrystal` centerpiece
  (breathing glow, sparkles, occasional glint).
- **Puzzle (`EquivalencePuzzle.ts`):** three rounds of a fraction/decimal/
  percent equivalence puzzle — drag three concentric rings to align the
  correct group under a fixed marker. A single compact Hebrew intro popup
  (`RoundIntroPopup.ts`, `'compact'` variant) shows once before round 1
  only, explaining all three rounds at once; rounds 2/3 begin immediately
  after each correct answer's feedback/digit sequence, with no popup in
  between. Validates on ring-check (no separate confirm step), reveals a
  digit that flies into a floating "crystal code" panel (735), and on
  completion plays a crystal activation sequence, sets
  `pinkCrystalShard`/`pinkRoomPuzzleComplete` in the registry, and flies
  the reward crystal into the `CrystalHolder`'s **pink** slot.
- **Exit:** the background's own painted archway (top-left), made
  interactive via `Doorway.ts`; unlocked only once the puzzle is
  complete. Return transition: short zoom + 400ms fade → `scene.start('CentralHallScene')`.

### Libra Room (`LibraRoomScene.ts`)

- Reached only via Entrance 2 (the hall's floor seal), never from the
  Pink Room. Uses the real `Background_Libra.png` art (a chamber centered
  on a giant crystal balance scale) — no procedural backdrop.
- **Puzzle (`LibraPuzzle.ts`):** a fixed, ordered sequence of exactly 5
  order-of-operations questions (`QUESTION_SEQUENCE`; all 5 required, no
  random draw) — the player drags stones onto the scale; each drop is
  validated immediately (no separate confirm click, unlike the Pink
  Room's ring-then-check flow). A wrong answer retries the *same*
  question rather than skipping to a different one. On completion, plays
  a reward sequence and flies a reward crystal into the `CrystalHolder`'s
  **red** slot, sets the room's `completed` state in the registry, and
  unlocks the exit.
- **Exit:** reuses the background's own painted archway + stairway (right
  side of frame) via `Doorway.ts`, same technique as the Pink Room. Once
  unlocked, the doorway also gets a clearly-visible animated "attention"
  glow (`Doorway.startAttentionPulse()` — opt-in, only used here, so the
  Pink Room's exit is unaffected) that stops the instant the player
  clicks it; re-entering the room after completion shows the doorway
  already unlocked and glowing, no animation replay. Return transition:
  zoom + fade → `scene.start('CentralHallScene')`.
- The **green** `CrystalHolder` slot is reserved but not yet wired to any
  room/puzzle — no third room exists yet.

### Room-entry and return flows (shared conventions)

- Every room entry arrives pre-zoomed with a dark screen-fixed overlay
  that settles to normal framing (500–800ms, `Sine.Out`); input is locked
  from the first line of `create()` until the settle finishes.
- Every return-to-hall exit is a short zoom/fade (~400ms) then
  `scene.start('CentralHallScene')`; `CentralHallScene.create()` always
  re-checks its registry flags (`leftStatueOpen`, `libraFloorEntranceOpen`,
  crystal collection state) and jumps straight to the correct persisted
  visual state rather than replaying any activation animation.
- **Scene-instance-reuse bug class (fixed):** Phaser reuses each Scene
  instance across `stop()`/`start()`, so every one-shot guard flag
  (`leavingHall`, `isEnteringRoom`, `isEnteringLibraRoom` in
  `CentralHallScene.ts`; `isReturning` in `PinkRoomScene.ts`/
  `LibraRoomScene.ts`) is explicitly reset to `false` at the top of
  `create()`. Related fix: `Doorway.ts`/`Entrance.ts`'s `setActive()` now
  only toggles `input.enabled` instead of re-calling
  `setInteractive()`/`disableInteractive()`, which previously could
  corrupt hit areas if called before `layout()`.

### Crystal collection system

- `GameState.ts` defines `CrystalId = 'pink' | 'red' | 'green'` and a
  `CrystalCollectionState`, backed by the shared Phaser registry
  (`getCrystalCollectionState`/`setCrystalCollected`).
- `CrystalHolder.ts` is a persistent, screen-fixed 3-slot UI (pink, red,
  green, left to right), mounted in `CentralHallScene`, `PinkRoomScene`,
  and `LibraRoomScene` alike, always re-synced from the registry on
  `create()`. Each puzzle's reward-crystal animation flies directly into
  its slot's real screen position (`getSlotScreenPosition()`) and calls
  `setCrystalCollected()` + `revealCollected()` (pop-scale reveal) on
  arrival — there is no separate fixed-corner reward icon anymore.

### Known interaction issues

- None currently open. The scene-instance-reuse class of bugs (doorways/
  entrances becoming permanently unclickable after one use) was found and
  fixed — see above.
- The green `CrystalHolder` slot has no puzzle wired to it yet (expected —
  no third room exists).

### GitHub repository and deployment

- Repo: `https://github.com/einav-gal/TempleOfNumbers` (branch `main`).
- Deployment: `.github/workflows/main.yml` builds (`npm run build`) and
  publishes `./dist` to GitHub Pages on every push to `main`
  (`actions/upload-pages-artifact` + `actions/deploy-pages`).
- `vite.config.ts` sets `base: '/TempleOfNumbers/'` so production asset/
  script paths resolve correctly under the Pages subpath (fixed after a
  black-screen incident caused by this config existing only as an
  uncommitted local change — now committed and pushed).
- **Live URL:** https://einav-gal.github.io/TempleOfNumbers/