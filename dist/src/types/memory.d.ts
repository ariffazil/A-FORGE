export type TaskMemoryRecord = {
    id: string;
    summary: string;
    keywords: string[];
    createdAt: string;
    metadata?: Record<string, unknown>;
};
