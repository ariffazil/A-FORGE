import type { TaskMemoryRecord } from "../types/memory.js";
export declare class LongTermMemory {
    private readonly filePath;
    constructor(filePath: string);
    store(record: TaskMemoryRecord): Promise<void>;
    searchByKeyword(keyword: string): Promise<TaskMemoryRecord[]>;
    searchRelevant(task: string, limit?: number): Promise<TaskMemoryRecord[]>;
    private readAll;
    private writeAll;
}
