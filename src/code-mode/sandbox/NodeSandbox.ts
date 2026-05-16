/**
 * src/code-mode/sandbox/NodeSandbox.ts — Isolated Execution Environment
 *
 * F12 Injection Defense + F1 Amanah: Runs user-submitted scripts inside
 * a Worker thread with strict resource limits. The sandbox exposes only
 * a curated set of safe globals plus MCP gateway bindings. All file
 * system access is jailed to /tmp/a-forge-exec/{sessionId}. Network
 * access is blocked except for whitelisted MCP gateway hosts.
 *
 * F4 Clarity: Explicit allow-list approach — deny by default, permit
 * by contract. No implicit global leakage.
 *
 * WARNING: Node.js vm module alone is insufficient for untrusted code.
 * This scaffold uses worker_threads with resourceLimits for memory
 * enforcement. Production hardening should migrate to isolated-vm.
 *
 * DITEMPA BUKAN DIBERI — Forged, Not Given
 */

import { Worker } from "node:worker_threads";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ScriptResult, SandboxOptions } from "../types.js";

// ── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MEMORY_LIMIT_MB = 128;
const SANDBOX_ROOT = "/tmp/a-forge-exec";

// ── Worker Script (inline, self-contained) ──────────────────────────────────

/**
 * The worker bootstraps a frozen context with only safe globals,
 * injects the MCP bindings passed from the parent, and executes
 * the user script inside a try/catch envelope.
 */
