import { DecoupleError } from "./errors.ts";

export type CastFn<T> = (value: string) => T;

export const casters = {
  string: (v: string) => v,

  number: (v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) {
      throw new DecoupleError(`Invalid number: "${v}"`);
    }
    return n;
  },

  boolean: (v: string) => {
    const val = v.toLowerCase().trim();
    if (["1", "true", "yes", "on"].includes(val)) return true;
    if (["0", "false", "no", "off"].includes(val)) return false;
    throw new DecoupleError(`Invalid boolean: "${v}"`);
  },

  json: <T = unknown>(v: string): T => {
    try {
      return JSON.parse(v);
    } catch {
      throw new DecoupleError(`Invalid JSON: "${v}"`);
    }
  },

  list: (v: string, sep = ",") =>
    v.split(sep).map((x) => x.trim()).filter(Boolean),
};
