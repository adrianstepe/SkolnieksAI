// Lazily loaded pipeline singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelineInstance: any = null;

const MODEL = process.env.EMBEDDING_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

async function getPipeline() {
  if (!pipelineInstance) {
    // Dynamic import keeps this out of the browser bundle
    const { pipeline } = await import("@xenova/transformers");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pipelineInstance = await (pipeline as any)("feature-extraction", MODEL);
  }
  return pipelineInstance;
}

/**
 * Embed a single string. Returns a mean-pooled, normalized 384-dim float array.
 */
export async function embedText(text: string): Promise<number[]> {
  const pipe = await getPipeline();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * Embed a batch of strings. Returns array of 384-dim vectors.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const pipe = await getPipeline();
  const results: number[][] = [];
  // Process one-by-one to avoid OOM on large batches
  for (const text of texts) {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}
