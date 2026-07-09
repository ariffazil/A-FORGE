# MCP APPS STANDARDIZATION — Federation Surface Migration (2026-07-09)

> **Purpose:** Standardize GEOX apps as MCP Apps with `ui://` resources and `_meta.ui` metadata.
> **Auditor finding:** "GEOX is one migration step away from becoming a first-class MCP Apps server."
> **Authority:** F13 SOVEREIGN directive

---

## 1. Current State

GEOX has 4 interactive apps defined in its agent instructions:

| App | Purpose | Current Location |
|---|---|---|
| `welldesk` | Well log viewer and QC | `/root/GEOX/apps/welldesk/` |
| `seismic_vision` | Seismic image interpretation | `/root/GEOX/apps/seismic_vision/` |
| `earth_volume` | 3D volume visualization | `/root/GEOX/apps/earth_volume/` |
| `judge_console` | Constitutional verdict display | `/root/GEOX/apps/judge_console/` |

**Problem:** These apps are repo-local HTML/JS. They don't expose `ui://` resources, don't have `_meta.ui` metadata, and can't be discovered by standard MCP hosts (ChatGPT, Claude, etc.).

---

## 2. MCP Apps Standard (v1.0)

Per the MCP Apps extension (2026), an MCP App is:

1. A **tool** that returns `_meta.ui.resourceUri` pointing to a `ui://` resource
2. The host fetches the `ui://` resource and renders it in a **sandboxed iframe**
3. Communication between app and host is over **JSON-RPC using `postMessage`**

### Required Metadata

```json
{
  "name": "geox_welldesk",
  "description": "Well log viewer with QC, petrophysics, and synthetic seismogram display",
  "inputSchema": {
    "type": "object",
    "properties": {
      "well_id": {"type": "string", "description": "Well identifier"}
    }
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://geox/welldesk/{well_id}",
      "mimeType": "text/html",
      "sandbox": ["allow-scripts", "allow-same-origin"]
    }
  }
}
```

---

## 3. Migration Plan

### Phase 1: Resource URIs (Priority)

For each GEOX app, create a `ui://` resource handler:

```
ui://geox/welldesk/{well_id}       → HTML viewer for well logs
ui://geox/seismic_vision/{line_id} → HTML viewer for seismic interpretation
ui://geox/earth_volume/{vol_id}    → HTML viewer for 3D volumes
ui://geox/judge_console/{verdict}  → HTML viewer for constitutional verdicts
```

### Phase 2: Tool Cards

For each GEOX tool, generate a toolcard with `_meta.ui` metadata:

```python
# In GEOX MCP server tool registration
def register_tool(name, description, input_schema, app_uri=None):
    tool = {
        "name": name,
        "description": description,
        "inputSchema": input_schema,
    }
    if app_uri:
        tool["_meta"] = {
            "ui": {
                "resourceUri": app_uri,
                "mimeType": "text/html"
            }
        }
    return tool
```

### Phase 3: Host Integration

Update AAA cockpit to recognize `_meta.ui` and render MCP Apps:

```typescript
// In AAA's MCP client
if (tool._meta?.ui?.resourceUri) {
  const resource = await mcpClient.getResource(tool._meta.ui.resourceUri);
  renderInIframe(resource.contents);
}
```

---

## 4. Toolcard Template

Each GEOX tool should have a toolcard at `/root/GEOX/toolcards/`:

```json
{
  "name": "geox_well_tie_compute",
  "description": "Well-to-seismic tie via bruges. Generates synthetic seismogram from LAS.",
  "domain": "geox",
  "risk_tier": "medium",
  "floors": ["F1", "F2", "F4", "F7", "F11"],
  "evidence_class": "DER",
  "inputSchema": {
    "type": "object",
    "properties": {
      "las_path": {"type": "string"},
      "segy_path": {"type": "string"},
      "output_dir": {"type": "string"}
    },
    "required": ["las_path"]
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://geox/well_tie/{las_path}",
      "mimeType": "text/html"
    }
  }
}
```

---

## 5. Apps to Standardize

| App | Tool Prefix | ui:// URI | Priority |
|---|---|---|---|
| welldesk | `geox_well_*` | `ui://geox/welldesk/{id}` | HIGH |
| seismic_vision | `geox_rsi_*`, `geox_seismic_*` | `ui://geox/seismic/{id}` | HIGH |
| earth_volume | `geox_3d_*` | `ui://geox/volume/{id}` | MEDIUM |
| judge_console | `geox_claim_*` | `ui://geox/claim/{id}` | MEDIUM |

---

## 6. Implementation Status

| Phase | Status | Notes |
|---|---|---|
| Phase 1: Resource URIs | NOT STARTED | Need to wire `ui://` handlers in GEOX MCP server |
| Phase 2: Tool Cards | NOT STARTED | Need to generate toolcards with `_meta.ui` |
| Phase 3: Host Integration | NOT STARTED | Need to update AAA cockpit |

---

*MCP Apps Standardization: 2026-07-09 by FORGE (000Ω)*
*DITEMPA BUKAN DIBERI*
