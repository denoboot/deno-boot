// example-app/plugins/analytics/plugin.ts
/**
 * Analytics Plugin
 * Provides event tracking and analytics
 */

import { Container } from "@denoboot/di/mod.ts";
import { Logger } from "@denoboot/logger";
import { CacheDriver, DatabaseDriver } from "@denoboot/types";
import { defineOakPlugin } from "@denoboot/oak/mod.ts";

export const AnalyticsPlugin = defineOakPlugin({
  name: "analytics",
  version: "1.0.0",
  description: "Analytics and event tracking",
  type: 'server',
  

  async init(container, config) {
    const logger = container.resolve("logger");
    const events = container.resolve("events");

    // Register analytics service
    container.registerSingleton("analytics", async (c) => {
      return new AnalyticsService(c);
    });

     // Listen for tenant initialization
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data ||{};

      if (tenant && tenant.plugins.includes("analytics")) {
        logger.debug(`Setting up analytics for tenant: ${tenant.id}`);
        
        // Initialize analytics service
        const analytics = tenantContainer.resolve("analytics") as AnalyticsService;
        console.log(analytics)
        await analytics.initialize();
      }
    });
    return await Promise.resolve();
  },

  routes: [
    {
      method: "POST",
      path: "/api/analytics/track",
      tenant: true,
      handler({ container }){
        return async (ctx) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const body = await ctx.request.body.json()

        // Dispatch tracking worker
        const workers = container.resolve("workers");
        const jobId = await workers.dispatch(
          "analytics",
          "track-event",
          {
            tenantId: ctx.state.tenant?.id,
            data: {
              ...body,
              timestamp: new Date().toISOString(),
              ip: ctx.request.ip,
              userAgent: ctx.request.headers.get("user-agent"),
            },
          },
          container.getParent() || container
        );

        ctx.response.body = {
          success: true,
          jobId,
        };
      }
      },
    },
    {
      method: "GET",
      path: "/api/analytics/stats",
      tenant: true,
      handler({ container }) {
        return async (ctx) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const stats = await analytics.getStats();

        ctx.response.body = stats;
      }
      },
    },
    {
      method: "GET",
      path: "/api/analytics/events",
      tenant: true,
      handler({ container }) {
        return async (ctx) => {
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");
        const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
        const events = await analytics.getEvents(limit);

        ctx.response.body = { events };
      }
      },
    },
  ],

  workers: [
    {
      name: "track-event",
      handler: async (payload, container) => {
        const logger = container.resolve<Logger>("logger");
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");

        logger.debug("Tracking analytics event", {
          tenantId: payload.tenantId,
          event: payload.data.event,
        });

        await analytics.storeEvent(payload.data);

        return {
          success: true,
          data: { tracked: true },
        };
      },
    },
    {
      name: "aggregate-stats",
      handler: async (payload, container) => {
        const logger = container.resolve<Logger>("logger");
        const analytics = await container.resolveAsync<AnalyticsService>("analytics");

        logger.debug("Aggregating analytics stats");

        await analytics.aggregateStats();

        return {
          success: true,
          data: { aggregated: true },
        };
      },
    },
  ],

  middleware: [
    async (ctx, next) => {
      // Auto-track page views
      if (ctx.state.tenant && ctx.request.method === "GET") {
        const container = ctx.state.container;
        const workers = container.resolve("workers");

        await workers.dispatch(
          "analytics",
          "track-event",
          {
            tenantId: ctx.state.tenant.id,
            data: {
              event: "page_view",
              path: ctx.request.url.pathname,
              timestamp: new Date().toISOString(),
            },
          },
          container.getParent() || container
        );
      }

      await next();
    },
  ],
});

class AnalyticsService {
  private container: Container;
  private events: any[] = [];
  private initialized = false;

  constructor(container: Container) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;


    // create table if not exists
    const db = this.container.resolve<DatabaseDriver>("db");

    console.log("Creating analytics_events table");
    
    await db.execute(
      "CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY, event TEXT, data TEXT, timestamp TEXT)"
    );
    this.initialized = true;
  }

  async storeEvent(event: any): Promise<void> {
    // Try to use cache for recent events
    if (this.container.has("cache")) {
      const cache = this.container.resolve<CacheDriver>("cache");
      const key = `event:${event.timestamp}:${Math.random()}`;
      await cache.set(key, event, 3600); // 1 hour TTL
    }

    // Store in database
    const db = this.container.resolve<DatabaseDriver>("db.sqlite");

    try {
      await db.execute(
        "INSERT INTO analytics_events (event, data, timestamp) VALUES (?, ?, ?)",
        [event.event, JSON.stringify(event), event.timestamp]
      );
    } catch {
      // Fallback to in-memory
      this.events.push(event);
      if (this.events.length > 1000) {
        this.events.shift(); // Keep only last 1000
      }
    }
  }

  async getEvents(limit = 100): Promise<any[]> {
    const db = this.container.resolve<DatabaseDriver>("db.sqlite");

    try {
      return await db.query(
        "SELECT * FROM analytics_events ORDER BY timestamp DESC LIMIT ?",
        [limit]
      );
    } catch {
      return this.events.slice(0, limit);
    }
  }

  async getStats(): Promise<any> {
    const events = await this.getEvents(1000);

    const stats = {
      total: events.length,
      byEvent: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
    };

    for (const event of events) {
      // Count by event type
      const eventType = event.event || "unknown";
      stats.byEvent[eventType] = (stats.byEvent[eventType] || 0) + 1;

      // Count by day
      const day = new Date(event.timestamp).toISOString().split("T")[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    }

    return stats;
  }

  async aggregateStats(): Promise<void> {
    const logger = this.container.resolve<Logger>("logger");
    logger.debug("Aggregating analytics stats...");

    const stats = await this.getStats();

    // Store aggregated stats
    if (this.container.has("cache")) {
      const cache = this.container.resolve<CacheDriver>("cache");
      await cache.set("analytics:stats", stats, 300); // 5 min cache
    }
  }
}

export default AnalyticsPlugin;