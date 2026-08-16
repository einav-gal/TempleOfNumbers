# TempleOfNumbers – Sprint Log

This file documents completed and planned development sprints.

Each sprint must include one capability only.

Do not combine unrelated changes in the same sprint.

---

## Sprint 001 – Project Setup

### Status

Completed

### Goal

Create a working Phaser 3 project using TypeScript and Vite.

### Completed

- Development environment configured
- Phaser 3 installed
- TypeScript configured
- Vite configured
- Project runs in the browser
- VS Code used as the development environment
- Claude Code configured for development

### Result

The basic project environment is working.

---

## Sprint 002 – Central Hall Background

### Status

Completed

### Goal

Display the Central Hall background in the Phaser scene.

### Completed

- Central Hall scene created
- Temple background asset loaded
- Background displayed in the browser

### Result

The Central Hall environment is visible and working.

---

## Sprint 003 – Central Crystal

### Status

Completed

### Goal

Add the central crystal to the Central Hall.

### Completed

- Crystal asset loaded
- Crystal displayed in the center of the hall
- Crystal aligned with the central platform

### Result

The central crystal is visible and acts as the main focal object.

---

## Sprint 004 – Ring Assets

### Status

Completed

### Goal

Add the existing ring assets around the crystal.

### Completed

- Ring assets loaded
- Multiple rings displayed
- Rings positioned around the crystal

### Result

The ring mechanism is visible.

### Known Issue

The current ring placement is not visually correct.

The rings overlap too much and obscure the central crystal.

This issue will be handled in a separate sprint.

---

## Sprint 005 – Improve Ring Placement

### Status

Completed

### Outcome

The ring assets were split into rear/front PNG pairs (in
`assets/images/central-hall/Rings/`):

- `Ring_Back-vetical-rear.png` / `Ring_Back-vetical-front.png`
- `Ring_Middle--rear.png` / `Ring_Middle--front.png`
- `Ring-front--rear.png` / `Ring-front-front.png`

Each pair is placed with one identical transform (same position, uniform
scale, angle, origin 0.5/0.5). Rear arcs render behind the crystal
(depths 6–8), the crystal at depth 9, front arcs in front (depths 10–12),
so the rings wrap around the crystal instead of covering it. The flat
front ring sits around the crystal's lower third. The old full-ring
assets are no longer loaded. Verified in the browser: crystal readable
top to bottom, click popup still works, no console errors, TypeScript
clean.

### Goal

Arrange the existing ring assets so they frame the crystal without obscuring its main body.

### Scope

This sprint includes only:

- Ring position
- Ring scale
- Ring angle
- Ring depth order
- Visual spacing between rings and crystal

### Out of Scope

Do not add or change:

- Puzzle logic
- Doorway interaction
- New visual assets
- User interface
- Sound
- Music
- Progress tracking
- Crystal state logic
- New effects
- New animations
- Other scene elements

### Requirements

- The crystal must remain clearly visible.
- The crystal must remain the main focal point.
- Thick ring sections must not cross the crystal’s central body.
- The rings must appear to surround the crystal.
- Each ring must have a distinct visual angle.
- The rings must not appear stacked on the same plane.
- The composition must feel balanced.
- Existing ring assets must be reused.
- Existing working scene elements must remain unchanged.

### Technical Approach

Start with the smallest possible changes:

1. Adjust ring coordinates.
2. Adjust ring scale.
3. Adjust ring angles.
4. Adjust display depth.

Only consider splitting assets or using masks if these changes are insufficient.

### Acceptance Criteria

The sprint is complete when:

- The crystal silhouette is clearly readable.
- No dominant ring segment hides the crystal’s central body.
- The rings visually frame the crystal.
- The composition feels balanced.
- The scene runs without errors.
- No unrelated features are added.
- Existing working elements remain unchanged.

### Verification

After implementation:

- Run the project.
- Open the Central Hall.
- Check the composition at the intended browser size.
- Confirm that the crystal remains dominant.
- Confirm that no console errors appear.
- Capture an updated screenshot.
- Update `PROJECT_STATE.md`.
- Mark this sprint as completed.

---

## Sprint 006 – Left Doorway Interaction

### Status

Completed

### Goal

Add interaction to one doorway only: hover feedback, pointer cursor, click,
and a transition to a temporary placeholder puzzle scene.

### Completed

- New `Doorway` class (`src/game/Doorway.ts`): invisible hit zone anchored
  over the left doorway opening, soft warm hover glow, hand cursor.
- New `PuzzlePlaceholderScene` (`src/scenes/PuzzlePlaceholderScene.ts`):
  minimal placeholder scene with no puzzle logic, click to return to the
  hall.
- `CentralHallScene` wires the left doorway's click to a camera fade into
  the placeholder scene; the doorway disables itself after activation.
- Registered the new scene in `main.ts`.

### Out of Scope (respected)

- Full puzzle logic
- The right doorway (untouched)
- Scoring
- Progress system
- Sound

### Verification

- `npx tsc --noEmit` passes.
- Dev server serves `main.ts`, `CentralHallScene.ts`,
  `PuzzlePlaceholderScene.ts`, and `Doorway.ts` with no transform errors.
- Could not capture an in-session screenshot: the Browser pane's
  navigate/screenshot tools timed out, the same environment limitation
  recorded during the fire-shadow sprint. Visual confirmation in a real
  browser is still needed.

---

## Sprint 007 – Left Statue Sprite

### Status

Completed (pending real-browser visual confirmation)

### Goal

Place a separate transparent left-statue sprite over the painted statue in
the Central Hall background, static, no interaction.

### Completed

- New `Statue` class (`src/game/Statue.ts`): floor-contact-point anchor,
  same pattern as `Pot`/`Handle`, static image only.
- `CentralHallScene` preloads `assets/images/central-hall/statue/statue.png`,
  creates the statue at depth 2, and positions it each layout pass from a
  background-pixel anchor (`STATUE_CENTER_X` 482, `STATUE_BASE_Y` 705,
  height 457px).

### Out of Scope (respected)

- Pot/handle behavior, hidden-passage logic, puzzle scenes, crystal, rings,
  particles, fire shadows, intro overlay, right doorway — all unchanged.
- No animation, no background patching.

### Verification

- `npx tsc --noEmit` passes.
- Dev server confirmed serving `index.html`, `main.ts`,
  `CentralHallScene.ts`, `Statue.ts`, and `statue.png` (HTTP 200 each).
