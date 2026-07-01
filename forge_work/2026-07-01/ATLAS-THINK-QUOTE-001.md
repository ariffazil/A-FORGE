---
id: ATLAS-THINK-QUOTE-001
title: "arif_think 7-Mode Quote Atlas"
type: philosophical-anchor-atlas
domain: arifOS/kernel/arif_think
ratified_by: F13 SOVEREIGN (888)
date: 2026-07-01
status: SEALED
---

# arif_think Quote Atlas v1

## Core Policy

```yaml
quote_policy:
  purpose: "cognitive constraint"
  display_default: "hidden"
  display_when:
    - debug_mode
    - teaching_mode
    - receipt_mode
    - user_request
  max_quotes_per_mode: 1
  max_active_quote_per_call: 1
  never_use_quote_as_evidence: true
  never_use_quote_as_authority: true
  authority:
    quote_can:
      - shape reasoning discipline
      - trigger caution
      - remind mode purpose
    quote_cannot:
      - prove a conclusion
      - approve execution
      - override evidence
      - replace arif_judge
      - replace VAULT999 receipt
```

## Required Fields

```yaml
required_fields:
  - quote_id
  - mode
  - text
  - author
  - source
  - source_status
  - function
  - agent_constraint
```

---

## Mode 1: `analyze`

**Quote:**
> "All models are wrong, but some are useful."
> — George E. P. Box

**Source:** Box & Draper, *Evolutionary Operation* (1987), widely cited.

```yaml
mode: analyze
quote_id: THINK-ANALYZE-01
text: "All models are wrong, but some are useful."
author: "George E. P. Box"
source: "Evolutionary Operation, 1987"
source_status: VERIFIED
function: anti-model-worship
agent_constraint: "Treat analysis as map, not territory. Label assumptions and missing data."
```

**Cognitive governor:** Analysis always builds a model of reality. The model is never reality. Prevents model-worship — mistaking framework for truth.

---

## Mode 2: `critique`

**Quote:**
> "He who knows only his own side of the case knows little of that."
> — John Stuart Mill

**Source:** *On Liberty* (1859), Chapter 2.

```yaml
mode: critique
quote_id: THINK-CRITIQUE-01
text: "He who knows only his own side of the case knows little of that."
author: "John Stuart Mill"
source: "On Liberty, 1859"
source_status: VERIFIED
function: force-opposition
agent_constraint: "State the strongest opposing case before recommending."
```

**Cognitive governor:** Critique means attacking your own case before the world attacks it. Forces adversarial self-check.

---

## Mode 3: `metabolize`

**Quote:**
> "Ignorance more frequently begets confidence than does knowledge."
> — Charles Darwin

**Source:** *The Descent of Man* (1871), Introduction.

```yaml
mode: metabolize
quote_id: THINK-METABOLIZE-01
text: "Ignorance more frequently begets confidence than does knowledge."
author: "Charles Darwin"
source: "The Descent of Man, 1871"
source_status: VERIFIED
function: anti-false-confidence
agent_constraint: "When input is messy, reduce confidence. Do not upgrade noise into truth."
```

**Cognitive governor:** Metabolism is where raw input becomes governed meaning. The danger is false confidence. Stops the agent from upgrading messy input into certainty.

---

## Mode 4: `plan`

**Quote:**
> "Can machines think?" should be replaced by a clearer question.
> — Alan Turing

**Source:** *Computing Machinery and Intelligence* (1950), Section 1. Paraphrased.

```yaml
mode: plan
quote_id: THINK-PLAN-01
text: "Can machines think?" should be replaced by a clearer question.
author: "Alan Turing"
source: "Computing Machinery and Intelligence, 1950"
source_status: PARAPHRASE
function: question-refinement
agent_constraint: "Before planning, restate the problem in operational terms. Convert vague desire into executable shape."
```

**Cognitive governor:** Planning fails when the question is badly framed. Forces question refinement before path generation.

---

## Mode 5: `reflect`

**Quote:**
> "The unexamined life is not worth living."
> — Socrates (recorded by Plato)

**Source:** Plato, *Apology* 38a.

