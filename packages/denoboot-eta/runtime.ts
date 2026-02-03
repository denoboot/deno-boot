/**
 * Main Eta runtime for Deno Boot
 */

import { join, relative, resolve } from "@denoboot/x/std/path.ts";
import { Eta } from "@denoboot/x/eta.ts";
import { CompilationResult, TemplateCompiler } from "./template-compiler.ts";
import { LayoutProcessor } from "./layout-system.ts";
import {
  TemplateContext,
  TemplateEngineOptions,
  TemplateSource,
  TenantConfig,
} from "./types.ts";
import { TemplateSourceResolver } from "./resolver.ts";
import { Logger } from "@denoboot/logger";

export class DenoBootEtaRuntime {
  private eta: Eta;
  private compiler: TemplateCompiler;
  private layoutProcessor: LayoutProcessor;
  private resolver: TemplateSourceResolver;
  private sources: TemplateSource[] = [];
  private currentTenant?: TenantConfig;
  private compiledDir: string;
  private isWatching = false;
  private watchers: Deno.FsWatcher[] = [];
  private templateCache = new Map<string, string>();
  private lastCompilation?: CompilationResult;
  private rebuildInProgress = false;
  private pendingRebuild = false;
  private logger?: Logger;

  constructor(
    options: TemplateEngineOptions = {},
    resolver?: TemplateSourceResolver,
    logger?: Logger,
  ) {
    this.compiledDir = resolve(options.viewsRoot ?? ".denoboot/views");
    this.resolver = resolver || new TemplateSourceResolver({
      baseDir: Deno.cwd(),
      allowNetwork: Deno.env.get("DENO_ENV") !== "production",
    });
    this.logger = logger;
    this.logger?.setPrefix("[ETA Runtime]");
    // Configure Eta
    this.eta = new Eta({
      views: this.compiledDir,
      cache: options.cache ?? Deno.env.get("DENO_ENV") === "production",
      autoFilter: true,
      autoTrim: [false, "nl"],
      autoEscape: true,
      rmWhitespace: true,
      ...options.etaConfig,
    });

    this.compiler = new TemplateCompiler(this.resolver, this.logger);
    this.layoutProcessor = new LayoutProcessor();
  }

  /**
   * Initialize template sources with resolver support
   */
  async initialize(options: {
    sources?: string[] | TemplateSource[];
  }): Promise<void> {
    const { sources: $sources = [] } = options;
    const sources = $sources.map((s, i) => {
      if (typeof s === "string") {
        // string contains params, eg ?id=1&priority=100
        const params = new URLSearchParams(s.split("?")[1]);
        const name = params.get("id") || "source";
        return {
          id: `${name}-${i}`,
          priority: parseInt(params.get("priority") || "0"),
          path: s.split("?")[0],
        };
      }
      return s;
    });

    // Add framework source
    // sources.push({
    //   id: "framework",
    //   priority: 0,
    //   path: options.frameworkPath
    // });

    // // Add application source
    // sources.push({
    //   id: "app",
    //   priority: 100,
    //   path: options.appPath
    // });

    // // Handle plugins
    // if (options.pluginPaths && options.pluginPaths.length > 0) {
    //   let pluginIndex = 0;

    //   for (const pluginPath of options.pluginPaths) {
    //     // Auto-discover plugins if enabled
    //     if (options.autoDiscoverPlugins) {
    //       // Resolve the plugin path
    //       const resolvedPlugin = await this.resolver.resolve(pluginPath);

    //       // If it's a directory, look for plugins inside
    //       if (resolvedPlugin.isDirectory) {
    //         try {
    //           for await (const entry of Deno.readDir(resolvedPlugin.path)) {
    //             if (entry.isDirectory) {
    //               sources.push({
    //                 id: `plugin-${entry.name}`,
    //                 priority: 10 + pluginIndex,
    //                 path: join(resolvedPlugin.path, entry.name)
    //               });
    //               pluginIndex++;
    //             }
    //           }
    //         } catch (error) {
    //           console.warn(`Cannot discover plugins in ${resolvedPlugin.path}:`, error.message);
    //         }
    //       } else {
    //         // Single plugin
    //         sources.push({
    //           id: `plugin-${pluginIndex}`,
    //           priority: 10 + pluginIndex,
    //           path: pluginPath
    //         });
    //         pluginIndex++;
    //       }
    //     } else {
    //       // Add the plugin path directly
    //       sources.push({
    //         id: `plugin-${pluginIndex}`,
    //         priority: 10 + pluginIndex,
    //         path: pluginPath
    //       });
    //       pluginIndex++;
    //     }
    //   }
    // }

    // // Add theme sources
    // if (options.themePaths) {
    //   options.themePaths.forEach((themePath, index) => {
    //     sources.push({
    //       id: `theme-${index}`,
    //       priority: 200 + index,
    //       path: themePath
    //     });
    //   });
    // }

    this.sources = sources;
    await this.rebuild();

    if (Deno.env.get("DENO_ENV") !== "production") {
      this.startWatching();
    }
  }

