// Why chunk? One embedding for a whole long post blurs every topic in it into one average
// "meaning". Smaller chunks each keep a focused meaning, so a search can match the one
// paragraph that is actually about the query.

type ChunkOptions = {
  // Upper bound for a chunk's length, in characters (roughly 4 characters per token).
  maxChars?: number;
  // How much of the previous chunk is repeated at the start of the next one, so a sentence
  // that straddles a boundary still appears whole in at least one chunk.
  overlapChars?: number;
};

export function chunkText(
  text: string,
  { maxChars = 1000, overlapChars = 150 }: ChunkOptions = {},
) {
  const pieces = splitIntoPieces(text, maxChars - overlapChars);
  const chunks: string[] = [];
  let current = '';

  for (const piece of pieces) {
    if (current && current.length + 1 + piece.length > maxChars) {
      chunks.push(current);
      current = `${tail(current, overlapChars)} ${piece}`.trim();
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

// Prefer natural boundaries: paragraphs, then sentences, and only as a last resort a hard cut.
function splitIntoPieces(text: string, maxLength: number): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= maxLength) return [paragraph];
    const sentences = paragraph.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) ?? [paragraph];
    return sentences.flatMap((sentence) => hardSplit(sentence.trim(), maxLength));
  });
}

function hardSplit(text: string, maxLength: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) parts.push(text.slice(i, i + maxLength));
  return parts;
}

// The last `length` characters of `text`, starting at a word boundary.
function tail(text: string, length: number): string {
  // Guard: slice(-0) is slice(0), which would return the whole text instead of nothing.
  if (length <= 0) return '';
  if (text.length <= length) return text;
  const slice = text.slice(-length);
  const firstSpace = slice.indexOf(' ');
  return firstSpace === -1 ? slice : slice.slice(firstSpace + 1);
}
