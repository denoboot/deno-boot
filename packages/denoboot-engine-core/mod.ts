import type { Container } from "@denoboot/di/mod.ts";
import type { AnyMiddleware } from "./middleware.ts";
import type { DenoBootEnginePlugin } from "./plugin-manager.ts";
import type { DenoBootWorkerDefinition } from "./worker-manager.ts";
import type { DenoBootRouteDefinition } from "./router.ts";

export * from "./engine.ts";
export * from "./middleware.ts";
export * from "./tenant-manager.ts";
export * from "./plugin-manager.ts";
export * from "./worker-manager.ts";
export * from "./router.ts";

export function defineBootPlugin<
  TAppMiddleware extends AnyMiddleware = AnyMiddleware,
  TRouterMiddleware extends AnyMiddleware = AnyMiddleware,
  TContainer extends Container = Container,
>(
  $: DenoBootEnginePlugin<
    TAppMiddleware,
    TRouterMiddleware,
    TRouterMiddleware,
    TContainer
  >,
) {
  $.routes = $.routes?.map(defineBootPluginRoute);
  $.workers = $.workers?.map(defineBootPluginWorker);
  $.middleware = $.middleware?.map(defineBootPluginMiddleware);
  return $;
}

export function defineBootPluginRoute<
  TRouterMiddleware extends AnyMiddleware,
  TContainer extends Container,
>(
  $: DenoBootRouteDefinition<TRouterMiddleware, TRouterMiddleware, TContainer>,
) {
  return $;
}

export function defineBootPluginWorker<
  TContainer extends Container = Container,
>($: DenoBootWorkerDefinition<TContainer>) {
  return $;
}

export function defineBootPluginMiddleware<
  TAppMiddleware extends AnyMiddleware,
>($: TAppMiddleware) {
  return $;
}
