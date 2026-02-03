// ============================================================================
// server/middleware.ts - Server middleware

import { join } from "@denoboot/x/std/path.ts";
import { transform } from "esbuild";
import { mimes } from "../../denoboot-mimes/mod.ts";
// ============================================================================
export type Middleware = (
  req: Request,
  next: () => Promise<Response>,
) => Promise<Response>;

export class MiddlewareStack {
  private stack: Middleware[] = [];

  use(middleware: Middleware): void {
    this.stack.push(middleware);
  }

  async handle(
    req: Request,
    finalHandler: () => Promise<Response>,
  ): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= this.stack.length) {
        return finalHandler();
      }

      const middleware = this.stack[index++];
      return middleware(req, next);
    };

    return next();
  }
}

// CORS middleware
export function corsMiddleware(): Middleware {
  return async (_req, next) => {
    const response = await next();

    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "*");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

// Logging middleware
export function loggingMiddleware(): Middleware {
  return async (req, next) => {
    const start = Date.now();
    const response = await next();
    const duration = Date.now() - start;

    console.log(
      `${req.method} ${
        new URL(req.url).pathname
      } - ${response.status} (${duration}ms)`,
    );

    return response;
  };
}

// .ts transpilation middleware
export function tsTranspileMiddleware(appRoot: string = ""): Middleware {
  return async (req, next) => {
    // console.log(
    //   `file://${Deno.cwd()}/.denoboot/dist${reqPath.replace(".ts", ".js")}`,
    // );

    const url = new URL(req.url);
    const path = join(appRoot, url.pathname);

    if (!path.endsWith(".ts") && !path.endsWith(".tsx")) {
      return next();
    }

    const source = await Deno.readTextFile(path);

    const result = await transform(source, {
      loader: path.endsWith(".tsx") ? "tsx" : "ts",
      format: "esm",
      sourcemap: true,
    });

    return new Response(result.code, {
      headers: {
        "Content-Type": mimes.js,
        "Cache-Control": "no-cache",
        "X-Sourcemap": result.map ? path : "",
      },
    });
  };
}
