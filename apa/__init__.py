"""
apa — Agent Protocol Architecture
==================================
APA bridges connect the arifOS kernel to external surfaces (Telegram, Email,
Calendar, GitHub) through lease-gated verbs.

This package provides:
  - apa/core/schemas.py  — canonical Pydantic models (VAULT999Receipt, APAResponse)
  - apa/core/receipt.py  — bridge import surface + factory functions
  - apa/core/act_executor.py — 7-phase ACT execution engine
  - apa/manifests/       — per-connector YAML specifications

Canonical arc: ART → KERNEL → APA → ACT → VAULT999
                arifos   arifos   A-FORGE  A-FORGE  arifos

DITEMPA BUKAN DIBERI — Architecture is forged, not given.
"""

__version__ = "1.0.0"
