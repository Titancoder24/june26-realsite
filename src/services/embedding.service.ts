import { vertexAIService } from "./vertex-ai.service";

export class EmbeddingService {
  /** Walkthrough RAG embeddings via Vertex AI (1536-dim for pgvector compatibility). */
  async embed(text: string): Promise<number[]> {
    try {
      return await vertexAIService.embedText(text, 1536);
    } catch {
      return this.fallbackEmbed(text);
    }
  }

  private fallbackEmbed(text: string): number[] {
    const vec = new Array(1536).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 1536] += text.charCodeAt(i) / 255;
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}

export const embeddingService = new EmbeddingService();