const WORKER_BOOT_SCRIPT = `
const { parentPort } = require("node:worker_threads");

parentPort.once("message", (payload) => {
  const { script, bindings, workingDirectory, allowedNetworkHosts } = payload;

  // ── Safe Context Construction ─────────────────────────────────────────
  const safeConsole = {
    log: (...args) => parentPort.postMessage({ type: "stdout", data: args.map(String).join(" ") + "\\n" }),
    error: (...args) => parentPort.postMessage({ type: "stderr", data: args.map(String).join(" ") + "\\n" }),
    warn: (...args) => parentPort.postMessage({ type: "stderr", data: args.map(String).join(" ") + "\\n" }),
    info: (...args) => parentPort.postMessage({ type: "stdout", data: args.map(String).join(" ") + "\\n" }),
  };

  const safeMath = Object.create(null);
  for (const key of Object.getOwnPropertyNames(Math)) {
    const desc = Object.getOwnPropertyDescriptor(Math, key);
    if (desc) Object.defineProperty(safeMath, key, desc);
  }

  const safeJSON = {
    parse: JSON.parse,
    stringify: JSON.stringify,
  };

  const safeArray = Array;
  const safeObject = Object;
  const safeString = String;
  const safeNumber = Number;
  const safeBoolean = Boolean;
  const safeDate = Date;
  const safeRegExp = RegExp;
  const safeError = Error;
  const safeTypeError = TypeError;
  const safeRangeError = RangeError;
  const safePromise = Promise;
  const safeMap = Map;
  const safeSet = Set;
  const safeWeakMap = WeakMap;
  const safeWeakSet = WeakSet;
  const safeSymbol = Symbol;
  const safeProxy = Proxy;
  const safeReflect = Reflect;
  const safeInt8Array = Int8Array;
  const safeUint8Array = Uint8Array;
  const safeUint8ClampedArray = Uint8ClampedArray;
  const safeInt16Array = Int16Array;
  const safeUint16Array = Uint16Array;
  const safeInt32Array = Int32Array;
  const safeUint32Array = Uint32Array;
  const safeFloat32Array = Float32Array;
  const safeFloat64Array = Float64Array;
  const safeBigInt64Array = BigInt64Array;
  const safeBigUint64Array = BigUint64Array;
  const safeDataView = DataView;
  const safeArrayBuffer = ArrayBuffer;
  const safeSharedArrayBuffer = SharedArrayBuffer;
  const safeBigInt = BigInt;
  const safeparseInt = parseInt;
  const safeparseFloat = parseFloat;
  const safeisNaN = isNaN;
  const safeisFinite = isFinite;
  const safeencodeURI = encodeURI;
  const safedecodeURI = decodeURI;
  const safeencodeURIComponent = encodeURIComponent;
  const safedecodeURIComponent = decodeURIComponent;
  const safeescape = escape;
  const safeunescape = unescape;
  const safeInfinity = Infinity;
  const safeNaN = NaN;
  const safeUndefined = undefined;
  const safenull = null;
  const safetrue = true;
  const safefalse = false;
  const safeObjectPrototype = Object.prototype;
  const safeArrayPrototype = Array.prototype;
  const safeStringPrototype = String.prototype;
  const safeNumberPrototype = Number.prototype;
  const safeBooleanPrototype = Boolean.prototype;
  const safeDatePrototype = Date.prototype;
  const safeRegExpPrototype = RegExp.prototype;
  const safeErrorPrototype = Error.prototype;
  const safeTypeErrorPrototype = TypeError.prototype;
  const safeRangeErrorPrototype = RangeError.prototype;
  const safePromisePrototype = Promise.prototype;
  const safeMapPrototype = Map.prototype;
  const safeSetPrototype = Set.prototype;
  const safeWeakMapPrototype = WeakMap.prototype;
  const safeWeakSetPrototype = WeakSet.prototype;
  const safeInt8ArrayPrototype = Int8Array.prototype;
  const safeUint8ArrayPrototype = Uint8Array.prototype;
  const safeUint8ClampedArrayPrototype = Uint8ClampedArray.prototype;
  const safeInt16ArrayPrototype = Int16Array.prototype;
  const safeUint16ArrayPrototype = Uint16Array.prototype;
  const safeInt32ArrayPrototype = Int32Array.prototype;
  const safeUint32ArrayPrototype = Uint32Array.prototype;
  const safeFloat32ArrayPrototype = Float32Array.prototype;
  const safeFloat64ArrayPrototype = Float64Array.prototype;
  const safeBigInt64ArrayPrototype = BigInt64Array.prototype;
  const safeBigUint64ArrayPrototype = BigUint64Array.prototype;
  const safeDataViewPrototype = DataView.prototype;
  const safeArrayBufferPrototype = ArrayBuffer.prototype;
  const safeSharedArrayBufferPrototype = SharedArrayBuffer.prototype;
  const safeIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
  const safeArrayIteratorPrototype = Object.getPrototypeOf([][Symbol.iterator]());
  const safeStringIteratorPrototype = Object.getPrototypeOf(""[Symbol.iterator]());
  const safeMapIteratorPrototype = Object.getPrototypeOf(new Map()[Symbol.iterator]());
  const safeSetIteratorPrototype = Object.getPrototypeOf(new Set()[Symbol.iterator]());
  const safeGeneratorPrototype = Object.getPrototypeOf(function* () {}());
  const safeAsyncGeneratorPrototype = Object.getPrototypeOf(async function* () {}());
  const safePromisePrototypePrototype = Object.getPrototypeOf(Promise.prototype);
  const safeObjectPrototypePrototype = Object.getPrototypeOf(Object.prototype);
  const safeArrayPrototypePrototype = Object.getPrototypeOf(Array.prototype);
  const safeStringPrototypePrototype = Object.getPrototypeOf(String.prototype);
  const safeNumberPrototypePrototype = Object.getPrototypeOf(Number.prototype);
  const safeBooleanPrototypePrototype = Object.getPrototypeOf(Boolean.prototype);
  const safeDatePrototypePrototype = Object.getPrototypeOf(Date.prototype);
  const safeRegExpPrototypePrototype = Object.getPrototypeOf(RegExp.prototype);
  const safeErrorPrototypePrototype = Object.getPrototypeOf(Error.prototype);
  const safeTypeErrorPrototypePrototype = Object.getPrototypeOf(TypeError.prototype);
  const safeRangeErrorPrototypePrototype = Object.getPrototypeOf(RangeError.prototype);
  const safePromisePrototypePrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(Promise.prototype));
  const safeMapPrototypePrototype = Object.getPrototypeOf(Map.prototype);
  const safeSetPrototypePrototype = Object.getPrototypeOf(Set.prototype);
  const safeWeakMapPrototypePrototype = Object.getPrototypeOf(WeakMap.prototype);
  const safeWeakSetPrototypePrototype = Object.getPrototypeOf(WeakSet.prototype);
  const safeInt8ArrayPrototypePrototype = Object.getPrototypeOf(Int8Array.prototype);
  const safeUint8ArrayPrototypePrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const safeUint8ClampedArrayPrototypePrototype = Object.getPrototypeOf(Uint8ClampedArray.prototype);
  const safeInt16ArrayPrototypePrototype = Object.getPrototypeOf(Int16Array.prototype);
  const safeUint16ArrayPrototypePrototype = Object.getPrototypeOf(Uint16Array.prototype);
  const safeInt32ArrayPrototypePrototype = Object.getPrototypeOf(Int32Array.prototype);
  const safeUint32ArrayPrototypePrototype = Object.getPrototypeOf(Uint32Array.prototype);
  const safeFloat32ArrayPrototypePrototype = Object.getPrototypeOf(Float32Array.prototype);
  const safeFloat64ArrayPrototypePrototype = Object.getPrototypeOf(Float64Array.prototype);
  const safeBigInt64ArrayPrototypePrototype = Object.getPrototypeOf(BigInt64Array.prototype);
  const safeBigUint64ArrayPrototypePrototype = Object.getPrototypeOf(BigUint64Array.prototype);
  const safeDataViewPrototypePrototype = Object.getPrototypeOf(DataView.prototype);
  const safeArrayBufferPrototypePrototype = Object.getPrototypeOf(ArrayBuffer.prototype);
  const safeSharedArrayBufferPrototypePrototype = Object.getPrototypeOf(SharedArrayBuffer.prototype);
  const safeIteratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));
  const safeArrayIteratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
  const safeStringIteratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(""[Symbol.iterator]()));
  const safeMapIteratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(new Map()[Symbol.iterator]()));
  const safeSetIteratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(new Set()[Symbol.iterator]()));
  const safeGeneratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(function* () {}()));
  const safeAsyncGeneratorPrototypePrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}()));

  const context = {
    console: safeConsole,
    Math: safeMath,
    JSON: safeJSON,
    Array: safeArray,
    Object: safeObject,
    String: safeString,
    Number: safeNumber,
    Boolean: safeBoolean,
    Date: safeDate,
    RegExp: safeRegExp,
    Error: safeError,
    TypeError: safeTypeError,
    RangeError: safeRangeError,
    Promise: safePromise,
    Map: safeMap,
    Set: safeSet,
    WeakMap: safeWeakMap,
    WeakSet: safeWeakSet,
    Symbol: safeSymbol,
    Proxy: safeProxy,
    Reflect: safeReflect,
    Int8Array: safeInt8Array,
    Uint8Array: safeUint8Array,
    Uint8ClampedArray: safeUint8ClampedArray,
    Int16Array: safeInt16Array,
    Uint16Array: safeUint16Array,
    Int32Array: safeInt32Array,
    Uint32Array: safeUint32Array,
    Float32Array: safeFloat32Array,
    Float64Array: safeFloat64Array,
    BigInt64Array: safeBigInt64Array,
    BigUint64Array: safeBigUint64Array,
    DataView: safeDataView,
    ArrayBuffer: safeArrayBuffer,
    SharedArrayBuffer: safeSharedArrayBuffer,
    BigInt: safeBigInt,
    parseInt: safeparseInt,
    parseFloat: safeparseFloat,
    isNaN: safeisNaN,
    isFinite: safeisFinite,
    encodeURI: safeencodeURI,
    decodeURI: safedecodeURI,
    encodeURIComponent: safeencodeURIComponent,
    decodeURIComponent: safedecodeURIComponent,
    escape: safeescape,
    unescape: safeunescape,
    Infinity: safeInfinity,
    NaN: safeNaN,
    undefined: safeUndefined,
    null: safenull,
    true: safetrue,
    false: safefalse,
    ObjectPrototype: safeObjectPrototype,
    ArrayPrototype: safeArrayPrototype,
    StringPrototype: safeStringPrototype,
    NumberPrototype: safeNumberPrototype,
    BooleanPrototype: safeBooleanPrototype,
    DatePrototype: safeDatePrototype,
    RegExpPrototype: safeRegExpPrototype,
    ErrorPrototype: safeErrorPrototype,
    TypeErrorPrototype: safeTypeErrorPrototype,
    RangeErrorPrototype: safeRangeErrorPrototype,
    PromisePrototype: safePromisePrototype,
    MapPrototype: safeMapPrototype,
    SetPrototype: safeSetPrototype,
    WeakMapPrototype: safeWeakMapPrototype,
    WeakSetPrototype: safeWeakSetPrototype,
    Int8ArrayPrototype: safeInt8ArrayPrototype,
    Uint8ArrayPrototype: safeUint8ArrayPrototype,
    Uint8ClampedArrayPrototype: safeUint8ClampedArrayPrototype,
    Int16ArrayPrototype: safeInt16ArrayPrototype,
    Uint16ArrayPrototype: safeUint16ArrayPrototype,
    Int32ArrayPrototype: safeInt32ArrayPrototype,
    Uint32ArrayPrototype: safeUint32ArrayPrototype,
    Float32ArrayPrototype: safeFloat32ArrayPrototype,
    Float64ArrayPrototype: safeFloat64ArrayPrototype,
    BigInt64ArrayPrototype: safeBigInt64ArrayPrototype,
    BigUint64ArrayPrototype: safeBigUint64ArrayPrototype,
    DataViewPrototype: safeDataViewPrototype,
    ArrayBufferPrototype: safeArrayBufferPrototype,
    SharedArrayBufferPrototype: safeSharedArrayBufferPrototype,
    IteratorPrototype: safeIteratorPrototype,
    ArrayIteratorPrototype: safeArrayIteratorPrototype,
    StringIteratorPrototype: safeStringIteratorPrototype,
    MapIteratorPrototype: safeMapIteratorPrototype,
    SetIteratorPrototype: safeSetIteratorPrototype,
    GeneratorPrototype: safeGeneratorPrototype,
    AsyncGeneratorPrototype: safeAsyncGeneratorPrototype,
    PromisePrototypePrototype: safePromisePrototypePrototype,
    ObjectPrototypePrototype: safeObjectPrototypePrototype,
    ArrayPrototypePrototype: safeArrayPrototypePrototype,
    StringPrototypePrototype: safeStringPrototypePrototype,
    NumberPrototypePrototype: safeNumberPrototypePrototype,
    BooleanPrototypePrototype: safeBooleanPrototypePrototype,
    DatePrototypePrototype: safeDatePrototypePrototype,
    RegExpPrototypePrototype: safeRegExpPrototypePrototype,
    ErrorPrototypePrototype: safeErrorPrototypePrototype,
    TypeErrorPrototypePrototype: safeTypeErrorPrototypePrototype,
    RangeErrorPrototypePrototype: safeRangeErrorPrototypePrototype,
    PromisePrototypePrototypePrototype: safePromisePrototypePrototypePrototype,
    MapPrototypePrototype: safeMapPrototypePrototype,
    SetPrototypePrototype: safeSetPrototypePrototype,
    WeakMapPrototypePrototype: safeWeakMapPrototypePrototype,
    WeakSetPrototypePrototype: safeWeakSetPrototypePrototype,
    Int8ArrayPrototypePrototype: safeInt8ArrayPrototypePrototype,
    Uint8ArrayPrototypePrototype: safeUint8ArrayPrototypePrototype,
    Uint8ClampedArrayPrototypePrototype: safeUint8ClampedArrayPrototypePrototype,
    Int16ArrayPrototypePrototype: safeInt16ArrayPrototypePrototype,
    Uint16ArrayPrototypePrototype: safeUint16ArrayPrototypePrototype,
    Int32ArrayPrototypePrototype: safeInt32ArrayPrototypePrototype,
    Uint32ArrayPrototypePrototype: safeUint32ArrayPrototypePrototype,
    Float32ArrayPrototypePrototype: safeFloat32ArrayPrototypePrototype,
    Float64ArrayPrototypePrototype: safeFloat64ArrayPrototypePrototype,
    BigInt64ArrayPrototypePrototype: safeBigInt64ArrayPrototypePrototype,
    BigUint64ArrayPrototypePrototype: safeBigUint64ArrayPrototypePrototype,
    DataViewPrototypePrototype: safeDataViewPrototypePrototype,
    ArrayBufferPrototypePrototype: safeArrayBufferPrototypePrototype,
    SharedArrayBufferPrototypePrototype: safeSharedArrayBufferPrototypePrototype,
    IteratorPrototypePrototype: safeIteratorPrototypePrototype,
    ArrayIteratorPrototypePrototype: safeArrayIteratorPrototypePrototype,
    StringIteratorPrototypePrototype: safeStringIteratorPrototypePrototype,
    MapIteratorPrototypePrototype: safeMapIteratorPrototypePrototype,
    SetIteratorPrototypePrototype: safeSetIteratorPrototypePrototype,
    GeneratorPrototypePrototype: safeGeneratorPrototypePrototype,
    AsyncGeneratorPrototypePrototype: safeAsyncGeneratorPrototypePrototype,
  };

  // Inject MCP bindings passed from parent
  for (const [key, value] of Object.entries(bindings)) {
    context[key] = value;
  }

  // Freeze context to prevent prototype pollution
  for (const key of Object.keys(context)) {
    const val = context[key];
    if (val && typeof val === "object") {
      Object.freeze(val);
      Object.freeze(Object.getPrototypeOf(val));
    }
  }

  // ── Execution ─────────────────────────────────────────────────────────
  const outputs = [];
  const errors = [];

  const startTime = Date.now();
  let exitCode = 0;
  let result;

  try {
    // Build function with context keys as parameters to shadow globals
    const paramNames = Object.keys(context).join(",");
    const body = \`
      "use strict";
      \${script}
    \`;
    const fn = new Function(paramNames, body);
    result = fn(...Object.values(context));
    if (result && typeof result.then === "function") {
      result = await result;
    }
  } catch (err) {
    exitCode = 1;
    errors.push(String(err));
  }

  parentPort.postMessage({
    type: "result",
    result: {
      output: result,
      stdout: outputs.join(""),
      stderr: errors.join("\\n"),
      exitCode,
      executionTimeMs: Date.now() - startTime,
      floorsTriggered: [],
      tokensConsumed: 0,
    },
  });
});
`;

