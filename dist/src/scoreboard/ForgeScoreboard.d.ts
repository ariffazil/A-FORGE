import type { ForgeTaskRecord, ForgeWeeklySummary } from "../types/scoreboard.js";
export declare class ForgeScoreboard {
    private readonly filePath;
    constructor(filePath: string);
    append(record: ForgeTaskRecord): Promise<void>;
    readAll(): Promise<ForgeTaskRecord[]>;
    summarizeCurrentWeek(now?: Date, filters?: {
        taskCommand?: string;
        trustMode?: "local_vps" | "default";
    }): Promise<ForgeWeeklySummary>;
    private writeAll;
}
