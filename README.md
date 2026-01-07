# denoboot

![Deno Boot Logo](image.png)

> **⚠️ Status: Early Development / Unstable**
>
> Deno Boot is **actively under development**. APIs, behavior, naming, and internal architecture may change **frequently and without notice**. Do **not** rely on Deno Boot for production use at this stage.

---

## Overview

**Deno Boot** is an experimental, modular **runtime and plugin engine for Deno**.

While the project currently ships with **Oak-based HTTP integration**, Deno Boot is **not locked to Oak** and is **not inherently a web framework**. Oak is simply the **first concrete adapter** used to explore and validate the core ideas.

At its core, Deno Boot focuses on:

* Runtime composition
* Plugin isolation and lifecycle management
* Explicit dependency wiring
* Multi-tenant-aware systems

The long-term vision is for Deno Boot to support **multiple adapters and execution models**, such as:

* HTTP servers (Oak today, others in the future)
* Workers / job systems
* CLIs and background daemons
* Non-HTTP or event-driven runtimes

In short: **Deno Boot is an engine**, not an Oak wrapper.

---

## What Problem Is It Exploring?

Most backend systems slowly accrete:

* Tight coupling between features
* Global state and implicit dependencies
* Hard-to-remove modules
* Single-tenant assumptions baked deep into the stack

Deno Boot explores an alternative model where:

* Functionality lives in **explicit plugins**
* Capabilities are **granted, not assumed**
* Tenancy is a **first-class concern**, not an afterthought
* Runtimes can evolve without rewriting everything

---

## Goals

Deno Boot is being built with the following goals in mind:

* **Plugin-first architecture**
* **Deno-native** (no Node.js compatibility layer)
* **Adapter-based runtime design** (HTTP is optional)
* **Strong isolation boundaries** between plugins
* **Explicit dependency wiring** (no magic globals)
* **Multi-tenancy support** from day one
* **Readable, hackable codebase** over abstraction-heavy frameworks

---

## Non-Goals (For Now)

To keep scope realistic, Deno Boot intentionally does **not** aim to be:

* A full framework replacement (e.g. Next.js, NestJS)
* Tied permanently to Oak or any single server library
* Stable or production-ready (yet)
* Backwards compatible between versions
* Opinionated about databases, ORMs, or UI layers

---

## Architecture (High-Level)

While the internals are evolving, Deno Boot roughly consists of:

### Core Engine

* Plugin lifecycle management
* Shared service container
* Event bus / hooks
* Explicit capability exposure

### Plugin System

* Explicit registration
* Scoped access to engine capabilities
* Optional tenant awareness
* Ability to run with or without HTTP

### Tenant Layer

* Tenant-aware lifecycle events
* Tenant-scoped services and state
* Optional tenant routing (when HTTP is present)

### Runtime Adapters

* **Oak adapter (current)**

  * HTTP server and middleware
  * Route mounting from plugins
* **Future adapters (planned / exploratory)**

  * Alternative HTTP servers
  * Worker-only runtimes
  * CLI or task-based execution

Expect this structure to shift as the engine matures.

---

## Example (Oak Adapter – Conceptual)

The example below shows **one possible adapter usage** using Oak. This is **not** the only intended way to use Deno Boot.

```ts
import { defineOakPlugin } from "@denoboot/oak";

export const BlogPlugin = defineOakPlugin({
  name: "blog",
  version: "1.0.0",
  description: "Blog plugin with markdown support and workers",
  type: "client-server",

  async init(container, config) {
    // some internal services
    const logger = container.resolve("logger");
    const events = container.resolve("events");

    logger.info("Initializing blog plugin");

    // register customer services in the global container
    container.registerFactory("blog", (c) => {
      return new BlogService(c);
    });

    // listen for tenant initialization events
    // is only initialized if tenant and tenant has the plugin enabled
    events.on("tenant:initialized", async (data: any) => {
      const { tenant, container: tenantContainer } = data;

      if (tenant.plugins.includes("blog")) {
        logger.debug(`Setting up blog for tenant: ${tenant.id}`);
        const blog = tenantContainer.resolve("blog");
        await blog.initialize();
      }
    });
  },

  routes: [
    {
      method: "GET",
      path: "/tenant/:tenantId/blog",
      requiresTenant: true,
      requiresAuth: false,
      requiresPermissions: false,
      handler({ container, tenant, user }) {
        // container: tenant container or global container
        // tenant: current tenant object or null
        // user: current user object or null
        return async (ctx, next) => {
          ...
        };
      },
      middleware: [...],
    },
  ],
  middleware: [...],
  workers: [...],
  ...
});
```

> ⚠️ This example is illustrative only. APIs and patterns are expected to change.

---

## Development Status

* 🚧 APIs are **unstable**
* 🚧 Documentation is **incomplete**
* 🚧 Breaking changes are **expected**
* 🚧 Internal refactors happen often

If you are using Deno Boot right now, you are an **early explorer**, not an end user.

---

## Who Is This For?

Deno Boot is currently best suited for:

* Developers experimenting with **plugin-based runtimes**
* Learning projects around **Deno internals and architecture**
* Prototyping **multi-tenant or modular backend systems**
* Contributors interested in shaping an engine from first principles

If you need stability, maturity, or long-term guarantees — this project is **not there yet**.

---

## Contributing

Contributions, ideas, and discussions are welcome — especially around:

* Plugin lifecycle design
* Adapter abstractions (beyond Oak)
* Tenant isolation strategies
* DX improvements
* Clearer mental models and naming

That said, expect:

* Minimal guardrails
* Rapid iteration
* Breaking changes without deprecation cycles

Open issues or discussions before submitting large PRs.

---

## License

License to be defined.

---

## Final Note

Deno Boot is an experiment.

Oak is a starting point — not a constraint.

If it grows into something solid — great.
If it teaches useful lessons — even better.
