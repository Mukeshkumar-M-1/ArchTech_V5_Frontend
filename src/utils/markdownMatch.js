export const normalizeText = (str) => (str || "").replace(/\s+/g, " ").trim();

// Curly punctuation → ASCII equivalents, mirroring Claude Code's
// findActualString normalization cascade (FileEditTool/utils.ts).
const CURLY_QUOTE_TO_ASCII_MAP = new Map([
  ["‘", "'"],
  ["’", "'"],
  ["‚", "'"],
  ["‛", "'"],
  ["“", '"'],
  ["”", '"'],
  ["„", '"'],
  ["–", "-"],
  ["—", "-"],
  ["−", "-"],
  ["\u00a0", " "],
  ["…", "..."],
]);

const WHITESPACE_PATTERN = /\s/;

/**
 * Build a normalized view of `originalText` with an index map so a match found
 * in the normalized text can be mapped back to exact original-document offsets.
 * indexMap[i] = original index of the character that produced normalized char i;
 * the final entry (index normalizedText.length) maps to originalText.length.
 */
function buildNormalizedView(originalText, { normalizeQuotes, collapseWhitespace }) {
  let normalizedText = "";
  const indexMap = [];
  let previousCharWasCollapsedWhitespace = false;

  for (let charIndex = 0; charIndex < originalText.length; charIndex++) {
    const originalChar = originalText[charIndex];
    const replacementText = normalizeQuotes
      ? CURLY_QUOTE_TO_ASCII_MAP.get(originalChar) ?? originalChar
      : originalChar;

    for (const replacementChar of replacementText) {
      if (collapseWhitespace && WHITESPACE_PATTERN.test(replacementChar)) {
        if (previousCharWasCollapsedWhitespace) continue;
        normalizedText += " ";
        indexMap.push(charIndex);
        previousCharWasCollapsedWhitespace = true;
      } else {
        normalizedText += replacementChar;
        indexMap.push(charIndex);
        previousCharWasCollapsedWhitespace = false;
      }
    }
  }

  indexMap.push(originalText.length);
  return { normalizedText, indexMap };
}

/**
 * Map a [normalizedStart, normalizedStart + matchLength) window back to
 * original-document offsets and return that original substring.
 */
function mapNormalizedMatchToOriginal(normalizedStart, matchLength, indexMap, originalText) {
  const originalStart = indexMap[normalizedStart];
  const originalEnd = indexMap[normalizedStart + matchLength];
  if (originalStart == null || originalEnd == null) return null;
  return originalText.substring(originalStart, originalEnd);
}

/**
 * Try one normalization strategy: match the normalized search text inside the
 * normalized document and return the corresponding original-document slice.
 */
function findMatchWithNormalization(searchText, fullDocumentMarkdown, normalizationOptions) {
  const { normalizedText: normalizedSearchText, indexMap: searchIndexMap } =
    buildNormalizedView(searchText, normalizationOptions);
  const { normalizedText: normalizedDocument, indexMap: documentIndexMap } =
    buildNormalizedView(fullDocumentMarkdown, normalizationOptions);
  if (!normalizedSearchText) return null;

  const matchStart = normalizedDocument.indexOf(normalizedSearchText);
  if (matchStart === -1) return null;
  return mapNormalizedMatchToOriginal(
    matchStart,
    normalizedSearchText.length,
    documentIndexMap,
    fullDocumentMarkdown,
  );
}

/**
 * Find the best line-boundary match for `searchText` inside a markdown string.
 * Returns the matched segment (expanded to full line boundaries, trimmed) or null.
 *
 * Match cascade (lenient → strict), mirroring Claude Code's findActualString:
 * 1. exact substring
 * 2. curly-quote-normalized (position back-mapped to the original document)
 * 3. whitespace-normalized (tabs/runs collapsed, back-mapped)
 * 4. quotes + whitespace combined (back-mapped)
 * 5. token sliding-window sequence match, expanded to full line boundaries
 */
export function findBestMatchInMarkdown(searchText, fullDocumentMarkdown) {
  const exactText = searchText.trim();
  if (!exactText || !fullDocumentMarkdown) return null;

  // 1. Direct match check
  if (fullDocumentMarkdown.includes(exactText)) return exactText;

  // 2-4. Normalization cascade — each strategy returns a slice of the ORIGINAL
  // document so callers can sourceMarkdown.replace(matched, proposed) safely.
  const normalizationStrategies = [
    { normalizeQuotes: true, collapseWhitespace: false },
    { normalizeQuotes: false, collapseWhitespace: true },
    { normalizeQuotes: true, collapseWhitespace: true },
  ];
  for (const strategy of normalizationStrategies) {
    const normalizedMatch = findMatchWithNormalization(exactText, fullDocumentMarkdown, strategy);
    if (normalizedMatch) return normalizedMatch;
  }

  // 5. Tokenize Markdown into distinct structural & text tokens with exact offsets
  const tokenizeMarkdown = (text) => {
    const tokens = [];
    // Captures words, numbers, or specific markdown symbols (| * - # ` [ ] ( ))
    const tokenRegex = /[a-zA-Z0-9]+|\||\*+|-+|#+|`+|\[|\]|\(|\)/g;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
      tokens.push({
        value: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return tokens;
  };

  const searchTokens = tokenizeMarkdown(exactText);
  const docTokens = tokenizeMarkdown(fullDocumentMarkdown);

  if (searchTokens.length === 0 || docTokens.length === 0) return null;

  // Sliding Window Sequence Match
  const windowSize = searchTokens.length;
  let startCharIndex = -1;
  let endCharIndex = -1;

  for (let i = 0; i <= docTokens.length - windowSize; i++) {
    let isMatch = true;

    for (let j = 0; j < windowSize; j++) {
      if (docTokens[i + j].value !== searchTokens[j].value) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      startCharIndex = docTokens[i].start;
      endCharIndex = docTokens[i + windowSize - 1].end;
      break;
    }
  }

  // Expand to full multi-line boundaries (e.g., table rows)
  if (startCharIndex !== -1 && endCharIndex !== -1) {
    let lineStart = fullDocumentMarkdown.lastIndexOf('\n', startCharIndex - 1) + 1;
    if (lineStart < 0) lineStart = 0;

    let lineEnd = fullDocumentMarkdown.indexOf('\n', endCharIndex);
    if (lineEnd === -1) lineEnd = fullDocumentMarkdown.length;

    return fullDocumentMarkdown.substring(lineStart, lineEnd).trim();
  }

  return null;
}
