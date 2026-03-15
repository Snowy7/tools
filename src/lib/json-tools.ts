export interface JsonParseResult {
  valid: boolean;
  formatted: string;
  minified: string;
  size: number;
  error: string | null;
}

export function analyzeJson(input: string): JsonParseResult {
  try {
    const parsed = JSON.parse(input);
    const formatted = JSON.stringify(parsed, null, 2);
    const minified = JSON.stringify(parsed);
    return {
      valid: true,
      formatted,
      minified,
      size: minified.length,
      error: null,
    };
  } catch (error) {
    return {
      valid: false,
      formatted: input,
      minified: input,
      size: input.length,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

export function escapeJsonForEmbedding(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

