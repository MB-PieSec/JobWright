import type { Page } from "puppeteer";

export interface JobListing {
  title: string | null;
  url: string;
}

export interface JobPosting extends JobListing {
  details: {
    description: string | null;
    infoItems: {label: string | null, value: string}[]
  }
}

export interface JobPlatform{
  search(page: Page, query: string): Promise<JobListing[]>;
  getJobDetails(page: Page, url: string): Promise<JobPosting["details"]>
}
