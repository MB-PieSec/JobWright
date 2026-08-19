import type { Page } from "puppeteer";

export interface JobListing {
  title: string | null;
  url: string;
}

export type ApplyResult =
  | { status: "success" }
  | { status: "alreadyApplied" }
  | { status: "error"; reason: string };


export interface JobPosting extends JobListing {
  details: {
    description: string | null;
    infoItems: {label: string | null, value: string}[]
  }
}

export interface JobPlatform{
  buildSearchQuery(keyword: string): string;
  search(page: Page, query: string, maxPages: number): Promise<JobListing[]>;
  getJobDetails(page: Page, url: string): Promise<JobPosting["details"]>
  apply(page: Page, url: string): Promise<ApplyResult>;
}
