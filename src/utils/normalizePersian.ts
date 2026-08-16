export function normalizePersian(text: string): string {
  return text
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, "") // zero-width non-joiner
    .trim();
}
