import { useMemo } from "react";

/**
 * Scans `raw` and returns the longest prefix that contains no unclosed
 * LaTeX math delimiters ($...$ or $$...$$).
 *
 * When the LLM streams a partial math expression such as `$\frac{1` the
 * opening `$` has arrived but the closing one hasn't yet. Passing that
 * string directly to KaTeX causes a parse error and a flash of broken
 * raw code. This function holds back the stream from the position of the
 * last unclosed delimiter so that react-markdown / KaTeX only ever
 * receives well-formed content.
 *
 * Rules:
 *  - Outside any math block: flush every character immediately.
 *  - `$$` opens a block-math span; nothing inside is flushed until the
 *    matching closing `$$` arrives.
 *  - `$` (not followed by another `$`) opens an inline-math span; nothing
 *    inside is flushed until the matching closing `$` arrives.
 *  - Nested `$$` inside `$...$` is treated as closing the inline span so
 *    the outer loop can re-evaluate correctly.
 */
function getSafeContent(raw: string): string {
  let i = 0;
  let safeEnd = 0; // index of the last character known safe to render

  while (i < raw.length) {
    if (raw[i] !== "$") {
      // Plain character — always safe.
      safeEnd = i + 1;
      i++;
      continue;
    }

    // We are at a `$`.
    const isBlock = i + 1 < raw.length && raw[i + 1] === "$";
    const openStart = i;
    i += isBlock ? 2 : 1;

    // Scan forward for the matching closing delimiter.
    let closed = false;

    while (i < raw.length) {
      if (isBlock) {
        // Looking for `$$`.
        if (raw[i] === "$" && i + 1 < raw.length && raw[i + 1] === "$") {
          i += 2;
          safeEnd = i; // The entire $$...$$ block is now safe.
          closed = true;
          break;
        }
      } else {
        // Looking for a single closing `$`.
        if (raw[i] === "$") {
          i += 1;
          safeEnd = i; // The entire $...$ span is now safe.
          closed = true;
          break;
        }
      }
      i++;
    }

    if (!closed) {
      // Opening delimiter has no matching close yet — hold everything from
      // openStart onward. safeEnd stays where it was before we saw `$`.
      // Break out of the outer loop; there's nothing more to process.
      void openStart; // referenced only for clarity
      break;
    }
  }

  return raw.slice(0, safeEnd);
}

/**
 * LaTeX-aware streaming buffer hook.
 *
 * @param rawContent - The full accumulated streaming string (grows over time).
 * @returns `safeContent` — the portion of `rawContent` safe to pass to
 *   react-markdown + KaTeX without triggering parse errors from incomplete
 *   math delimiters.
 */
export function useStreamingMarkdown(rawContent: string): { safeContent: string } {
  const safeContent = useMemo(() => getSafeContent(rawContent), [rawContent]);
  return { safeContent };
}
