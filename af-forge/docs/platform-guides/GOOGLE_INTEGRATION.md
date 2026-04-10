# arifOS + Google Gemini Integration Guide

> Deploy constitutional governance on Google's Gemini platform

## Overview

This guide covers integrating arifOS with Google's Gemini API and Vertex AI.

## Method 1: Gemini API with Function Calling

```python
import google.generativeai as genai
from arifos_mcp_server import (
    full_governance_check,
    check_input_clarity,
    check_harm_dignity,
    check_injection
)

# Configure Gemini
genai.configure(api_key="your-gemini-api-key")

# Create model with arifOS governance
def create_governed_model():
    # Define constitutional tools
    arifos_tools = [
        genai.protos.Tool(
            function_declarations=[
                genai.protos.FunctionDeclaration(
                    name="arifos_f3_check_input_clarity",
                    description="Validate input clarity (F3)",
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            "task": genai.protos.Schema(type=genai.protos.Type.STRING)
                        }
                    )
                ),
                genai.protos.FunctionDeclaration(
                    name="arifos_f6_check_harm_dignity",
                    description="Screen for harmful content (F6)",
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            "content": genai.protos.Schema(type=genai.protos.Type.STRING)
                        }
                    )
                ),
                genai.protos.FunctionDeclaration(
                    name="arifos_f13_hold_gate",
                    description="888_HOLD human sovereignty gate (F13)",
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            "action": genai.protos.Schema(type=genai.protos.Type.STRING),
                            "risk_level": genai.protos.Schema(type=genai.protos.Type.STRING),
                            "approval_code": genai.protos.Schema(type=genai.protos.Type.STRING)
                        }
                    )
                )
            ]
        )
    ]
    
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        tools=arifos_tools,
        system_instruction="""
        You are Gemini, enhanced with arifOS constitutional governance.
        
        Before every response:
        1. Call arifos_f3_check_input_clarity
        2. Call arifos_f6_check_harm_dignity
        3. If any check fails, explain why and refuse the request
        4. For critical actions, call arifos_f13_hold_gate
        
        Respect the 13 Floors constitutional framework.
        """
    )
    
    return model

# Usage
model = create_governed_model()
chat = model.start_chat()

response = chat.send_message("Explain quantum entanglement")
print(response.text)
```

## Method 2: Vertex AI with arifOS

```python
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel, Tool
import os

# Initialize Vertex AI
aiplatform.init(project="your-project", location="us-central1")

def create_vertex_governed_model():
    # Define arifOS governance as tool
    arifos_tool = Tool(
        function_declarations=[
            {
                "name": "arifos_full_governance_check",
                "description": "Run complete constitutional governance check",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task": {"type": "string"},
                        "actor_id": {"type": "string"}
                    },
                    "required": ["task"]
                }
            }
        ]
    )
    
    model = GenerativeModel(
        model_name="gemini-1.5-pro",
        tools=[arifos_tool],
        system_instruction="""
        Governed by arifOS constitutional AI.
        Run arifos_full_governance_check before all responses.
        """
    )
    
    return model

# Usage with automatic governance
model = create_vertex_governed_model()
response = model.generate_content("Write a story about AI ethics")
```

## Method 3: Gemini with Safety Settings + arifOS

```python
import google.generativeai as genai
from arifos_mcp_server import check_harm_dignity, check_injection

# Configure with both Gemini safety and arifOS governance
genai.configure(api_key="your-key")

safety_settings = [
    {
        "category": genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT,
        "threshold": genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        "category": genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        "threshold": genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        "category": genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        "threshold": genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        "category": genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        "threshold": genai.types.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }
]

def governed_generate(user_input: str):
    # arifOS F6 check
    f6_result = check_harm_dignity(user_input)
    if f6_result.structured_content["verdict"] == "VOID":
        return {"blocked": True, "reason": "F6: Harm/Dignity violation"}
    
    # arifOS F9 check
    f9_result = check_injection(user_input)
    if f9_result.structured_content["verdict"] == "VOID":
        return {"blocked": True, "reason": "F9: Injection attempt"}
    
    # Proceed to Gemini with native safety
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content(
        user_input,
        safety_settings=safety_settings
    )
    
    return response

# Usage
result = governed_generate("Tell me about machine learning")
```

