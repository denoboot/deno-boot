// deno-lint-ignore-file no-explicit-any
// engine/core/kernel.ts
/**
 * DenoBoot Kernel
 * Main orchestrator for the engine lifecycle
 */

import {
  Application,
  type ListenOptions,
  type Middleware,
  type RouteParams,
} from "@denoboot/x/oak.ts";
import { type Container, createContainer } from "@denoboot/di/mod.ts";

import {
  type OakEngineRouterMiddleware,
  type OakEngineRouterState,
  OakRouter,
} from "./router.ts";
import { DenoBootConfig } from "@denoboot/config/mod.ts";
import { createLogger, type Logger } from "@denoboot/logger/mod.ts";
import { createEventEmitter, type EventEmitter } from "@denoboot/events/mod.ts";
import type { DenoBootEngine } from "@denoboot/engine/engine.ts";
import {
  createWorkerManager,
  type WorkerManager,
  type WorkerPayload,
} from "@denoboot/engine/worker-manager.ts";
import {
  EtaViewEngine,
  type ViewEngine,
} from "@denoboot/engine/view-engine.ts";
import {
  DefaultTenantResolver,
  type Tenant,
  TenantManager,
  type TenantResolver,
} from "@denoboot/engine/tenant-manager.ts";
import {
  createPluginManager,
  type DenoBootEnginePlugin,
  type DenoBootPluginConfig,
  PluginManager,
} from "@denoboot/engine/plugin-manager.ts";
import { requestLogMiddleware } from "./middleware/request-log.ts";
import {
  errorHandleMiddleware,
  renderErrorPage,
} from "./middleware/error-handle.ts";
import {
  createEtaRuntime,
  DenoBootEtaRuntime,
} from "@denoboot/engine/runtime/mod.ts";
export interface OakEngineAppMiddleware<
  S extends Record<PropertyKey, any> = Record<string, any>,
> extends Middleware<S> {}

export type OakEngineInternalServices<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  config: DenoBootConfig;
  logger: Logger;
  events: EventEmitter;
  plugins: PluginManager;
  tenantManager: TenantManager;
  pluginManager: PluginManager;
  workers: WorkerManager;
  views: ViewEngine;
  router: OakRouter;
  runtime: DenoBootEtaRuntime;
} & T;

export interface OakEngineContainer<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Container<OakEngineInternalServices<T>> {
  // Add any Oak-specific container properties here if needed
}

export class OakKernel<
  AS extends Record<PropertyKey, any> = Record<string, any>,
