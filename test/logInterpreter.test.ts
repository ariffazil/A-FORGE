import test from "node:test";
import assert from "node:assert/strict";
import { GEOXLogInterpreterTool } from "../src/domains/geophysics/logInterpreter.js";
import type { ToolExecutionContext } from "../src/types/tool.js";

const ctx: ToolExecutionContext = { sessionId: "test", workingDirectory: "/tmp", modeName: "internal_mode" };

function makeGR(min: number, max: number, n: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    values.push(min + (max - min) * t);
  }
  return values;
}

function makeRHOB(clean: number, fluid: number, n: number): number[] {
  return Array.from({ length: n }, () => clean - Math.random() * (clean - fluid) * 0.5);
}

function makeNPHI(clean: number, fluid: number, n: number): number[] {
  return Array.from({ length: n }, () => fluid + Math.random() * (clean - fluid) * 0.4);
}

function makeRT(low: number, high: number, n: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    values.push(Math.pow(10, Math.log10(low) + (Math.log10(high) - Math.log10(low)) * t));
  }
  return values;
}

test("GEOXLogInterpreterTool — name is GEOX_log_interpreter", () => {
  const tool = new GEOXLogInterpreterTool();
  assert.equal(tool.name, "GEOX_log_interpreter");
});

test("GEOXLogInterpreterTool — riskLevel is guarded", () => {
  const tool = new GEOXLogInterpreterTool();
  assert.equal(tool.riskLevel, "guarded");
});

test("GEOXLogInterpreterTool — missing required logs returns error", async () => {
  const tool = new GEOXLogInterpreterTool();
  const result = await tool.run({}, ctx);
  assert.equal(result.ok, false);
});

test("GEOXLogInterpreterTool — gas sand anomaly detection", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 50;
  const result = await tool.run(
    {
      GR: makeGR(15, 80, n),
      RT: makeRT(1, 100, n),
      RHOB: makeRHOB(2.45, 1.0, n),
      NPHI: makeNPHI(0.02, 0.45, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
      matrix: "sandstone",
    },
    ctx
  );
  assert.ok(result.ok, (result.output as string).slice(0, 200));
  const parsed = JSON.parse(result.output as string);
  assert.ok(Array.isArray(parsed.Vsh));
  assert.ok(Array.isArray(parsed.PHIE));
  assert.ok(Array.isArray(parsed.SW));
  assert.ok(Array.isArray(parsed.BVW));
  assert.ok(Array.isArray(parsed.fluidFlag));
  assert.ok(Array.isArray(parsed.lithology));
  assert.ok(parsed.anomalyContrast != null);
  assert.ok(["ESTIMATE", "HYPOTHESIS", "UNKNOWN"].includes(parsed.uncertaintyTag));
});

test("GEOXLogInterpreterTool — water sand high SW", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 30;
  const result = await tool.run(
    {
      GR: makeGR(15, 40, n),
      RT: makeRT(1, 5, n),
      RHOB: makeRHOB(2.35, 1.0, n),
      NPHI: makeNPHI(0.05, 0.40, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
      matrix: "sandstone",
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  const waterCount = (parsed.fluidFlag as string[]).filter((f) => f === "WATER").length;
  assert.ok(waterCount > 0, "Expected at least one WATER flag");
});

test("GEOXLogInterpreterTool — shale formation high Vsh", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 30;
  const result = await tool.run(
    {
      GR: makeGR(80, 130, n),
      RT: makeRT(5, 15, n),
      RHOB: makeRHOB(2.50, 1.1, n),
      NPHI: makeNPHI(0.20, 0.45, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
      matrix: "limestone",
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  const avgVsh = parsed.Vsh.reduce((s: number, v: number) => s + v, 0) / parsed.Vsh.length;
  assert.ok(avgVsh > 0.5, `Expected high Vsh for shale, got ${avgVsh}`);
});

test("GEOXLogInterpreterTool — limestone density anomaly", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 20;
  const result = await tool.run(
    {
      GR: makeGR(10, 30, n),
      RT: makeRT(100, 1000, n),
      RHOB: makeRHOB(2.71, 1.0, n),
      NPHI: makeNPHI(0.02, 0.15, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
      matrix: "limestone",
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  const lithos = parsed.lithology as string[];
  assert.ok(lithos.includes("DENSE_LIMESTONE") || lithos.includes("LIMESTONE"), "Expected limestone lithology");
});

test("GEOXLogInterpreterTool — anomaly contrast composite is computed", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 25;
  const result = await tool.run(
    {
      GR: makeGR(20, 100, n),
      RT: makeRT(1, 50, n),
      RHOB: makeRHOB(2.45, 1.0, n),
      NPHI: makeNPHI(0.05, 0.4, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  const ac = parsed.anomalyContrast;
  assert.ok(typeof ac.kappa_GR === "number");
  assert.ok(typeof ac.kappa_RHOB === "number");
  assert.ok(typeof ac.kappa_NPHI === "number");
  assert.ok(typeof ac.kappa_RT === "number");
  assert.ok(typeof ac.compositeAnomaly === "number");
});

test("GEOXLogInterpreterTool — quality GOOD when anomaly > 1.5", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 20;
  const result = await tool.run(
    {
      GR: makeGR(10, 150, n),
      RT: makeRT(0.5, 200, n),
      RHOB: makeRHOB(2.30, 0.9, n),
      NPHI: makeNPHI(0.0, 0.5, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  const goodCount = (parsed.quality as string[]).filter((q) => q === "GOOD").length;
  assert.ok(goodCount > 0, "Expected at least one GOOD quality point");
});

test("GEOXLogInterpreterTool — SP and DT optional logs processed", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 20;
  const result = await tool.run(
    {
      GR: makeGR(20, 90, n),
      RT: makeRT(1, 30, n),
      RHOB: makeRHOB(2.45, 1.0, n),
      NPHI: makeNPHI(0.05, 0.4, n),
      SP: Array.from({ length: n }, () => -20 + Math.random() * 40),
      DT: Array.from({ length: n }, () => 50 + Math.random() * 30),
      CAL: Array.from({ length: n }, () => 8 + Math.random() * 0.5),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
    },
    ctx
  );
  assert.ok(result.ok);
});

test("GEOXLogInterpreterTool — anomalyScore array length matches input", async () => {
  const tool = new GEOXLogInterpreterTool();
  const n = 40;
  const result = await tool.run(
    {
      GR: makeGR(20, 90, n),
      RT: makeRT(1, 30, n),
      RHOB: makeRHOB(2.45, 1.0, n),
      NPHI: makeNPHI(0.05, 0.4, n),
      GR_clean: 20,
      GR_shale: 120,
      RW: 0.055,
    },
    ctx
  );
  assert.ok(result.ok);
  const parsed = JSON.parse(result.output as string);
  assert.equal(parsed.Vsh.length, n);
  assert.equal(parsed.PHIE.length, n);
  assert.equal(parsed.SW.length, n);
  assert.equal(parsed.BVW.length, n);
  assert.equal(parsed.anomalyScore.length, n);
  assert.equal(parsed.fluidFlag.length, n);
  assert.equal(parsed.lithology.length, n);
});
