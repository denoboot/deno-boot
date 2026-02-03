// engine/core/config.ts
/**
 * Configuration Loader
 * Loads and merges configuration from various sources
 */

// TODO: This should configure/orchestrate the loading and merging of configuration from multiple sources (FE/BE/CLI/ENV/CONFIG_FILE)

import { deepMerge, fileExists, loadJSON, resolveImportPath, tryCatch } from "@denoboot/utils/mod.ts";
import type { Tenant } from "@denoboot/engine/mod.ts";
import type { LoggerOptions } from "@denoboot/logger";
import type { DenoBootRuntimeConfig } from "@denoboot/runtime/mod.ts";
import config, { GlobalServerSettings, globalServerSettings } from "@denoboot/config/decouple.ts";
import { fromDotEnv } from "@denoboot/decouple/mod.ts";

export default config;
export { fromDotEnv, globalServerSettings };

/**
 * Base configuration for the engine
 */
export interface DenoBootConfig {
  client: Record<string, any>;
  server: GlobalServerSettings;
}

export interface DenoBootUserConfig extends Partial<DenoBootConfig> {
}

/**
 * Bootstrap options for the engine
 */
// export interface BootstrapOptions {
//   runtime?: DenoBootRuntimeConfig;
//   engine?: DenoBootConfig;
//   // configFilename?: string;
//   plugins?: any[];
//   tenants?: string | Record<string, any>[];
//   middleware?: any[];
//   tenantResolver?: any;
//   container?: any;
//   env?: string | Record<string, any>;
//   deno?:
//     | Record<string, any>
//     | ((denoJson: Record<string, any>) => Record<string, any>);
// }

const DEFAULT_CONFIG: DenoBootConfig = {
  client: {},
  server: globalServerSettings,
};

export class ConfigLoader {
  /**
   * Load tenants from file
   */
  static async loadTenants<T extends string | Record<string, any>[]>(
    source: T | undefined,
  ): Promise<Tenant[]> {
    if (!source) return [];
    if (typeof source === "string") {
      // if is http or https
      if (source.startsWith("http://") || source.startsWith("https://")) {
        const response = await fetch(source);
        const data = await response.json();
        return data?.tenants || Array.isArray(data) ? data : [];
      }

      if (!(await fileExists(source))) {
        return [];
      }
      const data = await loadJSON<{ tenants: Tenant[] }>(source);
      return data.tenants || [];
    }
    return source as Tenant[];
  }

  /**
   * Validate configuration
   */
  static validate(config: DenoBootUserConfig = {}): void {
    // if (!config.port) {
    //   throw new Error("Port is required");
    // }

    // if (config.port < 1 || config.port > 65535) {
    //   throw new Error(`Invalid port: ${config.port}`);
    // }

    // const validEnvs = ["development", "production", "test"];
    // if (!validEnvs.includes(config.env!)) {
    //   throw new Error(`Invalid environment: ${config.env}`);
    // }

    // const validLogLevels = ["debug", "info", "warn", "error"];
    // if (!validLogLevels.includes(config.logger?.level!)) {
    //   throw new Error(`Invalid log level: ${config.logger?.level}`);
    // }
  }

  static defineConfig<T extends DenoBootUserConfig | object>(
    $:
      | T
      | ((
        args: { config: typeof config },
      ) => T),
  ) {
    let defined: T;
    if (typeof $ === "function") {
      defined = $({ config });
    } else {
      defined = $;
    }
    // loadDefaults(defined);
    return defined;
  }

  static async resolveConfigFile<R extends Record<string, any>>(
    config: string | R,
    loader: "esm" | "deno" = "esm",
  ): Promise<R> {
    const codeFiles = [".ts", ".js", ".cjs", ".mjs"];

    if (typeof config === "string") {
      const useEsmImport = loader === "esm" ||
        codeFiles.includes(config.slice(-3)) ||
        codeFiles.includes(config.slice(-4));

      // import file
      if (useEsmImport) {
        const [result, error] = await tryCatch(async () => {
          const content = await import(resolveImportPath(config));
          return content?.default || content;
        }, `Failed to import config file "${config}" via ESM import`);

        if (error) {
          throw error;
        }
        return result as R;
      }

      // deno read text file
      const [result, error] = await tryCatch(async () => {
        const content = await Deno.readTextFile(resolveImportPath(config));
        return JSON.parse(content) as R;
      }, `Failed to read config file "${config}" via Deno.readTextFile`);

      if (error) {
        throw error;
      }
      return result as R;
    }

    return config as R;
  }
}

export const defineBootConfig = ConfigLoader.defineConfig;
