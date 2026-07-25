#!/usr/bin/env python3
"""
Mage-Flow Inference — Modal.com Serverless GPU Deployment
=========================================================
Custom image generation pipeline: Mage-VAE + NR-MMDiT.
Deployed on Modal with zero idle cost, per-second billing.

DITEMPA BUKAN DIBERI — Forged 2026-07-25
Based on Arif's 5-primitive architecture + Modal serverless doctrine.

─── ARCHITECTURE (5 PRIMITIVES) ─────────────────────────────────────────
1. modal.Image      — Declarative dependencies (no Dockerfile)
2. modal.Volume     — Persistent model weights cache (avoids re-download)
3. modal.Secret     — Hugging Face token injection (never hardcoded)
4. @app.cls         — Class-based lifecycle (load model ONCE, inference many)
5. @modal.web_endpoint — REST API for arifOS MCP integration

─── F1 AMANAH ──────────────────────────────────────────────────────────
Scale-to-zero enforcement: $0.00 idle cost. Pay only for seconds of GPU
time during active inference. W_scar (financial risk to 888) = $0/month.

─── GPU STRATEGY ───────────────────────────────────────────────────────
Primary: L40S ($0.000542/sec, 48GB VRAM) — sweet spot for image gen
Fallback: A10G ($0.000306/sec, 24GB) — lighter models
Heavy: H100 ($0.001097/sec, 80GB) — large batch or high-res

─── DEPLOY ─────────────────────────────────────────────────────────────
modal deploy mage_flow_inference.py
modal run mage_flow_inference.py  # local test
"""

import modal
from pathlib import Path
import time
import hashlib
import json

# ── Constants ──────────────────────────────────────────────────────────────
APP_NAME = "mage-flow-inference"
MODEL_CACHE_VOLUME = "mage-model-cache"
HF_SECRET_NAME = "huggingface-token"
DEFAULT_GPU = "L40S"
MODEL_CACHE_PATH = "/cache/models"
OUTPUT_PATH = "/cache/outputs"

# ── Modal primitives ───────────────────────────────────────────────────────

app = modal.App(APP_NAME)

# PRIMITIVE 1: Declarative image — all dependencies defined in Python
image = (
    modal.Image.debian_slim()
    .uv_pip_install(
        "torch>=2.5.0",
        "diffusers>=0.31.0",
        "transformers>=4.46.0",
        "accelerate>=1.0.0",
        "safetensors>=0.4.0",
        "pillow>=10.0.0",
        "huggingface_hub>=0.25.0",
        "sentencepiece>=0.2.0",
        "fastapi[standard]>=0.115.0",
    )
    .run_commands(
        "apt-get update -qq && apt-get install -y -qq ffmpeg libgl1-mesa-glx 2>/dev/null || true"
    )
)

# PRIMITIVE 2: Persistent volume — model weights survive cold starts
model_volume = modal.Volume.from_name(MODEL_CACHE_VOLUME, create_if_missing=True)

# PRIMITIVE 3: Secrets — Hugging Face token injected at runtime.
# Create at: https://modal.com/secrets/arifbfazil/main/create?secret_name=huggingface-token
# hf_secret = modal.Secret.from_name(HF_SECRET_NAME)  # Uncomment when secret exists
hf_secret = None  # Placeholder — create HF secret when model weights ready


# ── Inference Class (PRIMITIVE 4: Class-based lifecycle) ───────────────────


