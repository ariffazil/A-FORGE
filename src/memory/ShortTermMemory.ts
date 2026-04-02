import type { AgentMessage } from "../types/agent.js";

export class ShortTermMemory {
  private readonly transcript: AgentMessage[] = [];

  append(message: AgentMessage): void {
    this.transcript.push(message);
  }

  appendMany(messages: AgentMessage[]): void {
    for (const message of messages) {
      this.append(message);
    }
  }

  getMessages(): AgentMessage[] {
    return [...this.transcript];
  }

  clear(): void {
    this.transcript.length = 0;
  }
}
