export function normalizeKeywordLine(line: string, lowerCase: boolean): string {
  let s = line.trim().replace(/\s+/g, " ");
  if (lowerCase) s = s.toLowerCase();
  return s;
}

export function dedupeKeywords(
  raw: string,
  opts: { caseInsensitive: boolean; sort: "alpha" | "length" | "none" }
): { lines: string[]; removed: number } {
  const lower = opts.caseInsensitive;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const normalized = normalizeKeywordLine(line, lower);
    if (!normalized) continue;
    const key = lower ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  const removed = raw.split(/\r?\n/).filter((l) => l.trim()).length - out.length;

  if (opts.sort === "alpha") {
    out.sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" }));
  } else if (opts.sort === "length") {
    out.sort((a, b) => b.length - a.length || a.localeCompare(b));
  }

  return { lines: out, removed: Math.max(0, removed) };
}

export function keywordsToQuestionSeeds(keyword: string): string[] {
  const k = keyword.trim();
  if (!k) return [];
  return [
    `What is ${k}?`,
    `How does ${k} work?`,
    `Why is ${k} important?`,
    `Where to use ${k}?`,
    `When should you consider ${k}?`,
    `Who benefits from ${k}?`,
    `${k} vs alternatives`,
    `Best practices for ${k}`,
  ];
}