- Browser pane navigate/screenshot tools failed in this session (recurring
  environment limitation); alignment against the painted statue still
  needs confirmation in a real browser.

---

## Sprint — Intro Overlay Readability Pass

### Status

Completed

### Goal

Improve readability of the Hebrew introduction overlay's body text and
make the "כניסה למקדש" button noticeably larger, without touching text
content, colors, decorative elements, torches, panel design, or any other
scene/game logic.

### Completed (`src/game/IntroOverlay.ts` only)

- Body text font size: `18px` → `22px`.
- Body text `lineSpacing`: `18` → `6` — tightens the gaps between the
  paragraph blocks (the body copy uses blank `\n` lines as paragraph
  breaks, so this one value governs that spacing). Net effect: despite the
  larger font, the body block is shorter than before (measured ~366px vs.
  an estimated ~488px previously), leaving headroom for the larger button.
- Button size: `130×40` → `190×56`. Button label font size: `16px` →
  `22px`. The button's interactive hit-rectangle and all drawing already
  derive from the `BUTTON_WIDTH`/`BUTTON_HEIGHT` constants, so both grew
  automatically with no separate hit-area edit needed.
- Panel height is computed dynamically from actual text/button extents
  (unchanged formula), so no manual panel-size edit was needed for it to
  keep fitting.

### Out of Scope (respected)

- Text content, colors, panel frame/ornaments, torches, RTL alignment —
  all unchanged.
- No other scene or game-logic file touched.

### Verification

- `npx tsc --noEmit` and `npm run build` both pass.
- Measured the live overlay via a temporary `window.__game` exposure in
  `main.ts` (reverted immediately after, confirmed clean by a final
  `tsc`/`build` pass): at 1366×768 the panel is ~624px tall, comfortably
  inside the viewport with ~72px clear top and bottom; re-tested via
  `IntroOverlay.layout()` at a tighter 1280×700 (button bottom edge at
  y=628, panel top at y=8 in a 640-tall test) — still fits with no
  clipping, confirming the panel holds up on smaller laptop viewports too.

---

## Sprint — Pink Room Puzzle: Single Intro Popup + Direct Round Flow

### Status

Completed

### Goal

Replace the Pink Room equivalence puzzle's per-round intro popups with one
compact, general explanation shown only once (before round 1), and make
rounds 2/3 begin immediately after each correct answer with no popup in
between. No changes to rings, crystal, room, feedback popup, or code
panel.

### Completed

- **`equivalenceData.ts`:** removed the `introTitle`/`introBody` fields
  from `RoundDefinition` and from all three `PUZZLE_ROUNDS` entries
  (`successMessage`/`digit` unchanged). Added two new exported constants,
  `PUZZLE_INTRO_TITLE`/`PUZZLE_INTRO_BODY`, holding the one general
  Hebrew explanation (exact copy: title "חידת טבעות השוויון"; body
  explains the 3-question structure, the ring-alignment goal, and
  clicking the crystal to check). `ROUND_INTRO_BUTTON_LABEL` ("מתחילים")
  unchanged.
- **`EquivalencePuzzle.ts`:** `beginPuzzle()` now calls a renamed
  `showIntroPopup()` (was `showCurrentRoundIntro()`), which shows the one
  general explanation instead of per-round copy — called only once, at
  round 1. `advanceToNextPuzzleRound()` (the method that runs after every
  correct answer's feedback + digit reveal/flight/lock-in) no longer
  calls the intro popup at all: it rotates the rings to a fresh
  unsolved arrangement, sets the next code-panel slot active, then goes
  directly to `state = 'ALIGNING_RINGS'` and re-enables ring/crystal
  interaction — rounds 2 and 3 now begin the instant the rings finish
  resetting, with no popup in between. Duplicate-answer detection
  (`solvedGroupIds`) and "any valid, not-yet-solved group is accepted"
  (`checkCurrentAlignment()`) are both untouched. Completion, the crystal
  reward flight into `CrystalHolder`'s pink slot, the code panel, exit
  unlocking, and the `pinkRoomPuzzleComplete`/`pinkCrystalShard` registry
  flags are all unchanged (`completeCrystalCode()`/`revealRewardSymbol()`
  not touched).
- **`RoundIntroPopup.ts`:** this shared popup class is also used by the
  Libra Room's own one-time room-intro (`LibraPuzzle.ts`) — resizing it
  outright would have shrunk that popup too, outside this task's scope.
  Instead gave it a `variant: 'default' | 'compact'` constructor
  parameter (defaults to `'default'`, so `LibraPuzzle.ts`'s existing
  `new RoundIntroPopup(scene)` call is byte-for-byte unaffected — same
  size, same texture keys, same look). `EquivalencePuzzle.ts` now
  constructs its instance as `new RoundIntroPopup(scene, 'compact')`: a
  smaller frame (560×560 → 420×300), smaller title/body/button fonts, and
  tighter internal gaps. Each variant generates its own texture keys
  (suffixed `-default`/`-compact`) so the two sizes can never collide in
  the shared, game-wide texture cache.

### Out of Scope (respected)

- Rings, crystal, room background, `FeedbackPopup.ts` (correct/incorrect/
  duplicate/completed/hint feedback), and the crystal-code panel — none
  touched.
- `LibraPuzzle.ts` / Libra Room's own intro popup — unaffected (uses the
  unchanged `'default'` variant).

### Verification

- `npx tsc --noEmit` and `npm run build` both pass.
- Verified live via a temporary `window.__game` exposure in `main.ts`
  (reverted after, confirmed clean by a final `tsc`/`build` pass):
  started `PinkRoomScene`, called `puzzle.beginPuzzle()` directly and
  confirmed the popup shows the exact required title/body/button text
  using the `pink-puzzle-popup-frame-compact` texture (420×300, vs. the
  original 560×560), with the button sitting ~74px clear of the frame's
  bottom edge — no clipping. Then simulated a correct round-1 answer by
  calling `advanceToNextPuzzleRound()` directly and confirmed the state
  goes straight to `ALIGNING_RINGS` with the popup staying closed
  (`isOpen: false`) and both the ring-selection zone and the crystal's
  submit zone already interactive — i.e. round 2 begins with no popup.

---

## Sprint — Libra Room: Fixed 5-Question Sequence + Exit Attention Glow

### Status

Completed

### Goal

