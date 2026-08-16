import { JobPlatform, JobListing, JobPosting } from "../types.js";
import type { Page } from "puppeteer";
import { SELECTORS } from "./selectors.js";
import type { ApplyResult } from "../types.js";

class JobinjaAdapter implements JobPlatform{
  async search(page: Page, query: string): Promise<JobListing[]>{
    await page.goto(query, { waitUntil: "networkidle2", timeout: 0 });
    const jobs = await page.$$eval(
      SELECTORS.listing.jobItem,
      (items, selectors) => {
        return items.map(item => {
          const titleLink = item.querySelector<HTMLAnchorElement>(selectors.listing.titleLink);
          return {
            title: titleLink?.textContent?.trim() ?? null,
            url: titleLink?.href ?? null,
          };
        });
      },
      SELECTORS
    );
    return jobs.filter((job): job is JobListing => job.url !== null);
  };
  async getJobDetails(page: Page, url: string): Promise<JobPosting["details"]> {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

    return page.evaluate((selectors) => {
      const rawDesc = document.querySelector(selectors.detail.description)?.textContent ?? '';
      const description = rawDesc
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n') || null;

      const infoItems = Array.from(document.querySelectorAll(selectors.detail.infoItem)).map(li => {
        const label = li.querySelector(selectors.detail.infoItemLabel)?.textContent?.trim() ?? null;
        const value = Array.from(li.querySelectorAll(selectors.detail.infoItemTags))
          .map(s => s.textContent?.replace(/\s+/g, ' ').trim() ?? '')
          .join(', ');
        return { label, value };
      });

      return { description, infoItems };
    }, SELECTORS);
  }
  async apply(page: Page, url: string): Promise<ApplyResult> {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  
    const alreadyApplied = await page.$(SELECTORS.apply.appliedIndicator);
    if (alreadyApplied) {
      return { status: "alreadyApplied" };
    }
  
    const submitButton = await page.$(SELECTORS.apply.applySubmitButton);
    if (!submitButton) {
      return { status: "error", reason: "Apply form not found on page" };
    }
  
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 0 }),
      submitButton.click(),
    ]);
  
    // explicitly re-fetch the original job URL, rather than trusting
    // whatever page the click's redirect landed on
    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  
    const confirmed = await page.$(SELECTORS.apply.appliedIndicator);
    if (confirmed) {
      return { status: "success" };
    }
  
    return { status: "error", reason: "No confirmation appeared after submit" };
  }
}

export const jobinjaAdapter = new JobinjaAdapter();