```yaml
mode: reflect
quote_id: THINK-REFLECT-01
text: "The unexamined life is not worth living."
author: "Socrates / Plato"
source: "Apology, 38a"
source_status: VERIFIED
function: self-examination
agent_constraint: "Extract lessons, scars, patterns, and consequences. Do not rush to execute."
```

**Cognitive governor:** Reflect mode is not for action. It is for self-examination. Extract lessons before next action.

---

## Mode 6: `compare`

**Quote:**
> "The first principle is that you must not fool yourself—and you are the easiest person to fool."
> — Richard Feynman

**Source:** *Surely You're Joking, Mr. Feynman!* (1985), attributed. Primary citation not yet canon-verified.

```yaml
mode: compare
quote_id: THINK-COMPARE-01
text: "The first principle is that you must not fool yourself—and you are the easiest person to fool."
author: "Richard Feynman"
source: "Surely You're Joking, Mr. Feynman!, 1985"
source_status: NEEDS_PRIMARY_VERIFICATION
function: anti-self-deception
agent_constraint: "Compare options against the same criteria. Do not favor the preferred answer."
```

**Cognitive governor:** Compare mode is vulnerable to preference laundering. The agent may already prefer one option and invent reasons. Forces symmetric comparison.

---

## Mode 7: `summarize`

**Quote:**
> "The fundamental problem of communication is reproducing at one point either exactly or approximately a message selected at another point."
> — Claude Shannon

**Source:** *The Mathematical Theory of Communication* (1948). Paraphrased.

```yaml
mode: summarize
quote_id: THINK-SUMMARIZE-01
text: "The fundamental problem of communication is reproducing at one point either exactly or approximately a message selected at another point."
author: "Claude Shannon"
source: "The Mathematical Theory of Communication, 1948"
source_status: PARAPHRASE
function: preserve-signal
agent_constraint: "Compress without changing meaning, authority, uncertainty, or decision status."
```

**Cognitive governor:** Summarization is compression. Compression can destroy meaning. Preserve signal, reduce noise, avoid distortion.

---

## Top-3 (If Only Three Fit)

If only three quotes can be deployed:

```yaml
top_3:
  1:
    mode: metabolize
    quote: "Ignorance more frequently begets confidence than does knowledge."
    reason: "Stops false certainty."
  2:
    mode: analyze
    quote: "All models are wrong, but some are useful."
    reason: "Stops model worship."
  3:
    mode: critique
    quote: "He who knows only his own side of the case knows little of that."
    reason: "Forces adversarial self-check."
```

These three prevent the most dangerous agent failures:
```
false confidence  →  metabolize anchor stops it
model worship     →  analyze anchor stops it
one-sided reason  →  critique anchor stops it
```

---

## What NOT to Embed

```yaml
excluded:
  - motivational quotes
  - vague quotes
  - uncited quotes
  - overused quotes
  - spiritualized quotes
  - aesthetic but non-operational quotes
  - fake-attributed quotes
  - quotes longer than 3 sentences
  examples:
    - "Be the change you wish to see in the world"
    - "Think different"
    - "The journey is the destination"
    - "Knowledge is power"
    - "Everything happens for a reason"
```

---

## Display Structure

When a quote IS shown (debug/teaching/receipt/user_request):

```yaml
philosophical_anchor:
  quote_id: "THINK-CRITIQUE-01"
  mode: "critique"
  text: "He who knows only his own side of the case knows little of that."
  author: "John Stuart Mill"
  source: "On Liberty, 1859"
  source_status: VERIFIED
  function: "force-opposition"
  agent_constraint: "State the strongest opposing case before recommending."
  display_policy:
    default: "hidden"
    show_when:
      - user_asks
      - debug_mode
      - receipt_mode
      - teaching_mode
```

## Metadata

```yaml
sealed_by: FORGE (A-FORGE)
vault_id: VAULT999/atlas/ATLAS-THINK-QUOTE-001
ratified: F13 SOVEREIGN 888
date: 2026-07-01
entropy_delta: -0.2  # reduces reasoning drift
blast_radius: LOW    # metadata only, no mutation
reversibility: FULL  # quote atlas can be updated via F13 + new SEAL
modes_covered: 7
quotes_verified: 5
quotes_needing_verification: 2  # Feynman, Shannon paraphrase
```
