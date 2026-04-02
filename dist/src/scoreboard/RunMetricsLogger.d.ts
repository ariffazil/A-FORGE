export declare class RunMetricsLogger {
    private readonly directoryPath;
    constructor(directoryPath: string);
    log(taskId: string, payload: Record<string, unknown>): Promise<string>;
}
