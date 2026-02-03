// ============================================================================
// server/dev-server.ts - Complete implementation
// ============================================================================
import type { Builder } from "../build/builder.ts";
import type { HMREngine } from "../hmr/engine.ts";
import type { ResolvedConfig } from "../config/loader.ts";
import type { PluginManager } from "../core/plugin-manager.ts";
import {
  corsMiddleware,
  loggingMiddleware,
  MiddlewareStack,
  tsTranspileMiddleware,
} from "./middleware.ts";
import { StaticFileServer } from "./static.ts";
import { mimes } from "@denoboot/mimes";
import { join } from "@denoboot/x/std/path.ts";
// import { walkSync } from "@denoboot/x/std/fs.ts";

export class PreviewServer {
  private server: Deno.HttpServer | null = null;
  private middleware: MiddlewareStack;
  private staticServer: StaticFileServer;

  constructor(
    private builder: Builder,
    private config: ResolvedConfig,
  ) {
    // for (
    //   const entry of walkSync(config.root, {
    //     exts: [".html"],
    //     includeDirs: false,
    //   })
    // ) {
    //   if (entry.path?.endsWith("index.html")) {
    //     config.root = entry.path.replace("/index.html", "");
    //   }
    // }

    this.middleware = new MiddlewareStack();
    this.staticServer = new StaticFileServer(config.root);

    // Setup default middleware
    // this.middleware.use(corsMiddleware());
    this.middleware.use(loggingMiddleware());
  }

  use(
    middleware: (
      req: Request,
      next: () => Promise<Response>,
    ) => Promise<Response>,
  ): void {
    this.middleware.use(middleware);
  }

  async start(): Promise<void> {
    this.server = Deno.serve({
      port: this.config.server.port,
      hostname: this.config.server.host,
      onListen: ({ hostname, port }) => {
        console.log(`\n  ➜ Local:   http://${hostname}:${port}/`);
        console.log(`  ➜ Network: use --host to expose\n`);
      },
    }, (req) => this.middleware.handle(req, () => this.handleRequest(req)));
    await Promise.resolve();
  }

  async stop(): Promise<void> {
    await this.server?.shutdown();
    this.server = null;
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // 3. Serve from esbuild output (built modules)
    const outDir = "/.denoboot/dist/";
    if (url.pathname.startsWith(outDir)) {
      const modulePath = url.pathname.slice(outDir.length);
      const output = this.builder.getOutput(modulePath);

      if (output) {
        // Uint8Array<ArrayBufferLike> to BodyInit
        const body = new TextDecoder().decode(output.contents);
        return new Response(body, {
          headers: {
            "Content-Type": this.getContentType(modulePath),
            "Cache-Control": "no-cache",
            "X-Sourcemap": output.map ? join(outDir, `${modulePath}.map`) : "",
          },
        });
      }
    }

    // 4. Source maps
    if (url.pathname.endsWith(".map")) {
      const modulePath = url.pathname.slice(0, -4);
      const output = this.builder.getOutput(modulePath);

      if (output?.map) {
        return new Response(output.map, {
          headers: { "Content-Type": mimes.json },
        });
      }
    }

    // 5. Static files
    const staticResponse = await this.staticServer.serve(url.pathname);
    if (staticResponse) {
      // Inject HMR client into HTML
      if (staticResponse.headers.get("Content-Type")?.includes(mimes.html)) {
        const html = await staticResponse.text();
        return new Response(html, {
          headers: staticResponse.headers,
        });
      }
      return staticResponse;
    }

    // 6. Not found
    return new Response("Not Found", { status: 404 });
  }

  private getContentType(path: string): string {
    if (path.endsWith(".js") || path.endsWith(".mjs")) {
      return mimes.js;
    }
    if (
      path.endsWith(".css") || path.endsWith(".scss") || path.endsWith(".sass")
    ) return mimes.css;
    if (path.endsWith(".json")) return mimes.json;
    if (path.endsWith(".html")) return mimes.html;
    return mimes.binary;
  }
}
