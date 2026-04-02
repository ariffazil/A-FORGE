import type { BackgroundJobDefinition, BackgroundJobRegistrationResult } from "../types/jobs.js";
export declare class BackgroundJobManager {
    private readonly jobs;
    register(job: BackgroundJobDefinition): BackgroundJobRegistrationResult;
    list(): BackgroundJobDefinition[];
}