  /**
   * Initialize with existing sources
   */
  async initializeWithSources(sources: TemplateSource[]): Promise<void> {
    this.sources = sources;
    await this.rebuild();

    if (Deno.env.get("DENO_ENV") !== "production") {
      this.startWatching();
    }
  }

  /**
   * Rebuild compiled views directory
   */
  async rebuild(): Promise<CompilationResult> {
    if (this.rebuildInProgress) {
      this.pendingRebuild = true;
      return this.lastCompilation!;
    }

    this.rebuildInProgress = true;

    try {
      this.logger?.info("Rebuilding templates...");

      const result = await this.compiler.compile(
        this.sources,
        this.currentTenant,
        this.compiledDir,
      );

      this.lastCompilation = result;
      this.templateCache.clear();

      // Update Eta's views path
      this.eta.configure({ views: this.compiledDir });

      this.logger?.info(
        `✅ Templates rebuilt: ${result.compiledCount} templates compiled`,
      );

      if (result.errors.length > 0) {
        console.warn(`⚠️  ${result.errors.length} errors during compilation:`);
        result.errors.forEach((error) => {
          console.warn(`  ${error.source}: ${error.error.message}`);
        });
      }

      return result;
    } finally {
      this.rebuildInProgress = false;

      // Handle any pending rebuild
      if (this.pendingRebuild) {
        this.pendingRebuild = false;
        setTimeout(() => this.rebuild(), 50);
      }
    }
  }

  /**
   * Render a template
   */
  async render(
    templateName: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    // Ensure template has .eta extension
    const name = templateName.endsWith(".eta")
      ? templateName
      : `${templateName}.eta`;

    // Check if template uses layout inheritance
    const templatePath = join(this.compiledDir, name);
    let templateContent: string;

    if (this.templateCache.has(templatePath)) {
      templateContent = this.templateCache.get(templatePath)!;
    } else {
      try {
        templateContent = await Deno.readTextFile(templatePath);
        this.templateCache.set(templatePath, templateContent);
      } catch (error) {
        // Try to find the template without extension
        const files = await this.findTemplateFile(name);
        if (files.length === 0) {
          throw new Error(
            `Template not found: ${templateName} (searched in ${this.compiledDir})`,
          );
        }
        templateContent = await Deno.readTextFile(files[0]);
        this.templateCache.set(files[0], templateContent);
      }
    }

    // Handle layout inheritance if needed
    if (this.layoutProcessor.hasLayoutDirective(templateContent)) {
      const getTemplate = async (
        layoutName: string,
      ): Promise<string | null> => {
        const layoutPath = join(this.compiledDir, layoutName);
        try {
          return await Deno.readTextFile(layoutPath);
        } catch {
          return null;
        }
      };

      return await this.layoutProcessor.processWithLayouts(
        templateContent,
        data,
        getTemplate,
        this.eta,
      );
    }

    // Regular template rendering
    return await this.eta.renderAsync(name, data);
  }

