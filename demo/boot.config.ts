import config, { defineBootConfig, fromDotEnv } from "@denoboot/config/mod.ts";

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

import { oakEngine } from "@denoboot/oak/mod.ts";

import { createEtaRuntime } from "@denoboot/eta/mod.ts";

config.extend(fromDotEnv());

export default defineBootConfig({
  client: {
    root: "./app",
    ssr: true,
  },
  server: () => {
    return oakEngine({
      port: config.number("PORT", 8443),
      hostname: config.string("HOSTNAME", "localhost"),
      application: {
        plugins: [
          MySQLPlugin,
          SQLitePlugin,
          DenoKVPlugin,
          OakFsRouterPlugin,
          OakDashboardPlugin,
          BlogPlugin,
          AnalyticsPlugin,
        ],
        middleware: [],
        templates: {
          engine: () => createEtaRuntime({ sources: [] }),
        },
      },
      auth: {},
      cache: {},
      core: {},
      csrf: {},
      database: {
        databases: {
          default: {
            client: config.string("DB_CLIENT", "sqlite"),
            connection: config.string("DB_CONNECTION", "sqlite://db.sqlite"),
            migrations: {
              directory: "./migrations",
            },
          },
        },
      },
      http: {},
      logging: {},
      media: {},
      security: {},
      sessions: {},
      static: {},
      tasks: {},
    });
  },
});
