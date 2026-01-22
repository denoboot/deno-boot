import { casters, type CastFn } from "./casters.ts";
import { DecoupleError } from "./errors.ts";

export class DecoupledVar {
  constructor(
    private readonly key: string,
    private readonly value: string | undefined,
  ) {}

  private resolve<T>(
    caster: CastFn<T>,
    defaultValue?: T,
  ): T {
    if (this.value === undefined) {
      if (defaultValue !== undefined) return defaultValue;
      throw new DecoupleError(`Missing config value: ${this.key}`);
    }

    try {
      return caster(this.value);
    } catch (err) {
      throw new DecoupleError(
        `Error parsing "${this.key}": ${(err as Error).message}`,
      );
    }
  }

  /* -------------------------------------------------
   * Core types
   * ------------------------------------------------- */

  string(defaultValue?: string): string {
    return this.resolve(casters.string, defaultValue);
  }

  number(defaultValue?: number): number {
    return this.resolve(casters.number, defaultValue);
  }

  bool(defaultValue?: boolean): boolean {
    return this.resolve(casters.boolean, defaultValue);
  }

  json<T = unknown>(defaultValue?: T): T {
    return this.resolve<T>(casters.json, defaultValue);
  }

  list(defaultValue?: string[], sep = ","): string[] {
    return this.resolve((v) => casters.list(v, sep), defaultValue);
  }

  /* -------------------------------------------------
   * Validation helpers
   * ------------------------------------------------- */

  enum<const T extends readonly string[]>(
    values: T,
    defaultValue?: T[number],
  ): T[number] {
    return this.resolve((v) => {
      if (!values.includes(v)) {
        throw new Error(
          `Expected one of ${values.join(", ")}, got "${v}"`,
        );
      }
      return v as T[number];
    }, defaultValue);
  }

  match(
    pattern: RegExp,
    defaultValue?: string,
  ): string {
    return this.resolve((v) => {
      if (!pattern.test(v)) {
        throw new Error(`Value does not match ${pattern}`);
      }
      return v;
    }, defaultValue);
  }

  /* -------------------------------------------------
   * Required / raw access
   * ------------------------------------------------- */

  required(): string {
    if (this.value === undefined) {
      throw new DecoupleError(
        `Missing required config value: ${this.key}`,
      );
    }
    return this.value;
  }

  raw(): string | undefined {
    return this.value;
  }
}
