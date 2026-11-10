import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "fa";

export type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

const STORAGE_KEY = "jobwright-lang";

/**
 * Persian strings keyed by their English source text. Keeping the English
 * string as the key means components stay readable, and any string that has
 * not been translated yet falls back to English instead of showing a raw key.
 */
const FA_TRANSLATIONS: Record<string, string> = {
  // Shell / navigation
  Overview: "نمای کلی",
  "Stats, charts and recent activity": "آمار، نمودارها و فعالیت اخیر",
  Jobs: "مشاغل",
  "Browse the scraped job database": "مرور پایگاه داده مشاغل",
  Runs: "اجراها",
  "Search and apply to jobs": "جستجو و درخواست برای مشاغل",
  Resume: "رزومه",
  "Upload and inspect your profile": "بارگذاری و بررسی پروفایل",
  "AI providers": "ارائه‌دهندگان هوش مصنوعی",
  "Keys, models and connection tests": "کلیدها، مدل‌ها و آزمون اتصال",
  Settings: "تنظیمات",
  "Cookies and browser import": "کوکی‌ها و ورود از مرورگر",
  "Local job assistant": "دستیار شغلی محلی",
  "Running locally · data never leaves this machine":
    "اجرای محلی · داده‌ها هرگز از این دستگاه خارج نمی‌شوند",
  "Main navigation": "ناوبری اصلی",
  Primary: "اصلی",
  "Open navigation": "باز کردن ناوبری",
  "Close navigation": "بستن ناوبری",
  "Switch to light mode": "تغییر به حالت روشن",
  "Switch to dark mode": "تغییر به حالت تاریک",
  "Switch to Persian": "تغییر به فارسی",
  "Switch to English": "تغییر به انگلیسی",
  Language: "زبان",

  // Common
  Retry: "تلاش دوباره",
  Refresh: "به‌روزرسانی",
  Remove: "حذف",
  Show: "نمایش",
  Hide: "پنهان",
  Cancel: "انصراف",
  Clear: "پاک کردن",
  "Clear all": "پاک کردن همه",
  "Working…": "در حال انجام…",
  "Loading…": "در حال بارگذاری…",
  "Dismiss notification": "بستن اعلان",
  "Something went wrong.": "مشکلی پیش آمد.",

  // Overview
  "A snapshot of your job search, scoring and applications.":
    "نمایی از جستجوی شغلی، امتیازدهی و درخواست‌های شما.",
  "Last database update": "آخرین به‌روزرسانی پایگاه داده",
  "Could not load stats": "بارگذاری آمار ممکن نشد",
  "Total jobs": "کل مشاغل",
  Applied: "درخواست‌داده‌شده",
  "Average score": "میانگین امتیاز",
  "Completed runs": "اجراهای تکمیل‌شده",
  "{count} run recorded": "{count} اجرا ثبت شده",
  "{count} runs recorded": "{count} اجرا ثبت شده",
  "{percent}% of all jobs": "{percent}٪ از کل مشاغل",
  "{count} job scored": "{count} شغل امتیازدهی شده",
  "{count} jobs scored": "{count} شغل امتیازدهی شده",
  "{failed} failed · {cancelled} stopped · {running} running":
    "{failed} ناموفق · {cancelled} متوقف · {running} در حال اجرا",
  "Status breakdown": "تفکیک وضعیت",
  "Where every job currently sits": "وضعیت فعلی هر شغل",
  Activity: "فعالیت",
  "Jobs seen and applied over the last 14 days":
    "مشاغل مشاهده‌شده و درخواست‌شده در ۱۴ روز گذشته",
  seen: "مشاهده",
  applied: "درخواست",
  "Score distribution": "توزیع امتیاز",
  "Scored jobs grouped into ten-point buckets":
    "مشاغل امتیازدهی‌شده در بازه‌های ده‌امتیازی",
  avg: "میانگین",
  "Platform split": "تفکیک پلتفرم",
  "Where the listings came from": "منبع آگهی‌ها",
  "Job status breakdown: {summary}": "تفکیک وضعیت مشاغل: {summary}",
  "Activity over the last 14 days: {seen} jobs seen and {applied} applied.":
    "فعالیت در ۱۴ روز گذشته: {seen} شغل مشاهده و {applied} درخواست.",
  "Job count by score bucket.": "تعداد مشاغل بر اساس بازه امتیاز.",
  "Platform split: Jobinja {jobinja}, Jobvision {jobvision}.":
    "تفکیک پلتفرم: جابینجا {jobinja}، جاب‌ویژن {jobvision}.",
  "Recent runs": "اجراهای اخیر",
  "The latest searches and apply passes": "آخرین جستجوها و درخواست‌ها",
  "View runs": "مشاهده اجراها",
  "No runs yet.": "هنوز اجرایی وجود ندارد.",
  "No runs yet": "هنوز اجرایی وجود ندارد",
  "Start a search": "شروع جستجو",
  "Start a search above to populate the database.":
    "برای پر کردن پایگاه داده، از بالا یک جستجو شروع کنید.",
  jobs: "شغل",
  "Below threshold": "کمتر از حد آستانه",
  "Already applied": "قبلاً درخواست شده",
  Unprocessed: "پردازش‌نشده",
  Expired: "منقضی",
  Error: "خطا",
  Search: "جستجو",
  Apply: "درخواست",
  Seen: "مشاهده‌شده",

  // Jobs
  "Loading the job database…": "در حال بارگذاری پایگاه داده مشاغل…",
  "{count} job in the database": "{count} شغل در پایگاه داده",
  "{count} jobs in the database": "{count} شغل در پایگاه داده",
  "Wipe all jobs": "پاک کردن همه مشاغل",
  "Could not load jobs": "بارگذاری مشاغل ممکن نشد",
  "No jobs yet": "هنوز شغلی وجود ندارد",
  "The database is empty. Start a search from the Runs page, or run the CLI to populate it.":
    "پایگاه داده خالی است. از صفحه اجراها جستجو را شروع کنید یا CLI را برای پر کردن آن اجرا کنید.",
  "Go to Runs": "رفتن به اجراها",
  "No jobs match these filters": "هیچ شغلی با این فیلترها مطابقت ندارد",
  "Try widening your search or clearing the filters.":
    "جستجو را گسترده‌تر کنید یا فیلترها را پاک کنید.",
  "Clear filters": "پاک کردن فیلترها",
  "Wipe all jobs?": "همه مشاغل پاک شوند؟",
  "Delete this job?": "این شغل حذف شود؟",
  "This permanently deletes every job in the database and resets IDs. This cannot be undone.":
    "این کار همه مشاغل پایگاه داده را برای همیشه حذف کرده و شناسه‌ها را بازنشانی می‌کند. قابل بازگشت نیست.",
  "Remove {title} from the database? This cannot be undone.":
    "{title} از پایگاه داده حذف شود؟ این کار قابل بازگشت نیست.",
  "Delete job": "حذف شغل",
  "Deleted {count} job.": "{count} شغل حذف شد.",
  "Deleted {count} jobs.": "{count} شغل حذف شد.",
  "Job deleted.": "شغل حذف شد.",
  "Scraped jobs": "مشاغل جمع‌آوری‌شده",
  Title: "عنوان",
  Platform: "پلتفرم",
  Status: "وضعیت",
  Score: "امتیاز",
  "First seen": "اولین مشاهده",
  Updated: "به‌روزرسانی",
  "First seen {date}": "اولین مشاهده {date}",
  "Untitled job": "شغل بدون عنوان",
  "Close details": "بستن جزئیات",
  "Open posting": "باز کردن آگهی",
  "LLM reasoning": "استدلال مدل زبانی",
  "No reasoning recorded.": "استدلالی ثبت نشده است.",
  "No description available": "توضیحی موجود نیست",
  "No score": "بدون امتیاز",
  "Score {score} of 100": "امتیاز {score} از ۱۰۰",

  // Filters
  Filters: "فیلترها",
  "Search title or URL": "جستجوی عنوان یا نشانی",
  "Search jobs": "جستجوی مشاغل",
  "Filter by platform": "فیلتر بر اساس پلتفرم",
  "Min score": "حداقل امتیاز",
  "Max score": "حداکثر امتیاز",
  "Minimum score": "حداقل امتیاز",
  "Maximum score": "حداکثر امتیاز",
  "Seen after": "مشاهده‌شده پس از",
  "Seen before": "مشاهده‌شده پیش از",
  "Sort by": "مرتب‌سازی بر اساس",
  "Sort descending": "مرتب‌سازی نزولی",
  "Sort ascending": "مرتب‌سازی صعودی",
  "Status ({count})": "وضعیت ({count})",
  "Filter by status": "فیلتر بر اساس وضعیت",
  "Clear status": "پاک کردن وضعیت",
  "Search: {query}": "جستجو: {query}",
  "Score ≥ {score}": "امتیاز ≥ {score}",
  "Score ≤ {score}": "امتیاز ≤ {score}",
  "Seen after {date}": "مشاهده‌شده پس از {date}",
  "Seen before {date}": "مشاهده‌شده پیش از {date}",
  "Remove filter: {label}": "حذف فیلتر: {label}",

  // Status labels
  "Low score": "امتیاز پایین",
  Scored: "امتیازدهی‌شده",

  // Pagination
  Pagination: "صفحه‌بندی",
  "No jobs": "بدون شغل",
  "Showing {from}–{to} of {total}": "نمایش {from}–{to} از {total}",
  Rows: "ردیف‌ها",
  "Rows per page": "ردیف در هر صفحه",
  "Previous page": "صفحه قبل",
  "Next page": "صفحه بعد",

  // Runs
  "Search the job boards, score matches, and apply — with a live event log.":
    "تخته‌های شغلی را جستجو کنید، تطابق‌ها را امتیاز دهید و درخواست بدهید — همراه با گزارش زنده رویدادها.",
  "Search & score": "جستجو و امتیازدهی",
  "Scrape listings, filter them, and score each job against your profile.":
    "آگهی‌ها را جمع‌آوری، فیلتر و هر شغل را نسبت به پروفایل شما امتیازدهی کنید.",
  "Revisit scored jobs and submit applications. Dry runs only report what would happen.":
    "به مشاغل امتیازدهی‌شده برگردید و درخواست ارسال کنید. اجرای آزمایشی فقط گزارش می‌دهد چه اتفاقی می‌افتاد.",
  "{count} total": "{count} مجموع",
  "Start a live apply run?": "اجرای درخواست زنده شروع شود؟",
  "This run will use your imported browser cookies to sign in and":
    "این اجرا از کوکی‌های واردشده مرورگر برای ورود استفاده می‌کند و",
  "submit real applications": "درخواست‌های واقعی ارسال می‌کند",
  "on Jobinja and Jobvision. Make sure your cookies are fresh and your profile is up to date.":
    "در جابینجا و جاب‌ویژن. مطمئن شوید کوکی‌ها تازه و پروفایل شما به‌روز است.",
  "Start live apply": "شروع درخواست زنده",
  Keyword: "کلیدواژه",
  "Max pages": "حداکثر صفحه",
  Reasoning: "استدلال",
  "Experience tolerance (years)": "تلورانس تجربه (سال)",
  "Leave empty to disable the experience filter.":
    "برای غیرفعال کردن فیلتر تجربه خالی بگذارید.",
  Off: "خاموش",
  "Hard match": "تطابق سخت",
  "Reject jobs that fail required-skill checks.":
    "مشاغلی را که در مهارت‌های الزامی رد می‌شوند رد کن.",
  "Skip filters": "رد کردن فیلترها",
  "Score every job, including location and experience misses.":
    "همه مشاغل را امتیاز بده، حتی آن‌هایی که موقعیت یا تجربه را رد می‌کنند.",
  "Starting…": "در حال شروع…",
  "Start search": "شروع جستجو",
  "Max applies": "حداکثر درخواست",
  "0 means no cap.": "۰ یعنی بدون محدودیت.",
  "Retry errored jobs": "تلاش دوباره برای مشاغل خطادار",
  "Include jobs whose previous apply attempt failed.":
    "مشاغلی را شامل شو که تلاش قبلی درخواستشان ناموفق بوده است.",
  "Live apply": "درخواست زنده",
  "Submit real applications. Requires a fresh cookies.json.":
    "درخواست‌های واقعی ارسال کن. به cookies.json تازه نیاز دارد.",
  "Start dry run": "شروع اجرای آزمایشی",
  "Enter a keyword to search for.": "یک کلیدواژه برای جستجو وارد کنید.",
  "Experience tolerance must be between 0 and 20 years.":
    "تلورانس تجربه باید بین ۰ و ۲۰ سال باشد.",
  "Fill in the score and apply limit.": "امتیاز و محدودیت درخواست را پر کنید.",
  "{kind} run #{id} queued.": "اجرای {kind} شماره {id} در صف قرار گرفت.",
  "Search run": "اجرای جستجو",
  "Apply run": "اجرای درخواست",
  "Stopped by user": "توسط کاربر متوقف شد",
  "Waiting in the queue": "در انتظار در صف",
  "In progress": "در حال انجام",
  "{found} found · {scored} scored · {low} low · {errors} errors":
    "{found} یافت شد · {scored} امتیازدهی شد · {low} پایین · {errors} خطا",
  "{applied} applied · {already} already · {expired} expired · {errors} errors":
    "{applied} درخواست · {already} قبلی · {expired} منقضی · {errors} خطا",
  "{keyword} · {platform} · {pages} pages · min score {minScore}":
    "{keyword} · {platform} · {pages} صفحه · حداقل امتیاز {minScore}",
  "{mode} · min score {minScore} · max {maxApplies}":
    "{mode} · حداقل امتیاز {minScore} · حداکثر {maxApplies}",
  live: "زنده",
  "dry run": "آزمایشی",
  "Run log": "گزارش اجرا",
  "Run #{id}": "اجرا #{id}",
  "{kind} · started {date}": "{kind} · شروع {date}",
  "Live events from the selected run": "رویدادهای زنده اجرای انتخاب‌شده",
  "Close run log": "بستن گزارش اجرا",
  "Log cleared. This run is still in the history below.":
    "گزارش پاک شد. این اجرا هنوز در تاریخچه پایین است.",
  "Start a run or pick one from the history to watch its progress.":
    "یک اجرا شروع کنید یا از تاریخچه یکی را برای دیدن پیشرفتش انتخاب کنید.",
  "This run finished without recording events.":
    "این اجرا بدون ثبت رویداد به پایان رسید.",
  "Waiting for the first event…": "در انتظار اولین رویداد…",
  "Lost connection to the run stream.": "ارتباط با جریان اجرا قطع شد.",
  "Stopping…": "در حال توقف…",
  Stop: "توقف",
  "Resuming…": "در حال ادامه…",
  "runs.action.resume": "ادامه",
  "Stops after the current job finishes.": "پس از پایان شغل فعلی متوقف می‌شود.",
  "Resume skips jobs this run already processed.":
    "ادامه، مشاغلی را که این اجرا قبلاً پردازش کرده نادیده می‌گیرد.",
  "Clear hides the log without deleting the run.":
    "پاک کردن، گزارش را بدون حذف اجرا پنهان می‌کند.",
  "Stop requested for run #{id}.": "درخواست توقف برای اجرا #{id} ثبت شد.",
  "Run #{id} resumed as run #{runId}.":
    "اجرا #{id} به‌عنوان اجرا #{runId} ادامه یافت.",

  // Run status
  Queued: "در صف",
  Running: "در حال اجرا",
  Completed: "تکمیل‌شده",
  Failed: "ناموفق",
  Stopped: "متوقف",
  "Search run started": "اجرای جستجو شروع شد",
  "Apply run started": "اجرای درخواست شروع شد",
  "Found {count} job": "{count} شغل یافت شد",
  "Found {count} jobs": "{count} شغل یافت شد",
  "Skipped {job}": "{job} نادیده گرفته شد",
  "Already processed by the previous run": "در اجرای قبلی پردازش شده است",
  "Filtered {job}": "{job} فیلتر شد",
  "Experience filter": "فیلتر تجربه",
  "Location filter": "فیلتر موقعیت",
  "{job} — {score}": "{job} — {score}",
  "Error on {job}": "خطا در {job}",
  "Applied to {job}": "درخواست برای {job} ارسال شد",
  "Already applied — {job}": "قبلاً درخواست شده — {job}",
  "Expired — {job}": "منقضی — {job}",
  "Apply failed — {job}": "درخواست ناموفق — {job}",
  "Would apply — {job}": "درخواست می‌شد — {job}",
  "Dry run": "اجرای آزمایشی",
  "Skipped — {job}": "نادیده گرفته شد — {job}",
  "Run finished": "اجرا به پایان رسید",
  "Run failed": "اجرا ناموفق بود",
  "Run stopped": "اجرا متوقف شد",
  "Resumed from run #{id}": "ادامه از اجرا #{id}",
  "Jobs already processed by that run are skipped":
    "مشاغلی که آن اجرا قبلاً پردازش کرده نادیده گرفته می‌شوند",

  // Resume
  "Upload a Markdown resume. JobWright parses it into the profile used for filtering, scoring, and applying.":
    "یک رزومه Markdown بارگذاری کنید. JobWright آن را به پروفایلی برای فیلتر، امتیازدهی و درخواست تبدیل می‌کند.",
  "Upload resume": "بارگذاری رزومه",
  "Replaces the active profile and keeps the original Markdown.":
    "پروفایل فعال را جایگزین می‌کند و Markdown اصلی را نگه می‌دارد.",
  "Drop a Markdown resume here": "رزومه Markdown را اینجا رها کنید",
  "or choose a file from your computer": "یا فایلی از رایانه خود انتخاب کنید",
  "Choose .md file": "انتخاب فایل .md",
  "Choose a Markdown resume": "انتخاب رزومه Markdown",
  "Parsing with the LLM…": "در حال تجزیه با مدل زبانی…",
  "Upload & parse": "بارگذاری و تجزیه",
  "Only .md files are supported for now. Other formats are coming later. The original file is kept as resume.md and the parsed profile as profile.json.":
    "فعلاً فقط فایل‌های .md پشتیبانی می‌شوند. قالب‌های دیگر بعداً اضافه می‌شوند. فایل اصلی به‌صورت resume.md و پروفایل تجزیه‌شده به‌صورت profile.json نگهداری می‌شود.",
  "Active profile": "پروفایل فعال",
  "Uploaded {date}": "بارگذاری‌شده {date}",
  "Updated {date}": "به‌روزرسانی‌شده {date}",
  "No profile yet": "هنوز پروفایلی وجود ندارد",
  "No resume uploaded yet": "هنوز رزومه‌ای بارگذاری نشده است",
  "Upload a .md file to create profile.json.":
    "برای ساخت profile.json یک فایل .md بارگذاری کنید.",
  Skills: "مهارت‌ها",
  Roles: "نقش‌ها",
  Projects: "پروژه‌ها",
  Experience: "تجربه",
  Education: "تحصیلات",
  "No skills recorded.": "مهارتی ثبت نشده است.",
  "No work history recorded.": "سابقه کاری ثبت نشده است.",
  "Source not recorded": "منبع ثبت نشده است",
  "{years} years experience · {level}": "{years} سال تجربه · {level}",
  "{years} yrs": "{years} سال",
  junior: "جونیور",
  mid: "میانی",
  senior: "ارشد",
  lead: "رهبر",
  "Resume parsed and saved for {name}.": "رزومه برای {name} تجزیه و ذخیره شد.",
  "Only Markdown (.md) files are supported for now.":
    "فعلاً فقط فایل‌های Markdown (.md) پشتیبانی می‌شوند.",
  "The selected file is empty.": "فایل انتخاب‌شده خالی است.",
  "The resume must be smaller than {size} KB.":
    "رزومه باید کوچک‌تر از {size} کیلوبایت باشد.",

  // AI providers
  "Choose the LLM used for resume parsing and job scoring. Keys are stored locally and never sent back to this page.":
    "مدل زبانی مورد استفاده برای تجزیه رزومه و امتیازدهی مشاغل را انتخاب کنید. کلیدها به‌صورت محلی ذخیره می‌شوند و هرگز به این صفحه بازگردانده نمی‌شوند.",
  "Active provider": "ارائه‌دهنده فعال",
  Ready: "آماده",
  "Key missing": "کلید موجود نیست",
  Providers: "ارائه‌دهندگان",
  "Select a service, then paste its API key and test the connection.":
    "یک سرویس انتخاب کنید، سپس کلید API آن را وارد و اتصال را آزمایش کنید.",
  Connection: "اتصال",
  "Test first, then save. A successful test is required before the settings are stored.":
    "ابتدا آزمایش کنید، سپس ذخیره کنید. پیش از ذخیره تنظیمات، آزمایش موفق لازم است.",
  Provider: "ارائه‌دهنده",
  Active: "فعال",
  Model: "مدل",
  "API key": "کلید API",
  "Saved key in use — paste a new one to replace it":
    "کلید ذخیره‌شده در حال استفاده است — برای جایگزینی کلید جدید وارد کنید",
  "Using {env}": "استفاده از {env}",
  "Paste your API key": "کلید API خود را وارد کنید",
  "A key is saved for this provider. Leave the field empty to keep using it.":
    "برای این ارائه‌دهنده کلیدی ذخیره شده است. برای ادامه استفاده، فیلد را خالی بگذارید.",
  "Using {env} from the environment. Paste a key to store one here instead.":
    "استفاده از {env} از محیط. برای ذخیره کلید در اینجا، کلید را وارد کنید.",
  "No key configured for this provider yet.":
    "هنوز کلیدی برای این ارائه‌دهنده تنظیم نشده است.",
  "Connection works": "اتصال برقرار است",
  "Replied in {ms} ms ·": "پاسخ در {ms} میلی‌ثانیه ·",
  "Test connection & save": "آزمون اتصال و ذخیره",
  "Testing connection…": "در حال آزمون اتصال…",
  "Remove saved key": "حذف کلید ذخیره‌شده",
  "Provider API docs": "مستندات API ارائه‌دهنده",
  "Select a provider to configure it.":
    "برای پیکربندی، یک ارائه‌دهنده انتخاب کنید.",
  "Saved key": "کلید ذخیره‌شده",
  "Environment key": "کلید محیط",
  "No key": "بدون کلید",
  "{label} responded in {ms} ms. Settings saved.":
    "{label} در {ms} میلی‌ثانیه پاسخ داد. تنظیمات ذخیره شد.",
  "Saved key removed for {label}.": "کلید ذخیره‌شده {label} حذف شد.",

  // Notifications
  Notifications: "اعلان‌ها",
  "Telegram alerts after live apply runs":
    "هشدارهای تلگرام پس از اجراهای درخواست زنده",
  "Send a summary to Telegram after each live apply run. Dry runs never notify.":
    "پس از هر اجرای درخواست زنده، خلاصه‌ای به تلگرام بفرستید. اجراهای آزمایشی هرگز اعلان نمی‌فرستند.",
  "Active channel": "کانال فعال",
  Telegram: "تلگرام",
  "No chat ID": "بدون شناسه گفتگو",
  Enabled: "فعال",
  Disabled: "غیرفعال",
  "Saved token": "توکن ذخیره‌شده",
  "Environment token": "توکن محیطی",
  "No token": "بدون توکن",
  "Telegram bot": "ربات تلگرام",
  "Create a bot with @BotFather, then send it a message to get the chat ID.":
    "با ‎@BotFather یک ربات بسازید، سپس به آن پیام بدهید تا شناسه گفتگو را دریافت کنید.",
  "Bot token": "توکن ربات",
  "Saved token in use — paste a new one to replace it":
    "توکن ذخیره‌شده در حال استفاده است — برای جایگزینی توکن جدید وارد کنید",
  "Paste your bot token": "توکن ربات خود را وارد کنید",
  "A token is saved locally. Leave the field empty to keep using it.":
    "توکن به‌صورت محلی ذخیره شده است. برای ادامه استفاده، فیلد را خالی بگذارید.",
  "Using {env} from the environment. Paste a token to store one here instead.":
    "استفاده از {env} از محیط. برای ذخیره توکن در اینجا، توکن را وارد کنید.",
  "No bot token configured yet. Get one from @BotFather.":
    "هنوز توکن رباتی تنظیم نشده است. آن را از ‎@BotFather بگیرید.",
  "Chat ID": "شناسه گفتگو",
  "Numeric chat ID or @channelname": "شناسه عددی گفتگو یا ‎@نام‌کانال",
  "Using {env} from the environment. Saving stores this value locally.":
    "استفاده از {env} از محیط. ذخیره کردن، این مقدار را به‌صورت محلی نگه می‌دارد.",
  "Message the bot once, then read the chat ID from getUpdates.":
    "یک بار به ربات پیام بدهید، سپس شناسه گفتگو را از getUpdates بخوانید.",
  "Enter a chat ID before saving.": "پیش از ذخیره، شناسه گفتگو را وارد کنید.",
  "Telegram settings saved.": "تنظیمات تلگرام ذخیره شد.",
  "Message delivered": "پیام تحویل شد",
  "Telegram replied in {ms} ms ·": "تلگرام در {ms} میلی‌ثانیه پاسخ داد ·",
  "Test message sent to {chatId}.": "پیام آزمایشی به {chatId} ارسال شد.",
  "Save notification settings": "ذخیره تنظیمات اعلان",
  "Sending…": "در حال ارسال…",
  "Send test message": "ارسال پیام آزمایشی",
  "Saved Telegram settings removed.": "تنظیمات ذخیره‌شده تلگرام حذف شد.",
  "Remove saved settings": "حذف تنظیمات ذخیره‌شده",
  "Telegram bot docs": "مستندات ربات تلگرام",
  Delivery: "تحویل",
  "One message per live apply run, sent after the browser closes.":
    "یک پیام برای هر اجرای درخواست زنده، پس از بسته شدن مرورگر ارسال می‌شود.",
  "Applied, already applied, expired, error counts and duration.":
    "تعداد درخواست‌های ارسال‌شده، قبلاً ارسال‌شده، منقضی، خطا و مدت اجرا.",
  "Dry runs never send a notification.":
    "اجراهای آزمایشی هرگز اعلانی نمی‌فرستند.",
  "A failed notification is logged and never fails the run.":
    "اعلان ناموفق ثبت می‌شود و هرگز باعث شکست اجرا نمی‌شود.",
  Privacy: "حریم خصوصی",
  "The token and chat ID are stored locally. The token is never sent back to this page — only whether one is saved.":
    "توکن و شناسه گفتگو به‌صورت محلی ذخیره می‌شوند. توکن هرگز به این صفحه بازگردانده نمی‌شود — فقط اینکه توکنی ذخیره شده است.",
  "Environment fallback: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.":
    "جایگزین محیطی: TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID.",

  // Settings
  "Import session cookies from your browser so live apply runs can sign in.":
    "کوکی‌های نشست را از مرورگر خود وارد کنید تا اجراهای درخواست زنده بتوانند وارد شوند.",
  "Refresh detection": "به‌روزرسانی تشخیص",
  "Chromium cookie decryption is currently Linux-only. Firefox cookies are plaintext and work on every platform. Windows and macOS support is planned next.":
    "رمزگشایی کوکی Chromium فعلاً فقط در لینوکس انجام می‌شود. کوکی‌های Firefox متن ساده هستند و در همه پلتفرم‌ها کار می‌کنند. پشتیبانی ویندوز و macOS در ادامه برنامه‌ریزی شده است.",
  "Could not load settings": "بارگذاری تنظیمات ممکن نشد",
  "Browser cookie source": "منبع کوکی مرورگر",
  "Only jobinja.ir and jobvision.ir cookies are read. Values are never sent back to this page.":
    "فقط کوکی‌های jobinja.ir و jobvision.ir خوانده می‌شوند. مقادیر هرگز به این صفحه بازگردانده نمی‌شوند.",
  Browser: "مرورگر",
  Profile: "پروفایل",
  "Custom folder…": "پوشه سفارشی…",
  Default: "پیش‌فرض",
  "Profile or browser folder": "پروفایل یا پوشه مرورگر",
  "Auto-detect the default profile, or browse…":
    "تشخیص خودکار پروفایل پیش‌فرض، یا مرور…",
  "Browse…": "مرور…",
  "If the browser was not detected, browse to its installation folder and pick the profile that contains the cookie database.":
    "اگر مرورگر تشخیص داده نشد، به پوشه نصب آن بروید و پروفایلی را انتخاب کنید که پایگاه داده کوکی را دارد.",
  "Importing…": "در حال ورود…",
  "Import cookies": "ورود کوکی‌ها",
  "Last import": "آخرین ورود",
  "No cookies imported yet.": "هنوز کوکی‌ای وارد نشده است.",
  Automation: "اتوماسیون",
  "Refresh cookies from the selected browser before each live apply run.":
    "پیش از هر اجرای درخواست زنده، کوکی‌ها را از مرورگر انتخاب‌شده به‌روزرسانی کن.",
  "Auto-import before live apply": "ورود خودکار پیش از درخواست زنده",
  "A failed import is logged and the run continues with the existing cookies file.":
    "ورود ناموفق ثبت می‌شود و اجرا با فایل کوکی موجود ادامه می‌یابد.",
  "Saving…": "در حال ذخیره…",
  "Save settings": "ذخیره تنظیمات",
  "Debug mode": "حالت اشکال‌زدایی",
  "Show the browser window while search and live apply runs. Slower and needs a display; off runs headless (default).":
    "نمایش پنجره مرورگر هنگام جست‌وجو و اجرای درخواست زنده. کندتر است و به نمایشگر نیاز دارد؛ در حالت خاموش، اجرا بدون پنجره انجام می‌شود (پیش‌فرض).",
  "Show the browser window": "نمایش پنجره مرورگر",
  "Runs are headful and visible.":
    "اجراها با پنجره مرورگر و قابل مشاهده هستند.",
  "Runs are headless (default).":
    "اجراها بدون پنجره مرورگر انجام می‌شوند (پیش‌فرض).",
  "Applies to CLI runs too, because they share this database.":
    "روی اجراهای CLI هم اثر دارد، چون از همین پایگاه داده استفاده می‌کنند.",
  "Debug mode on — the browser window will be visible.":
    "حالت اشکال‌زدایی روشن شد — پنجره مرورگر نمایش داده می‌شود.",
  "Debug mode off — runs are headless.":
    "حالت اشکال‌زدایی خاموش شد — اجراها بدون پنجره مرورگر انجام می‌شوند.",
  "Cookie file": "فایل کوکی",
  "Puppeteer reads this owner-only file.":
    "Puppeteer این فایل مخصوص مالک را می‌خواند.",
  "Unsupported OS": "سیستم‌عامل پشتیبانی‌نشده",
  "Not detected": "تشخیص داده نشد",
  Found: "یافت شد",
  Cookies: "کوکی‌ها",
  Imported: "واردشده",
  Domains: "دامنه‌ها",
  "{count} profile found": "{count} پروفایل یافت شد",
  "{count} profiles found": "{count} پروفایل یافت شد",
  "Imported {count} cookie from {browser}.":
    "{count} کوکی از {browser} وارد شد.",
  "Imported {count} cookies from {browser}.":
    "{count} کوکی از {browser} وارد شد.",
  "Cookies imported, but saving the source failed: {error}":
    "کوکی‌ها وارد شدند، اما ذخیره منبع ناموفق بود: {error}",
  "Settings saved.": "تنظیمات ذخیره شد.",
  "{count} skipped": "{count} نادیده گرفته شد",

  // Folder picker
  "Find your browser folder": "پوشه مرورگر خود را پیدا کنید",
  "Pick the folder that contains Cookies (Chromium) or cookies.sqlite (Firefox). A browser user-data folder also works.":
    "پوشه‌ای را انتخاب کنید که Cookies (کرومیوم) یا cookies.sqlite (فایرفاکس) دارد. پوشه داده کاربر مرورگر هم کار می‌کند.",
  "Close folder browser": "بستن مرور پوشه",
  Home: "خانه",
  "Filesystem root": "ریشه فایل‌سیستم",
  "Go to parent folder": "رفتن به پوشه والد",
  "Folder path": "مسیر پوشه",
  Go: "برو",
  "Loading folders…": "در حال بارگذاری پوشه‌ها…",
  "This folder has no subfolders. You can still select it below.":
    "این پوشه زیرپوشه‌ای ندارد. همچنان می‌توانید آن را در پایین انتخاب کنید.",
  "Only the first 500 folders are shown. Type a path above to go directly to a subfolder.":
    "فقط ۵۰۰ پوشه اول نمایش داده می‌شوند. برای رفتن مستقیم به زیرپوشه، مسیر را در بالا وارد کنید.",
  "Selected folder": "پوشه انتخاب‌شده",
  "Use this folder": "استفاده از این پوشه",

  // Confirmation dialog
  "Type {text} to confirm": "برای تأیید {text} را بنویسید",
};

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = language === "fa" ? (FA_TRANSLATIONS[key] ?? key) : key;
  return interpolate(template, vars);
}

function readStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "fa" ? stored : null;
  } catch {
    return null;
  }
}

function systemLanguage(): Language {
  return typeof navigator !== "undefined" &&
    navigator.language.toLowerCase().startsWith("fa")
    ? "fa"
    : "en";
}

function initialLanguage(): Language {
  return readStoredLanguage() ?? systemLanguage();
}

interface I18nValue {
  language: Language;
  dir: "ltr" | "rtl";
  locale: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language === "fa" ? "fa" : "en";
    root.dir = language === "fa" ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The switch still works for this session without persistence.
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "fa" ? "en" : "fa");
  }, [language, setLanguage]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      dir: language === "fa" ? "rtl" : "ltr",
      locale: language === "fa" ? "fa-IR" : "en-US",
      setLanguage,
      toggleLanguage,
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage, toggleLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
