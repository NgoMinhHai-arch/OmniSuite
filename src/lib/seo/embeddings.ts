/* Lightweight similarity / clustering helpers built on TF-IDF + cosine.
 * Avoids native ML libs so it runs in any Node/Edge runtime. */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
  "is", "are", "was", "were", "be", "been", "by", "with", "as", "at",
  "this", "that", "it", "from", "you", "your", "we", "our", "they",
  "có", "không", "và", "hoặc", "là", "của", "với", "trong", "ngoài",
  "cho", "tới", "tại", "này", "kia", "đó", "khi", "nếu", "vì", "do",
]);

export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

export function buildIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of docs) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map<string, number>();
  const N = Math.max(1, docs.length);
  for (const [term, freq] of df) {
    idf.set(term, Math.log((N + 1) / (freq + 1)) + 1);
  }
  return idf;
}

export interface TfIdfVector {
  norm: number;
  weights: Map<string, number>;
}

export function tfidfVector(tokens: string[], idf: Map<string, number>): TfIdfVector {
  const tf = termFreq(tokens);
  const weights = new Map<string, number>();
  let sumSq = 0;
  for (const [term, freq] of tf) {
    const w = freq * (idf.get(term) || 0);
    if (w > 0) {
      weights.set(term, w);
      sumSq += w * w;
    }
  }
  return { norm: Math.sqrt(sumSq) || 1, weights };
}

export function cosineSim(a: TfIdfVector, b: TfIdfVector): number {
  const [small, big] = a.weights.size <= b.weights.size ? [a.weights, b.weights] : [b.weights, a.weights];
  let dot = 0;
  for (const [term, w] of small) {
    const o = big.get(term);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}

export interface ClusterResult {
  centroid: string;
  members: Array<{ text: string; score: number }>;
}

/**
 * Greedy similarity clustering.
 * Threshold defaults to 0.45 (good balance for keyword grouping).
 */
export function clusterTexts(items: string[], threshold = 0.45): ClusterResult[] {
  const docs = items.map((s) => tokenize(s));
  const idf = buildIdf(docs);
  const vectors = docs.map((d) => tfidfVector(d, idf));

  const assigned = new Array<number>(items.length).fill(-1);
  const clusters: ClusterResult[] = [];

  for (let i = 0; i < items.length; i++) {
    if (assigned[i] !== -1) continue;
    const seedId = i;
    const members: Array<{ text: string; score: number }> = [{ text: items[seedId], score: 1 }];
    assigned[seedId] = clusters.length;
    for (let j = i + 1; j < items.length; j++) {
      if (assigned[j] !== -1) continue;
      const sim = cosineSim(vectors[seedId], vectors[j]);
      if (sim >= threshold) {
        members.push({ text: items[j], score: sim });
        assigned[j] = clusters.length;
      }
    }
    members.sort((a, b) => b.score - a.score);
    clusters.push({ centroid: items[seedId], members });
  }

  clusters.sort((a, b) => b.members.length - a.members.length);
  return clusters;
}

/** Sort items by similarity to a target string. */
export function rankBySimilarity(target: string, items: string[]): Array<{ text: string; score: number }> {
  const docs = [target, ...items].map((s) => tokenize(s));
  const idf = buildIdf(docs);
  const vectors = docs.map((d) => tfidfVector(d, idf));
  const targetVec = vectors[0];
  return items
    .map((text, i) => ({ text, score: cosineSim(targetVec, vectors[i + 1]) }))
    .sort((a, b) => b.score - a.score);
}

export function nGrams(tokens: string[], n: number): string[] {
  if (n <= 1) return tokens;
  const out: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

export function topNgrams(corpus: string[], n: number, top = 30): Array<{ phrase: string; count: number }> {
  const counts = new Map<string, number>();
  for (const text of corpus) {
    const tokens = tokenize(text);
    for (const gram of nGrams(tokens, n)) {
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase))
    .slice(0, top);
}
