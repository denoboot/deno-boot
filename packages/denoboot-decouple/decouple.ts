import { DecoupledVar } from "./var.ts";
import { DecoupleError } from "./errors.ts";
import { layer } from "./layer.ts";

export type ConfigValues = Record<string, string | undefined>;

export type ConfigSource =
  | ConfigValues
  | (() => ConfigValues);

export class DecoupledConfig {
  private frozen = false;

  // Always stored as ordered layers (priority: index 0 wins)
  private sources: ConfigSource[];

  constructor(source: ConfigSource | ConfigSource[]) {
    this.sources = Array.isArray(source) ? source : [source];
  }

  /* -------------------------------------------------
   * Internal helpers
   * ------------------------------------------------- */

  private assertMutable() {
    if (this.frozen) {
      throw new DecoupleError("Config is frozen and cannot be modified");
    }
  }

  private readLayer(source: ConfigSource): ConfigValues {
    return typeof source === "function" ? source() : source;
  }

  private resolveValue(key: string): string | undefined {
    for (const source of this.sources) {
      const values = this.readLayer(source);
      if (key in values && values[key] !== undefined) {
        return values[key];
      }
    }
    return undefined;
  }

  /* -------------------------------------------------
   * Core access
   * ------------------------------------------------- */

  get(key: string): DecoupledVar {
    return new DecoupledVar(key, this.resolveValue(key));
  }

  string(key: string, defaultValue?: string) {
    return this.get(key).string(defaultValue);
  }

  number(key: string, defaultValue?: number) {
    return this.get(key).number(defaultValue);
  }

  bool(key: string, defaultValue?: boolean) {
    return this.get(key).bool(defaultValue);
  }

  json<T = unknown>(key: string, defaultValue?: T) {
    return this.get(key).json<T>(defaultValue);
  }

  list(key: string, defaultValue?: string[], sep = ",") {
    return this.get(key).list(defaultValue, sep);
  }

  require(key: string) {
    return this.get(key).required();
  }

  /* -------------------------------------------------
   * Layer control
   * ------------------------------------------------- */

  extend(source: ConfigSource): this {
    this.assertMutable();
    this.sources = [source, ...this.sources];
    return this;
  }

  freeze(): this {
    this.frozen = true;
    return this;
  }

  /* -------------------------------------------------
   * Debug / introspection
   * ------------------------------------------------- */

  explain(key: string) {
    const sources = this.sources.map((src, index) => {
      const values = this.readLayer(src);
      return {
        layer: index,
        value: values[key],
      };
    });

    return {
      key,
      resolved: this.resolveValue(key),
      sources,
    };
  }
}

/* -------------------------------------------------
 * Factory
 * ------------------------------------------------- */

export function decouple(
  source: ConfigSource | ConfigSource[] = layer(),
): DecoupledConfig {
  return new DecoupledConfig(source);
}

// const config = decouple([
//   fromDenoEnv(),
//   fromDotEnv(),
//   fromDefaults({ PORT: "3000" }),
// ])
//   .extend(fromObject({ DEBUG: "true" }))
//   .freeze();

// config.explain("PORT");
/*
{
  key: "PORT",
  resolved: "8000",
  sources: [
    { layer: 0, value: undefined },
    { layer: 1, value: "8000" },
    { layer: 2, value: "4000" },
    { layer: 3, value: "3000" }
  ]
}
*/
