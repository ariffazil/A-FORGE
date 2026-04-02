export type FeatureFlags = {
    ENABLE_BACKGROUND_JOBS: boolean;
    ENABLE_EXPERIMENTAL_TOOLS: boolean;
    ENABLE_DANGEROUS_TOOLS: boolean;
};
export declare function readFeatureFlags(overrides?: Partial<FeatureFlags>): FeatureFlags;
