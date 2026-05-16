/**
 * src/code-mode/sandbox/SecurityScanner.ts — AST-Based Static Analysis
 *
 * F12 Injection Defense: Performs lexical and syntactic analysis on
 * user-submitted code to detect and block dangerous patterns before
 * they reach the sandbox. No external parser dependencies — pure
 * TypeScript tokenizer ensures full transparency and zero supply-chain
 * entropy (F4 Clarity).
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import type { SecurityAnalysis, SecurityRiskLevel } from "../types.js";

// ── Canonical Dangerous Patterns (F12 Defense Matrix) ────────────────────────

const DISALLOWED_IDENTIFIERS = new Set([
  "require",
  "process",
  "global",
  "globalThis",
  "eval",
  "Function",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "clearTimeout",
  "clearInterval",
  "clearImmediate",
  "Buffer",
  "URL",
  "fetch",
  "WebSocket",
  "XMLHttpRequest",
]);

const DISALLOWED_MODULES = new Set([
  "fs",
  "path",
  "os",
  "child_process",
  "cluster",
  "worker_threads",
  "net",
  "http",
  "https",
  "http2",
  "dgram",
  "dns",
  "tls",
  "crypto",
  "vm",
  "repl",
  "readline",
  "stream",
  "events",
  "url",
  "querystring",
  "zlib",
  "module",
  "v8",
  "inspector",
  "perf_hooks",
  "async_hooks",
  "trace_events",
  "domain",
  "punycode",
  "string_decoder",
  "sys",
  "timers",
  "tty",
  "util",
  "assert",
]);

const SHELL_COMMAND_PATTERNS = [
  /\bexec\s*\(/,
  /\bexecSync\s*\(/,
  /\bspawn\s*\(/,
  /\bspawnSync\s*\(/,
  /\bfork\s*\(/,
  /\bexecFile\s*\(/,
];

const FILE_SYSTEM_PATTERNS = [
  /\breadFile\s*\(/,
  /\bwriteFile\s*\(/,
  /\bappendFile\s*\(/,
  /\breaddir\s*\(/,
  /\bmkdir\s*\(/,
  /\brmdir\s*\(/,
  /\bunlink\s*\(/,
  /\brename\s*\(/,
  /\bstat\s*\(/,
  /\baccess\s*\(/,
  /\bopen\s*\(/,
  /\bcreateReadStream\s*\(/,
  /\bcreateWriteStream\s*\(/,
];

const NETWORK_PATTERNS = [
  /\bfetch\s*\(/,
  /\bhttp\.request\s*\(/,
  /\bhttps\.request\s*\(/,
  /\bnet\.connect\s*\(/,
  /\bnet\.createConnection\s*\(/,
  /\bdns\.lookup\s*\(/,
  /\bWebSocket\s*\(/,
  /\bXMLHttpRequest\s*\(/,
];

// ── Tokenizer ───────────────────────────────────────────────────────────────

type TokenType =
  | "identifier"
  | "string"
  | "template"
  | "number"
  | "comment"
  | "regex"
  | "operator"
  | "punctuation"
  | "keyword"
  | "whitespace"
  | "unknown";

interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

/**
 * Lightweight ECMAScript tokenizer.
 * Handles single-line comments, block comments, string literals,
 * template literals, regex literals, and identifiers.
 *
 * F4 Clarity: No regex soup — explicit state machine with
 * measurable O(n) complexity per character.
 */
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  const len = source.length;

  const peek = (offset = 0): string => source[i + offset] ?? "\0";
  const advance = (): string => {
    const ch = source[i++];
    if (ch === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  };

  while (i < len) {
    const startLine = line;
    const startCol = col;
    const ch = peek();

    // Whitespace
    if (/\s/.test(ch)) {
      let value = "";
      while (i < len && /\s/.test(peek())) {
        value += advance();
      }
      tokens.push({ type: "whitespace", value, line: startLine, col: startCol });
      continue;
    }

    // Single-line comment
    if (ch === "/" && peek(1) === "/") {
      let value = "";
      while (i < len && peek() !== "\n") {
        value += advance();
      }
      tokens.push({ type: "comment", value, line: startLine, col: startCol });
      continue;
    }

    // Block comment
    if (ch === "/" && peek(1) === "*") {
      let value = "";
      advance(); // /
      advance(); // *
      while (i < len && !(peek() === "*" && peek(1) === "/")) {
        value += advance();
      }
      if (i < len) {
        advance(); // *
        advance(); // /
      }
      tokens.push({ type: "comment", value: `/*${value}*/`, line: startLine, col: startCol });
      continue;
    }

    // String literals (single / double quote)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = advance();
      while (i < len && peek() !== quote) {
        if (peek() === "\\") {
          value += advance();
        }
        value += advance();
      }
      if (peek() === quote) {
        value += advance();
      }
      tokens.push({ type: "string", value, line: startLine, col: startCol });
      continue;
    }

    // Template literal
    if (ch === "`") {
      let value = advance();
      while (i < len && peek() !== "`") {
        if (peek() === "\\") {
          value += advance();
        }
        if (peek() === "$" && peek(1) === "{") {
          value += advance(); // $
          value += advance(); // {
          let braceDepth = 1;
          while (i < len && braceDepth > 0) {
            if (peek() === "{") braceDepth++;
            if (peek() === "}") braceDepth--;
            value += advance();
          }
        } else {
          value += advance();
        }
      }
      if (peek() === "`") {
        value += advance();
      }
      tokens.push({ type: "template", value, line: startLine, col: startCol });
      continue;
    }

    // Regex literal (heuristic: / after operator or punctuation or keyword or open paren)
    if (
      ch === "/" &&
      (tokens.length === 0 ||
        ["operator", "punctuation", "keyword", "whitespace"].includes(tokens[tokens.length - 1].type))
    ) {
      let value = advance();
      while (i < len && peek() !== "/") {
        if (peek() === "\\") {
          value += advance();
        }
        value += advance();
      }
      if (peek() === "/") {
        value += advance();
      }
      while (i < len && /[gimsuvy]/.test(peek())) {
        value += advance();
      }
      tokens.push({ type: "regex", value, line: startLine, col: startCol });
      continue;
    }

    // Number literal
    if (/\d/.test(ch) || (ch === "." && /\d/.test(peek(1)))) {
      let value = "";
      while (i < len && /[\d._a-fA-FxXbBoOn]/.test(peek())) {
        value += advance();
      }
      tokens.push({ type: "number", value, line: startLine, col: startCol });
      continue;
    }

    // Identifier or keyword
    if (/[A-Za-z_$]/.test(ch)) {
      let value = "";
      while (i < len && /[A-Za-z0-9_$]/.test(peek())) {
        value += advance();
      }
      const isKeyword =
        /^(import|export|from|as|default|class|function|return|if|else|while|for|do|break|continue|switch|case|try|catch|finally|throw|new|this|typeof|instanceof|void|delete|in|of|with|yield|await|async|var|let|const|debugger)$/.test(
          value,
        );
      tokens.push({ type: isKeyword ? "keyword" : "identifier", value, line: startLine, col: startCol });
      continue;
    }

    // Punctuation / operator
    if (/[+\-*/%=<>!&|^~?:;.,()[\]{}]/.test(ch)) {
      let value = advance();
      // Multi-char operators
      const twoChar = value + peek();
      if (
        ["++", "--", "+=", "-=", "*=/", "%=", "==", "!=", "<=", ">=", "&&", "||", "??", "=>", "**", "//"].includes(
          twoChar,
        )
      ) {
        value += advance();
      }
      tokens.push({ type: /[()[\]{}]/.test(value) ? "punctuation" : "operator", value, line: startLine, col: startCol });
      continue;
    }

    // Fallback
    tokens.push({ type: "unknown", value: advance(), line: startLine, col: startCol });
  }

  return tokens;
}

