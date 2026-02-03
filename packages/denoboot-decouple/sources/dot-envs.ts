import { join } from "@denoboot/x/std/path.ts";
import { fromDotEnv } from "./dot-env.ts";

export function fromDotEnvs(mode: string, envDir: string | false, prefixes: string | string[] = "DENOBOOT_") {
  let cache: Record<string, string> | null = null;

  return () => {
    if (cache) return cache;
    cache = {};

    prefixes = typeof prefixes === "string" ? prefixes.split(",") : prefixes;
    const envFiles = getEnvFilesForMode(mode, envDir);
    const parsed = Object.fromEntries(
      envFiles.flatMap((filePath) => {
        return Object.entries(fromDotEnv(filePath)());
      }),
    );

    // only keys that start with prefix are exposed to client
    for (const [key, value] of Object.entries(parsed)) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        cache[key] = value;
      }
    }
    return cache;
  };
}

export function getEnvFilesForMode(
  mode: string,
  envDir: string | false,
): string[] {
  if (envDir !== false) {
    return [
      /** default file */ `.env`,
      /** local file */ `.env.local`,
      /** mode file */ `.env.${mode}`,
      /** mode local file */ `.env.${mode}.local`,
    ].map((file) => join(envDir, file));
  }

  return [];
}
export function resolveEnvPrefix({
  envPrefix = "DENOBOOT_",
}: { envPrefix?: string | string[] }): string[] {
  envPrefix = typeof envPrefix === "string" ? envPrefix.split(",") : envPrefix;
  if (envPrefix.includes("")) {
    throw new Error(
      `envPrefix option contains value '', which could lead unexpected exposure of sensitive information.`,
    );
  }
  if (envPrefix.some((prefix) => /\s/.test(prefix))) {
    // eslint-disable-next-line no-console
    console.warn(
      `[denoboot] Warning: envPrefix option contains values with whitespace, which does not work in practice.`,
    );
  }
  return envPrefix;
}
