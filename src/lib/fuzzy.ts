/**
 * Búsqueda difusa liviana para la paleta ⌘K (mejora 3.40): ignora acentos
 * y mayúsculas, acepta palabras en cualquier orden y tolera errores de
 * tipeo (distancia de Damerau-Levenshtein), sin depender de un servicio de
 * búsqueda externo.
 */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Distancia de Damerau-Levenshtein (transposiciones adyacentes) acotada. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

const allowedTypos = (len: number) => (len >= 8 ? 2 : len >= 4 ? 1 : 0);

function tokenScore(token: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === token) return 30;
    if (w.startsWith(token)) best = Math.max(best, 25);
    else if (w.includes(token)) best = Math.max(best, 20);
    else {
      const dist = editDistance(token, w.slice(0, token.length + 1), allowedTypos(token.length));
      const distFull = editDistance(token, w, allowedTypos(token.length));
      const d = Math.min(dist, distFull);
      if (d <= allowedTypos(token.length)) best = Math.max(best, 15 - d * 4);
    }
  }
  return best;
}

/**
 * Puntaje de `text` para `query` (más alto = mejor) o null si no coincide.
 * Coincidencia exacta de la frase > todas las palabras > palabras con
 * errores de tipeo.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalizeText(query);
  const t = normalizeText(text);
  if (!q) return 0;
  if (!t) return null;
  const index = t.indexOf(q);
  if (index >= 0) return 200 - Math.min(index, 50);
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = q.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const token of tokens) {
    const s = tokenScore(token, words);
    if (s === 0) return null;
    total += s;
  }
  return total;
}
