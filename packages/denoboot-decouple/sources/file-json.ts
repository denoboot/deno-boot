import { DecoupleError } from "../errors.ts";

export function fromJsonFile(path: string | undefined) {
  let cache: Record<string, string> | null = null;

  return () => {
    if (cache) return cache;
    if (!path) {
      throw new DecoupleError("Path to JSON file is required");
    }

    try {
      const content = Deno.readTextFileSync(path);
      cache = JSON.parse(content);
      return cache!;
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        throw new DecoupleError(
          `Failed to load JSON file (${path})`,
        );
      }

      if (err instanceof SyntaxError) {
        throw new DecoupleError(
          "Unable to parse JSON file. Please check the file for syntax errors.",
        );
      }

      console.error(err);
      cache = {};
      return cache;
    }
  };
}

export function fromJsonFiles(paths: string[]) {
  return paths.map((path) => fromJsonFile(path)).reduce((a, b) => {
    return () => {
      return { ...a(), ...b() };
    };
  }, () => ({}));
}
