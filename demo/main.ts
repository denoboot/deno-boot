// demo/main.ts

import { oakEngine } from "@denoboot/oak/mod.ts";

const boot = await oakEngine();

// These examples below are accessing internal services directly from the container
// This is useful for testing and debugging, but in production you should use the plugin system

const router = boot.getRouter();

// router.register({
//   method: "GET",
//   path: "/",
//   tenant: false,
//   name: "home",
//   handler: (kwargs) => {
//     return async (ctx, _next) => {
//     const views = kwargs.container.resolve("views");
//     views.addPath(new URL("./views", import.meta.url).pathname);
//     const html = await views.render("home", {
//       title: "Deno Boot Engine",
//       description: "Multi-tenant plugin framework for Deno",
//     });
//     ctx.response.type = "text/html";
//     ctx.response.body = html;
//     }
//   },
// });

router.register({
  method: "GET",
  path: "/health",
  tenant: false,
  name: "health",
  handler: (kwargs) => {
    return (ctx) => {
    const workers = kwargs.container.resolve("workers");

    ctx.response.body = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      stats: {
        tenants: kwargs.container.resolve("tenantManager").listTenants().length,
        plugins: kwargs.container.resolve("pluginManager").list().length,
        workers: workers.getStats(),
      },
    };
  }
  },
});

router.register({
  method: "GET",
  path: "/api/tenants",
  tenant: false,
  name: "list-tenants",
  handler: (kwargs) => {
    return (ctx) => {
      const tenantManager = kwargs.container.resolve("tenantManager");
    const tenants = tenantManager.listTenants().map((t) => ({
      id: t.id,
      name: t.name,
      domain: t.domain,
      subdomain: t.subdomain,
      plugins: t.plugins,
      enabled: t.enabled !== false,
    }));

    ctx.response.body = { tenants };
  }
  },
});


// Worker dispatch endpoint
router.register({
  method: "POST",
  path: "/api/dispatch/:plugin/:worker",
  tenant: true,
  name: "dispatch-worker",
  handler: (kwargs) => {
    return async (ctx, ) => {
    const plugin = ctx.params.plugin;
    const worker = ctx.params.worker;
    const tenant = ctx.state.tenant;
    
    const body = await ctx.request.body.json();
    
    const workers = kwargs.container.resolve("workers");
    const jobId = await workers.dispatch(
      plugin,
      worker,
      {
        tenantId: tenant?.id,
        data: body,
      },
      kwargs.container.getParent() || kwargs.container
    );
    
    ctx.response.body = {
      success: true,
      jobId,
      message: "Worker dispatched",
    };
  }
  },
});

// Worker status endpoints
router.register({
  method: "GET",
  path: "/api/workers/stats",
  tenant: false,
  name: "worker-stats",
  handler: (kwargs) => {
    return (ctx) => {
    const workers = kwargs.container.resolve("workers");
    ctx.response.body = workers.getStats();
  }
  },
});

router.register({
  method: "GET",
  path: "/api/workers/:jobId",
  tenant: false,
  name: "worker-job",
  handler: (kwargs) => {
    return (ctx) => {
    const workers = kwargs.container.resolve("workers");
    const job = workers.getJob(ctx.params.jobId);
    
    if (!job) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Job not found" };
      return;
    }
    
    ctx.response.body = job;
  }
  },
});





// Start the server
await boot.listen();
// await boot.shutdown();