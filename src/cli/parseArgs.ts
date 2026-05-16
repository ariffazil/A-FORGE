export type ParsedCliArgs = {
  command: string;
  options: Record<string, string | boolean>;
};

export function parseArgs(argv: string[]): ParsedCliArgs {
  const [command = "help", ...restArgs] = argv;
  let rest = [...restArgs];
  const options: Record<string, string | boolean> = {};

  // Special handling for "me" and "os" commands — capture everything as "say"
  if ((command === "me" || command === "os") && rest.length > 0 && !rest[0].startsWith("--")) {
    // First positional arg is the subcommand for "os"
    if (command === "os") {
      options.cmd = rest[0];
      rest = rest.slice(1);
    }
    
    // Join remaining non-flag arguments as the natural language input
    const sayParts: string[] = [];
    for (const arg of rest) {
      if (arg.startsWith("--")) {
        break;
      }
      sayParts.push(arg);
    }
    if (sayParts.length > 0) {
      options.say = sayParts.join(" ");
    }
    
    // Parse any remaining flags
    let foundFlag = false;
    for (const arg of rest) {
      if (arg.startsWith("--")) {
        foundFlag = true;
      }
      if (foundFlag) {
        const key = arg.slice(2);
        const nextIdx = rest.indexOf(arg) + 1;
        const next = rest[nextIdx];
        if (!next || next.startsWith("--")) {
          options[key] = true;
        } else {
          options[key] = next;
        }
      }
    }
    return { command, options };
  }

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

export function parseServeArgs(argv: string[]): {
  organ: string;
  transport: "stdio" | "sse" | "streamable-http";
  port?: number;
  mode: "internal_mode" | "external_safe_mode";
} {
  const args = argv.slice(1);
  let organ = "forge";
  let transport: "stdio" | "sse" | "streamable-http" = "stdio";
  let port: number | undefined;
  let mode: "internal_mode" | "external_safe_mode" = "external_safe_mode";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--organ" && args[i + 1]) {
      organ = args[i + 1];
      i++;
    } else if (arg === "--transport" && args[i + 1]) {
      const t = args[i + 1];
      if (t === "stdio" || t === "sse" || t === "streamable-http") {
        transport = t;
      }
      i++;
    } else if (arg === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (arg === "--mode" && args[i + 1]) {
      const m = args[i + 1];
      if (m === "internal_mode" || m === "external_safe_mode") {
        mode = m;
      }
      i++;
    }
  }

  return { organ, transport, port, mode };
}
