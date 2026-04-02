export class BackgroundJobManager {
    jobs = new Map();
    register(job) {
        this.jobs.set(job.id, job);
        return {
            accepted: true,
            job,
        };
    }
    list() {
        return [...this.jobs.values()];
    }
}
