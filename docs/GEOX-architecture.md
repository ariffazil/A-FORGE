# GEOX Architecture — Geological Intelligence Coprocessor for arifOS

> DITEMPA BUKAN DIBERI

---

## 1. Overview

GEOX is **not a model**. It is a governed agentic system that orchestrates Large Earth Models (LEM), Vision Language Models (VLM), and LLM-based planning (via arifOS) under constitutional governance.

GEOX sits between the physical Earth and arifOS's language kernel as a **domain coprocessor** — it adds geological grounding, perception bridging, and Earth-physics contracts to every inference.

```
arifOS kernel
    └── GeoXAgent (GEOX coprocessor)
            ├── EarthModelTool    (LEM)
            ├── SimulatorTool     (PVT / basin simulator)
            ├── EOFoundationModelTool (Earth Observation VLM)
            ├── SeismicVLMTool    (seismic interpretation VLM)
            └── GeoRAGTool        (geological literature RAG)
```

---

## 2. Four-Plane Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  PLANE 4: GOVERNANCE                                            │
│  Constitutional Floors: F1·F2·F4·F7·F9·F11·F12·F13            │
│  Risk Gating · 888 HOLD · Human Veto · vault_ledger(999)       │
│  GeoXReporter · Audit Chain · Regulator Escalation             │
├─────────────────────────────────────────────────────────────────┤
│  PLANE 3: LANGUAGE / AGENT  (arifOS kernel)                     │
│  000 INIT → 111 THINK → 333 EXPLORE → 555 HEART                │
│           → 777 REASON → 888 AUDIT → 999 SEAL                  │
│  GeoXAgent · agi_mind planner · vault_ledger audit sink        │
│  GeoMemoryStore ←→ Qdrant M4 · GeoXValidator synthesis         │
├─────────────────────────────────────────────────────────────────┤
│  PLANE 2: PERCEPTION  (VLM Bridge)                              │
│  SeismicVLMTool · EOFoundationModelTool                         │
│  RGB ≠ Truth · uncertainty ≥ 0.15 ALWAYS · multisensor req.    │
│  VLM claims: ambiguous max without corroboration                │
├─────────────────────────────────────────────────────────────────┤
│  PLANE 1: EARTH  (Physical Reality)                             │
│  EarthModelTool · SimulatorTool · GeoRAGTool                    │
│  Every quantity: value + units + coordinates + timestamp        │
│                + uncertainty [0.03, 0.15] + ProvenanceRecord    │
└─────────────────────────────────────────────────────────────────┘
```

**The fundamental direction is Earth → Language, never Language → Earth.**
Language may describe the Earth; it may never assert physical truth without Earth-tool verification.

---

## 3. Component Architecture

### GeoXAgent
The main orchestrator. Dependency-injectable — arifOS plugs in its kernel via three injection points:
- `llm_planner`: calls `agi_mind (333)` for tool sequence planning
- `audit_sink`: calls `vault_ledger (999)` to seal every action
- `memory_store`: wraps `M4 Qdrant` for geological context retrieval

Pipeline method chain:
```
evaluate_prospect(GeoRequest)
  → plan()       : LLM planner produces tool sequence
  → execute()    : runs tools with retry, logs to audit_sink
  → synthesise() : converts GeoToolResult → GeoInsight
  → validate()   : Earth→Language contract enforcement
  → summarise()  : assembles GeoResponse + arifOS telemetry
