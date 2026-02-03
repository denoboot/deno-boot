// deno-lint-ignore-file no-explicit-any
// engine/core/kernel.ts
/**
 * DenoBoot Kernel
 * Main orchestrator for the engine lifecycle
 */

import { ConfigLoader, type DenoBootUserConfig } from "@denoboot/config/mod.ts";
import { OakKernel } from "./kernel.ts";

/**
 * Bootstrap the DenoBoot Engine
 *
 * @param options - Configuration options or path to config file
 * @default options = 'boot.config.ts'
 * @returns {Promise<DenoBootKernel>}
 */
export async function oakEngine<
  AS extends Record<PropertyKey, any> = Record<string, any>,
>(
  /**
   * Configuration options or path to config file
   *
   * @default 'boot.config.ts'
   */
  options: DenoBootUserConfig["server"] | string = "boot.config.ts",
): Promise<OakKernel<AS>> {
  const cfg = await ConfigLoader.resolveConfigFile(options);

  // Validate configuration
  ConfigLoader.validate(cfg);

  // Create kernel
  const kernel = new OakKernel<AS>(cfg);

  // Use custom container if provided
  if (cfg.container) {
    // Transfer services to custom container
    // (This is advanced usage)
    kernel.setContainer(cfg.container);
  }

  // Set custom tenant resolver
  if (cfg.tenantResolver) {
    kernel.setTenantResolver(cfg.tenantResolver);
  }

  // // Register plugins
  if (cfg.plugins) {
    for (const plugin of cfg.plugins) {
      await kernel.registerPlugin(plugin);
    }
  }

  // Load tenants
  const tenants = await ConfigLoader.loadTenants(cfg.tenants);
  kernel.registerTenants(tenants);

  // Apply middleware
  if (cfg.middleware) {
    for (const middleware of cfg.middleware) {
      kernel.use(middleware);
    }
  }
  kernel.use((_ctx, next) => {
    if (
      kernel.getRouter().getRoutes().filter((r) => r.path === "/").length <= 0
    ) {
      kernel.getRouter().register({
        method: "GET",
        path: "/",
        tenant: false,
        name: "core/root",
        handler: (kwargs) => {
          return async (ctx, _next) => {
            const runtime = kwargs.container.resolve("runtime");
            const html = await runtime.render("core/root", {
              // app: ctx.app,
              // env: ctx.env,
              version: "0.1.0",
            });
            ctx.response.type = "text/html";
            ctx.response.body = html;
          };
        },
      });
    }
    return next();
  });

  // Initialize and boot
  await kernel.initialize();
  await kernel.boot();

  return kernel;
}
