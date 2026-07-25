const GAME_ELEMENT_ID = 'game';

type FullscreenCapableElement = HTMLElement & {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function getGameElement(): FullscreenCapableElement | null {
  return document.getElementById(GAME_ELEMENT_ID) as FullscreenCapableElement | null;
}

/** Feature-detection only — never assume Fullscreen support (notably absent on iOS Safari for non-video elements). */
export function isFullscreenSupported(): boolean {
  const el = getGameElement();
  return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
}

export function isGameFullscreen(): boolean {
  return document.fullscreenElement != null;
}

/**
 * Best-effort fullscreen request on the #game element. Must be called
 * synchronously from within a real user-gesture handler (click/pointerdown)
 * — browsers reject (or throw) otherwise. Feature-detected and never
 * throws/rejects outward: if unsupported or denied, this is a silent
 * no-op and the game simply continues in its normal (non-fullscreen)
 * layout, exactly as if fullscreen had never been requested.
 */
export function requestGameFullscreen(): void {
  const el = getGameElement();
  if (!el) {
    return;
  }
  try {
    const result = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen?.();
    // Not every implementation returns a Promise (older webkit-prefixed
    // versions return undefined) — only chain .catch when one is given.
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {});
    }
  } catch {
    // Some browsers throw synchronously (e.g. denied by permissions
    // policy) rather than rejecting a promise — swallow either way.
  }
}

export function exitGameFullscreen(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

export function toggleGameFullscreen(): void {
  if (isGameFullscreen()) {
    exitGameFullscreen();
  } else {
    requestGameFullscreen();
  }
}
