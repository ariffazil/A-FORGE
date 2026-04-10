# VPS Native Mode

`agent-workbench` can run in a trusted local VPS mode for your own agents.

## Recommended Environment

```bash
export AGENT_WORKBENCH_TRUST_LOCAL_VPS=1
export AGENT_WORKBENCH_PROVIDER=openai_responses
export AGENT_WORKBENCH_MODEL=gpt-5
export OPENAI_API_KEY=your_key_here
# Optional:
export OPENAI_BASE_URL=https://api.openai.com/v1
export AGENT_WORKBENCH_MEMORY_PATH=/root/.agent-workbench/memory.json
```

## Effect Of Trusted VPS Mode

- defaults CLI behavior to `internal_mode`
- enables dangerous and experimental tool flags
- broadens profile tool access to include `write_file`, `run_tests`, and `run_command`
- relaxes the command prefix allow-list to `*`
- keeps explicit block patterns for obviously destructive commands

## Example Commands

```bash
agent explore --goal "map this repo"
agent coordinate --goal "inspect, validate, and propose next changes"
agent fix --file src/engine/AgentEngine.ts --issue "tighten loop behavior"
```

## Notes

- This mode is intended for your own VPS and your own agent fleet.
- It does not bypass the outer execution environment of whatever host runs the CLI.
- If you need stricter control, keep `AGENT_WORKBENCH_TRUST_LOCAL_VPS` unset and use `external_safe_mode`.
