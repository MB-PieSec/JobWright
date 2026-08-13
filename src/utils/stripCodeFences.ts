export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const withoutOpening = trimmed.slice(trimmed.indexOf("\n") + 1);
    const withoutClosing = withoutOpening.slice(0, withoutOpening.lastIndexOf("```"));
    return withoutClosing.trim();
  }
  return trimmed;
}
