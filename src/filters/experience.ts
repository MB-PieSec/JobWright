export type ExperienceRequirement =
  | { type: 'range'; min: number; max: number }
  | { type: 'atLeast'; min: number }
  | { type: 'noRequirement' }
  | { type: 'fieldAbsent' }
  | { type: 'unparseable'; raw: string }

const persianNumberWords: Record<string, number> = {
  'یک': 1,
  'دو': 2,
  'سه': 3,
  'چهار': 4,
  'پنج': 5,
  'شش': 6,
  'هفت': 7,
  'هشت': 8,
  'نه': 9,
  'ده': 10,
};

export function parseExperienceRange(raw: string | undefined): ExperienceRequirement {
  if (raw === undefined) {
    return { type: 'fieldAbsent' };
  }

  const trimmed = raw.trim();

  if (trimmed === 'مهم نیست') {
    return { type: 'noRequirement' };
  }

  const atLeastMatch = trimmed.match(/^بیش از (\S+) سال$/);
  if (atLeastMatch) {
    const min = persianNumberWords[atLeastMatch[1]];
    if (min !== undefined) {
      return { type: 'atLeast', min };
    }
  }

  const rangeMatch = trimmed.match(/^(\S+) تا (\S+) سال$/);
  if (rangeMatch) {
    const min = persianNumberWords[rangeMatch[1]];
    const max = persianNumberWords[rangeMatch[2]];
    if (min !== undefined && max !== undefined) {
      return { type: 'range', min, max };
    }
  }

  return { type: 'unparseable', raw };
}

export function meetsExperienceRequirement(
  req: ExperienceRequirement,
  candidateYears: number,
  toleranceYears: number
): boolean {
  switch (req.type) {
    case 'noRequirement':
    case 'fieldAbsent':
    case 'unparseable':
      return true;
    case 'atLeast':
    case 'range':
      return candidateYears >= req.min - toleranceYears;
  }
}