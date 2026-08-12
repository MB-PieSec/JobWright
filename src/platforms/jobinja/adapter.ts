import { JobPlatform, JobListing, JobPosting } from "../types.js";
import type { Page } from "puppeteer";
import { SELECTORS } from "./selectors.js";

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
}

export const jobinjaAdapter = new JobinjaAdapter();