```

### GeoXValidator
The Earth→Language contract enforcer. Three responsibilities:
1. **extract_predictions()** — parse LLM-generated text into testable GeoPredictions (regex + heuristics, extracts value, units, coordinates)
2. **verify_prediction()** — run each prediction against tool ensemble, compare predicted range vs returned quantities
3. **validate_batch()** — aggregate per-insight verdicts into SEAL / PARTIAL / SABAR / VOID

### ToolRegistry
A dependency-injection container for all geological tools. Allows production tools and mock tools to implement the same `BaseTool` ABC and be swapped transparently.

### GeoMemoryStore
Geological context memory. Default: in-memory dict for testing. Production: Qdrant vector store (same cluster as arifOS M4). Exports JSONL for HuggingFace Dataset ingestion.

### GeoXReporter
Generates three output formats from every GeoResponse:
- **Markdown report**: tables, floor checklist, 888 HOLD notice, telemetry block
- **JSON audit**: machine-readable, vault_ledger compatible
- **Human brief**: 3-paragraph plain language summary for non-technical stakeholders

### GeoXMCPServer
Exposes GEOX as an MCP-compatible tool server (JSON-RPC 2.0 over HTTP). Registers three tools: `geox_evaluate_prospect`, `geox_query_memory`, `geox_health`. Runs on port 8100.

---

## 4. Data Flow Sequence

```
Client / arifOS kernel
    │
    ▼  GeoRequest (prospect_name, location, basin, available_data, risk_tolerance)
GeoXAgent.evaluate_prospect()
    │
    ├─[000 INIT]──► validate request, check F11 authority, init session
    │
    ├─[111 THINK]─► plan() → agi_mind(333) produces tool sequence
    │               e.g. ["EarthModelTool", "SimulatorTool", "GeoRAGTool", "SeismicVLMTool"]
    │
    ├─[333 EXPLORE]► execute() → run each BaseTool → GeoToolResult[]
    │               Each result: { quantities: GeoQuantity[], metadata, latency_ms }
    │
    ├─[555 HEART]──► synthesise() → GeoToolResult[] → GeoInsight[]
    │               VLM insights: risk bumped up one tier (perception bridge)
    │               All insights: provenance_chain populated
    │
    ├─[777 REASON]─► validate() → GeoXValidator.validate_batch()
    │               Per insight: extract_predictions → verify vs tools → ValidationResult
    │               Aggregate: SEAL | PARTIAL | SABAR | VOID
    │
    ├─[888 AUDIT]──► if human_signoff_required: add 888 HOLD to telemetry
    │               seal all tool calls + verdicts to audit_sink (vault_ledger)
    │
    └─[999 SEAL]───► summarise() → GeoResponse
                    arifos_telemetry block attached
                    GeoMemoryStore.store() called
                    Return to client
```

---

## 5. Tool Registry Design

All tools implement `BaseTool` (ABC), enabling transparent mock ↔ production swapping:

```python
class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @abstractmethod
    async def run(self, inputs: dict) -> GeoToolResult: ...
```

| Tool | Plane | Data contract (inputs → quantities) |
|------|-------|--------------------------------------|
| `EarthModelTool` | Earth | query + location + depth_range → seismic_velocity, density, porosity |
| `EOFoundationModelTool` | Perception | bbox + bands + date_range → surface_reflectance, ndvi, thermal_anomaly |
| `SeismicVLMTool` | Perception | image_path + query → fault_probability, amplitude_anomaly, structural_closure_m |
| `SimulatorTool` | Earth | scenario + timesteps_ma → pressure_psi, temperature_degC, maturity_ro |
| `GeoRAGTool` | Earth | query + basin + max_results → literature-backed GeoQuantity proxies |

**SeismicVLMTool contract**: uncertainty always ≥ 0.15. metadata always includes `multisensor_required: True`. This is a compile-time invariant in the perception bridge.

---

## 6. Validator Logic — Earth→Language Contract

### Step 1: extract_predictions(text, location)
Regex patterns scan LLM output for geological quantity claims:
- `"(\d+\.?\d*)\s*m(?:eters?)?\s+(?:of\s+)?net\s+pay"` → target="net_pay_m", units="m"
- `"porosity\s+(?:of\s+)?(\d+\.?\d*)\s*%"` → target="porosity", units="%"
- `"pressure\s+(?:of\s+)?(\d+\.?\d*)\s*MPa"` → target="pressure", units="MPa"
- Plus patterns for temperature, velocity, density, maturity

Each match → GeoPrediction with: target, location, expected_range (±20% of extracted value), confidence=0.7 default.

### Step 2: verify_prediction(pred, tools)
For each tool in ensemble:
- Call tool.run() with prediction location
- Find quantity matching pred.target
- Check if quantity.value is within pred.expected_range

```
overlap check:
  tool_value in [pred.expected_range[0], pred.expected_range[1]] → supported
  tool_value outside range AND uncertainty bands don't overlap → contradicted
  else → ambiguous
