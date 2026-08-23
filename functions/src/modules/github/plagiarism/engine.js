/**
 * Plagiarism detection engine - pure functions only.
 *
 * Strategy: normalize source text (drop comments, strings and whitespace),
 * fingerprint it with character k-gram hashing and compare submissions via
 * Jaccard + containment of their fingerprint sets. Robust against renamed
 * identifiers and reformatting while remaining cheap enough to run inline.
 */

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "java", "c", "h", "cpp", "hpp", "cs",
  "go", "rb", "php", "swift", "kt", "rs", "sql", "sh", "html", "css", "scss"
]);

const MAX_FILE_SIZE = 120 * 1024; // 120 KB per file

function extensionOf(path) {
  const m = /\.([A-Za-z0-9]+)$/.exec(path || "");
  return m ? m[1].toLowerCase() : "";
}

function isCodeFile(path) {
  return CODE_EXTENSIONS.has(extensionOf(path));
}

/**
 * Language-aware light normalization: removes comments and string literal
 * contents so that cosmetic rewrites do not affect fingerprints, then
 * collapses all non-alphanumeric runs to a single space.
 */
function normalizeCode(text, ext) {
  if (typeof text !== "string") return "";
  let src = text;

  if (ext === "py" || ext === "sh" || ext === "rb") {
    // Python-ish: triple-quoted strings then line comments
    src = src.replace(/("""[\s\S]*?"""|'''[\s\S]*?''')/g, ' "" ');
    src = src.replace(/"(?:[^"\\\n]|\\.)*"/g, ' "" ').replace(/'(?:[^'\\\n]|\\.)*'/g, " '' ");
    src = src.replace(/#[^\n]*/g, " ");
  } else {
    // C-like family (and everything else): comments then strings
    src = src.replace(/\/\*[\s\S]*?\*\//g, " ");
    src = src.replace(/\/\/[^\n]*/g, " ");
    src = src.replace(/"(?:[^"\\]|\\.)*"/g, ' "" ');
    src = src.replace(/'(?:[^'\\]|\\.)*'/g, " '' ");
  }

  return src
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/** djb2 rolling hash over fixed-size character windows. */
function hashCode(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Fingerprint set from k-character grams of the normalized text. */
function fingerprint(normalizedText, k = 12) {
  if (!normalizedText || normalizedText.length < k) return new Set();
  const grams = new Set();
  for (let i = 0; i <= normalizedText.length - k; i++) {
    grams.add(hashCode(normalizedText.slice(i, i + k)));
  }
  return grams;
}

function setIntersectionSize(a, b) {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const v of small) if (large.has(v)) n++;
  return n;
}

/**
 * Pairwise similarity between two fingerprint sets.
 *   jaccard      - shared / union (symmetric, penalizes size differences)
 *   containmentA - share of A found inside B (useful when one repo is a
 *                  superset, e.g. base template + extra work)
 */
function similarity(fa, fb) {
  if (fa.size === 0 || fb.size === 0) return { jaccard: 0, containmentA: 0, containmentB: 0 };
  const shared = setIntersectionSize(fa, fb);
  const union = fa.size + fb.size - shared;
  return {
    jaccard: Math.round((shared / union) * 100),
    containmentA: Math.round((shared / fa.size) * 100),
    containmentB: Math.round((shared / fb.size) * 100),
  };
}

/** Convenience pipeline for one repository payload. */
function fingerprintFiles(files, k = 12) {
  // files: [{ path, content }]
  const usable = files.filter((f) => f && isCodeFile(f.path) && typeof f.content === "string");
  const normalized = usable.map((f) => normalizeCode(f.content, extensionOf(f.path))).join(" ").slice(0, 400000);
  return fingerprint(normalized, k);
}

module.exports = {
  CODE_EXTENSIONS,
  MAX_FILE_SIZE,
  isCodeFile,
  extensionOf,
  normalizeCode,
  hashCode,
  fingerprint,
  similarity,
  fingerprintFiles,
};
