import { AgentEngine } from "../src/engine/AgentEngine.js";
import { MockLlmProvider } from "../src/llm/MockLlmProvider.js";
import { LongTermMemory } from "../src/memory/LongTermMemory.js";
import { buildExploreProfile } from "../src/agents/profiles.js";
import { ToolRegistry } from "../src/tools/ToolRegistry.js";
import { ReadFileTool, ListFilesTool } from "../src/tools/FileTools.js";
import { GrepTextTool } from "../src/tools/SearchTools.js";
import { defaultMemoryPath } from "../src/utils/paths.js";

const registry = new ToolRegistry();
registry.register(new ReadFileTool());
registry.register(new ListFilesTool());
registry.register(new GrepTextTool());

const engine = new AgentEngine(buildExploreProfile("external_safe_mode"), {
  llmProvider: new MockLlmProvider(),
  toolRegistry: registry,
  longTermMemory: new LongTermMemory(defaultMemoryPath(process.cwd())),
});

const result = await engine.run({
  task: "Explain the repository structure and main entrypoints.",
  workingDirectory: process.cwd(),
});

console.log(result.finalText);