  /**
   * Find template file with various naming patterns
   */
  private async findTemplateFile(templateName: string): Promise<string[]> {
    const foundFiles: string[] = [];
    const baseName = templateName.replace(/\.eta$/, "");

    const patterns = [
      `${baseName}.eta`,
      `${baseName}/index.eta`,
      `${baseName}.html`,
      `${baseName}/index.html`,
    ];

    for (const pattern of patterns) {
      const filePath = join(this.compiledDir, pattern);
      try {
        await Deno.stat(filePath);
        foundFiles.push(filePath);
      } catch {
        // File doesn't exist
      }
    }

    return foundFiles;
  }

  /**
   * Render a template synchronously
   */
  renderSync(templateName: string, data: Record<string, unknown> = {}): string {
    const name = templateName.endsWith(".eta")
      ? templateName
      : `${templateName}.eta`;
    return this.eta.render(name, data);
  }

  /**
   * Switch tenant
   */
  async setTenant(tenant: TenantConfig): Promise<void> {
    if (this.currentTenant?.id === tenant.id) {
      return;
    }

    this.currentTenant = tenant;
    await this.rebuild();
  }

  /**
   * Clear tenant
   */
  async clearTenant(): Promise<void> {
    this.currentTenant = undefined;
    await this.rebuild();
  }

  /**
   * Start filesystem watching (development only)
   */
  private async startWatching(): Promise<void> {
    if (this.isWatching) return;

    this.isWatching = true;

    // We can't watch remote sources, only local ones
    for (const source of this.sources) {
      try {
        // Resolve source to check if it's local
        const resolved = await this.resolver.resolve(source.path);

        if (resolved.type !== "local") {
          console.warn(`Cannot watch remote source: ${source.path}`);
          continue;
        }

        // Skip if inside compiled directory
        if (resolved.path.startsWith(this.compiledDir)) {
          console.warn(
            `Skipping watch for source inside compiled directory: ${source.path}`,
          );
          continue;
        }

        // Check if directory exists
        try {
          await Deno.stat(resolved.path);
        } catch {
          console.warn(
            `Source directory not found, skipping watch: ${source.path}`,
          );
          continue;
        }

        const watcher = Deno.watchFs(resolved.path, { recursive: true });
        this.watchers.push(watcher);

        this.logger?.info(
          `Watching for template changes in: ${
            relative(Deno.cwd(), resolved.path)
          }`,
        );

        // Handle file changes asynchronously
        (async () => {
          for await (const event of watcher) {
            if (event.paths.length === 0) continue;

            // Check if any changed file is a template
            const shouldRebuild = event.paths.some((path) => {
              const ext = path.toLowerCase();
              return ext.endsWith(".eta") || ext.endsWith(".html");
            });

            if (shouldRebuild) {
              this.logger?.info(
                `Template change detected in: ${
                  event.paths.map((p) => relative(Deno.cwd(), p)).join(", ")
                }`,
              );
              await this.debouncedRebuild();
            }
          }
        })();
      } catch (error) {
        console.warn(
          `Cannot setup watch for ${source.path}:`,
          (error as Error).message,
        );
      }
    }
  }

  private debounceTimer?: number;
  private async debouncedRebuild(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      try {
        await this.rebuild();
      } catch (error) {
        this.logger?.error("❌ Failed to rebuild templates:", error);
      }
    }, 300);
  }

  /**
   * Stop filesystem watching
   */
  stopWatching(): void {
    this.isWatching = false;
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  /**
   * Get compilation statistics
   */
  getStats(): {
    templates: number;
    compiledDir: string;
    sources: number;
    lastCompiled: Date | undefined;
    watching: boolean;
  } {
    return {
      templates: this.lastCompilation?.compiledCount ?? 0,
      compiledDir: relative(Deno.cwd(), this.compiledDir),
      sources: this.sources.length,
      lastCompiled:
        this.lastCompilation?.templates.values().next().value?.compiledPath
          ? new Date()
          : undefined,
      watching: this.isWatching,
    };
  }

  /**
   * Get the resolver instance
   */
  getResolver(): TemplateSourceResolver {
    return this.resolver;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.stopWatching();
    this.templateCache.clear();
  }
}
