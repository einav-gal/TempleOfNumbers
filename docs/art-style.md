# TempleOfNumbers – Art Style Guide

## 1. Purpose

This document defines the visual language of TempleOfNumbers.

Its purpose is to keep all visual assets consistent across the game and to prevent unnecessary style changes during development.

The visual style should support the game’s main goals:

* Create a sense of mystery and discovery
* Make the environment feel magical but not frightening
* Keep the interface clear for sixth-grade students
* Maintain visual consistency across all scenes and assets
* Support a focused, high-quality pilot

---

## 2. Overall Visual Direction

TempleOfNumbers should feel like an ancient mathematical temple powered by hidden energy.

The visual world combines:

* Ancient stone architecture
* Magical light
* Geometric patterns
* Crystals
* Rotating rings
* Mathematical symbols
* Quiet mystery
* A clean educational game interface

The style should feel immersive and atmospheric, while remaining readable and easy to understand.

---

## 3. Mood

The intended mood is:

* Mysterious
* Magical
* Ancient
* Intelligent
* Calm
* Inviting
* Curious
* Slightly dramatic

The game should not feel:

* Dark or frightening
* Violent
* Chaotic
* Overly realistic
* Childish
* Cartoonish in an exaggerated way
* Visually overloaded

---

## 4. Visual Style

The preferred visual style is:

* Stylized digital illustration
* Semi-realistic environment design
* Soft cinematic lighting
* Clear object separation
* Clean silhouettes
* Moderate detail
* Slightly polished fantasy appearance

The game should avoid extreme realism.

Assets should look like they belong to the same illustrated fantasy world.

---

## 5. Color Palette

The main color palette should be based on:

* Dark stone gray
* Deep blue
* Teal
* Turquoise
* Soft cyan
* Warm gold
* Muted bronze
* Subtle violet accents

The main magical energy color should be cyan or turquoise.

Gold should be used mainly for:

* Ancient details
* Ring decoration
* Important symbols
* Progress highlights
* Activated mechanisms

Bright colors should be reserved for interactive feedback and magical effects.

---

## 6. Lighting

Lighting is an important part of the game’s atmosphere.

The environment should use:

* Soft ambient darkness
* Light coming from the crystal
* Subtle glow around magical objects
* Gentle highlights on metallic surfaces
* Controlled contrast
* Local light sources instead of full-screen brightness

The central crystal should be the strongest light source in the Central Hall.

Lighting should guide the player’s attention without making the scene difficult to read.

---

## 7. Environment Design

The temple environment should include:

* Ancient stone walls
* Geometric carvings
* Mathematical symbols
* Symmetrical architecture
* Arches or columns
* Circular mechanisms
* Hidden energy channels
* Subtle signs of age

The environment should feel old but still functional.

Damage and decay should be limited.

The temple should not look abandoned or destroyed.

---

## 8. Central Hall

The Central Hall is the visual center of the game.

It should feel:

* Important
* Symmetrical
* Spacious
* Magical
* Ancient
* Easy to understand

The main visual hierarchy should be:

1. Central crystal
2. Ring mechanism
3. Puzzle access points
4. Environmental details
5. Decorative background elements

The Central Hall should not contain unnecessary visual distractions.

---

## 9. Crystal Design

The crystal is the main focal point of the Central Hall.

It should:

* Be clearly visible
* Sit in the center of the composition
* Emit magical light
* Feel important
* Have a recognizable silhouette
* Show visual changes during game progress

The crystal should not be hidden by rings, effects, or interface elements.

Possible visual states:

* Inactive
* Partially active
* Fully active

The inactive state should still be visible, but less bright.

The fully active state should feel rewarding and powerful.

---

## 10. Ring Design

The rings represent the temple mechanism and player progress.

The rings should:

* Surround the crystal without covering it
* Use circular or elliptical forms
* Feel mechanical and magical
* Include subtle engraved details
* Remain visually readable
* Keep a clear distance from the crystal

The rings may include:

* Gold or bronze material
* Glowing symbols
* Small light points
* Energy lines
* Geometric markings

The rings should appear as separate assets when possible.

Each ring asset should have:

* Transparent background
* Clean edges
* No baked-in background
* Consistent lighting
* Correct perspective
* Clear central opening

The rings must not visually block the crystal.

---

## 11. Ring Placement

Ring placement must follow these rules:

* The crystal remains visible at all times.
* Each ring has a clear central opening.
* Rings should not overlap the crystal’s main body.
* Rings should be positioned at different angles.
* Ring spacing should remain consistent.
* The overall composition should feel balanced.
* Rings should rotate around the crystal, not through it.

The visual relationship between the crystal and rings is more important than exact physical realism.

---

## 12. Mathematical Visual Language

Mathematics should appear naturally within the world.

Possible visual elements include:

* Numbers
* Geometric shapes
* Fractions
* Number sequences
* Symmetry
* Coordinate-like markings
* Ancient mathematical symbols
* Grid patterns
* Circular diagrams

Mathematical symbols should feel integrated into the temple design.

They should not look like modern classroom worksheets placed inside the environment.

---

## 13. Puzzle Scene Style

