// src/platforms/jobvision/adapter.ts

import type { Page } from 'puppeteer';
import type { JobPlatform, JobListing, JobPosting, ApplyResult } from '../types.js';
import { SELECTORS, parseTotalResultCount } from './selectors.js';

const BASE_URL = 'https://jobvision.ir';

export class JobvisionAdapter implements JobPlatform {
  buildSearchQuery(keyword: string): string {
    return `${BASE_URL}/jobs/keyword/${encodeURIComponent(keyword)}`;
  }

  private async scrapeJobItems(page: Page): Promise<JobListing[]> {
    const jobs = await page.$$eval(
      SELECTORS.search.jobItem,
      (items, selectors) => {
        return items.map((item) => {
          const titleEl = item.querySelector(selectors.search.titleLink);
          const href = item.getAttribute('href');
          return {
            title: titleEl?.textContent?.trim() ?? null,
            url: href ? new URL(href, window.location.origin).href : null,
          };
        });
      },
      SELECTORS
    );
    return jobs.filter((job): job is JobListing => job.url !== null);
  }

  async search(page: Page, query: string, maxPages: number): Promise<JobListing[]> {
    await page.goto(`${query}?page=1`, { waitUntil: 'networkidle2', timeout: 0 });

    const allJobs = await this.scrapeJobItems(page);

    const countText = await page
      .$eval(SELECTORS.search.totalResultCount, (el) => el.textContent ?? '')
      .catch(() => null);

    const totalCount = countText ? parseTotalResultCount(countText) : null;

    if (totalCount === null) {
      console.warn('Could not determine total result count — scraping page 1 only.');
      return allJobs;
    }

    const perPage = allJobs.length;
    const totalPages = perPage > 0 ? Math.ceil(totalCount / perPage) : 1;
    const pagesToFetch = Math.min(totalPages, maxPages);

    if (totalPages > pagesToFetch) {
      console.log(
        `Found ${totalCount} jobs across ~${totalPages} pages. Scraping first ${pagesToFetch} page${pagesToFetch === 1 ? '' : 's'} (~${pagesToFetch * perPage} jobs) — pass --max-pages to scrape more.`
      );
    }

    for (let pageNum = 2; pageNum <= pagesToFetch; pageNum++) {
      await page.goto(`${query}?page=${pageNum}`, { waitUntil: 'networkidle2', timeout: 0 });
      const pageJobs = await this.scrapeJobItems(page);
      allJobs.push(...pageJobs);
    }

    return allJobs;
  }

    async getJobDetails(page: Page, url: string): Promise<JobPosting['details']> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

    const description = await page
        .$eval(SELECTORS.detail.description, (el) => el.textContent?.trim() ?? null)
        .catch(() => null);

    const location = await page
        .$eval(SELECTORS.detail.location, (el) => el.textContent?.trim() ?? null)
        .catch(() => null);

    const featureTags = await page
        .$$eval(SELECTORS.detail.featureTags, (els) => els.map((el) => el.textContent?.trim() ?? ''))
        .catch(() => [] as string[]);

    const infoItems = await page.$$eval(
        SELECTORS.detail.requirementTitle,
        (titleEls, valueSelector) => {
        return titleEls.map((titleEl) => {
            const valueEl = titleEl.parentElement?.parentElement?.querySelector(valueSelector);
            return {
            label: titleEl.textContent?.trim() ?? '',
            value: valueEl?.textContent?.trim() ?? '',
            };
        });
        },
        SELECTORS.detail.requirementValue
    );

    if (location) {
        infoItems.push({ label: 'موقعیت مکانی', value: location });
    }

    // Jobinja carries remote status inside نوع همکاری's value as a substring
    // ("تمام وقت, دورکاری"). Jobvision has no equivalent single field — remote
    // status is one of possibly several standalone .feature-tag chips instead.
    // Folding it into a نوع همکاری-labeled entry keeps meetsLocationRequirement's
    // substring check ("دورکاری") working unchanged across both platforms.
    const cooperationType = featureTags.join(', ');
    if (cooperationType) {
        infoItems.push({ label: 'نوع همکاری', value: cooperationType });
    }

    return { description, infoItems };
    }

  async apply(page: Page, url: string): Promise<ApplyResult> {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

    const submitButton = await page.$(SELECTORS.apply.submitButton);
    if (submitButton === null) {
      return { status: 'alreadyApplied' };
    }

    await page.click(SELECTORS.apply.submitButton);

    try {
      await page.waitForSelector(SELECTORS.apply.submitButton, { hidden: true, timeout: 10000 });
      return { status: 'success' };
    } catch {
      return { status: 'error', reason: 'Timed out waiting for submit confirmation' };
    }
  }
}

export const jobvisionAdapter = new JobvisionAdapter();