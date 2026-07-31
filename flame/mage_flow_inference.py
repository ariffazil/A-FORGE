#!/usr/bin/env python3
"""
Mage-Flow Inference — Modal.com Serverless GPU Deployment
=========================================================
Real MageFlowPipeline wired to microsoft/Mage-Flow-Turbo (4B, 4-step distilled).
Zero idle cost. SDPA backend (no flash-attn needed).

DITEMPA BUKAN DIBERI — Rewired 2026-07-26

─── DEPLOY ─────────────────────────────────────────────────────────────
modal deploy mage_flow_inference.py
"""

from __future__ import annotations

import io
import base64
import time
import hashlib
import json
from pathlib import Path

import modal
from pydantic import BaseModel, Field

# ── Constants ──────────────────────────────────────────────────────────────
APP_NAME = "mage-flow-inference"
MODEL_CACHE_VOLUME = "mage-model-cache"
HF_SECRET_NAME = "hf-token"
MODEL_ID = "microsoft/Mage-Flow-Turbo"
DEFAULT_GPU = "l40s"
CACHE_MOUNT = "/model-cache"

# ── PRIMITIVE 1: Image ────────────────────────────────────────────────────

_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch>=2.5.0",
        "torchvision>=0.20.0",
        "diffusers>=0.37.0",
        "transformers>=4.46.0",
        "accelerate>=1.0.0",
        "einops>=0.8.0",
        "pydantic>=2.0",
        "pillow>=10.0",
        "safetensors>=0.4.0",
        "huggingface_hub>=0.25",
        "loguru>=0.7.0",
        "fastapi[standard]>=0.115.0",
    )
    .add_local_dir(Path(__file__).parent / "mage_flow", "/root/mage_flow", copy=True)
)

# ── PRIMITIVE 2: Volume ───────────────────────────────────────────────────

_model_volume = modal.Volume.from_name(MODEL_CACHE_VOLUME, create_if_missing=True)

# ── PRIMITIVE 3: Secret ───────────────────────────────────────────────────

_hf_secret = modal.Secret.from_name(HF_SECRET_NAME)

# ── App ────────────────────────────────────────────────────────────────────

app = modal.App(name=APP_NAME, image=_image, secrets=[_hf_secret] if _hf_secret else [])


# ── PRIMITIVE 4: Inference Class ──────────────────────────────────────────


@app.cls(
    gpu=DEFAULT_GPU,
    image=_image,
    volumes={CACHE_MOUNT: _model_volume},
    env={
        "HF_HOME": f"{CACHE_MOUNT}/huggingface",
        "HF_HUB_CACHE": f"{CACHE_MOUNT}/huggingface/hub",
        "TORCH_HOME": f"{CACHE_MOUNT}/torch",
        "XDG_CACHE_HOME": CACHE_MOUNT,
    },
    scaledown_window=300,
    timeout=600,
)
class MageFlowInference:
    @modal.enter()
    def load_pipeline(self):
        import sys

        sys.path.insert(0, "/root")

        # Patch TextEncoder to use SDPA — no flash-attn in this image
        import mage_flow.models.modules.text_encoder as _te

        _orig_init = _te.TextEncoder.__init__

        def _patched_init(self, *args, **kwargs):
            kwargs["attn_type"] = "sdpa"
            _orig_init(self, *args, **kwargs)

        _te.TextEncoder.__init__ = _patched_init

        # Patch DiT attention backend to SDPA
        from mage_flow.models.modules._attn_backend import set_attn_backend

        set_attn_backend("sdpa")

        from mage_flow import MageFlowPipeline

        self._pipe = MageFlowPipeline.from_pretrained(MODEL_ID, device="cuda")
        self._model_id = MODEL_ID
        print(f"[MageFlow] ✅ Pipeline loaded: {MODEL_ID}")

    @modal.method()
    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        steps: int = 4,
        cfg: float = 5.0,
        seed: int = 42,
        height: int = 1024,
        width: int = 1024,
        prompt_template: str = "mage-flow",
    ) -> dict:
        t0 = time.perf_counter()
        print(f"[MageFlow] 🎨 '{prompt[:80]}...' steps={steps} seed={seed}")

        imgs = self._pipe.generate(
            [prompt],
            neg_prompts=[negative_prompt] if negative_prompt else None,
            seeds=[seed],
            heights=[height],
            widths=[width],
            steps=steps,
            cfg=cfg,
            prompt_template=prompt_template,
        )

        dt = int((time.perf_counter() - t0) * 1000)
        buf = io.BytesIO()
        imgs[0].save(buf, format="PNG")
        image_b64 = base64.b64encode(buf.getvalue()).decode()
        fingerprint = hashlib.sha256(
            f"{prompt}|{seed}|{width}x{height}|{dt}".encode()
        ).hexdigest()

        print(f"[MageFlow] ✅ {dt}ms seed={seed}")
        return {
            "image_b64": image_b64,
            "format": "png",
            "seed": seed,
            "inference_ms": dt,
            "model": self._model_id,
            "fingerprint": fingerprint,
        }

    @modal.method()
    def health(self) -> dict:
        import torch

        return {
            "status": "healthy" if hasattr(self, "_pipe") else "loading",
            "model": getattr(self, "_model_id", "unknown"),
            "gpu": (
                torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
            ),
            "vram_total_gb": (
                torch.cuda.get_device_properties(0).total_memory / 1e9
                if torch.cuda.is_available()
                else 0
            ),
        }


