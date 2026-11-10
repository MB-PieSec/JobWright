import { getSetting, setSetting } from "./store.js";

const DEBUG_MODE_KEY = "browser.debugMode";

/**
 * Debug mode shows the Chromium window during search and live apply runs.
 * It is off by default, so headless is the default for both the CLI and the
 * web server.
 */
export function getBrowserDebugMode(): boolean {
  return getSetting<boolean>(DEBUG_MODE_KEY) === true;
}

export function setBrowserDebugMode(enabled: boolean): void {
  setSetting(DEBUG_MODE_KEY, enabled);
}

/** Headless unless debug mode is explicitly enabled. */
export function isHeadless(): boolean {
  return !getBrowserDebugMode();
}
