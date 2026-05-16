export type FeatureFlags = {
  ENABLE_BACKGROUND_JOBS: boolean;
  ENABLE_EXPERIMENTAL_TOOLS: boolean;
  ENABLE_DANGEROUS_TOOLS: boolean;
};

function envFlag(name: string): boolean {
  const raw = process.env[name];
  return raw === "1" || raw === "true";
}

export function readFeatureFlags(overrides?: Partial<FeatureFlags>): FeatureFlags {
  return {
    ENABLE_BACKGROUND_JOBS: overrides?.ENABLE_BACKGROUND_JOBS ?? envFlag("ENABLE_BACKGROUND_JOBS"),
    ENABLE_EXPERIMENTAL_TOOLS:
      overrides?.ENABLE_EXPERIMENTAL_TOOLS ?? envFlag("ENABLE_EXPERIMENTAL_TOOLS"),
    ENABLE_DANGEROUS_TOOLS:
      overrides?.ENABLE_DANGEROUS_TOOLS ?? envFlag("ENABLE_DANGEROUS_TOOLS"),
  };
}
