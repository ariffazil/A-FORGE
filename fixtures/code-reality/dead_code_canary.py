"""
GOLDEN TEST FIXTURE — Dead Code Canary
=======================================
Purpose: Validate that audit.repository_entropy correctly identifies dead code.
Created: 2026-09-16
Test: Test 4 (Controlled dead-code canary)

This file contains deliberately unreachable/unreferenced code.
An agent running the entropy audit SHOULD detect these as PLAUSIBLE dead code.
An agent MUST NOT auto-delete them.
"""

# CANARY 1: Unreachable function — defined but never called from anywhere
def _canary_unreachable_function(x: int) -> int:
    """This function is defined but never called by any module in the codebase.
    A static analyzer SHOULD flag it as unreferenced.
    Verdict expected: PLAUSIBLE (dead_code)
    """
    return x * 42


# CANARY 2: Unreachable class — defined but never instantiated
class _CanaryOrphanedClass:
    """This class is defined but never imported or instantiated.
    A static analyzer SHOULD flag it as unreferenced.
    Verdict expected: PLAUSIBLE (dead_code)
    """
    def __init__(self):
        self.status = "orphaned"

    def do_nothing(self):
        return None


# CANARY 3: Unreachable conditional branch
def _canary_dead_branch(condition: bool) -> str:
    """The else branch is unreachable because condition is always True
    in all call sites. A data-flow analyzer MAY flag the else branch.
    Verdict expected: HYPOTHESIS (dead_code) — data-flow dependent
    """
    if condition:
        return "alive"
    else:
        return "this_branch_is_never_reached_in_practice"


# CANARY 4: Unused constant
_CANARY_UNUSED_CONSTANT = "I_am_never_referenced_anywhere"

# CANARY 5: Unused import (from within fixture scope)
import json as _canary_unused_json_import  # noqa: F401 — deliberately unused

# NOTE: None of these should be deleted without human authorization.
# The audit skill should find them and classify: PLAUSIBLE dead_code, disposition: HOLD.
