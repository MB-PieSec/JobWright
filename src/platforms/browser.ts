import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Page } from "puppeteer";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const puppeteerExtra = puppeteer as any;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'fs/promises';
async function loadCookies(page: Page, filePath = path.resolve(__dirname, '../config/cookies.json')) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const cookies = JSON.parse(data);
    await page.setCookie(...cookies);
    console.log('Cookies loaded successfully.');
  } catch (error) {
    console.error('No cookies file found or error loading:', error);
  }
}

puppeteerExtra.use(StealthPlugin());

export async function launchBrowser(){
  const browser = await puppeteerExtra.launch({
    headless: true,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 600 });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await loadCookies(page);

  return { browser, page };
}
