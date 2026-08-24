// Entry point for the dedicated mobile link (mobile/index.html). Sets the
// forced-mobile flag (see scaleMode.ts's isMobileDevice()) BEFORE the
// shared game bootstrap loads, then defers to it entirely — no separate
// game/scene code lives here, so nothing about actual gameplay is ever
// duplicated between this entry and the regular one (index.html).
//
// The import below is deliberately dynamic, not `import './main'` at the
// top: static imports are hoisted and always execute before any other
// top-level code in the importing module, which would run main.ts's own
// boot() call before the flag below is ever set.
(window as unknown as { FORCE_MOBILE?: boolean }).FORCE_MOBILE = true;
void import('./main');
