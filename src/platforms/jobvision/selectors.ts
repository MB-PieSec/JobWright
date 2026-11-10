const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function arabicIndicDigitsToAscii(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
}

export const SELECTORS = {
  search: {
    jobItem: "job-card > a",
    titleLink: ".job-card-title",
    totalResultCount: ".seo-title b",
  },
  detail: {
    title: "h1.yn_title",
    location: ".yn_category",
    featureTags: ".feature-tag",
    description: ".job-specification .jvt-flex-1.jvt-mr-2",
    requirementTitle: ".requirement-title",
    requirementValue: ".requirement-value",
  },
  apply: {
    submitButton: "button.jvt-btn-send-resume",
  },
};

export function parseTotalResultCount(rawText: string): number | null {
  const digitsOnly = arabicIndicDigitsToAscii(rawText).replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const count = parseInt(digitsOnly, 10);
  return Number.isNaN(count) ? null : count;
}
