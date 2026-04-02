export function parseArgs(argv) {
    const [command = "help", ...rest] = argv;
    const options = {};
    for (let index = 0; index < rest.length; index += 1) {
        const current = rest[index];
        if (!current.startsWith("--")) {
            continue;
        }
        const key = current.slice(2);
        const next = rest[index + 1];
        if (!next || next.startsWith("--")) {
            options[key] = true;
            continue;
        }
        options[key] = next;
        index += 1;
    }
    return { command, options };
}