Replace the Libra Room's random question-pool puzzle with a fixed,
ordered sequence of exactly 5 order-of-operations questions (all 5
required), and add a clearly-visible animated glow to the exit doorway
once the room completes, so it's obvious the doorway must be clicked.

### Completed

- **`LibraPuzzle.ts` — question content:** `QUESTION_POOL` (10 questions,
  mixed order/missing-number types, randomly drawn, never repeated)
  replaced with `QUESTION_SEQUENCE` — exactly the 5 required
  order-of-operations questions in order (`5×4+3=23`, `2+1×0=2`,
  `4÷2+1=3`, `5×5+5=30`, `(2+2)×10=40`), each with 4 plausible drag-stone
  choices. `REQUIRED_CORRECT_ANSWERS` is now derived
  (`QUESTION_SEQUENCE.length`) instead of a separate literal. Removed the
  now-dead `'missing'` question type/`MISSING_INSTRUCTION` (no question
  uses it) and the `LibraQuestion.type` field entirely.
- **Round flow — retry instead of skip:** `usedQuestionIds`/
  `drawNextQuestion()` (random draw from unused questions, permanently
  skipping any question ever asked, right or wrong) are gone.
  `startNextQuestion()` now simply loads
  `QUESTION_SEQUENCE[this.correctAnswerCount]`. A correct answer still
  increments `correctAnswerCount` as before (so this naturally advances
  to the next question). A wrong answer (`finishIncorrectAnswer()`, now
  taking no parameter) leaves `correctAnswerCount` unchanged, so the same
  question reloads automatically — the fixed sequence can only be
  completed by answering every question correctly, in order, matching
  the requirement that all 5 must be completed. `handleIncorrectAnswer()`
  no longer takes a question parameter either, since nothing downstream
  needs the id anymore.
- **Answer banner widened for 5 slots:** `BANNER_WIDTH_PX` 420→560 and
  `BANNER_SLOT_SPACING_PX` 110→96 (same frame-gradient texture, just a
  larger canvas) — the slot count itself already came from
  `REQUIRED_CORRECT_ANSWERS`, so no other banner code changed.
- **Room-intro copy:** `ROOM_INTRO_BODY` updated from "3 תשובות נכונות...
  אם תטעו, תעברו לחידה אחרת" (3 correct answers, wrong answers move to a
  different question) to "כל 5 החידות... אם תטעו, תוכלו לנסות שוב את
  אותה חידה" (all 5 questions, wrong answers retry the same question) —
  matching the new fixed-sequence/retry behavior.
- **Exit doorway — attention glow (`Doorway.ts`, shared with Pink Room's
  exit):** added an opt-in `startAttentionPulse()`/`stopAttentionPulse()`
  pair — a clearly visible, continuously breathing glow (alpha
  0.35↔0.85, 900ms yoyo, same warm additive texture/tint as the existing
  idle/hover glow, just stronger and animated) layered on top of the
  existing idle/hover glow system without replacing it. Off by default,
  so `PinkRoomScene`'s doorway (which never calls these methods) is
  completely unaffected. The doorway's own `POINTER_DOWN` handler now
  calls `stopAttentionPulse()` (a no-op if never started) immediately
  before `onActivate()`, so clicking always stops the glow itself — no
  scene needs to remember to do it. `setHovered()` ignores hover while
  the attention pulse is active, so the two never fight over the same
  alpha tween.
