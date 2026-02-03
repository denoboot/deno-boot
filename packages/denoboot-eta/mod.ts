/**
 * Main export for Deno Boot Eta Runtime
 */

import { join } from "@denoboot/x/std/path.ts";
import { type ResolverOptions, TemplateSourceResolver } from "./resolver.ts";
import { DenoBootEtaRuntime } from "./runtime.ts";
import type { TemplateEngineOptions, TemplateSource } from "./types.ts";
import type { Logger } from "@denoboot/logger/mod.ts";

export { DenoBootEtaRuntime } from "./runtime.ts";
export { TemplateCompiler } from "./template-compiler.ts";
export { BlockRegistry, LayoutProcessor } from "./layout-system.ts";
export type {
  CompiledTemplate,
  TemplateContext,
  TemplateDiscoveryOptions,
  TemplateEngineOptions,
  TemplateSource,
  TenantConfig,
} from "./types.ts";

/**
 * Factory function to create a configured Eta runtime
 */
export async function createEtaRuntime(options: {
  sources: string[] | TemplateSource[];
  engineOptions?: TemplateEngineOptions;
  resolver?: TemplateSourceResolver;
  logger?: Logger;
}): Promise<DenoBootEtaRuntime> {
  const runtime = new DenoBootEtaRuntime(
    options.engineOptions,
    options.resolver || createDefaultResolver({
      cacheDir: "./.denoboot/cache",
      allowNetwork: true,
    }),
    options.logger,
  );

  await runtime.initialize({
    sources: options.sources,
  });

  return runtime;
}

/**
 * Create a resolver with common Deno Boot aliases
 */
export function createDefaultResolver(
  options?: ResolverOptions,
): TemplateSourceResolver {
  const resolver = new TemplateSourceResolver(options);

  // Register common Deno Boot aliases
  resolver.registerAlias(
    "@denoboot/engine",
    join(Deno.cwd(), "../packages/denoboot-engine-core/views"),
  );
  resolver.registerAlias(
    "@denoboot/oak-dashboard-plugin",
    join(
      Deno.cwd(),
      "../packages-engine-plugins/denoboot-oak-dashboard-plugin/views",
    ),
  );

  return resolver;
}

/**
 * Default configuration for production
 */
export const defaultConfig: TemplateEngineOptions = {
  cache: true,
  viewsRoot: ".denoboot/views",
  etaConfig: {
    autoEscape: true,
    rmWhitespace: true,
    autoTrim: false,
  },
};

/**
 * Development configuration with watching
 */
export const developmentConfig: TemplateEngineOptions = {
  ...defaultConfig,
  cache: false,
  watch: true,
};
