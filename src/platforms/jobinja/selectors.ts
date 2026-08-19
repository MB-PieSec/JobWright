export const SELECTORS = {
  listing: {
    jobItem: 'ul.c-jobListView__list li.o-listView__item',
    titleLink: 'a.c-jobListView__titleLink',
  },
  detail: {
    description: '.s-jobDesc',
    infoItem: '.c-infoBox__item',
    infoItemLabel: '.c-infoBox__itemTitle',
    infoItemTags: '.tags span',
  },
  apply: {
    appliedIndicator: ".application-innerCard",
    applySubmitButton: "form.apply-form input[type='submit']"
  },
  search: {
    totalResultCount: '.c-jobSearchState__numberOfResultsEcho'
  }
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function persianDigitsToAscii(text: string): string {
  return text.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

export function parseTotalResultCount(rawText: string): number | null {
  const digitsOnly = persianDigitsToAscii(rawText).replace(/[^\d]/g, '');
  if (!digitsOnly) return null;
  const count = parseInt(digitsOnly, 10);
  return Number.isNaN(count) ? null : count;
}