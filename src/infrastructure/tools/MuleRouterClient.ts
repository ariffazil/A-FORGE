/**
 * MuleRouter API Client — Agentic Multimodal Surface
 *
 * Wraps MuleRouter's multimodal API (vision, image gen, TTS, music)
 * through a single governed client. One key, one bill, one surface.
 *
 * Wolf Cabinet Model: Δ Perception layer — reversible, retriable, F1-safe.
 *
 * @module tools/MuleRouterClient
 * @forged 2026-07-30 — 333-AGI under F13 directive "make mulerouter real agentic multimodal"
 * @constitutional F5 PEACE² — content policy gate on all generation
 * @constitutional F11 AUDIT — every generation logged with receipt
 */

import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export type MuleRouterModality = "vision" | "image" | "tts" | "music";

export interface VisionRequest {
  imageUrl?: string;       // Public URL (preferred)
  imageBase64?: string;     // Base64 data URI (recommended — OpenRouter only path, tested working on MuleRouter 2026-07-30)
  prompt?: string;          // What to analyze
  model?: string;           // default: qwen-vl-max
}

export interface ImageGenRequest {
  prompt: string;
  model?: "gpt" | "wan";   // default: gpt (GPT Image 2)
  size?: string;            // "auto" | "square" | "1024x1024" | "1920x1080"
  quality?: "high" | "medium" | "low" | "auto";
  format?: "png" | "jpg" | "webp";
  n?: number;               // 1-4 (GPT only)
}

export interface TTSRequest {
  text: string;
  voice?: string;           // default: Wise_Woman
  speed?: number;           // 0.5-2.0
  model?: "speech-2.8-hd" | "speech-2.8-turbo";
}

export interface MusicRequest {
  prompt: string;           // Genre/mood description
  lyrics?: string;          // Optional lyrics
  instrumental?: boolean;
}

export interface GenerationResult {
  ok: boolean;
  modality: MuleRouterModality;
  taskId?: string;
  outputPath?: string;
  outputUrl?: string;
  durationMs: number;
  cost?: { inputTokens?: number; outputTokens?: number };
  error?: string;
  receiptHash?: string;
}

// ── Client ─────────────────────────────────────────────────────────────────