> implements DenoBootEngine {
  name = "oak-engine";

  /**
   * Oak Application instance
   */
  private app: Application<AS>;

  /**
   * Oak Engine Container
   */
  private container: OakEngineContainer;

  /**
   * Logger instance
   */
  private logger: Logger;

  /**
   * Plugin Manager
   */
  private pluginManager: PluginManager;

  /**
   * Tenant Manager
   */
  private tenantManager: TenantManager;

  /**
   * Worker Manager
   */
  private workerManager: WorkerManager;

  /**
   * View Engine
   */
  private viewEngine: ViewEngine;

  /**
   * Oak Router
   */
  private router: OakRouter<any, any, any>;

  /**
   * Configuration
   */
  private config: DenoBootConfig;

  /**
   * Middlewares
   */
  private middlewares: OakEngineAppMiddleware<AS>[] = [];

  /**
   * Initialized flag
   */
  private initialized = false;

  /**
   * Booted flag
   */
  private booted = false;

  /**
   * Event Emitter
   */
  private eventEmitter: EventEmitter;

  private runtime!: DenoBootEtaRuntime;

  constructor(config: DenoBootConfig) {
    this.config = config;
    this.app = new Application<AS>();
    this.container = createContainer<OakEngineInternalServices>();
    this.logger = createLogger(config.logger);
    this.pluginManager = createPluginManager(this.logger);
    this.workerManager = createWorkerManager(this.logger);
    this.viewEngine = new EtaViewEngine(this.logger, config.viewPaths || []);
    this.eventEmitter = createEventEmitter();

    // Register core services
    this.registerPreTenantCoreServices();

    // Initialize tenant manager
    this.tenantManager = new TenantManager(
      this.container,
      this.logger,
      new DefaultTenantResolver(),
    );

    // Initialize router
    this.router = new OakRouter(
      undefined, // TODO: Original Oak Router options
      this.container,
      this.tenantManager,
      this.logger,
    );

    // Register post-tenant core services
    this.registerPostTenantCoreServices();
  }

  /**
   * Register core services in the container
   */
  private registerPreTenantCoreServices(): void {
    this.container.register("config", this.config);
    this.container.register("logger", this.logger);
    this.container.register("events", this.eventEmitter);
    this.container.register("plugins", this.pluginManager);
    this.container.register("pluginManager", this.pluginManager);
    this.container.register("workers", this.workerManager);
    this.container.register("views", this.viewEngine);
  }

  private registerPostTenantCoreServices(): void {
    this.container.register("tenantManager", this.tenantManager);
    this.container.register("router", this.router);
  }

  setContainer(container: OakEngineContainer): void {
    this.container = container;
  }

  /**
   * Register a plugin
   */
  async registerPlugin(
    plugin: DenoBootEnginePlugin<
      OakEngineAppMiddleware<AS>,
      OakEngineRouterMiddleware
    >,
    config: DenoBootPluginConfig = {},
  ): Promise<void> {
    await this.pluginManager.register(plugin, config);
  }

  /**
   * Register a plugin from path
   */
  async registerPluginFromPath(
    path: string,
    config: DenoBootPluginConfig = {},
  ): Promise<void> {
    await this.pluginManager.registerFromPath(path, config);
  }

  /**
   * Register a tenant
   */
  registerTenant(tenant: Tenant): void {
    this.tenantManager.registerTenant(tenant);
  }

  /**
   * Register multiple tenants
   */
  registerTenants(tenants: Tenant[]): void {
    this.tenantManager.registerTenants(tenants);
  }

  /**
   * Set custom tenant resolver
   */
  setTenantResolver(resolver: TenantResolver): void {
    this.tenantManager.setResolver(resolver);
  }

  /**
   * Add middleware
   */
  use(middleware: OakEngineAppMiddleware<AS>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Initialize the kernel
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error("Kernel already initialized");
    }

    // Initialize plugins
    await this.pluginManager.initialize(this.container);

    // Register plugin routes
    this.registerPluginRoutes();

    // Register plugin workers
    this.registerPluginWorkers();

    // Add plugin view paths
    this.addPluginViewPaths();

    this.runtime = await createEtaRuntime({
      sources: [
        "@denoboot/engine?id=framework&priority=0",
        "@denoboot/oak-dashboard-plugin?id=plugin&priority=100",
        "@views",
        "@plugins",
      ],
      engineOptions: {
        watch: true,
        cache: false,
      },
      logger: this.logger,
    });
    this.container.register("runtime", this.runtime);
    this.initialized = true;
  }

  /**
   * Boot the kernel
   */
  async boot(): Promise<void> {
    if (!this.initialized) {
      throw new Error("Kernel must be initialized before booting");
    }

    if (this.booted) {
      throw new Error("Kernel already booted");
    }

    // Initialize tenant services
    await this.tenantManager.initializeTenantServices();

    // Boot plugins
    await this.pluginManager.boot(this.container);

    // Setup Oak application
    this.setupApplication();

    this.booted = true;
    await this.bootLogDiagnostics();
  }

  /**
   * Register routes from all plugins
   */
  private registerPluginRoutes(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.routes) {
        this.router.registerRoutes(plugin.routes);
      }
    }
  }

  /**
   * Register workers from all plugins
   */
  private registerPluginWorkers(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.workers) {
        this.workerManager.registerWorkers(plugin.name, plugin.workers);
      }
    }
  }

  /**
   * Add view paths from all plugins
   */
  private addPluginViewPaths(): void {
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.viewPaths) {
        for (const path of plugin.viewPaths) {
          this.viewEngine.addPath(path);
        }
      }
    }
  }

  /**
   * Setup Oak application
   */
  private setupApplication(): void {
    // Error handling
    this.app.use(errorHandleMiddleware(this.container));

    // Request logging
    this.app.use(requestLogMiddleware(this.container));

    // Apply custom middleware
    for (const middleware of this.middlewares) {
      this.app.use(middleware);
    }

    // Apply plugin middleware
    for (const plugin of this.pluginManager.getAll()) {
      if (plugin.middleware) {
        for (const middleware of plugin.middleware) {
          this.app.use(middleware);
        }
      }
    }

    // Mount router
    this.app.use(this.router.getRouter().routes());
    this.app.use(this.router.getRouter().allowedMethods());

    this.app.use(renderErrorPage(this.container));
  }

  async bootLogDiagnostics(enabled = true) {
    if (!enabled) return;

    // Print diagnostic information
    console.log("\n" + "═".repeat(70));
    console.log("🦕 DenoBoot OakEngine Ready");
    console.log("═".repeat(70));

    const config = this.getConfig();
    const tenants = this.tenantManager.listTenants();
    const plugins = this.container.resolve<PluginManager>("plugins").list();

    console.log("\n📊 System Information:");
    console.log(`   Environment: ${config.env}`);
    console.log(`   Log Level: ${config.logger?.level}`);
    console.log(`   Server: http://${config.hostname}:${config.port}`);

    console.log("\n🔌 Loaded Plugins:");
    plugins.forEach((name) => console.log(`   - ${name}`));

    console.log("\n🏢 Registered Tenants:");
    tenants.forEach((t) => {
      console.log(`   - ${t.id} (${t.name})`);
      console.log(`     Plugins: ${t.plugins.join(", ")}`);
    });

    console.log("\n🌐 Access URLs:");
    console.log(`   Main: http://${config.hostname}:${config.port}`);
    console.log(`   Health: http://${config.hostname}:${config.port}/health`);
    console.log(
      `   Tenants: http://${config.hostname}:${config.port}/api/tenants`,
    );

    console.log("\n🏢 Tenant Dashboards (Path-Based):");
    tenants.forEach((t) => {
      console.log(
        `   ${t.name}: http://${config.hostname}:${config.port}/tenant/${t.id}/dashboard`,
      );
    });

    if (tenants.some((t) => t.subdomain)) {
      console.log("\n🌍 Tenant Dashboards (Subdomain - Requires Hosts File):");
      tenants
        .filter((t) => t.subdomain)
        .forEach((t) => {
          console.log(
            `   ${t.name}: http://${t.subdomain}.${config.hostname}:${config.port}/dashboard`,
          );
        });
      console.log("\n   ⚠️  For subdomain routing, add to /etc/hosts:");
      tenants
        .filter((t) => t.subdomain)
        .forEach((t) => {
          console.log(`   127.0.0.1 ${t.subdomain}.${config.hostname}`);
        });
    }

    console.log("\n📍 Registered Routes:");
    const routes = this.router.getRoutes();
    console.log(`   Total: ${routes.length}`);
    console.log(`   Global: ${this.router.getGlobalRoutes().length}`);
    console.log(`   Tenant: ${this.router.getTenantRoutes().length}`);

    if (this.isDebug()) {
      this.router.printRoutes();
    }

    console.log("\n💡 Quick Test:");
    console.log(`   curl http://${config.hostname}:${config.port}/health`);
    if (tenants.length > 0) {
      const firstTenant = tenants[0];
      console.log(
        `   curl http://${config.hostname}:${config.port}/tenant/${firstTenant.id}/dashboard`,
      );
    }

    console.log("\n" + "═".repeat(70));
    console.log("Press Ctrl+C to stop\n");
    await Promise.resolve();
  }

  /**
   * Start the server
   */
  async listen(options: ListenOptions = {}) {
    if (!this.booted) {
      throw new Error("Kernel must be booted before listening");
    }

    const { hostname, port } = this.config;

    await this.app.listen({ hostname, port, ...options });
  }

  /**
   * Shutdown the kernel
   */
  async shutdown(): Promise<void> {
    this.app.addEventListener("close", this._shutdown);
    Deno.addSignalListener("SIGINT", this._shutdown);
    Deno.addSignalListener("SIGTERM", this._shutdown);

    await Promise.resolve();
  }

  // Graceful shutdown
  private async _shutdown(): Promise<void> {
    const logger = this.container.resolve("logger");
    logger.info("Received shutdown signal");

    await this.pluginManager.shutdown(this.container);
    await Promise.resolve();
    Deno.exit(0);
  }

  getRouter<
    R extends string = string,
    P extends RouteParams<R> = RouteParams<R>,
    S extends OakEngineRouterState = OakEngineRouterState,
  >(): OakRouter<R, P, S> {
    return this.router;
  }

  /**
   * Get container
   */
  getContainer(): OakEngineContainer {
    return this.container;
  }

  /**
   * Get tenant container
   */
  getTenantContainer(tenantId: string): Container | null {
    return this.tenantManager.getContainer(tenantId);
  }

  /**
   * Dispatch a worker
   */
  async dispatchWorker(
    plugin: string,
    worker: string,
    payload: WorkerPayload,
  ): Promise<string> {
    return await this.workerManager.dispatch(
      plugin,
      worker,
      payload,
      this.container,
    );
  }

  /**
   * Render a view
   */
  async renderView(
    view: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return await this.viewEngine.render(view, data);
  }

  /**
   * Get Oak application (for advanced usage)
   */
  getApplication(): Application {
    return this.app;
  }

  /**
   * Get configuration
   */
  getConfig(): DenoBootConfig {
    return this.config;
  }

  isDebug(): boolean {
    return this.config.debug || false;
  }
}
