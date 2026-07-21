/**
 * The one shared font for the entire game — Bellefair (Google Fonts),
 * loaded globally in index.html. Bellefair ships a matched Hebrew
 * design alongside its Latin characters, so this same family covers
 * both RTL Hebrew UI text and LTR mathematical/Latin text; every text
 * object in the game should import this constant rather than hard-code
 * its own font-family string. Bellefair only ships a regular weight —
 * never pair this with `fontStyle: 'bold'` (no real bold face exists,
 * so the browser would synthesize a fake one, which can trigger
 * fallback-glyph rendering instead). Use size, stroke, shadow, or tint
 * for emphasis instead.
 */
export const FONT_FAMILY = '"Bellefair", serif';
