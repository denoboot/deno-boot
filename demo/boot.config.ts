import { ConfigLoader } from "@denoboot/config/mod.ts";

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

const DEBUG = Deno.env.get("DEBUG") === "true";


export default ConfigLoader.defineConfig({
  config: {
    port: parseInt(Deno.env.get("PORT") || "8000"),
    hostname: Deno.env.get("HOSTNAME") || "localhost",
    env: (Deno.env.get("DENO_ENV") || "development") as
      | "development"
      | "production",
    logger: { level: Deno.env.get("LOG_LEVEL") || "info", useColors: true },
    viewPaths: ["./views"],
    assetPaths: ["./public"],
    pluginPaths: ["./plugins"],
    debug: DEBUG,
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
  tenantsFile: "./tenants.json",
  // middleware: [
  //   // corsMiddleware({ origin: "*" }), 
  //   // debugMiddleware({ debug: DEBUG }),
  // ],
});