```

### Step 3: validate_batch → SEAL / PARTIAL / SABAR / VOID

| Condition | Verdict |
|-----------|---------|
| ≥80% supported, 0 contradicted | SEAL |
| 50–79% supported OR any ambiguous | PARTIAL |
| <50% supported, no contradicted | SABAR (need more data) |
| Any insight contradicted | VOID |

---

## 7. Memory Architecture

```
GeoXAgent
    └── GeoMemoryStore
            ├── [default]  in-memory dict (testing / single-node)
            └── [production] Qdrant client (same cluster as arifOS M4)
                    collection: "geox_geological_memory"
                    vectors: 1536-dim (OpenAI ada-002 or bge-m3 compatible)

GeoMemoryStore.export_jsonl(path)
    └── JSONL file → HuggingFace Dataset upload
```

Each `GeoMemoryEntry` stores: prospect_name, basin, insight_text, verdict, confidence, timestamp, metadata. Deduplication via SHA-256 of insight text.

---

## 8. MCP Server Integration

GEOX exposes itself as an MCP tool server. arifOS discovers it via its MCP registry.

**Add to arifOS config** (`config/mcp_servers.yaml` or equivalent):
```yaml
mcp_servers:
  - name: geox
    url: http://geox-server:8100/mcp
    tools:
      - geox_evaluate_prospect
      - geox_query_memory
      - geox_health
    auth: none  # add bearer token in production
```

**Tool call example** from arifOS:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "geox_evaluate_prospect",
    "arguments": { "request": { "prospect_name": "Blok Selatan", ... } }
  }
}
```

The MCP server deserializes `arguments.request` into a `GeoRequest`, runs `GeoXAgent.evaluate_prospect()`, and returns a serialized `GeoResponse`.

---

## 9. Governance Pipeline

Risk level routing in `GeoXAgent.summarise()`:

| Risk Level | Threshold | Action | 888 HOLD? |
|------------|-----------|--------|-----------|
| `low` | <0.5 | auto-proceed | No |
| `medium` | 0.5–0.8 | human_signoff (48h SLA) | Yes |
| `high` | 0.8–0.95 | Chief Geoscientist + HSE | Yes |
| `critical` | ≥0.95 | regulator_required + legal | Yes |

When 888 HOLD fires:
- `arifos_telemetry.hold = "888 HOLD"`
- `GeoResponse.human_signoff_required = True`
- `GeoXReporter` prepends 888 HOLD notice to all report formats
- `audit_sink` (vault_ledger) sealed with HOLD status
- No downstream auto-action taken

---

## 10. Constitutional Floor Compliance Matrix

| Floor | Name | INIT | THINK | EXPLORE | HEART | REASON | AUDIT | SEAL |
|-------|------|------|-------|---------|-------|--------|-------|------|
| F1 | Amanah | ✓ | — | ✓ | — | — | ✓ | ✓ |
| F2 | Truth | — | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| F4 | Clarity | — | — | — | ✓ | ✓ | — | ✓ |
| F7 | Humility | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| F9 | Anti-Hantu | ✓ | — | — | — | ✓ | ✓ | ✓ |
| F11 | Authority | ✓ | — | — | — | — | ✓ | — |
| F12 | Injection | ✓ | ✓ | — | — | — | — | — |
| F13 | Sovereign | — | — | — | — | — | ✓ | ✓ |

✓ = enforced / advisory at this stage — = not applicable
