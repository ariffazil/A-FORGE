export type ParsedCliArgs = {
    command: string;
    options: Record<string, string | boolean>;
};
export declare function parseArgs(argv: string[]): ParsedCliArgs;