# ── PRIMITIVE 5: Web Endpoint ─────────────────────────────────────────────


@app.function(
    image=_image,
    volumes={CACHE_MOUNT: _model_volume},
    env={
        "HF_HOME": f"{CACHE_MOUNT}/huggingface",
        "HF_HUB_CACHE": f"{CACHE_MOUNT}/huggingface/hub",
    },
    secrets=[_hf_secret] if _hf_secret else [],
)
@modal.fastapi_endpoint(method="POST")
def api_generate(request: dict):
    prompt = request.get("prompt", "")
    if not prompt:
        return {"error": "prompt is required", "status": "REJECTED"}

    inference = MageFlowInference()
    result = inference.generate.remote(
        prompt=prompt,
        negative_prompt=request.get("negative_prompt", ""),
        steps=request.get("steps", 4),
        cfg=request.get("cfg", 5.0),
        seed=request.get("seed", 42),
        height=request.get("height", 1024),
        width=request.get("width", 1024),
        prompt_template=request.get("prompt_template", "mage-flow"),
    )
    return result


# ── Download helper ────────────────────────────────────────────────────────


@app.function(
    image=_image,
    volumes={CACHE_MOUNT: _model_volume},
    env={
        "HF_HOME": f"{CACHE_MOUNT}/huggingface",
        "HF_HUB_CACHE": f"{CACHE_MOUNT}/huggingface/hub",
    },
    secrets=[_hf_secret] if _hf_secret else [],
    timeout=3600,
)
def download_models():
    from huggingface_hub import snapshot_download

    print(f"[MageFlow] 📥 Pre-caching {MODEL_ID}...")
    snapshot_download(MODEL_ID)
    _model_volume.commit()
    print(f"[MageFlow] ✅ Cache committed")


# ── Local test ─────────────────────────────────────────────────────────────


@app.local_entrypoint()
def main():
    print(f"Testing Mage-Flow — {MODEL_ID}")
    inference = MageFlowInference()
    health = inference.health.remote()
    print(f"Health: {json.dumps(health, indent=2)}")

    result = inference.generate.remote(
        prompt="A serene Malaysian tropical landscape at golden hour, "
        "traditional wooden houses among coconut trees, photorealistic",
        steps=4,
        seed=42,
    )
    if result.get("image_b64"):
        out = Path("/tmp/mage_test_output.png")
        out.write_bytes(base64.b64decode(result["image_b64"]))
        print(f"✅ {out} ({result['inference_ms']}ms)")
    else:
        print(f"❌: {result}")
