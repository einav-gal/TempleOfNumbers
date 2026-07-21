# TempleOfNumbers – Game Design

## 1. Game Purpose

TempleOfNumbers is a digital educational escape room game designed for sixth-grade students.

The purpose of the game is to let students practice mathematical knowledge through interactive puzzles, exploration, decision-making, and problem-solving within a game-based environment.

The project is intended to become a focused, high-quality pilot rather than a large-scale full game.

---

## 2. Target Audience

* Sixth-grade students
* Single-player experience
* Designed for computer use
* Estimated playtime: 20–30 minutes
* Suitable for classroom activity or independent learning

---

## 3. Core Concept

The player enters an ancient temple called the Temple of Numbers.

At the center of the temple is a magical crystal that has lost its power.

To restore the crystal and open the exit, the player must solve a series of mathematical puzzles.

Each solved puzzle restores part of the crystal’s energy and moves the player closer to completing the game.

---

## 4. Game Structure

The game is built around one main location:

### Central Hall

The Central Hall serves as the main hub of the game.

It includes:

* Temple background
* Central crystal
* Rings surrounding the crystal
* Puzzle access points or interactive areas
* Visual progress indication

The player moves from the Central Hall to individual puzzles and returns after completing each one.

---

## 5. Core Game Loop

The basic gameplay loop is:

1. The player is in the Central Hall.
2. The player selects an area or puzzle.
3. A mathematical puzzle is presented.
4. The player attempts to solve it.
5. The game provides feedback.
6. If the answer is correct, progress is updated.
7. The player returns to the Central Hall.
8. The crystal or rings visually change.
9. After all required puzzles are completed, the exit opens.

---

## 6. Puzzle Design Principles

The puzzles should be:

* Appropriate for sixth-grade students
* Clear and concise
* Based on reasoning, not only calculation
* Varied in interaction style
* Understandable without long instructions
* Supported by immediate feedback
* Free from harsh penalties for mistakes

Each puzzle should focus on one main mathematical skill.

---

## 7. Mathematical Topics

The exact topics will be selected according to the pilot requirements.

Possible topics include:

* The four basic operations
* Order of operations
* Fractions
* Decimals
* Percentages
* Ratios
* Sequences and patterns
* Geometry
* Perimeter and area
* Quantitative reasoning

The pilot does not need to include all of these topics.

---

## 8. Player Progress

The player’s progress should be represented visually in the Central Hall.

Possible progress indicators include:

* A ring activating after a puzzle is solved
* A change in the crystal’s color
* Increased light intensity
* A short animation
* A newly unlocked area

For the pilot, only one clear progress mechanism should be used.

---

## 9. Player Feedback

### Correct Answer

* Positive visual feedback
* Short sound effect
* Brief animation
* Transition to the next step or back to the Central Hall

### Incorrect Answer

* Clear but non-punitive feedback
* Option to try again
* Hint, if hints are included
* No progress reset

---

## 10. Win Condition

The player wins after completing all required puzzles.

At the end of the game:

* The crystal becomes fully activated
* All rings reach their final state
* The temple exit opens
* A clear success message is displayed

---

## 11. Failure Condition

The pilot does not include a final failure state.

The player can:

* Try again
* Receive feedback
* Use hints, if implemented

The goal is learning and completion, not elimination.

---

## 12. User Interface

The interface should be simple and clear.

Possible interface elements include:

* Back button
* Confirm button
* Try again button
* Progress indicator
* Instruction area
* Mute button, if sound is added

No unnecessary interface elements should be added to the pilot.

---

## 13. User Experience Principles

* The player should understand what can be clicked.
* Every interaction should provide feedback.
* The player should never be left without direction.
* Text should be short and easy to read.
* Main actions should be visually clear.
* Puzzles should not require long technical explanations.
* Animations and effects should not create visual overload.

---

## 14. Game Style

The game combines:

* Ancient temple atmosphere
* Magic
* Mathematics
* Mystery
* Exploration
* Puzzle-solving

The experience should feel intriguing and pleasant, not frightening.

---

## 15. Pilot Scope

The pilot will include:

* One Central Hall
* One central crystal
* A ring system
* A limited number of puzzles
* One progress mechanism
* An ending sequence or final screen
* Basic feedback

The pilot will not include:

* User accounts
* Cloud saving
* Multiplayer
* Open-world exploration
* Character selection
* Complex achievement systems
* A large number of levels
* Features that were not explicitly requested

---

## 16. Development Principles

* Development is divided into small sprints.
* Each sprint adds only one capability.
* No unrequested features should be added.
* Every change should be testable.
* Working components should not be changed without a clear reason.
* Every sprint should be documented in `sprint-log.md`.
* `PROJECT_STATE.md` should be updated after significant changes.

---

## 17. Current Project Status

The project currently includes:

* Working development environment
* Phaser 3
* TypeScript
* Vite
* Central Hall
* Background asset
* Crystal asset
* Ring assets
* Claude Code configuration

---

## 18. Open Design Decisions

The following decisions are not yet final:

* Number of puzzles in the pilot
* Puzzle types
* Puzzle order
* Mathematical topics
* How puzzles are accessed from the Central Hall
* Exact progress mechanism
* Ending sequence
* Hint system
* Sound and music

These decisions will be made gradually in separate sprints.
