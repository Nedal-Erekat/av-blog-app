import { chunkText } from '../../src/ai/chunk-text';

describe('chunkText', () => {
  it('keeps a short post as a single chunk with whitespace normalized', () => {
    expect(chunkText('Hello   world.\n\nSecond  paragraph.')).toEqual([
      'Hello world. Second paragraph.',
    ]);
  });

  it('returns no chunks for empty content', () => {
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('splits long text into chunks no longer than maxChars', () => {
    const paragraph = 'This sentence is about deploying containers to production. '
      .repeat(10)
      .trim();
    const text = Array.from({ length: 5 }, () => paragraph).join('\n\n');

    const chunks = chunkText(text, { maxChars: 1000, overlapChars: 150 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(1000);
  });

  it('repeats the end of one chunk at the start of the next (overlap)', () => {
    const paragraphs = Array.from({ length: 4 }, (_, i) => `Paragraph ${i} `.repeat(20).trim());

    const [first, second] = chunkText(paragraphs.join('\n\n'), {
      maxChars: 700,
      overlapChars: 100,
    });

    const overlap = second.slice(0, 50);
    expect(first).toContain(overlap);
  });

  it('hard-splits a single giant word that has no natural boundary', () => {
    const chunks = chunkText('x'.repeat(2500), { maxChars: 1000, overlapChars: 0 });

    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500]);
  });
});
