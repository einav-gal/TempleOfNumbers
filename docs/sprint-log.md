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