// runtime/bin/boot.ts
import { cmd } from "@denoboot/commandline/mod.ts";
import { colors } from "@denoboot/ansi-tools";
import { createRuntime } from "../core/runtime.ts";
import { shutdownEsbuild } from "../build/builder.ts";
import { openTab } from "./openTab.deno.ts";
type RuntimeMode = "development" | "production";

function createAppRuntime(options: Parameters<typeof createRuntime>[0]) {
  return createRuntime({
    ...options,
    root: options.root ?? Deno.cwd(),
    mode: options.mode,
    config: options.config,
    hmr: options.mode === "development" && options.hmr !== false,
  });
}

/**
 * Graceful shutdown handler
 */
async function waitForShutdownSignal() {
  const ac = new AbortController();
  const handler = () => ac.abort();

  Deno.addSignalListener("SIGINT", handler);
  Deno.addSignalListener("SIGTERM", handler);

  try {
    await new Promise((resolve, reject) => {
      ac.signal.addEventListener("abort", () => {
        console.log("  Shutting down...");
        reject(new Error("Shutdown signal received"));
      });
    });
  } finally {
    Deno.removeSignalListener("SIGINT", handler);
    Deno.removeSignalListener("SIGTERM", handler);
  }
}

/**
 * Runtime lifecycle wrapper
 */
async function withRuntime(
  mode: RuntimeMode,
  opts: Parameters<typeof createRuntime>[0],
  fn: (runtime: ReturnType<typeof createRuntime>) => Promise<void>,
) {
  const runtime = createAppRuntime({ ...opts, mode });

  try {
    await fn(runtime);
  } finally {
    await runtime.stop();
    await shutdownEsbuild();
  }
}

const cli = cmd("boot");

/**
 * CLI setup
 */

cli
  .usage("<command> [options]")
  .help()
  .version("0.1.0");

/**
 * Global options
 */
cli
  .option("--root <path>", "Project root directory", {
    default: Deno.cwd(),
    type: ["string"],
  })
  .option("--config <file>", "Config file path");

/**
 * DEV COMMAND
 */
cli
  .command("dev", "Start dev server")
  .option("--hmr <boolean>", "Enable HMR", {
    default: "true",
    type: ["boolean", "string"],
  })
  .action(async (options) => {
    await withRuntime("development", options, async (runtime) => {
      await runtime.start(false);
      await openTab("http://localhost:3000");
      await waitForShutdownSignal();
    });
  });

/**
 * BUILD COMMAND
 */
cli
  .command("build", "Build for production")
  .action(async (options) => {
    await withRuntime("production", options, async (runtime) => {
      const result = await runtime.build();

      console.log(colors.bgGreen(`Built in ${result.duration}ms`));

      if (result.errors.length > 0) {
        console.error(colors.red(result.errors.map((e) => e.text).join("\n")));
        Deno.exit(1);
      } else {
        console.log(colors.bold(colors.green("Build successful")));
        console.log(
          colors.cyan(">>>> Output files:"),
          colors.white(Object.keys(result.metafile.outputs).join(", ")),
        );
        await runtime.stop();
        await shutdownEsbuild();
        Deno.exit(0);
      }
    });
  });

/**
 * PREVIEW COMMAND
 */
cli
  .command("preview", "Preview production build")
  .action(async (options) => {
    await withRuntime("production", options, async (runtime) => {
      await runtime.build();
      await runtime.start(true);
      await waitForShutdownSignal();
    });
  });

/**
 * Unknown command handler
 */
cli.on("command:*", () => {
  console.error("Unknown command");
  cli.outputHelp();
  Deno.exit(1);
});

/**
 * Entrypoint
 */
if (import.meta.main) {
  try {
    cli.parse(Deno.args, { run: true });
  } catch (err) {
    if ((err as Error)?.message !== "shutdown") {
      console.error(err);
      Deno.exit(1);
    }
  }
}

export default cli;
