import type { DocumentCategory } from '@orqafy/shared';

export interface ProjectRef {
  id: string;
  code: string;
  name: string;
  clientId: string;
}

export type MatchVerdict =
  | { kind: 'auto-file'; projectId: string; clientId: string; confidence: number; category?: DocumentCategory }
  | {
      kind: 'review';
      suggestedProjectId?: string;
      suggestedClientId?: string;
      suggestedCategory?: DocumentCategory;
      confidence: number;
    };

const CATEGORY_KEYWORDS: Array<[DocumentCategory, RegExp]> = [
  ['invoice', /\bINVOICE\b/],
  ['po', /\b(PURCHASE ORDER|\bPO\b)\b/],
  ['receipt', /\bRECEIPT\b/],
  ['expense', /\bEXPENSE\b/],
  ['payroll', /\bPAYROLL\b/],
  ['permit', /\bPERMIT\b/],
  ['drawing', /\b(DRAWING|BLUEPRINT)\b/],
];

/** Keyword-guess a document category from OCR text; undefined when unknown. */
export function guessCategory(text: string): DocumentCategory | undefined {
  const upper = text.toUpperCase();
  for (const [category, re] of CATEGORY_KEYWORDS) {
    if (re.test(upper)) return category;
  }
  return undefined;
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-token match: the code bounded by non-alphanumerics or string ends. */
function codeAppears(text: string, code: string): boolean {
  const re = new RegExp(`(?<![A-Z0-9])${escapeRegExp(code)}(?![A-Z0-9])`);
  return re.test(text);
}

/**
 * Deterministic exact-ID matcher (D-13, no LLM). Single code hit auto-files;
 * everything else routes to the review tray with a best-effort suggestion.
 */
export function matchDocument(input: { text: string; projects: ProjectRef[] }): MatchVerdict {
  const upper = input.text.toUpperCase();
  const category = guessCategory(input.text);

  const codeHits = input.projects.filter((p) => codeAppears(upper, p.code.toUpperCase()));

  if (codeHits.length === 1) {
    const p = codeHits[0]!;
    return {
      kind: 'auto-file',
      projectId: p.id,
      clientId: p.clientId,
      confidence: 0.95,
      ...(category !== undefined ? { category } : {}),
    };
  }
  if (codeHits.length > 1) {
    const p = codeHits[0]!;
    return {
      kind: 'review',
      suggestedProjectId: p.id,
      suggestedClientId: p.clientId,
      confidence: 0.5,
      ...(category !== undefined ? { suggestedCategory: category } : {}),
    };
  }

  const nameHits = input.projects.filter(
    (p) => p.name.length >= 4 && upper.includes(p.name.toUpperCase()),
  );
  if (nameHits.length === 1) {
    const p = nameHits[0]!;
    return {
      kind: 'review',
      suggestedProjectId: p.id,
      suggestedClientId: p.clientId,
      confidence: 0.6,
      ...(category !== undefined ? { suggestedCategory: category } : {}),
    };
  }

  return {
    kind: 'review',
    confidence: 0,
    ...(category !== undefined ? { suggestedCategory: category } : {}),
  };
}
