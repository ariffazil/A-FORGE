export type BackgroundJobDefinition = {
    id: string;
    name: string;
    scheduleHint: string;
    taskDescription: string;
    enabled: boolean;
    metadata?: Record<string, unknown>;
};
export type BackgroundJobRegistrationResult = {
    accepted: boolean;
    job: BackgroundJobDefinition;
};