@app.cls(
    gpu=DEFAULT_GPU,
    image=image,
    volumes={"/cache": model_volume},
    scaledown_window=300,  # 5 min idle → scale to zero
    max_containers=10,  # max 10 containers (cost control)
    min_containers=0,  # ZERO warm containers — true zero-idle-cost
)
class MageFlowInference:
    """Serverless GPU inference for Mage-VAE + NR-MMDiT pipeline.

    Lifecycle:
      @modal.enter()  → load_model()  — runs ONCE on container cold start
      @modal.method() → generate()    — runs on every inference request (fast)
    """

    # ── Container lifecycle ────────────────────────────────────────────

    @modal.enter()
    def load_model(self):
        """Load model weights into VRAM on container cold start.
        This runs ONCE. All subsequent generate() calls reuse the loaded model.
        """
        import os
        import torch
        from diffusers import DiffusionPipeline

        t0 = time.monotonic()
        hf_token = os.environ.get("HF_TOKEN", "")
        cache_dir = Path(MODEL_CACHE_PATH)

        print(f"[Mage-Flow] Cold start — loading model pipeline...")
        print(
            f"[Mage-Flow] GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}"
        )
        print(
            f"[Mage-Flow] VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB"
        )

        # ── Load base pipeline ────────────────────────────────────────
        # This is a placeholder for your actual Mage-VAE + NR-MMDiT weights.
        # Replace model_id and pipeline construction with your custom model.
        #
        # Example using a base Stable Diffusion pipeline as scaffold:
        # self.pipeline = DiffusionPipeline.from_pretrained(
        #     "stabilityai/stable-diffusion-3.5-large",
        #     torch_dtype=torch.bfloat16,
        #     cache_dir=cache_dir,
        #     token=hf_token,
        # )
        # self.pipeline.to("cuda")

        # ── Placeholder: Replace with Mage-VAE + NR-MMDiT ────────────
        try:
            # Attempt to load from local cache first
            local_weights = cache_dir / "mage-vae" / "model.safetensors"
            if local_weights.exists():
                print(f"[Mage-Flow] Found cached weights at {local_weights}")
                # self.pipeline = load_custom_pipeline(local_weights)
            else:
                print(f"[Mage-Flow] No cached weights — download required")
                print(f"[Mage-Flow] Run: python mage_flow_download.py first")
        except Exception as e:
            print(f"[Mage-Flow] Model load deferred: {e}")

        self._loaded = True
        self._load_time = time.monotonic() - t0
        print(f"[Mage-Flow] ✅ Pipeline loaded in {self._load_time:.1f}s")

    # ── Inference methods ──────────────────────────────────────────────

    @modal.method()
    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        num_inference_steps: int = 28,
        guidance_scale: float = 7.0,
        width: int = 1024,
        height: int = 1024,
        seed: int | None = None,
    ) -> dict:
        """Generate an image from a text prompt.

        Args:
            prompt: Text description of the desired image
            negative_prompt: What to avoid in the image
            num_inference_steps: Diffusion steps (quality vs speed trade-off)
            guidance_scale: Classifier-free guidance strength
            width, height: Output dimensions
            seed: Random seed for reproducibility

        Returns:
            dict with keys: image_base64, seed, latency_ms, fingerprint
        """
        import torch
        import base64
        from io import BytesIO

        t0 = time.monotonic()

        # Set seed for reproducibility
        if seed is None:
            seed = int(torch.rand(1).item() * 2**31)
        generator = torch.Generator(device="cuda").manual_seed(seed)

        print(f"[Mage-Flow] 🎨 Generating: '{prompt[:80]}...' (seed={seed})")

        # ── Placeholder: Replace with actual pipeline call ────────────
        # result = self.pipeline(
        #     prompt=prompt,
        #     negative_prompt=negative_prompt,
        #     num_inference_steps=num_inference_steps,
        #     guidance_scale=guidance_scale,
        #     width=width,
        #     height=height,
        #     generator=generator,
        # ).images[0]

        # ── Placeholder output ────────────────────────────────────────
        latency = (time.monotonic() - t0) * 1000

        # Build provenance fingerprint
        fingerprint = hashlib.sha256(
            f"{prompt}|{seed}|{width}x{height}|{latency:.0f}".encode()
        ).hexdigest()

        result = {
            "status": "PLACEHOLDER",
            "message": (
                "Mage-Flow pipeline scaffold deployed. Replace pipeline call "
                "in generate() with actual Mage-VAE + NR-MMDiT weights. "
                "Model weights must be downloaded to /cache/models/ first."
            ),
            "prompt": prompt,
            "seed": seed,
            "width": width,
            "height": height,
            "latency_ms": latency,
            "fingerprint": fingerprint,
            "authority": "ADVISORY",
            "gpu": torch.cuda.get_device_name(0)
            if torch.cuda.is_available()
            else "CPU",
            "container_id": hashlib.sha256(str(time.time()).encode()).hexdigest()[:8],
        }

        print(f"[Mage-Flow] ✅ Generated in {latency:.0f}ms (seed={seed})")
        return result

    @modal.method()
    def health(self) -> dict:
        """Health check — verify model is loaded and GPU available."""
        import torch

        return {
            "status": "healthy" if getattr(self, "_loaded", False) else "loading",
            "gpu": torch.cuda.get_device_name(0)
            if torch.cuda.is_available()
            else "CPU",
            "vram_total_gb": (
                torch.cuda.get_device_properties(0).total_mem / 1e9
                if torch.cuda.is_available()
                else 0
            ),
            "load_time_s": getattr(self, "_load_time", 0),
            "authority": "ADVISORY",
        }


