import type {
  BackgroundJobDefinition,
  BackgroundJobRegistrationResult,
} from "../types/jobs.js";

export class BackgroundJobManager {
  private readonly jobs = new Map<string, BackgroundJobDefinition>();

  register(job: BackgroundJobDefinition): BackgroundJobRegistrationResult {
    this.jobs.set(job.id, job);
    return {
      accepted: true,
      job,
    };
  }

  list(): BackgroundJobDefinition[] {
    return [...this.jobs.values()];
  }
}
