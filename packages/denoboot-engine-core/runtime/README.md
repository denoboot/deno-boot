/**
 * Example usage and integration guide
 */

// Example 1: Basic setup
import { createEtaRuntime } from "./mod.ts";

const runtime = await createEtaRuntime({
  frameworkPath: "/path/to/framework/templates",
  appPath: "/path/to/app/templates",
  pluginPaths: ["/path/to/plugin1/templates"],
  engineOptions: {
    cache: Deno.env.get("DENO_ENV") === "production"
  }
});

// Render a template
const html = await runtime.render("users/index", { users: [] });

// Example 2: Template with layout inheritance
// users/list.eta:
/*
{% extends "layouts/main.eta" %}

{% block content %}
  <h1>Users</h1>
  <ul>
    {% for user in it.users %}
      <li>{{ user.name }}</li>
    {% endfor %}
  </ul>
{% endblock %}
*/

// layouts/main.eta:
/*
<!DOCTYPE html>
<html>
<head>
  <title>{% block title %}My App{% endblock %}</title>
</head>
<body>
  <header>{% block header %}Welcome{% endblock %}</header>
  <main>{{ block("content") }}</main>
  <footer>{% block footer %}© 2024{% endblock %}</footer>
</body>
</html>
*/

// Example 3: Tenant switching
await runtime.setTenant({
  id: "acme",
  theme: "corporate"
});

// Now templates will look for:
// 1. templates/users/list.tenant-acme.eta (tenant override)
// 2. templates/users/list.eta (regular)

// Example 4: Manual source management
import { DenoBootEtaRuntime } from "./mod.ts";

const customRuntime = new DenoBootEtaRuntime();
await customRuntime.initialize([
  {
    id: "base",
    priority: 0,
    path: "/base/templates"
  },
  {
    id: "overrides",
    priority: 100,
    path: "/overrides/templates"
  }
]);

Key Design Features Implemented:
Single Virtual Views Root: All templates compiled to .denoboot/views/, Eta sees only this directory.

Compile-Time Resolution: Templates are compiled at startup/tenant change, not at render time.

Override Hierarchy: Sources processed in priority order (framework → plugins → app → themes → tenants).

Django-like Layout System: {% extends %} and {% block %} support via injected block() and define() helpers.

Tenancy Support: Tenant-specific overrides with .tenant-{id}.eta suffix pattern.

Development Mode: Filesystem watching with debounced rebuilds.

Production Ready: Template caching, no filesystem access during render.

Type Safety: Full TypeScript definitions for all public APIs.

The system ensures render calls are fast and deterministic: render("template", data) always reads from the compiled directory, never scans the filesystem at runtime.