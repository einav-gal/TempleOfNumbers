# TempleOfNumbers – Central Hall

## 1. Purpose

The Central Hall is the main hub of TempleOfNumbers.

It is the first major game scene and the location the player returns to after completing puzzles.

The hall must clearly communicate:

- Where the player is
- What the central objective is
- Which areas can be explored
- How much progress has been completed

---

## 2. Current Scene Status

The current Central Hall includes:

- A complete ancient temple background
- Two side doorways
- A raised circular platform
- A central blue crystal
- Multiple decorative ring assets
- Strong environmental lighting
- Architectural details and statues

The visual foundation is already strong and suitable for the intended game atmosphere.

---

## 3. Scene Composition

The composition is symmetrical.

Main visual elements:

1. Central crystal
2. Ring mechanism
3. Raised circular platform
4. Left and right doorways
5. Temple statues
6. Background wall symbol
7. Environmental lighting and torches

The player’s attention should first move toward the crystal, then toward the available puzzle entrances.

---

## 4. Central Crystal

The crystal is the main objective marker and the most important object in the scene.

Current characteristics:

- Bright blue appearance
- Strong magical glow
- Vertical shape
- Positioned in the center of the room
- Located above the central platform

The crystal should remain fully readable and visually dominant.

It must not be obscured by the surrounding ring assets.

---

## 5. Ring Mechanism

The Central Hall currently uses multiple ring assets around the crystal.

The rings are intended to represent:

- The temple’s magical mechanism
- Puzzle progress
- Restored energy
- The connection between completed challenges and the crystal

### Current Visual Problem

The rings currently overlap too much.

They cover a significant part of the crystal and compete with it for visual attention.

The front horizontal ring is especially dominant.

The vertical ring also intersects the crystal too closely.

As a result:

- The crystal silhouette is partially hidden
- The ring system appears visually crowded
- The object hierarchy is unclear
- The center of the scene feels heavier than intended

This is a composition issue, not only a technical placement issue.

---

## 6. Required Ring Placement

The rings should frame the crystal rather than cover it.

Required rules:

- The crystal must remain clearly visible.
- The main body of the crystal should not be crossed by thick ring sections.
- The rings should preserve a clear opening around the crystal.
- Each ring should have a distinct angle.
- Rings should not occupy the same visual plane.
- The front ring should be reduced in scale or moved lower.
- The vertical ring should be wider or positioned farther behind the crystal.
- Decorative ring details should not sit directly over the crystal’s center.
- Ring spacing should create depth rather than visual clutter.

The rings may overlap the outer glow of the crystal, but not its main silhouette.

---

## 7. Recommended Visual Hierarchy

The Central Hall should follow this hierarchy:

1. Crystal
2. Puzzle entrances
3. Ring mechanism
4. Platform
5. Architectural details
6. Decorative elements

The current scene gives too much visual weight to the rings.

The crystal should be restored as the dominant focal point.

---

## 8. Doorways

The left and right doorways are suitable as puzzle access points.

They should later communicate interaction through one clear method, such as:

- Glow
- Hover state
- Symbol activation
- Light pulse
- Cursor change

No doorway interaction should be added until the relevant sprint is defined.

---

## 9. Platform

The circular platform anchors the central mechanism.

It should visually support the crystal and ring system.

The platform currently works well as the scene’s structural base.

Possible future uses:

- Progress symbols
- Activated segments
- Light channels
- Final completion animation

These should not be implemented unless explicitly included in a future sprint.

---

## 10. Background

The background establishes:

- Ancient temple atmosphere
- Symmetry
- Depth
- Mystery
- Magical architecture

The background should remain unchanged unless there is a clear technical or design reason.

It already supports the desired visual direction.

---

## 11. Lighting

The scene currently uses:

- Warm torch lighting
- Cool blue crystal lighting
- Overhead ambient light
- Strong center contrast

This creates a successful warm-versus-cool lighting balance.

The crystal should remain the main magical light source.

The rings should not become brighter than the crystal.

---

## 12. Interaction Plan

The Central Hall will eventually support:

- Puzzle entrance selection
- Progress feedback
- Ring activation
- Crystal state changes
- Final completion state

These capabilities must be implemented separately.

Only one interaction capability should be added per sprint.

---

## 13. Progress Representation

The ring mechanism is the intended visual progress system.

A possible structure:

- One ring or ring state changes after each completed puzzle
- The crystal becomes brighter as progress increases
- The final state activates the entire mechanism

For the pilot, the number of ring states must match the number of required puzzle milestones.

The exact number of puzzles is still undecided.

---

## 14. Technical Scene Layers

Recommended visual layer order:

1. Background
2. Rear environmental effects
3. Rear ring elements
4. Crystal
5. Front ring elements
6. Foreground effects
7. Interactive UI

The ring system may need to be split between rear and front layers.

A single unsplit ring asset may prevent correct visual depth.

If a ring must appear both behind and in front of the crystal, it should be separated into two visual assets or rendered with masking.

---

## 15. Responsive Layout

The Central Hall should preserve its composition across supported screen sizes.

Required behavior:

- Keep the crystal centered
- Keep the platform aligned with the crystal
- Preserve ring proportions
- Avoid stretching assets
- Keep doorways visible
- Prevent cropping of essential interactive areas

The background may be cropped slightly, but the main central composition must remain intact.

---

## 16. Accessibility

The scene should not rely only on glow or color to indicate interaction.

Interactive doorways should also use:

- Clear cursor feedback
- Visible state change
- Optional label or icon
- Consistent interaction behavior

Important objects must remain visually distinct from decorative objects.

---

## 17. Current Approved Elements

The following elements are currently approved as the visual base:

- Temple background
- Central platform
- Blue crystal
- Ring asset set
- Left doorway
- Right doorway
- Overall temple atmosphere
- Warm and cool lighting combination

Approval of the assets does not mean the current ring placement is final.

---

## 18. Current Priority

The next Central Hall visual priority is:

**Arrange the existing ring assets so they frame the crystal without obscuring it.**

This task should not include:

- New puzzle logic
- Door interaction
- New UI
- Sound
- New assets
- Additional effects
- Crystal state logic
- Progress tracking

Only ring placement and visual hierarchy should be addressed.

---

## 19. Acceptance Criteria for Ring Placement

The ring placement task is complete when:

- The crystal is clearly visible.
- The crystal remains the main focal point.
- No thick ring segment crosses the central body of the crystal.
- The rings appear to surround the crystal.
- The ring angles are visually distinct.
- The rings do not appear stacked on the same plane.
- The composition feels balanced.
- No new features are added.
- The scene runs without errors.
- Existing working elements remain unchanged.

---

## 20. Open Decisions

The following decisions remain open:

- Final ring scale
- Final ring coordinates
- Final ring angles
- Whether rings require front and rear asset separation
- Whether masking is necessary
- Rotation direction
- Rotation speed
- Number of progress states
- Doorway puzzle mapping
- Crystal activation states

These decisions should be handled in separate, focused sprints.