- **`LibraRoomScene.ts` wiring:** `puzzle.onCompleted` now calls
  `this.exit?.startAttentionPulse()` right after `setActive(true)` — the
  glow starts the instant the completion sequence finishes. The
  already-completed restore branch (re-entering the room after finishing
  it previously) now also calls `this.exit.startAttentionPulse()`
  alongside the existing `setActive(true)`, so the doorway is already
  unlocked *and* glowing the moment the scene loads, with no animation
  replay — satisfying "on re-entry after completion, the doorway must
  already be unlocked and glowing." Hand cursor and the existing
  click-to-return-to-hall behavior are both untouched (`Doorway.ts`'s
  cursor/`onActivate` wiring wasn't touched).
- Room background, `CrystalHolder`, the reward crystal's destination
  (red slot), the `libraRoomState`/registry system, and the return
  transition to `CentralHallScene` are all untouched.

### Out of Scope (respected)

- `PinkRoomScene.ts` / `EquivalencePuzzle.ts` — untouched; `Doorway.ts`'s
  new methods are opt-in and never called there.
- Room background, crystal holder, reward destination, registry system,
  return transition — all unchanged.

### Verification

- `npx tsc --noEmit` and `npm run build` both pass.
- Verified live via a temporary `window.__game` exposure (reverted after,
  confirmed clean by a final `tsc`/`build` pass): started
  `LibraRoomScene`, confirmed question 1 loads as `5 × 4 + 3 = ?` with the
  expected choices/answer and 5 banner slots exist; called
  `finishIncorrectAnswer()` directly and confirmed the same question
  (`q1`) reloads with `correctAnswerCount` unchanged; drove all 5
  questions to completion and confirmed `isCompleted: true` with
  `correctAnswerCount: 5`; called the puzzle's `onCompleted` callback
  directly (simulating the reward/feedback sequence finishing) and
  confirmed the exit doorway became active *and* `attentionActive: true`
  in the same step; simulated a real click via the zone's own
  `pointerdown` event and confirmed `attentionActive` flips back to
  `false`; finally, restarted `LibraRoomScene` fresh (simulating
  re-entry) with the completed registry flag already set, and confirmed
  the exit was immediately active and pulsing with no animation delay.

---

## Sprint — Reset-Zoom Button Hardening + Click-Mapping Audit

### Status

Completed

### Goal

Harden the existing global "reset zoom" HTML button against a detailed
explicit checklist (fixed HTML element, survives zoom/pan/resize, shows
only on a real zoom/pan and hides again at rest, a full and correct
camera/gesture-state reset on click, no coupling to a specific scene, no
duplicate listeners across scene transitions), and re-audit click/hit-test
mapping after zoom and pan. No new zoom system; no puzzle-design changes.

### Completed

- **`src/game/MobilePinchZoom.ts`:**
  - `abortGesture()` now also explicitly zeroes `pinchPrevDistance` and
    `pinchPrevMidpoint` (previously left stale between gestures — harmless
    since `startPinch()` always recomputes them, but not explicit).
  - `reset()` now runs `resetCameraAndGestureState()` →
    `scene.scale.refresh()` → `resetCameraAndGestureState()` again, so the
    camera is guaranteed to be re-applied *after* the refresh rather than
    only before it (defensive — this project's FIT/ENVELOP scale modes
    never actually change `scene.scale.width/height` on a refresh, only
    the canvas's CSS display size, so today the extra call is a no-op,
    but it removes the reliance on that never changing).
  - `isZoomedOrPanned()` (fixed in the prior session, confirmed correct
    here) checks scroll drift from a cached default in addition to zoom,
    so a two-finger pan-only gesture also brings up the reset button.
- **`src/main.ts`:** the reset button's click handler now calls
  `event.preventDefault()`/`stopPropagation()` defensively before calling
  `MobilePinchZoom.getActive()?.reset()`.
- **Audit (no code change needed):** grepped the whole `src/` tree for
  `pointer.x`/`pointer.y` and for `clientX`/`clientY`/
  `getBoundingClientRect` — confirmed the only remaining hand-rolled
  screen-coordinate hit-testing was `EquivalencePuzzle.ts` (already fixed
  in a prior session to use `pointer.worldX`/`worldY`); every other
  interactive object uses Phaser's own camera-aware `setInteractive()`
  local-space hit-area system. Also confirmed all four scenes that create
  a `MobilePinchZoom` instance (`CentralHallScene`, `PinkRoomScene`,
  `LibraRoomScene`, `Room3Scene`) call `pinchZoom?.destroy()` in their
  `SHUTDOWN` handler, and that `MobilePinchZoom.getActive()`'s static
  registry (not a direct scene/camera reference held by `main.ts`) is
  already the "safe reference, no brittle coupling" pattern requested.

### Out of Scope (respected)

- No new pinch/zoom/pan system — the existing `MobilePinchZoom.ts` was
  hardened in place.
- No puzzle logic, object position, crystal-collection, or room-transition
  code touched.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- See `docs/PROJECT_STATE.md`'s matching sprint entry for the full
  requirement-by-requirement checklist this was verified against.

---

## Sprint — Crystal-Return Mechanism: Stage 1 Infrastructure

### Status

Completed

### Goal

Once all three crystals are collected and the player returns to the
Central Hall, add the infrastructure for a system that lets the player
drag/click each collected crystal back into a dedicated slot near the
Heart of the Temple: detection, display, slots, drag + click placement,
locking, persistence, and a temporary placeholder message. Explicitly not
the full ring-opening/ending sequence — that is a separate future stage.

### Completed

- **`src/game/GameState.ts`:** added a new registry-backed slice,
  `CrystalPlacementState` (`Record<CrystalId, boolean>`, same shape as the
  existing `CrystalCollectionState`) with `getCrystalPlacementState`/
  `setCrystalPlaced`/`areAllCrystalsPlaced`; also added
  `areAllCrystalsCollected` (a small missing helper over the *existing*
  collection state) and an exported canonical `CRYSTAL_IDS` order. No
  parallel/competing state system — everything is read/written through
  the same shared Phaser registry the rest of `GameState.ts` already uses.
- **New `src/game/CrystalPlacementMode.ts`:** the whole feature, split
  into the requested functions rather than one long routine —
  `createCrystalPlacementMode()` (top-level orchestrator, called from the
  public `create()`), `createCrystalSlots()`, `createCollectedCrystalsTray()`,
  `handleCrystalDrop()`, `placeCrystalInSlot()`, `returnCrystalToStart()`,
  `onCrystalPlaced()`, `onAllCrystalsPlaced()`, plus
  `selectCrystal()`/`deselectCrystal()`/`onSlotClicked()` for the
  click-based alternative to dragging.
  - One slot per crystal, generated by mapping over `CRYSTAL_IDS` (3
    today) rather than an assumed count — see `SLOT_ID_BY_CRYSTAL` for the
    fixed `pink → crystalSlot1` / `red → crystalSlot2` /
    `green → crystalSlot3` mapping (same left-to-right order
    `CrystalHolder.ts` already uses for its own pouch).
  - Dragging uses real Phaser Containers + `scene.input.setDraggable()`;
    `handleCrystalDrop()` accepts a drop only if the nearest slot within a
    generous catch radius is both the crystal's own correct slot and not
    already filled, otherwise tweens it back to its tray position.
  - Clicking a crystal then its correct empty slot places it the same way
    a drag would; a wrong slot is an explicit no-op.
  - A correct placement disables that crystal's own interactivity, plays
    a brief glow flash + scale-pop, saves progress via `setCrystalPlaced()`,
    and — once all three are placed — shows a temporary centered message
    ("כל הגבישים הוחזרו למקומם") via `onAllCrystalsPlaced()`. This never
    re-fires on a later visit where all three were already placed.
  - Both the tray and the slots are anchored in background-image-pixel
    space (same convention as every other Central Hall object — Pot,
    Handle, Statue, Doorway — never `scrollFactor(0)`), so dragging stays
    correct at any pinch-zoom/pan camera state via Phaser's own
    already-camera-aware drag system, with no hand-rolled coordinate math.
  - Both rows shift to a tighter, higher position in the mobile ENVELOP
    scale mode (same pattern `CrystalHolder.ts`/`Room3Scene.ts` already
    use), so they stay inside the visible band on short phone-landscape
    screens.
  - No dedicated slot/gem artwork exists yet — both are procedurally
    generated placeholders (a gentle dashed-diamond recess; a small
    faceted gem tinted per crystal, reusing `CrystalHolder.ts`'s own
    palette). Recommended for a future art pass: three carved-stone slot
    recesses matching the pedestal's material, and crystal icons matching
    each room's actual crystal asset rather than a neutral tinted gem.
- **`src/scenes/CentralHallScene.ts`:** one new field
  (`crystalPlacementMode`), constructed only when
  `areAllCrystalsCollected(this.registry)` is true (right after
  `crystalHolder.create()`), laid out via the scene's existing
  `toScreenX`/`toScreenY`/`backgroundScale`, and destroyed in the existing
  `SHUTDOWN` handler. No other hall object's behavior, position, or
  interactivity was touched.

### Out of Scope (respected)

- The full ring-opening/ending sequence once all crystals are placed —
  `onAllCrystalsPlaced()` only shows a temporary message.
- No changes to any other scene, puzzle, or existing Central Hall
  interaction (pot/lever/statue/entrance, floor seal, wall wheel, the
  crystal's own "dormant" popup, `CrystalHolder`'s pouch UI).

### Verification

- Traced all 9 requested scenarios against the implementation: missing
  crystal → nothing created (gated by `areAllCrystalsCollected`); all
  collected → tray + slots appear; correct drag/click → locks with
  feedback and saves state; wrong drop/slot → returns/no-ops; two
  crystals can't share a slot (fixed 1:1 mapping plus explicit
  `filled`/`placed` guards on both the drag and click paths, and
  `disableInteractive()` once placed); exit and return → placed crystals
  restore straight into their slots with no re-collected tray gem and no
  re-fired message; existing rooms/interactions untouched (only additive
  changes to `CentralHallScene.ts` and `GameState.ts`, one new file).
- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Crystal-Return Clarity Pass + Richer Glow + Debug Shortcut

### Status

Completed

### Goal

Feedback on the stage 1 infrastructure: it worked but gave the player no
idea what to do, and the slots/gems looked like flat placeholder icons.
Add a short instruction, clearly-shaped/positioned diamond slots with
proximity feedback, magical-feeling crystal glow (breathing, hover, drag,
lock states), a small "mechanism activated" ring nudge on a correct
placement, dim the now-redundant corner pouch, and add an isolated
`?debug=final` shortcut to reach this stage directly for testing. Still
not the full ring-opening/ending sequence — unchanged scope from before.

### Completed

- **`src/game/CrystalPlacementMode.ts`** (rewritten in place — same public
  `create()`/`layout()`/`destroy()` contract and underlying drag/click/
  persistence logic as the previous stage):
  - Added a guidance line above the slots ("גררו כל גביש אל השקע המתאים
    במנגנון").
  - Slots repositioned from a plain row to pink-left/red-top/green-right
    around the Heart of the Temple's mechanism, with separate FIT/ENVELOP
    offset tables (same `isEnvelopScaleMode()` pattern used elsewhere) so
    nothing is cropped on short phone-landscape screens.
  - Slots redrawn to read as engraved/sunken into metal, sized a bit
    bigger than the gems, and now visibly glowing even at rest (not just
    once targeted) — legible before any drag starts.
  - New four-state slot glow (`rest → targeted → near → filled`): a
    crystal's own matching slot highlights the instant its drag starts and
    intensifies further once within the catch radius; `layout()`
    re-applies whichever state is current instead of a flat default, so a
    resize mid-interaction stays correct.
  - Each tray crystal gained its own dedicated, non-interactive glow layer
    (added behind the gem, never covering its detail or its hit area)
    with a distinct two-tone tint (pink-violet, red-orange,
    green-turquoise) and: a continuous slow "breathing" idle animation
    (staggered per crystal), a hover boost (scale up + `pointer` cursor),
    a stronger drag boost plus a few soft trailing sparkle particles (one
    shared, reusable emitter), and a brief flash-then-steady glow once
    locked. A single function recombines the breathing value with
    whichever interaction boost currently applies and writes the result
    once, so nothing fights over the same animated property.
- **`src/game/HeartOfTheTemple.ts`:** new `playActivationNudge()` — a
  small, self-decaying extra rotation added to the middle ring only, on
  top of (never replacing) its existing per-frame oscillation math.
- **`src/game/CrystalHolder.ts`:** new `setDimmed(dimmed)` — just an alpha
  change (the pouch was never actually clickable).
- **`src/scenes/CentralHallScene.ts`:** wires
  `crystalPlacementMode.onCrystalPlaced = () => this.heart?.playActivationNudge()`
  and calls `crystalHolder.setDimmed(true)` once `CrystalPlacementMode` is
  constructed, so the corner pouch and the new bottom tray never both show
  the same crystals at full strength.
- **Debug shortcut:** `src/game/GameState.ts` gained
  `isDebugFinalStageRequested`/`isDebugResetRequested`/`isDebugModeActive`/
  `applyDebugFinalStage`/`clearDebugState` — all built on the SAME setters
  a real playthrough already uses, never a parallel state. `src/main.ts`
  reads the `?debug=final`/`?debug=reset` query param synchronously right
  after constructing the `Phaser.Game` (safely before any scene's
  `create()`, since Phaser's own scene boot is asynchronous) and toggles a
  new, low-key, pointer-events-none `#debug-stage-tag` element
  (`index.html`) reading "DEBUG: FINAL STAGE". `applyDebugFinalStage()`
  marks the intro seen and all rooms/crystals as done but deliberately
  never calls `setCrystalPlaced()`, so the drag-into-slot stage itself
  stays testable. No scene-selection change was needed — the game already
  boots into `CentralHallScene` (the first entry in `main.ts`'s scene
  array) regardless.

### Out of Scope (respected)

- Still no full ring-opening/ending sequence.
- No changes to any other scene, puzzle, or existing Central Hall
  interaction.
- `?debug=reset`/`?debug=final` only ever touch the registry via the same
  shared setters — never a second state system, and never applied unless
  the URL explicitly asks for it.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- See `docs/PROJECT_STATE.md`'s matching sprint entry, and its "Debug
  mode" entry in the Current State Summary, for the exact `?debug=final`/
  `?debug=reset` URLs.

---

## Sprint — Heart of the Temple: Real Ring-Opening Mechanism

### Status

Completed

### Goal

The previous "activation nudge" was only ever a small rotation, never a
real transition from "rings caged around the crystal" to "rings open,
center clear, crystal exposed." Build the real thing: each ring is a
genuinely separate object that moves/rotates/scales to its own open
position, not a single shared rotation or a fade.

### Pre-implementation findings (reported before writing code)

- 3 separate logical rings exist (`ringBack`/`ringMiddle`/`ringFront`),
  each a rear+front PNG pair — 6 total `Phaser.GameObjects.Image`
  instances.
- All 6 are already separate sprite assets under
  `assets/images/central-hall/Rings/`, never baked into the hall
  background — each pair already fully independently positionable/
  rotatable/scalable via the existing code.
- No new art was required for a real opening — only new code, since each
  ring pair can already be moved as one cohesive unit to any position.

### Completed

- **`src/game/HeartOfTheTemple.ts`** (major rewrite):
  - Generalized the 3 rings into a `RingRuntime[]` array, each with its
    own layout config (including a NEW open-state target position/angle/
    scale), oscillation config, current angle, and `openProgress` (0 =
    caged, 1 = fully open).
  - New `caged -> opening -> open` state machine. `caged` behaves exactly
    as before (idle sway, crystal opens the existing "dormant" popup).
  - Each ring is tied to one crystal (matching `CrystalPlacementMode`'s
    own left/top/right slot layout): the vertical ring -> red (rises/
    recedes back), the ring that opens right -> green, the ring that
    opens left -> pink.
  - `playActivationNudge(crystalId)` nudges only that one ring, then
    checks `GameState.areAllCrystalsPlaced()` itself (the same shared
    state, no separate counter) — if true, automatically starts the full
    `opening` sequence: shake (each ring jitters back to its exact
    starting angle) -> align (all three rotate to a shared flat angle) ->
    each ring — staggered, pink then green then red — tweens its OWN
    position/angle/scale out to its own open target -> the crystal's blue
    glow settles into a stronger sustained pulse. The crystal is not
    interactive during this phase.
  - `layout()` now re-derives every ring's position from its CURRENT
    `openProgress`/`angleDeg` (not a fixed closed layout), so a resize at
    any point in the sequence (or after) stays correct.
  - New `isOpen()` / `restoreOpen()` (jump straight to the open end state,
    no replay — for a returning visit where the mechanism was already
    opened, the same pattern as `Statue.restoreOpen()`).
- **`src/scenes/CentralHallScene.ts`:** passes `crystalId` through to
  `heart.playActivationNudge()`; calls `heart.restoreOpen()` right after
  `heart.create()` if `areAllCrystalsPlaced()` (before the first
  `layout()`); the crystal's click handler now branches on
  `heart.isOpen()` — the existing English "dormant" popup while caged
  (untouched), a new `openFinalStagePopup()` (same shell, its own Hebrew
  message) once open. The real ending/next-stage sequence is intentionally
  NOT built here.
- **`src/game/CrystalPlacementMode.ts`:** removed the now-redundant "all
  placed" toast — the real ring-opening sequence (triggered from the same
  hook) is now that feedback.

### Out of Scope (respected)

- The actual game-ending/next-stage content once the mechanism is open —
  `openFinalStagePopup()` is a placeholder confirming the click works.
- No new art/assets — all 6 ring sprites already existed and were already
  independently transformable.
- No other scene, puzzle, or unrelated Central Hall interaction touched.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- Traced the full state machine: caged (idle sway + old popup) ->
  per-crystal nudge on the correct ring only -> automatic opening once
  `areAllCrystalsPlaced()` (shake -> align -> staggered per-ring open ->
  glow settle) -> crystal re-enabled + new popup on click; and the restore
  path (`restoreOpen()`) for a returning visit with the mechanism already
  open, with no replay.

---

## Sprint — Ring-Opening Finale: Falling Ring + Crystal Explosion

### Status

Completed

### Goal

Two adjustments to the just-built ring-opening sequence, based on seeing
it: the middle/green ring should drop straight down (not slide out
sideways like the other two), and the finale should end with the crystal
itself shattering into a burst of particles across the whole screen,
rather than just settling into a steady glow.

### Completed

- **`src/game/HeartOfTheTemple.ts`:**
  - `RING_MIDDLE_LAYOUT`'s open target changed from "opens right" to a
    straight drop (`openOffsetYBg: 420`, a large tumbling rotation), using
    a new per-ring `openEase` field (`Bounce.Out` for this ring only, vs.
    `Cubic.Out` for the other two) and a longer duration so the bounce
    reads clearly — `playOpenOutward()` now reads `ring.layout.openEase`
    per ring instead of one hardcoded ease for all three.
  - New finale: `finishOpening()` now does a brief glow build-up, then
    calls `playCrystalExplosion()` — the crystal vanishes (quick scale/
    alpha collapse) while ~90 procedural shard particles (a small dedicated
    jagged-chip texture, not copies of the crystal's own image) burst
    outward fast/far enough to spread across the whole viewport. The
    crystal is never re-enabled afterward — there is nothing left to
    click.
  - `restoreOpen()` (the "returning visit, already finished" path) updated
    to match: rings already spread AND the crystal already hidden, no
    build-up/explosion replay.

### Out of Scope (respected)

- No change to the shake/align phases or to the pink/red rings' own open
  behavior.
- The real ending/next-stage content after the explosion — still not
  built (unchanged from the previous sprint).

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- Known limitation flagged in `docs/PROJECT_STATE.md` rather than fixed:
  the falling ring's drop distance is tuned for desktop/tablet framing and
  may fall past the visible band on the cropped mobile ENVELOP scale mode
  — a one-time finale animation, not treated as blocking for this pass.

---

## Sprint — Per-Ring Immediate Fall (Not Wait-for-All-Three)

### Status

Completed

### Goal

Feedback on the previous sprint: rings shouldn't wait for the last crystal
to all fall together — each ring should fall on its own, immediately,
the moment ITS crystal is placed. Also reassign which ring falls which
direction: green -> the ring that falls left, pink -> the ring that falls
right (and, by extension, red -> the ring that falls straight down).

### Completed

- **`src/game/HeartOfTheTemple.ts`:**
  - Reassigned ring/crystal/direction pairing per this task: green -> left
    fall, pink -> right fall, red -> straight-down fall. All three now use
    `Bounce.Out` easing (previously only the one "falling" ring did) and a
    longer, bounce-friendly duration.
  - Replaced the old "small nudge now, big shared sequence once all three
    are placed" design with a genuinely per-ring, immediate sequence:
    `playActivationNudge(crystalId)` now triggers that ONE ring's own full
    shake -> align -> fall (`playSingleRingOpen()`/`playRingShake()`/
    `playRingAlign()`/`playRingFall()`) right away, independent of the
    other two. Removed the now-obsolete small-nudge concept
    (`ACTIVATION_NUDGE_DEG`/`nudgeDeg`/`nudgeTween`) entirely, since every
    placement now triggers a full fall rather than a brief reaction.
  - New `RingRuntime.hasOpened` flag: once a ring has individually fallen,
    `update()` permanently excludes it from the idle sway from then on,
    independent of the other two rings (which keep swaying until their
    own crystal is placed) — the previous coarse `mechanismState !==
    'caged'` check on the whole batch no longer fits a per-ring design.
  - The LAST crystal's own ring-fall (checked fresh via
    `GameState.areAllCrystalsPlaced()` the moment it starts, exactly as
    before) is chained into the existing finale (glow build-up -> crystal
    explosion) once THAT ring lands — the other two rings, already fallen
    earlier in the session, are untouched by this chain.
  - `restoreOpen()` updated to mark every ring's `hasOpened = true` too
    (previously only `openProgress`/`angleDeg` were restored), since
    `update()`'s skip logic now keys off that flag specifically.

### Out of Scope (respected)

- No change to the shake/align phase shapes themselves, the explosion
  finale, or the real ending/next-stage content.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- Traced: placing crystal 1 -> only its ring falls (others keep swaying);
  placing crystal 2 -> only its ring falls; placing crystal 3 -> its ring
  falls, and once IT lands, the glow build-up and crystal explosion follow
  automatically; `restoreOpen()` still jumps straight to "all three
  fallen, crystal gone" with no replay.

---

## Sprint — Bigger Explosion + Automatic "You Escaped" Message

### Status

Completed

### Goal

Two refinements to the finale: the crystal's shatter should be a much
bigger, more dramatic burst of glowing shards ("thousands," significantly
more than before), and it should be followed automatically by a "you
escaped the temple" message — not gated behind a click on the (now gone)
crystal.

### Completed

- **`src/game/HeartOfTheTemple.ts`:**
  - `EXPLOSION_PARTICLE_COUNT` raised from 90 to 1000; speed/lifespan
    widened to match, so the burst genuinely spreads across the whole
    screen rather than reading as a small local sparkle. Still a single
    one-shot event (`emitter.explode()`), not continuous.
  - New public `onMechanismShattered` callback, fired automatically (via
    a short delayed call, `MECHANISM_SHATTERED_MESSAGE_DELAY_MS`) a beat
    after the explosion starts — long enough that the burst itself reads
    first, short enough that the message doesn't feel disconnected from
    it. Never fires from `restoreOpen()`'s "already resolved" path, so a
    returning visit doesn't replay it.
- **`src/scenes/CentralHallScene.ts`:**
  - `FINAL_STAGE_POPUP_TEXT` changed to the actual "you won" message:
    "הצלחתם לצאת מהמקדש!".
  - `heart.onMechanismShattered` wired to `openFinalStagePopup()` — the
    message is now automatic, not click-triggered.
  - Simplified `heart.onCrystalClick` back to always `openPopup()` (the
    existing "dormant" popup) — the previous `isOpen()` branch was dead
    code in practice, since the crystal is already invisible/disabled by
    the time `isOpen()` would ever be true.

### Out of Scope (respected)

- No dedicated ending scene, credits, or restart flow — the message is
  the full extent of "the ending" for now, as before.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Rings Disappear After Landing

### Status

Completed

### Goal

Resolve the known mobile limitation flagged earlier (a falling ring's
drop distance is tuned for desktop framing and could exit the visible
band on the cropped mobile ENVELOP scale mode) — per direct feedback:
rings can simply disappear once they've landed, so it no longer matters
exactly where that landing spot is.

### Completed

- **`src/game/HeartOfTheTemple.ts`:** `playRingFall()`'s `onComplete` now
  also calls a new `fadeRingAway(ring)` — a short delay, then both layers
  fade to alpha 0 and `setVisible(false)`. Fired in parallel with the
  existing `onComplete` callback (never blocking the last ring's own
  chain into the crystal explosion on the fade finishing).
- `restoreOpen()` updated to match: a returning visit's rings start
  already faded/hidden, not just positioned at their open spot.

### Out of Scope (respected)

- No change to the fall motion/direction/easing themselves, or to the
  explosion/message finale.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Retire the Left Doorway and Its Placeholder Exercise

### Status

Completed

### Goal

Dim/remove the light at the Central Hall's left entrance, make it
non-clickable, and remove the exercise behind it — the original
left-doorway hotspot from Sprint 6 (leading to `PuzzlePlaceholderScene`'s
single order-of-operations question), unrelated to Entrance 1 (the
statue/lever passage into the Pink Room).

### Completed

- **`src/scenes/CentralHallScene.ts`:** removed the `Doorway` instance for
  this spot entirely (field, `LEFT_DOORWAY_*`/`DOORWAY_FADE_OUT_MS`
  constants, every `setActive()`/`layout()` call site across `create()`,
  `restoreCentralHallInteractions()`, `openPopup()`,
  `openFinalStagePopup()`, and the popup-close restore path,
  `enterLeftDoorway()`, and the `isEnteringPuzzlePlaceholder` guard flag)
  — since the glow is entirely driven by the object's own active/hovered
  state, removing the object outright means no glow and no hit zone, with
  no separate "dim but alive" state needed.
  - Renamed `closeLeftExerciseAndRestoreInput()` →
    `closePopupAndRestoreInput()`, since it already closes both the
    dormant-crystal popup and the "you won" popup — the old name would
    have been misleading now that the left exercise is gone.
- **`src/main.ts`:** unregistered `PuzzlePlaceholderScene`.
- **Deleted `src/scenes/PuzzlePlaceholderScene.ts`** outright (confirmed
  unreferenced elsewhere first) — no remaining purpose once every real
  room existed, matching this project's own precedent of deleting whole
  superseded scene files rather than leaving dead code on disk.

### Out of Scope (respected)

- Entrance 1 (statue/lever/Pink Room passage), the shared `Doorway` class
  itself (still used by Pink Room/Libra Room/Room 3 exits), and every
  other Central Hall interaction — untouched.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- Grepped the whole `src/` tree for `leftDoorway`/`LEFT_DOORWAY`/
  `PuzzlePlaceholderScene` — zero remaining references outside the
  deleted file itself.

---

## Sprint — Wall Wheel Falls to the Floor (Not Sideways)

### Status

Completed

### Goal

Change the wall-wheel opening animation (Room 3's entrance, Entrance 3):
instead of swinging sideways along an arced hinge path, the disc should
fall straight down to the floor when clicked — matching the "falling"
language just established for the Heart of the Temple's rings.

### Completed

- **`src/game/WallWheel.ts`:**
  - Removed the sideways shift/arc-dip entirely (`OPEN_SHIFT_X_BG`,
    `OPEN_ARC_DIP_BG`) — the wheel now only ever moves straight down
    (`OPEN_SHIFT_Y_BG` raised to 520bg-px, toward the floor), tumbling
    (`OPEN_ROTATION_DEG` raised to 220°) and shrinking slightly, with
    `Bounce.Out` easing so it visibly lands rather than decelerating to a
    stop.
  - `beginSwingOpen()` (a custom progress-tween combining position/angle/
    scale to produce the old arc) replaced with `beginFallOpen()` —
    simpler now, since a straight fall needs no custom arc math and can
    tween the wheel's real `y`/`angle`/`scaleX`/`scaleY` properties
    directly.
  - New `fadeWheelAway()`: once landed, the wheel (and its trailing
    shadow) fade out and disappear — avoids the fallen disc sitting in
    view over whatever hall elements are beneath the wall mount, and
    mirrors how the Heart of the Temple's rings disappear after falling.
  - `restoreOpen()` updated to match: a returning visit's wheel starts
    already faded/hidden, not positioned at the old sideways-open spot.
  - The revealed passage opening itself is unaffected — it was always
    anchored at the wheel's original position, independent of wherever
    the wheel itself moves.

### Out of Scope (respected)

- No change to the shake phase, the passage reveal/glow, dust burst, or
  Room 3 itself.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Removed Room 3's "Back to Main Hall" Text Hint

### Status

Completed

### Goal

Remove the "חזרה לאולם הראשי" text label above Room 3's stairwell exit.

### Completed

- **`src/scenes/Room3Scene.ts`:** removed `EXIT_HINT_TEXT`/
  `EXIT_HINT_GAP_BG`/`EXIT_HINT_FONT_PX`/`EXIT_HINT_DEPTH`, the
  `exitHintText` field, its creation in `create()`, and its repositioning
  in `layout()`. Removed the now-unused `createRtlText` import. The exit
  doorway itself (`Doorway.ts` — hover glow, hand cursor, click-to-return)
  is completely unchanged.

### Out of Scope (respected)

- The doorway/exit mechanism itself, the puzzle, the crystal, and
  everything else in Room 3 — untouched.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Hint Button for the Hall's Three Hidden Discovery Targets

### Status

Completed

### Goal

Add a hint system for the Central Hall's three hidden interactive
entrances (pot/lever/statue passage, floor seal, wall wheel), landed on
after a design discussion: an opt-in button showing atmospheric guiding
QUESTIONS (two escalating tiers per target), not literal instructions —
and deliberately NOT math-related (math stays inside each room's own
puzzle; an earlier attempt at a math-flavored hint for the pot was
rejected as feeling disconnected/fabricated).

### Completed

- **`src/game/GameState.ts`:** promoted `leftStatueOpen`/
  `isFloorEntranceOpen`/`wallWheelOpen` from `CentralHallScene.ts`-local
  consts to proper exported getters/setters
  (`isLeftStatuePassageOpen`/`setLeftStatuePassageOpen`, etc. — same key
  strings, no behavior change), so the new hint system can read them
  without duplicating raw registry key strings in a second file.
- **`src/scenes/CentralHallScene.ts`:** updated to use the new GameState
  functions instead of its own inline `registry.get`/`.set` calls for
  those three flags.
- **New `src/game/HintSystem.ts`:** a small screen-fixed "רמז" button
  (bottom-left), hidden whenever nothing is pending. Three hint
  definitions (pot, floor tile, wheel), each with an `isAvailable`/
  `isDiscovered` check against the shared registry and two Hebrew guiding
  questions. Clicking the button cycles through pending targets, showing
  tier 1 the first time a target comes up, tier 2 (a more specific
  question) the next time. Self-contained: its own small dismiss-on-click
  popup (not reusing `CentralHallScene`'s crystal-popup machinery), a
  visibility poll (1s) so the button hides itself live as targets are
  discovered, and the same "shared debounce timestamp between open and a
  global dismiss-listener" pattern `CentralHallScene`'s own popup already
  uses, so the same click that opens a hint can never also instantly
  close it.
- Instantiated only in `CentralHallScene.ts` — the three targets are all
  physically there; no other scene needs it.

### Out of Scope (respected)

- The subtle visual-cue idea discussed earlier — not built this pass,
  purely the opt-in question/hint button.
- No math content in these hints — math stays inside each room's own
  puzzle.
- No other scene, puzzle, or unrelated Central Hall interaction touched.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.

---

## Sprint — Pink Room Mobile Fixes: Upright Ring Labels + Code Panel Crop

### Status

Completed

### Goal

Fix two issues reported from real-device testing (a mobile screenshot of
the Pink Room's equivalence puzzle): (1) the ring value labels
(fractions/decimals/percents) appeared sideways/upside-down as their ring
rotated, and (2) the floating "crystal code" panel above the rings was
cropped at the top, its title not visible.

### Completed

- **`src/game/EquivalencePuzzle.ts` — upright ring labels:** each ring's 4
  value-label `Text` objects are children of that ring's own rotating
  `Container` (for radial positioning), so they were inheriting the
  container's full rotation. Added a `labels` array to `RingRuntime`, and
  two helpers — `setRingAngle()` (sets the container's angle and
  counter-rotates the labels to match) and `syncRingLabelRotation()` (for
  tweens that animate `ring.container.angle`/`ring.angle` directly, via
  their own `onUpdate`). Replaced every one of the 8 call sites that
  previously set a ring's angle directly: `layout()`, live drag
  (`onPointerMove`), snap-to-position (both `onUpdate`/`onComplete`),
  incorrect-answer shake, duplicate-answer vibration, the next-round
  random reroll, the final-settle flourish tween, and the instant
  restore-on-reentry pose. Labels now always read upright in world space,
  regardless of the ring's own spin.
- **`src/game/EquivalencePuzzle.ts` — code panel top-crop fix:** the
  panel's plain top edge sits at bg-px Y~132 relative to the crystal
  center — inside the roughly-190bg-px band that ENVELOP scale mode (short
  phone-landscape screens, see `scaleMode.ts`) crops off the top/bottom of
  the shared 1536×1024 space, matching the screenshot. Added
  `ENVELOP_PANEL_SCALE` (0.55) and `ENVELOP_PANEL_CENTER_OFFSET_Y_BG`
  (-310); `layout()` now checks `isEnvelopScaleMode()` and, only in that
  mode, renders the panel (and its glow) smaller and lower — clearing the
  crop line with a buffer while keeping a small gap above the marker's own
  top edge. Purely visual (the panel has no interactive geometry of its
  own); the rings/marker's real scale and hit-testing math, and the
  desktop/tablet FIT-mode layout, are completely unaffected.

### Verification

- `npm run build` (`tsc && vite build`) passes with no errors.
- Reasoned through the exact bg-px numbers (crystal center, marker offset,
  panel height/offset, ENVELOP's ~190bg-px crop) to confirm the fix
  clears the crop line with margin; not yet re-verified on the reporter's
  own physical device.