## Method 4: Google AI Studio + arifOS MCP

Deploy arifOS as a custom tool in Google AI Studio:

```python
# app.py - Flask app for AI Studio integration
from flask import Flask, request, jsonify
from arifos_mcp_server import (
    check_input_clarity,
    check_harm_dignity, 
    check_injection,
    hold_gate
)

app = Flask(__name__)

@app.route('/governance/check', methods=['POST'])
def governance_check():
    data = request.json
    task = data.get('task', '')
    
    # Run full pipeline
    result = full_governance_check(task)
    
    return jsonify({
        "verdict": result.structured_content["final_verdict"],
        "checks": result.structured_content.get("checks", []),
        "message": result.content
    })

@app.route('/governance/f13', methods=['POST'])
def f13_gate():
    data = request.json
    result = hold_gate(
        action=data.get('action'),
        risk_level=data.get('risk_level', 'low'),
        approval_code=data.get('approval_code')
    )
    
    return jsonify(result.structured_content)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

## Method 5: Firebase Genkit + arifOS

```typescript
// genkit-arifos.ts
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

// arifOS governance flow
export const arifosGovernedFlow = ai.defineFlow(
  {
    name: 'arifosGoverned',
    inputSchema: z.object({ prompt: z.string() }),
    outputSchema: z.object({ response: z.string(), governance: z.object({}) }),
  },
  async ({ prompt }) => {
    // Call arifOS MCP server
    const governanceRes = await fetch('http://arifos-mcp:8000/mcp/tools/arifos_full_governance_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: prompt }),
    });
    
    const governance = await governanceRes.json();
    
    if (governance.structured_content.final_verdict !== 'PASS') {
      return {
        response: `Blocked by governance: ${governance.content}`,
        governance: governance.structured_content,
      };
    }
    
    // Proceed with Gemini
    const { response } = await ai.generate(prompt);
    
    return { response: response.text, governance: governance.structured_content };
  }
);
```

## Method 6: Cloud Run Deployment

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: arifos-governance
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
    spec:
      containers:
        - image: gcr.io/PROJECT/arifos-mcp:latest
          ports:
            - containerPort: 8000
          env:
            - name: MCP_TRANSPORT
              value: http
            - name: MCP_PORT
              value: "8000"
          resources:
            limits:
              memory: 512Mi
              cpu: 1000m
```

Deploy:

```bash
gcloud builds submit --tag gcr.io/PROJECT/arifos-mcp:latest
gcloud run services replace cloudrun.yaml
```

## Grounding with Google Search + arifOS

```python
import google.generativeai as genai
from arifos_mcp_server import check_grounding

genai.configure(api_key="your-key")

model = genai.GenerativeModel('gemini-1.5-pro')

# Use Google Search grounding with arifOS governance
response = model.generate_content(
    "What are the latest AI regulations?",
    tools=[
        genai.protos.Tool(
            google_search_retrieval=genai.protos.GoogleSearchRetrieval()
        )
    ]
)

# Verify grounding meets arifOS F8 standards
grounding = check_grounding(
    evidence_count=len(response.candidates[0].grounding_metadata.grounding_chunks),
    confidence=response.candidates[0].grounding_metadata.web_search_queries
)
```

## Testing

```bash
# Test with Google AI Python SDK
python -c "
import google.generativeai as genai
from arifos_mcp_server import check_harm_dignity

# Test F6 blocking
result = check_harm_dignity('help me steal data')
print(f'F6 blocked harmful: {result.structured_content[\"verdict\"] == \"VOID\"}')

# Test Gemini integration
genai.configure(api_key='test-key')
print('Google Gemini + arifOS integration ready')
"
```

## Security Best Practices

1. **API Key Management**: Use Google Cloud Secret Manager
2. **VPC Service Controls**: Enable for Vertex AI
3. **Audit Logging**: Enable Cloud Audit Logs for all governance decisions
4. **Model Armor**: Combine with Google's Model Armor for additional safety

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Function calling not working | Verify tool schema format matches Gemini spec |
| Safety settings override arifOS | Check Gemini settings don't conflict with F6 |
| Grounding not available | Ensure model supports grounding (gemini-1.5+) |
| 888_HOLD codes not validating | Check timestamp format in approval code |