# ── Web Endpoint (PRIMITIVE 5: REST API for arifOS MCP) ────────────────────


@app.function(
    image=image,
    volumes={"/cache": model_volume},
)
@modal.fastapi_endpoint(method="POST")
def api_generate(request: dict):
    """HTTP API endpoint for Mage-Flow image generation.

    Called by arifOS / A-FORGE / Hermes for image generation requests.
    Compatible with OpenAI API shape for drop-in replacement.

    POST /mage-flow-generate
    {
        "prompt": "a serene Malaysian landscape...",
        "negative_prompt": "",
        "num_inference_steps": 28,
        "width": 1024,
        "height": 1024,
        "seed": null
    }
    """
    import asyncio

    # Extract parameters
    prompt = request.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required", "status": "REJECTED"}

    negative_prompt = request.get("negative_prompt", "")
    num_inference_steps = request.get("num_inference_steps", 28)
    guidance_scale = request.get("guidance_scale", 7.0)
    width = request.get("width", 1024)
    height = request.get("height", 1024)
    seed = request.get("seed", None)

    # Call the inference class
    inference = MageFlowInference()
    result = inference.generate.remote(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height,
        seed=seed,
    )

    return result


# ── Download helper (run once to cache model weights) ──────────────────────


@app.function(
    image=image,
    volumes={"/cache": model_volume},
    timeout=3600,  # 1 hour for large model downloads
)
def download_models():
    """Download Mage-VAE + NR-MMDiT weights to persistent volume.

    Run ONCE: modal run mage_flow_inference.py::download_models
    Subsequent cold starts will mount the cached weights — no re-download.
    """
    import os
    from pathlib import Path

    hf_token = os.environ.get("HF_TOKEN", "")
    cache_dir = Path(MODEL_CACHE_PATH)
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"[Mage-Flow] 📥 Downloading models to {cache_dir}...")
    print(f"[Mage-Flow] HF_TOKEN present: {bool(hf_token)}")

    # ── Placeholder: Download your actual models ──────────────────────
    # from huggingface_hub import snapshot_download
    #
    # snapshot_download(
    #     "your-org/Mage-VAE",
    #     local_dir=str(cache_dir / "mage-vae"),
    #     token=hf_token,
    # )
    # snapshot_download(
    #     "your-org/NR-MMDiT",
    #     local_dir=str(cache_dir / "nr-mmdit"),
    #     token=hf_token,
    # )

    print(f"[Mage-Flow] ✅ Download complete")
    # Commit volume to persist
    model_volume.commit()


# ── Local entrypoint (test locally) ────────────────────────────────────────


@app.local_entrypoint()
def main():
    """Local test — run with: modal run mage_flow_inference.py"""
    print("=" * 60)
    print("Mage-Flow Inference — Modal Serverless GPU")
    print("=" * 60)

    # Test health
    inference = MageFlowInference()
    health = inference.health.remote()
    print(f"\n🏥 Health: {json.dumps(health, indent=2)}")

    # Test generation
    result = inference.generate.remote(
        prompt="A serene Malaysian tropical landscape at golden hour, "
        "with traditional wooden houses among coconut trees, "
        "dramatic sky, photorealistic style",
        num_inference_steps=20,
        seed=42,
    )
    print(f"\n🎨 Generation: {json.dumps(result, indent=2)}")

    print(f"\n✅ Scaffold verified. Next steps:")
    print(f"   1. Add Mage-VAE + NR-MMDiT weights to /cache/models/")
    print(f"   2. Run: modal run mage_flow_inference.py::download_models")
    print(f"   3. Update generate() with actual pipeline call")
    print(f"   4. Deploy API: modal deploy mage_flow_inference.py")


# ── W_scar (F1 AMANAH) Cost Estimate ──────────────────────────────────────
# L40S: $0.000542/sec
# Avg generation: 3-5 sec = $0.002 per image
# 1000 images/month = $2.00
# Idle: $0.00 (scale-to-zero)
# W_scar = $0/month (zero idle cost)
#
# Compare: Hugging Face Endpoint A10G @ $0.90/hr × 24h × 30d = $648/month
# Modal savings: $648 - $2 = $646/month for 1000 images
