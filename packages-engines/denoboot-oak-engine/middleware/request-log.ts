// deno-lint-ignore-file no-explicit-any
import type { Logger } from "@denoboot/logger";
import type { Container } from "@denoboot/di/mod.ts";

/**
 * Creates a request logging middleware
 * @param logger The logger to use
 * @returns The request logging middleware
 */
export const requestLogMiddleware = <TContainer extends Container = Container>(container: TContainer) => async (ctx: any, next: any) => {
    const logger = container.resolve<Logger>("logger");
    const start = Date.now();
    await next();
    const ms = Date.now() - start;

    const logLevel = ctx.response.status >= 500 ? "error" : ctx.response.status >= 400 ? "warn" : "info";

    logger[logLevel](
      `${ctx.request.method} ${ctx.request.url.pathname} - ${ctx.response.status} (${ms}ms)`,
    );
  };