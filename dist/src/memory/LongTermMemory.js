import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
export class LongTermMemory {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    async store(record) {
        const records = await this.readAll();
        records.push(record);
        await this.writeAll(records);
    }
    async searchByKeyword(keyword) {
        const normalized = keyword.toLowerCase();
        const records = await this.readAll();
        return records.filter((record) => record.keywords.some((entry) => entry.toLowerCase().includes(normalized)) ||
            record.summary.toLowerCase().includes(normalized));
    }
    async searchRelevant(task, limit = 3) {
        const terms = [...new Set(task.toLowerCase().split(/[^a-z0-9_/-]+/g).filter((term) => term.length >= 4))];
        const scored = new Map();
        for (const term of terms) {
            for (const record of await this.searchByKeyword(term)) {
                const current = scored.get(record.id);
                const nextScore = (current?.score ?? 0) + 1;
                scored.set(record.id, { score: nextScore, record });
            }
        }
        return [...scored.values()]
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map((entry) => entry.record);
    }
    async readAll() {
        try {
            const raw = await readFile(this.filePath, "utf8");
            return JSON.parse(raw);
        }
        catch (error) {
            const typedError = error;
            if (typedError.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    }
    async writeAll(records) {
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
    }
}
