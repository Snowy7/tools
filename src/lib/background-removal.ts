export type OutputFormat = "png" | "jpeg" | "webp";
export type RemovalEngine = "ormbg" | "birefnet" | "modnet" | "imgly" | "chromakey" | "luminance";
export type TransformDevice = "webgpu" | "wasm";

export const MODEL_IDS: Record<Extract<RemovalEngine, "ormbg" | "birefnet" | "modnet">, string> = {
  ormbg: "onnx-community/ormbg-ONNX",
  birefnet: "onnx-community/BiRefNet_lite-ONNX",
  modnet: "Xenova/modnet",
};

export function isAiRemovalEngine(engine: RemovalEngine): boolean {
  return engine === "ormbg" || engine === "birefnet" || engine === "modnet" || engine === "imgly";
}

export function getPreferredDevice(navigatorLike: Partial<Navigator> | undefined): TransformDevice {
  return navigatorLike && "gpu" in navigatorLike ? "webgpu" : "wasm";
}

export function getModelId(engine: RemovalEngine): string | null {
  if (engine === "ormbg" || engine === "birefnet" || engine === "modnet") {
    return MODEL_IDS[engine];
  }
  return null;
}

type PipelineFactory = (
  task: "background-removal",
  modelId: string,
  options: { device: TransformDevice },
) => Promise<unknown>;

const pipelinePromises = new Map<string, Promise<unknown>>();

function getPipelineCacheKey(modelId: string, device: TransformDevice): string {
  return `${modelId}:${device}`;
}

export async function loadRemovalPipelineForDevice(
  pipelineFactory: PipelineFactory,
  engine: Extract<RemovalEngine, "ormbg" | "birefnet" | "modnet">,
  device: TransformDevice,
): Promise<unknown> {
  const modelId = getModelId(engine);
  if (!modelId) {
    throw new Error(`Unsupported engine: ${engine}`);
  }

  const cacheKey = getPipelineCacheKey(modelId, device);
  if (!pipelinePromises.has(cacheKey)) {
    pipelinePromises.set(cacheKey, pipelineFactory("background-removal", modelId, { device }));
  }
  return pipelinePromises.get(cacheKey)!;
}

export async function loadCachedRemovalPipeline(
  pipelineFactory: PipelineFactory,
  engine: Extract<RemovalEngine, "ormbg" | "birefnet" | "modnet">,
  navigatorLike: Partial<Navigator> | undefined,
): Promise<{ pipeline: unknown; device: TransformDevice }> {
  const modelId = getModelId(engine);
  if (!modelId) {
    throw new Error(`Unsupported engine: ${engine}`);
  }

  const preferred = getPreferredDevice(navigatorLike);
  const devices: TransformDevice[] = preferred === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];
  let lastError: unknown;

  for (const device of devices) {
    try {
      const pipeline = await loadRemovalPipelineForDevice(pipelineFactory, engine, device);
      return { pipeline, device };
    } catch (error) {
      pipelinePromises.delete(getPipelineCacheKey(modelId, device));
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to load model for ${engine}`);
}

export function clearRemovalPipelineCache(): void {
  pipelinePromises.clear();
}

export function invalidateRemovalPipeline(
  engine: Extract<RemovalEngine, "ormbg" | "birefnet" | "modnet">,
  device: TransformDevice,
): void {
  const modelId = getModelId(engine);
  if (!modelId) return;
  pipelinePromises.delete(getPipelineCacheKey(modelId, device));
}
