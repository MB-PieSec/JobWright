export type BrowserId = "brave" | "chrome" | "opera" | "firefox";

export type BrowserFamily = "chromium" | "firefox";

export interface BrowserProfile {
  /** Stable id within a browser, e.g. "Default" or "Profile 1". */
  id: string;
  name: string;
  /** Absolute path to the profile directory. */
  path: string;
  /** Absolute path to the Cookies / cookies.sqlite file. */
  cookiePath: string;
  isDefault: boolean;
}

export interface DetectedBrowser {
  id: BrowserId;
  name: string;
  family: BrowserFamily;
  installed: boolean;
  executablePath: string | null;
  /** False when cookie decryption is not implemented for this OS. */
  supported: boolean;
  profiles: BrowserProfile[];
  note?: string;
}

/** The subset of Puppeteer's CookieParam we can produce from browser stores. */
export interface ImportedCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface CookieImportResult {
  browserId: BrowserId;
  browserName: string;
  profilePath: string;
  cookieCount: number;
  skipped: number;
  domains: string[];
  writtenTo: string;
  importedAt: string;
}

export interface CookieSource {
  browserId: BrowserId;
  profilePath: string;
  /** Refresh cookies from this browser before each live apply run. */
  autoImport: boolean;
}
