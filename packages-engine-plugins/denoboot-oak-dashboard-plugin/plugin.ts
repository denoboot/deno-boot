/**
 * OakDashboardPlugin Plugin
 */


import { defineOakPlugin, type OakEngineContainer } from "@denoboot/oak/mod.ts";
import type { Tenant } from "@denoboot/engine/mod.ts";

export const OakDashboardPlugin = defineOakPlugin({
  name: "oak-dashboard",
  version: "1.0.0",
  description: "Dashboard plugin",
  type: 'client-server',

  async init(container, config) {
    const logger = container.resolve("logger");
    const events = container.resolve("events");

    // Register dashboard service factory for each tenant
    container.registerFactory("dashboard", (c) => {
      return new DashboardService(c);
    });

    // Listen for tenant initialization
    events.on<{tenant: Tenant, container: OakEngineContainer<{ dashboard: DashboardService }>}>("tenant:initialized", async (data) => {
      const { tenant, container: tenantContainer } = data || {};

      if (tenantContainer && tenant && tenant.plugins.includes("oak-dashboard")) {
        logger.debug(`Setting up dashboard for tenant: ${tenant.id}`);

        // Initialize dashboard service
        const dashboard = tenantContainer.resolve("dashboard");
        await dashboard.initialize();
      }
    });

    await Promise.resolve();
  },

  routes: [
    {
      method: "GET",
      path: "/dashboard", // TODO: i'm thinking we could automatically clone a route if tenant is true. For example, if we have a route /dashboard, we could automatically create a route /tenant/:tenantId/dashboard
      tenant: true,
      name: "tenant-dashboard",
      handler: (kwargs) => async (ctx) => {
        const tenant = kwargs.tenant!;
        const runtime = kwargs.container.resolve("runtime");

        const html = await runtime.render(
          'dashboard',
          {
            tenant,
            title: `${tenant!.name} Dashboard`,
            assets: {
                'dashboard.css': "packages-engine-plugins/denoboot-oak-dashboard-plugin/static/dashboard.css", // E.g ./.out/css/plugins/dashboard.css
                'dashboard.js': "packages-engine-plugins/denoboot-oak-dashboard-plugin/static/dashboard.ts", // E.g ./.out/js/plugins/dashboard/scripts/dashboard.js
                // 'dashboard.css': "@denoboot/oak-dashboard-plugin/static/dashboard.css", // TODO Create asset resolver
                // 'dashboard.js': "@denoboot/oak-dashboard-plugin/static/dashboard.ts", // TODO Create asset resolver
                // 'dashboard.css': "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css", // TODO: Remove this. This is just for testing remote assets
                // 'dashboard.js': "https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/js/bootstrap.bundle.min.js", // TODO: Remove this. This is just for testing remote assets
            },
          }
        );

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
  ],

  workers: [],

  viewPaths: ["../packages-engine-plugins/denoboot-oak-dashboard-plugin/runtime"] // TODO: Fix this -> This should be relative to the plugin
});

/**
 * Dashboard Service
 */
class DashboardService {
  private container: OakEngineContainer;
  private initialized = false;

  constructor(container: OakEngineContainer) {
    this.container = container;
  }

  async initialize() {
    if (this.initialized) return;

    const logger = this.container.resolve("logger");
    logger.debug("Initializing dashboard service");

    this.initialized = true;
    await Promise.resolve();
  }
}

export default OakDashboardPlugin;