// ── Analyzer ────────────────────────────────────────────────────────────────

/**
 * Analyze token stream for dangerous patterns.
 * Returns a SecurityAnalysis with F12-mandated risk classification.
 */
function analyzeTokens(source: string, tokens: Token[]): SecurityAnalysis {
  const disallowedImports: string[] = [];
  const networkCalls: string[] = [];
  const fileSystemAccess: string[] = [];
  const shellCommands: string[] = [];
  const rawFlags: string[] = [];

  // Pass 1: Identifier scan
  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    if (tok.type !== "identifier" && tok.type !== "keyword") continue;

    const ident = tok.value;

    // Blocked global identifiers
    if (DISALLOWED_IDENTIFIERS.has(ident)) {
      disallowedImports.push(`${ident} (line ${tok.line}, col ${tok.col})`);
      rawFlags.push(`DISALLOWED_IDENTIFIER:${ident}`);
    }

    // Dynamic import detection
    if (ident === "import" && tokens[idx + 1]?.type === "punctuation" && tokens[idx + 1].value === "(") {
      rawFlags.push(`DYNAMIC_IMPORT:line_${tok.line}`);
    }
  }

  // Pass 2: Regex pattern scan (catches method calls tokenizer may miss)
  for (const pattern of SHELL_COMMAND_PATTERNS) {
    const matches = source.match(new RegExp(pattern, "g"));
    if (matches) {
      shellCommands.push(...matches);
      rawFlags.push("SHELL_COMMAND_DETECTED");
    }
  }

  for (const pattern of FILE_SYSTEM_PATTERNS) {
    const matches = source.match(new RegExp(pattern, "g"));
    if (matches) {
      fileSystemAccess.push(...matches);
      rawFlags.push("FILE_SYSTEM_DETECTED");
    }
  }

  for (const pattern of NETWORK_PATTERNS) {
    const matches = source.match(new RegExp(pattern, "g"));
    if (matches) {
      networkCalls.push(...matches);
      rawFlags.push("NETWORK_CALL_DETECTED");
    }
  }

  // Pass 3: Literal module name detection in strings (e.g., require("fs"))
  for (const tok of tokens) {
    if (tok.type === "string" || tok.type === "template") {
      const inner = tok.value.slice(1, -1);
      if (DISALLOWED_MODULES.has(inner)) {
        disallowedImports.push(`${inner} (line ${tok.line}, col ${tok.col})`);
        rawFlags.push(`DISALLOWED_MODULE:${inner}`);
      }
    }
  }

  // ── Risk Classification ─────────────────────────────────────────────────
  let riskLevel: SecurityRiskLevel = "safe";

  if (disallowedImports.length > 0 || shellCommands.length > 0) {
    riskLevel = "dangerous";
  } else if (networkCalls.length > 0 || fileSystemAccess.length > 0) {
    riskLevel = "caution";
  }

  const recommendedFloors: string[] = [];
  if (disallowedImports.length > 0 || shellCommands.length > 0) {
    recommendedFloors.push("F12");
  }
  if (networkCalls.length > 0) {
    recommendedFloors.push("F5");
  }
  if (fileSystemAccess.length > 0) {
    recommendedFloors.push("F1");
  }

  return {
    riskLevel,
    disallowedImports: [...new Set(disallowedImports)],
    networkCalls: [...new Set(networkCalls)],
    fileSystemAccess: [...new Set(fileSystemAccess)],
    shellCommands: [...new Set(shellCommands)],
    recommendedFloors: [...new Set(recommendedFloors)],
    rawFlags: [...new Set(rawFlags)],
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export class SecurityScanner {
  /**
   * Perform static analysis on a code string.
   *
   * F12 Defense: Detects injection vectors, disallowed identifiers,
   * dynamic imports, network calls, file system access, and shell
   * command patterns before the code reaches the sandbox.
   *
   * F4 Clarity: O(n) tokenization with explicit state machine —
   * no hidden regex complexity or external parser dependencies.
   */
  static analyze(script: string): SecurityAnalysis {
    const tokens = tokenize(script);
    return analyzeTokens(script, tokens);
  }

  /**
   * Quick check for obviously dangerous payloads.
   * Use this for fast-path rejection before full tokenization.
   */
  static quickReject(script: string): { rejected: boolean; reason?: string } {
    const normalized = script.replace(/\s+/g, " ");
    const dangerous = [
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\brequire\s*\(/,
      /\bprocess\.exit\s*\(/,
      /\bchild_process\b/,
      /\brm\s+-rf\b/,
    ];
    for (const pattern of dangerous) {
      if (pattern.test(normalized)) {
        return { rejected: true, reason: `QuickReject matched: ${pattern.source}` };
      }
    }
    return { rejected: false };
  }
}
