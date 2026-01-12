// deno-lint-ignore-file no-explicit-any
import type { Logger } from "@denoboot/logger";
import type { Container } from "@denoboot/di/mod.ts";

/**
 * Creates a request logging middleware
 * @param logger The logger to use
 * @returns The request logging middleware
 */
export const errorHandleMiddleware =
  <TContainer extends Container = Container>(container: TContainer) =>
  async (ctx: any, next: any) => {
    try {
      await next();
    } catch (error: any) {
      const logger = container.resolve<Logger>("logger");

      logger.error("Request error", {
        error: error.message,
        stack: error.stack,
        url: ctx.request.url.toString(),
      });

      ctx.response.status = error.status || 500;
      ctx.response.body = {
        error: error.message,
        status: error.status || 500,
      };
    }
  };

export const renderErrorPage =
  <TContainer extends Container = Container>(container: TContainer) =>
  async (ctx: any, next: any) => {
    if (ctx.request.headers.get("accept")?.includes("text/html")) {
      const views = container.resolve("views");
      views.addPath(new URL("../views", import.meta.url).pathname);
      if (ctx.response.status === 404) {
        const router = container.resolve("router");
        const data = {
          status: ctx.response.status || 404,
          requestId: ctx.state?.requestId,
          routes: router.getRoutes(),
          debug: Deno.env.get("DENO_ENV") !== "production",
        };
        const error404Html = await views.render("error/404", data);
        ctx.response.status = 404;
        ctx.response.body = error404Html;
      } else if (ctx.response.status >= 500) {
        const data = {
          status: ctx.response.status || 500,
          requestId: ctx.state?.requestId,
          errorId: ctx.state?.errorId,
        };
        const error500Html = await views.render("error/500", data);
        ctx.response.status = ctx.response.status || 500;
        ctx.response.body = error500Html;
      }
    }
    await next();
  };
