export class ShortTermMemory {
    transcript = [];
    append(message) {
        this.transcript.push(message);
    }
    appendMany(messages) {
        for (const message of messages) {
            this.append(message);
        }
    }
    getMessages() {
        return [...this.transcript];
    }
    clear() {
        this.transcript.length = 0;
    }
}
