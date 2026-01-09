/**
 * OakDashboardPlugin Plugin
 */


import { defineOakPlugin } from "@denoboot/oak/mod.ts";
import type { Container } from "@denoboot/di/mod.ts";

export const OakDashboardPlugin = defineOakPlugin({
  name: "oak-dashboard",
  version: "1.0.0",
  description: "Dashboard plugin",
  type: 'client-server',

  async init(container, config) {
    const logger = container.resolve("logger");
    const events = container.resolve("events");

    logger.info("Initializing dashboard plugin");

    // Register dashboard service factory for each tenant
    container.registerFactory("dashboard", (c) => {
      return new DashboardService(c);
    });

    // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;

      if (tenant.plugins.includes("oak-dashboard")) {
        logger.debug(`Setting up dashboard for tenant: ${tenant.id}`);

        // Initialize dashboard service
        const dashboard = tenantContainer.resolve("dashboard");
        await dashboard.initialize();
      }
    });
  },

  routes: [
    {
      method: "GET",
      path: "/dashboard",
      tenant: false,
      name: "dashboard",
      handler: (kwargs) => async (ctx) => {
        const tenantManager = kwargs.container.resolve("tenantManager");
        const tenant = await tenantManager.resolve(ctx);
        if (!tenant) {
          ctx.response.status = 404;
          ctx.response.body = { error: "Tenant not found" };
          return;
        }
        ctx.response.redirect(`/tenant/${tenant.id}/dashboard`);
      },
    },
    {
      method: "GET",
      path: "/tenant/:tenantId/dashboard",
      tenant: true,
      name: "tenant-dashboard",
      handler: (kwargs) => async (ctx) => {
        const tenant = ctx.state.tenant!;
        const views = kwargs.container.resolve("views");

        // if tenant.id not equal param tenantId, redirect to correct url
        if (tenant.id !== ctx.params.tenantId) {
          ctx.response.redirect(`/tenant/${tenant.id}/dashboard`);
          return;
        }

        const html = await views.render(
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
          },
          {
            tenant,
            plugin: "oak-dashboard",
          }
        );

        ctx.response.type = "text/html";
        ctx.response.body = html;
      },
    },
  ],

  workers: [],

  viewPaths: ["../packages-engine-plugins/denoboot-oak-dashboard-plugin/views"] // TODO: Fix this -> This should be relative to the plugin
});

/**
 * Dashboard Service
 */
class DashboardService {
  private container: Container;
  private posts: Map<string, any> = new Map();
  private initialized = false;

  constructor(container: Container) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const logger = this.container.resolve("logger");
    logger.debug("Initializing dashboard service");

    this.initialized = true;
  }
}

export default OakDashboardPlugin;
