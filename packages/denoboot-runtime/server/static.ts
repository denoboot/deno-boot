// ============================================================================
// server/static.ts - Static file serving
// ============================================================================
import { extname, join } from "@denoboot/x/std/path.ts";
import { mimes } from "@denoboot/mimes";

export class StaticFileServer {
  private mimeTypes = new Map<string, string>(
    Object.entries(mimes).map(([k, v]) => [`.${k}`, v]),
  );

  constructor(private root: string) {}

  async serve(pathname: string): Promise<Response | null> {
    try {
      const filePath = join(this.root, pathname);
      const stat = Deno.statSync(filePath);

      if (stat.isDirectory) {
        // Try index.html
        return this.serve(join(pathname, "index.html"));
      }
      const file = Deno.readFileSync(filePath);
      const ext = extname(pathname);
      // dev and is ts or tsx
      if (ext === ".ts" || ext === ".tsx") {
        mimes[ext.substring(1)] = mimes.js;
        // TODO: compile ts/tsx to js
        this.mimeTypes.set(ext, mimes[ext.substring(1)]);
      }
      const contentType = this.mimeTypes.get(ext);
      if (!contentType) {
        return await Promise.reject(null);
      }

      return new Response(file, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return null;
      }
      throw err;
    }
  }
}
