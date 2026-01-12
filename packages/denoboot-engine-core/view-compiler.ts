// engine/core/view-compiler.ts

import { join, dirname, relative } from "@std/path";
import { walkDir, walkDirSync } from "@denoboot/utils";

export interface ViewLayer {
  root: string;
  priority: number;
}

export class ViewCompiler {
  constructor(
    private outDir = ".denoboot/views",
  ) {}

  async build(layers: ViewLayer[]) {
    await Deno.remove(this.outDir, { recursive: true }).catch(() => {});
    await Deno.mkdir(this.outDir, { recursive: true });

    layers.sort((a, b) => a.priority - b.priority);

    for (const layer of layers) {
      if (!layer.root) continue;

      for await (const entry of walkDir(layer.root, ['.eta'])) {
        if (!entry.endsWith(".eta")) continue;

        const rel = relative(layer.root, entry);
        const dest = join(this.outDir, rel);

        await Deno.mkdir(dirname(dest), { recursive: true });
        await Deno.copyFile(entry, dest);
      }
    }
  }
}