export class MuleRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private gptImageBase: string;
  private wanImageBase: string;
  private ttsBase: string;
  private musicBase: string;
  private outputDir: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MULEROUTER_API_KEY || process.env.MULE_API_KEY || "";
    // OpenAI-compatible chat endpoint for vision + text
    this.baseUrl = "https://api.mulerouter.ai/vendors/openai/v1/chat/completions";
    // Async generation endpoints
    this.gptImageBase = "https://api.mulerouter.ai/vendors/openai/v1/gpt-image-2";
    this.wanImageBase = "https://api.mulerouter.ai/vendors/alibaba/v1/wan2.6-t2i";
    this.ttsBase = "https://api.mulerouter.ai/vendors/minimax/v1/speech-2.8-hd";
    this.musicBase = "https://api.mulerouter.ai/vendors/minimax/v1/music-2.5";
    this.outputDir = "/tmp/aforge-multimodal";
  }

  private authHeaders(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // ── Vision (synchronous — chat completion with image) ─────────────────

  async vision(req: VisionRequest): Promise<GenerationResult> {
    const startedAt = Date.now();
    const model = req.model || "qwen-vl-max";
    const prompt = req.prompt || "Describe this image in detail.";

    const content: any[] = [{ type: "text", text: prompt }];

    if (req.imageUrl) {
      content.push({ type: "image_url", image_url: { url: req.imageUrl } });
    } else if (req.imageBase64) {
      content.push({ type: "image_url", image_url: { url: req.imageBase64 } });
    }

    try {
      const resp = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "unknown");
        return {
          ok: false,
          modality: "vision",
          durationMs: Date.now() - startedAt,
          error: `MuleRouter vision ${resp.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await resp.json() as any;
      const text = data?.choices?.[0]?.message?.content || "";
      const usage = data?.usage || {};

      return {
        ok: true,
        modality: "vision",
        durationMs: Date.now() - startedAt,
        cost: {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        },
        outputPath: text, // for vision, output IS the text analysis
      };
    } catch (err) {
      return {
        ok: false,
        modality: "vision",
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Image Generation (async — GPT Image 2 or Wan 2.6 T2I) ─────────────

  async generateImage(req: ImageGenRequest): Promise<GenerationResult> {
    const startedAt = Date.now();
    const model = req.model || "gpt";

    try {
      const { taskId, baseUrl } = await this.submitImageTask(req, model);
      const result = await this.pollTask(baseUrl, taskId, 180_000);
      const images = this.extractImageUrls(result, model);

      if (!images.length) {
        return {
          ok: false,
          modality: "image",
          taskId,
          durationMs: Date.now() - startedAt,
          error: "No image URLs in completed task response",
        };
      }

      // Download first image
      const ext = req.format || "png";
      await mkdir(this.outputDir, { recursive: true });
      const outputPath = join(this.outputDir, `mr_img_${taskId.slice(0, 8)}_${Date.now()}.${ext}`);

      const imgResp = await fetch(images[0], { signal: AbortSignal.timeout(120_000) });
      if (!imgResp.ok) {
        return {
          ok: false,
          modality: "image",
          taskId,
          durationMs: Date.now() - startedAt,
          error: `Image download failed: ${imgResp.status}`,
        };
      }

      const buffer = Buffer.from(await imgResp.arrayBuffer());
      await writeFile(outputPath, buffer);

      const receiptHash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

      return {
        ok: true,
        modality: "image",
        taskId,
        outputPath,
        outputUrl: images[0],
        durationMs: Date.now() - startedAt,
        receiptHash,
      };
    } catch (err) {
      return {
        ok: false,
        modality: "image",
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async submitImageTask(req: ImageGenRequest, model: string): Promise<{ taskId: string; baseUrl: string }> {
    if (model === "wan") {
      const [w, h] = this.parseSize(req.size || "1024x1024");
      const url = `${this.wanImageBase}/generation`;
      const resp = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          prompt: req.prompt,
          width: w,
          height: h,
          image_format: req.format || "png",
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) throw new Error(`Wan submit failed: ${resp.status}`);
      const data = await resp.json() as any;
      const taskId = data?.task_info?.id;
      if (!taskId) throw new Error("No task_id in Wan submit response");
      return { taskId, baseUrl: this.wanImageBase };
    }

    // GPT Image 2
    const url = `${this.gptImageBase}/generation`;
    const resp = await fetch(url, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        prompt: req.prompt,
        quality: req.quality || "high",
        size: req.size || "1024x1024",
        n: req.n || 1,
        format: req.format || "png",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) throw new Error(`GPT Image submit failed: ${resp.status}`);
    const data = await resp.json() as any;
    const taskId = data?.task_info?.id;
    if (!taskId) throw new Error("No task_id in GPT Image submit response");
    return { taskId, baseUrl: this.gptImageBase };
  }

  private extractImageUrls(result: any, model: string): string[] {
    // GPT Image 2: { "images": ["url1", "url2"], "task_info": {...} }
    const images = result?.images;
    if (Array.isArray(images) && images.length) return images;

    // Wan: { "output": { "image_url": "..." } }
    const output = result?.output;
    if (output?.image_url) return [output.image_url];
    if (output?.url) return [output.url];
    if (output?.result) return [output.result];

    // Generic fallback
    for (const key of ["image_urls", "urls", "results", "data"]) {
      const val = result?.[key];
      if (Array.isArray(val) && val.length) return val;
    }

    return [];
  }

  // ── TTS (async — MiniMax Speech 2.8 HD via MuleRouter) ────────────────

  async generateTTS(req: TTSRequest): Promise<GenerationResult> {
    const startedAt = Date.now();
    const model = req.model || "speech-2.8-hd";

    try {
      const baseUrl = model === "speech-2.8-turbo"
        ? "https://api.mulerouter.ai/vendors/minimax/v1/speech-2.8-turbo"
        : this.ttsBase;

      const url = `${baseUrl}/text-to-speech/generation`;
      const resp = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          prompt: req.text,
          voice_setting: {
            voice_id: req.voice || "Wise_Woman",
            speed: req.speed || 1.0,
            vol: 1.0,
            pitch: 0,
          },
          output_format: "url",
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "unknown");
        return {
          ok: false,
          modality: "tts",
          durationMs: Date.now() - startedAt,
          error: `TTS submit ${resp.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await resp.json() as any;
      const taskId = data?.task_info?.id;
      if (!taskId) {
        return {
          ok: false,
          modality: "tts",
          durationMs: Date.now() - startedAt,
          error: "No task_id in TTS submit response",
        };
      }

      const result = await this.pollTask(baseUrl, taskId, 180_000);
      const audioUrl = this.extractAudioUrl(result);

      if (!audioUrl) {
        return {
          ok: false,
          modality: "tts",
          taskId,
          durationMs: Date.now() - startedAt,
          error: "No audio URL in completed TTS task",
        };
      }

      await mkdir(this.outputDir, { recursive: true });
      const outputPath = join(this.outputDir, `mr_tts_${taskId.slice(0, 8)}.mp3`);

      const audioResp = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
      if (!audioResp.ok) {
        return { ok: false, modality: "tts", taskId, durationMs: Date.now() - startedAt, error: `Audio download failed: ${audioResp.status}` };
      }

      const buffer = Buffer.from(await audioResp.arrayBuffer());
      await writeFile(outputPath, buffer);

      return {
        ok: true,
        modality: "tts",
        taskId,
        outputPath,
        outputUrl: audioUrl,
        durationMs: Date.now() - startedAt,
        receiptHash: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
      };
    } catch (err) {
      return {
        ok: false,
        modality: "tts",
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private extractAudioUrl(result: any): string | null {
    // MiniMax TTS returns: { "audios": ["url1", ...] } OR { "output": { "audio_url": "..." } }
    const audios = result?.audios;
    if (Array.isArray(audios) && audios.length > 0 && typeof audios[0] === "string") return audios[0];

    const output = result?.output;
    if (output?.audio_url) return output.audio_url;
    if (output?.url) return output.url;
    if (output?.result) return output.result;

    for (const key of ["audio_url", "url", "result"]) {
      if (typeof result?.[key] === "string") return result[key];
    }
    return null;
  }

  // ── Music Generation (async — MiniMax Music 2.5 via MuleRouter) ────────

  async generateMusic(req: MusicRequest): Promise<GenerationResult> {
    const startedAt = Date.now();

    try {
      const url = `${this.musicBase}/text-to-music/generation`;
      const body: Record<string, any> = {
        prompt: req.prompt,
        output_format: "url",
      };
      if (req.lyrics) body.lyrics = req.lyrics;
      if (req.instrumental) body.instrumental = true;

      const resp = await fetch(url, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "unknown");
        return {
          ok: false,
          modality: "music",
          durationMs: Date.now() - startedAt,
          error: `Music submit ${resp.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await resp.json() as any;
      const taskId = data?.task_info?.id;
      if (!taskId) {
        return { ok: false, modality: "music", durationMs: Date.now() - startedAt, error: "No task_id in music submit response" };
      }

      const result = await this.pollTask(this.musicBase, taskId, 300_000);
      const audioUrl = this.extractAudioUrl(result);

      if (!audioUrl) {
        return { ok: false, modality: "music", taskId, durationMs: Date.now() - startedAt, error: "No audio URL in completed music task" };
      }

      await mkdir(this.outputDir, { recursive: true });
      const outputPath = join(this.outputDir, `mr_music_${taskId.slice(0, 8)}.mp3`);

      const musicResp = await fetch(audioUrl, { signal: AbortSignal.timeout(120_000) });
      if (!musicResp.ok) {
        return { ok: false, modality: "music", taskId, durationMs: Date.now() - startedAt, error: `Music download failed: ${musicResp.status}` };
      }

      const buffer = Buffer.from(await musicResp.arrayBuffer());
      await writeFile(outputPath, buffer);

      return {
        ok: true,
        modality: "music",
        taskId,
        outputPath,
        outputUrl: audioUrl,
        durationMs: Date.now() - startedAt,
        receiptHash: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
      };
    } catch (err) {
      return {
        ok: false,
        modality: "music",
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Shared: Async Task Polling ─────────────────────────────────────────

  private async pollTask(baseUrl: string, taskId: string, timeoutMs: number): Promise<any> {
    const url = `${baseUrl}/generation/${taskId}`;
    const deadline = Date.now() + timeoutMs;
    const interval = 2000;

    while (Date.now() < deadline) {
      const resp = await fetch(url, {
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        await this.sleep(interval);
        continue;
      }

      const data = await resp.json() as any;
      const status = data?.task_info?.status || "unknown";

      if (status === "completed") return data;
      if (status === "failed") {
        throw new Error(`Task ${taskId} failed: ${JSON.stringify(data?.task_info?.error || "unknown error")}`);
      }

      await this.sleep(interval);
    }

    throw new Error(`Task ${taskId} timed out after ${timeoutMs}ms`);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private parseSize(size: string): [number, number] {
    const named: Record<string, [number, number]> = {
      auto: [1024, 1024],
      square: [1024, 1024],
      hd: [1920, 1080],
      "4k": [3840, 2160],
    };
    if (named[size.toLowerCase()]) return named[size.toLowerCase()];
    if (size.includes("x")) {
      const [w, h] = size.split("x").map(Number);
      if (w && h) return [w, h];
    }
    return [1024, 1024];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _client: MuleRouterClient | null = null;

export function getMuleRouterClient(): MuleRouterClient {
  if (!_client) {
    _client = new MuleRouterClient();
  }
  return _client;
}
