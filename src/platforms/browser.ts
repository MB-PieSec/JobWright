import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Page } from "puppeteer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const puppeteerExtra = puppeteer as any;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from "fs/promises";

// Cookies are credentials, so they deliberately live outside src/ and are
// gitignored. Override the location with JOBWRIGHT_COOKIES_PATH if needed.
const DEFAULT_COOKIES_PATH = path.resolve(__dirname, "../../cookies.json");

async function loadCookies(
  page: Page,
  filePath = process.env.JOBWRIGHT_COOKIES_PATH
    ? path.resolve(process.cwd(), process.env.JOBWRIGHT_COOKIES_PATH)
    : DEFAULT_COOKIES_PATH,
) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const cookies = JSON.parse(data);
    await page.setCookie(...cookies);
    console.log("Cookies loaded successfully.");
  } catch {
    console.warn(
      `No cookies found at ${filePath}. Authenticated actions (live apply) will fail until you export your session there.`,
    );
  }
}

puppeteerExtra.use(StealthPlugin());

export async function launchBrowser() {
  // Read lazily so importing this module never opens the database as a side
  // effect (unit tests and the CLI both import it).
  const { isHeadless } = await import("../settings/browserMode.js");
  const headless = isHeadless();
  console.log(
    `Launching browser in ${headless ? "headless" : "debug (visible)"} mode.`,
  );

  const browser = await puppeteerExtra.launch({
    headless,
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--start-maximized",
      "--disable-web-security",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 600 });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  await loadCookies(page);
  return { browser, page };
}
