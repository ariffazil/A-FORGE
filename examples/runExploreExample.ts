import { AgentEngine } from "../src/domain/engine/AgentEngine.js";
import { MockLlmProvider } from "../src/infrastructure/llm/MockLlmProvider.js";
import { LongTermMemory } from "../src/application/memory/LongTermMemory.js";
import { buildExploreProfile } from "../src/domain/agents/profiles.js";
import { ToolRegistry } from "../src/infrastructure/tools/ToolRegistry.js";
import { ReadFileTool, ListFilesTool } from "../src/infrastructure/tools/FileTools.js";
import { GrepTextTool } from "../src/infrastructure/tools/SearchTools.js";
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
