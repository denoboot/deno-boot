// denoboot/settings/loader.ts
import config, { globalServerSettings } from "@denoboot/config/decouple.ts";

type Settings = Record<string, unknown>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(base: Settings, override: Settings): Settings {
  const result: Settings = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(
        result[key] as Settings,
        value as Settings,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function loadOverrideModule(): Promise<Settings> {
  const modulePath = Deno.env.get("DENOBOOT_SETTINGS_MODULE") ||
    "./boot.config.ts";

  try {
    const mod = await import(modulePath);
    return mod.default ?? mod;
  } catch (error) {
    console.error(`Failed to load override module: ${modulePath}`);
    console.error(error);
    return {};
  }
}

export async function loadSettings(): Promise<Readonly<Settings>> {
  const override = await loadOverrideModule();
  const merged = deepMerge({ server: globalServerSettings }, override);
  return Object.freeze(merged);
}

export function loadDefaults(override: typeof globalServerSettings): Readonly<Settings> {
  const merged = deepMerge(globalServerSettings, override);
  return Object.freeze(merged);
}
