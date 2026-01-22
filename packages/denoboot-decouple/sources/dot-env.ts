import { DecoupleError } from "../errors.ts";

export function fromDotEnv(path = ".env") {
  let cache: Record<string, string> | null = null;

  return () => {
    if (cache) return cache;

    try {
      const text = Deno.readTextFileSync(path);
      const lines = text.split("\n");

      const values: Record<string, string> = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;

        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();

        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        values[key] = value;
      }

      cache = values;
      return values;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        cache = {};
        return cache;
      }

      throw new DecoupleError(
        `Failed to load .env file (${path})`,
      );
    }
  };
}
