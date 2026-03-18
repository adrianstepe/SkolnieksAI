export interface ChunkConfig {
  targetTokens: number;
  overlapTokens: number;
  minChunkTokens: number;
  separators: string[];
}

export const CHUNK_CONFIG: ChunkConfig = {
  targetTokens: 500,
  overlapTokens: 50,
  minChunkTokens: 100,
  separators: ["\n\n", "\n", ". ", " "],
};

// Rough approximation: 1 token ≈ 4 chars for Latvian/English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitBySeparator(text: string, separator: string): string[] {
  return text.split(separator).filter((s) => s.trim().length > 0);
}

export function chunkText(
  text: string,
  config: ChunkConfig = CHUNK_CONFIG,
): string[] {
  const chunks: string[] = [];
  const targetChars = config.targetTokens * 4;
  const overlapChars = config.overlapTokens * 4;
  const minChars = config.minChunkTokens * 4;

  // Try to split on paragraph boundaries first
  let segments: string[] = [text];
  for (const sep of config.separators) {
    if (segments.every((s) => s.length <= targetChars * 1.5)) break;
    segments = segments.flatMap((s) =>
      s.length > targetChars * 1.5 ? splitBySeparator(s, sep) : [s],
    );
  }

  let currentChunk = "";
  let overlapBuffer = "";

  for (const segment of segments) {
    const candidate = currentChunk
      ? currentChunk + " " + segment
      : segment;

    if (estimateTokens(candidate) <= config.targetTokens) {
      currentChunk = candidate;
    } else {
      // Flush current chunk if it meets minimum size
      if (estimateTokens(currentChunk) >= config.minChunkTokens) {
        chunks.push(currentChunk.trim());
        // Build overlap from end of flushed chunk
        const words = currentChunk.split(" ");
        overlapBuffer = words
          .slice(-Math.floor(overlapChars / 5))
          .join(" ");
      }
      currentChunk = overlapBuffer ? overlapBuffer + " " + segment : segment;
      overlapBuffer = "";
    }
  }

  // Flush remaining
  if (currentChunk.trim() && estimateTokens(currentChunk) >= config.minChunkTokens) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
