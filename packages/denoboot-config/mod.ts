// engine/core/config.ts
/**
 * Configuration Loader
 * Loads and merges configuration from various sources
 */

// TODO: This should configure/orchestrate the loading and merging of configuration from multiple sources (FE/BE/CLI/ENV/CONFIG_FILE)

import {
  deepMerge,
  fileExists,
  loadJSON,
  resolveImportPath,
  tryCatch,
} from "@denoboot/utils/mod.ts";
import type { Tenant } from "@denoboot/engine/mod.ts";
import {
  decouple,
  fromDefaults,
  fromDenoEnv,
  fromDotEnv,
} from "@denoboot/decouple/mod.ts";
import type { LoggerOptions } from "@denoboot/logger";
import type { DenoBootRuntimeConfig } from "@denoboot/runtime/mod.ts";

const config = decouple([
  fromDenoEnv(),
  fromDotEnv(),
  fromDefaults({ PORT: "8000", hostname: "localhost" }),
]);

/**
 * Base configuration for the engine
 */
export interface DenoBootConfig {
  port?: number;
  hostname?: string;
  env?: "development" | "production" | "test";
  logger?: LoggerOptions;
  viewPaths?: string[];
  assetPaths?: string[];
  pluginPaths?: string[];
  debug?: boolean;
}

/**
 * Bootstrap options for the engine
 */
export interface BootstrapOptions {
  runtime?: DenoBootRuntimeConfig;
  engine?: DenoBootConfig;
  // configFilename?: string;
  plugins?: any[];
  tenants?: string | Record<string, any>[];
  middleware?: any[];
  tenantResolver?: any;
  container?: any;
  env?: string | Record<string, any>;
  deno?:
    | Record<string, any>
    | ((denoJson: Record<string, any>) => Record<string, any>);
}

const DEFAULT_CONFIG: DenoBootConfig = {
  port: 8000,
  hostname: "localhost",
  env: "development",
  logger: {
    level: "info",
    useColors: true,
  },
  viewPaths: ["./views"],
  assetPaths: ["./public"],
  pluginPaths: ["./plugins"],
};

export class ConfigLoader {
  /**
   * Load configuration from file and environment
   */
  static async load(configPath?: string): Promise<DenoBootConfig> {
    let config = { ...DEFAULT_CONFIG };

    // Load from file if provided
    if (configPath && (await fileExists(configPath))) {
      const fileConfig = await loadJSON<Partial<DenoBootConfig>>(configPath);
      config = deepMerge(config, fileConfig);
    }

    // Override with environment variables
    const envConfig = this.loadFromEnv();
    config = deepMerge(config, envConfig);

    return config;
  }

  /**
   * Load configuration from environment variables
   */
  private static loadFromEnv(): Partial<DenoBootConfig> {
    const config: Partial<DenoBootConfig> = {};
    const envConfig = this.readEnvFile();

    // if (Deno.env.get("PORT")) {
    //   config.port = parseInt(Deno.env.get("PORT")!);
    // }

    // if (Deno.env.get("HOSTNAME")) {
    //   config.hostname = Deno.env.get("HOSTNAME");
    // }

    // if (Deno.env.get("DENO_ENV")) {
    //   config.env = Deno.env.get("DENO_ENV") as DenoBootConfig["env"];
    // }

    // if (Deno.env.get("LOG_LEVEL")) {
    //     config.logger = { ...config.logger, level: Deno.env.get("LOG_LEVEL") as  LogLevel | undefined || 'info' };
    // }

    return deepMerge(config, envConfig);
  }

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
  static validate(config: DenoBootConfig): void {
    if (!config.port) {
      throw new Error("Port is required");
    }

    if (config.port < 1 || config.port > 65535) {
      throw new Error(`Invalid port: ${config.port}`);
    }

    const validEnvs = ["development", "production", "test"];
    if (!validEnvs.includes(config.env!)) {
      throw new Error(`Invalid environment: ${config.env}`);
    }

    const validLogLevels = ["debug", "info", "warn", "error"];
    if (!validLogLevels.includes(config.logger?.level!)) {
      throw new Error(`Invalid log level: ${config.logger?.level}`);
    }
  }

  static defineConfig<T extends BootstrapOptions | object>(
    $:
      | T
      | ((
        args: { config: typeof config },
      ) => T),
  ) {
    // this.parseDenoJson($);
    if (typeof $ === "function") {
      return $({ config });
    }

    return $;
  }

  private static parseDenoJson<T extends BootstrapOptions>(
    $: T,
  ) {
    try {
      const $denoJson = Deno.readTextFileSync("./deno.json");
      if (typeof $.deno !== "function") {
        $.deno = { ...JSON.parse($denoJson), ...$.deno };
      } else {
        $.deno = (denoJson: Record<string, any>) => ({
          ...JSON.parse($denoJson),
          ...denoJson,
        });
      }
    } catch (error) {
      console.error(error);
    }

    return $;
  }

  private static parseDotEnv<T extends BootstrapOptions>(
    $: T,
  ) {
    if (!$.env) {
      $.env = ".env";
    }

    if (typeof $.env === "string") {
      try {
        $.env = ConfigLoader.readEnvFile($.env, true);
      } catch (_) {
        $.env = {};
      }
    } else if (typeof $.env === "object") {
      $.env = { ...$.env };
    } else {
      $.env = {};
    }
    return $;
  }

  static readEnvFile(path = ".env", setEnv = true) {
    const text = Deno.readTextFileSync(path);
    const env: Record<string, string> = {};

    for (const line of text.split("\n")) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Remove surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (setEnv) {
        Deno.env.set(key, value);
      }
      env[key] = value;
    }

    return env;
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
