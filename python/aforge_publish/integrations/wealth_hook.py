"""WEALTH integration hook — facade over organ_hooks.WealthHook."""

from .organ_hooks import WealthHook, MCPClient

__all__ = ["WealthHook", "MCPClient"]
