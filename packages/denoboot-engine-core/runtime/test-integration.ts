/**
 * Integration test example
 */

import { assertEquals } from "@denoboot/x/std/assert.ts";
import { createEtaRuntime } from "./mod.ts";
import { join } from "@denoboot/x/std/path.ts";

// Create test directory structure
const testDir = await Deno.makeTempDir({ prefix: "denoboot-eta-test" });
const frameworkDir = join(testDir, "framework");
const appDir = join(testDir, "app");

await Deno.mkdir(join(frameworkDir, "layouts"), { recursive: true });
await Deno.mkdir(join(appDir, "users"), { recursive: true });

// Write test templates
await Deno.writeTextFile(
  join(frameworkDir, "layouts", "main.eta"),
  `<!DOCTYPE html>
<html>
<head><title>{{ block("title", () => "Default Title") }}</title></head>
<body>
  <main>{{ block("content") }}</main>
</body>
</html>`
);

await Deno.writeTextFile(
  join(appDir, "users", "index.eta"),
  `{% extends "layouts/main.eta" %}
{% block content %}
  <h1>Users Page</h1>
  <p>Welcome, {{ it.username }}!</p>
{% endblock %}`
);

// Test the runtime
Deno.test("Eta Runtime Integration", async () => {
  const runtime = createEtaRuntime({
    frameworkPath: frameworkDir,
    appPath: appDir,
    engineOptions: {
      cache: false,
      viewsRoot: join(testDir, ".compiled")
    }
  });

  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 100));

  const html = await runtime.render("users/index", { username: "John" });
  
  // Verify layout inheritance worked
  assertEquals(html.includes("<!DOCTYPE html>"), true);
  assertEquals(html.includes("<h1>Users Page</h1>"), true);
  assertEquals(html.includes("Welcome, John!"), true);
  
  // Cleanup
  await runtime.dispose();
  await Deno.remove(testDir, { recursive: true });
});

// Run with: deno test --allow-read --allow-write --allow-net eta-runtime/test-integration.ts