function envFlag(name) {
    const raw = process.env[name];
    return raw === "1" || raw === "true";
}
export function readFeatureFlags(overrides) {
    return {
        ENABLE_BACKGROUND_JOBS: overrides?.ENABLE_BACKGROUND_JOBS ?? envFlag("ENABLE_BACKGROUND_JOBS"),
        ENABLE_EXPERIMENTAL_TOOLS: overrides?.ENABLE_EXPERIMENTAL_TOOLS ?? envFlag("ENABLE_EXPERIMENTAL_TOOLS"),
        ENABLE_DANGEROUS_TOOLS: overrides?.ENABLE_DANGEROUS_TOOLS ?? envFlag("ENABLE_DANGEROUS_TOOLS"),
    };
}