Puzzle scenes should remain visually connected to the Central Hall.

They may use:

* Stone panels
* Magical tablets
* Floating symbols
* Circular mechanisms
* Energy lines
* Engraved number systems

Each puzzle should have one clear focal area.

The player should immediately understand where to look and where to interact.

Puzzle visuals should support the task rather than decorate it excessively.

---

## 14. User Interface Style

The user interface should be:

* Minimal
* Clear
* Easy to read
* Consistent
* Visually connected to the temple world

Suggested UI style:

* Dark translucent panels
* Thin gold or cyan borders
* Soft glow on active buttons
* Large readable text
* Simple icons
* Clear button states

The interface should not cover important game objects.

---

## 15. Typography

Typography should prioritize readability.

Recommended characteristics:

* Clean sans-serif font
* Medium or large text size
* Strong contrast
* Short lines
* Limited use of decorative fonts

Decorative fonts may be used only for:

* Titles
* Temple names
* Short headings

Instructions, feedback, and puzzle text should use a simple, readable font.

---

## 16. Buttons and Interactive Elements

Interactive elements should clearly show their state.

Required states:

* Default
* Hover
* Pressed
* Disabled
* Completed, when relevant

Interactive elements should use:

* Subtle glow
* Brightness change
* Scale change
* Border change
* Short animation

Clickable objects should never look identical to background decoration.

---

## 17. Feedback Effects

Visual feedback should be immediate and easy to understand.

### Positive Feedback

Possible effects:

* Cyan or gold glow
* Light pulse
* Small particle burst
* Ring activation
* Crystal brightness increase
* Short success animation

### Negative Feedback

Possible effects:

* Soft red or orange flash
* Small shake
* Brief dimming
* Clear text message

Negative feedback should not feel harsh or alarming.

---

## 18. Animation Style

Animations should be:

* Smooth
* Short
* Purposeful
* Easy to read
* Not distracting

Possible animations:

* Slow ring rotation
* Crystal glow pulse
* Symbol activation
* Light movement
* Door opening
* Small particle effects

Background animations should remain subtle.

Important animations should clearly communicate progress or interaction.

---

## 19. Asset Requirements

All visual assets should:

* Match the established art style
* Use consistent lighting
* Use consistent perspective
* Have clean edges
* Be exported at appropriate resolution
* Avoid unnecessary empty space
* Be named clearly
* Be stored in the correct asset folder

Assets requiring transparency should be exported as PNG files.

Background assets may use JPG, PNG, or WebP depending on quality and file size.

---

## 20. Asset Naming

Recommended naming style:

`category-description-state.ext`

Examples:

* `background-central-hall.webp`
* `crystal-inactive.png`
* `crystal-active.png`
* `ring-outer.png`
* `ring-middle.png`
* `ring-inner.png`
* `icon-back.png`
* `panel-puzzle.png`

File names should:

* Use lowercase letters
* Use hyphens
* Avoid spaces
* Avoid unclear names such as `final2.png`
* Describe the asset clearly

---

## 21. Composition Rules

Each scene should have:

* One clear focal point
* Clear visual hierarchy
* Enough empty space for interface elements
* Balanced object placement
* Good contrast between interactive and decorative objects

The player should understand the scene before reading instructions.

The main object should never be hidden by decorative elements.

---

## 22. Accessibility

The visual design should support accessibility.

Guidelines:

* Do not rely on color alone to communicate meaning.
* Use clear contrast between text and background.
* Keep text large enough to read.
* Avoid flashing effects.
* Avoid fast repeated animation.
* Use icons together with text when needed.
* Maintain clear button boundaries.
* Keep important information away from busy backgrounds.

---

## 23. Visual Consistency Rules

To maintain consistency:

* Do not mix unrelated visual styles.
* Do not introduce new colors without a clear reason.
* Do not change the crystal design between scenes.
* Do not change ring proportions without documenting the change.
* Do not use different button styles in different scenes.
* Do not add decorative elements that reduce clarity.
* Reuse existing visual components when possible.

---

## 24. Pilot Scope

For the pilot, the visual system should focus on:

* One polished Central Hall
* One clear crystal design
* One consistent ring system
* A small set of UI components
* A limited number of puzzle scenes
* Basic progress effects
* A clear ending state

The pilot does not require:

* Multiple temple environments
* Multiple art styles
* Character animation
* Large cinematic sequences
* Advanced particle systems
* Complex environmental effects
* A large asset library

---

## 25. Current Visual Assets

The project currently includes:

* Central Hall background
* Central crystal
* Ring assets

These assets should be treated as the current visual foundation.

They should not be replaced without a clear design or technical reason.

---

## 26. Open Visual Decisions

The following visual decisions are still open:

* Final ring placement
* Exact ring rotation speed
* Crystal activation states
* Final magical energy color
* Puzzle interface panel design
* Button design
* Progress feedback animation
* Final ending animation
* Sound and visual synchronization

These decisions should be made gradually and documented when finalized.

---

## 27. Development Rule

Visual changes must be implemented in small, testable steps.

Each visual sprint should change only one main capability or one clearly defined visual element.

No additional visual features should be added unless they are explicitly requested.