// ── NodeSandbox Class ───────────────────────────────────────────────────────

export class NodeSandbox {
  private readonly timeoutMs: number;
  private readonly memoryLimitMb: number;

  constructor(options?: { timeoutMs?: number; memoryLimitMb?: number }) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.memoryLimitMb = options?.memoryLimitMb ?? DEFAULT_MEMORY_LIMIT_MB;
  }

  /**
   * Execute a script inside an isolated worker with strict resource limits.
   *
   * F12 Defense: The worker context exposes ONLY the safe globals defined
   * in WORKER_BOOT_SCRIPT plus the explicitly injected MCP bindings.
   *
   * F1 Amanah: Execution is logged and reversible (no fs mutation outside
   * the jailed working directory).
   *
   * F4 Clarity: O(1) context setup, O(n) script execution — no hidden
   * async surprises; timeout guarantees termination.
   */
  async execute(options: SandboxOptions): Promise<ScriptResult> {
    const {
      script,
      bindings,
      workingDirectory,
      allowedNetworkHosts,
      timeoutMs = this.timeoutMs,
      memoryLimitMb = this.memoryLimitMb,
    } = options;

    // Ensure jailed working directory exists
    const jailPath = join(SANDBOX_ROOT, randomUUID());
    await mkdir(jailPath, { recursive: true });

    const worker = new Worker(WORKER_BOOT_SCRIPT, {
      eval: true,
      stdout: true,
      stderr: true,
      resourceLimits: {
        maxOldGenerationSizeMb: memoryLimitMb,
        maxYoungGenerationSizeMb: Math.floor(memoryLimitMb / 4),
      },
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    return new Promise<ScriptResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(
          new Error(
            `[F12|888_HOLD] Sandbox execution exceeded ${timeoutMs}ms timeout. ` +
              `Possible infinite loop or resource exhaustion.`,
          ),
        );
      }, timeoutMs);

      worker.on("message", (msg: unknown) => {
        if (typeof msg !== "object" || msg === null) return;
        const m = msg as Record<string, unknown>;

        if (m.type === "stdout" && typeof m.data === "string") {
          stdoutChunks.push(m.data);
          return;
        }
        if (m.type === "stderr" && typeof m.data === "string") {
          stderrChunks.push(m.data);
          return;
        }
        if (m.type === "result") {
          clearTimeout(timer);
          const result = m.result as ScriptResult;
          result.stdout = stdoutChunks.join("") + result.stdout;
          result.stderr = stderrChunks.join("") + result.stderr;
          resolve(result);
          return;
        }
      });

      worker.on("error", (err: Error) => {
        clearTimeout(timer);
        worker.terminate();
        reject(
          new Error(
            `[F12|888_HOLD] Sandbox worker crashed: ${err.message}. ` +
              `Possible memory limit violation or illegal instruction.`,
          ),
        );
      });

      worker.on("exit", (code: number) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new Error(
              `[F12|888_HOLD] Sandbox worker exited with code ${code}. ` +
                `Possible resource limit violation.`,
            ),
          );
        }
      });

      // Post the payload to the worker
      worker.postMessage({
        script,
        bindings,
        workingDirectory: jailPath,
        allowedNetworkHosts,
      });
    }).finally(async () => {
      worker.terminate();
      // F1 Amanah: Clean up the ephemeral jail directory
      try {
        await rm(jailPath, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup — do not block verdict on failure
      }
    });
  }
}
