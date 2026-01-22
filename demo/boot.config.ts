import { defineBootConfig } from "@denoboot/config/mod.ts";

// local plugins
import { BlogPlugin } from "./plugins/blog/plugin.ts";
import { AnalyticsPlugin } from "./plugins/analytics/plugin.ts";

// agnostic plugins
import { MySQLPlugin } from "@denoboot/mysql-plugin/mod.ts";
import { SQLitePlugin } from "@denoboot/sqlite-plugin/mod.ts";
import { DenoKVPlugin } from "@denoboot/denokv-plugin/mod.ts";

// oak specific plugins
import { OakDashboardPlugin } from "@denoboot/oak-dashboard-plugin/mod.ts";
import { OakFsRouterPlugin } from "@denoboot/oak-fs-router-plugin/mod.ts";

export default defineBootConfig(({ config }) => ({
  runtime: {},
  storage: {},
  engine: {
    port: config.number("PORT", 8000),
    hostname: config.string("HOSTNAME", "localhost"),
    env: config.string("DENO_ENV", "development"),
    logger: config.json("LOGGER", {
      level: config.string("LOG_LEVEL", "info"),
      useColors: config.bool("LOG_USE_COLORS", true),
    }),
    debug: config.bool("DEBUG", false),
  },
  plugins: [
    OakFsRouterPlugin,
    OakDashboardPlugin,
    MySQLPlugin,
    SQLitePlugin,
    DenoKVPlugin,
    BlogPlugin,
    AnalyticsPlugin,
  ],
  tenants: config.string("TENANTS_SOURCE", "./tenants.json"),
  // middleware: [
  //   // corsMiddleware({ origin: "*" }),
  //   // debugMiddleware({ debug: DEBUG }),
  // ],
}));
