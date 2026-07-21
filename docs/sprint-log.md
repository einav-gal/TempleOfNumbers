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