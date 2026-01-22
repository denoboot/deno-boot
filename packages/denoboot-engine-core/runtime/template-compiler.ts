/**
 * Template compilation and filesystem management
 */

import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
} from "@denoboot/x/std/path.ts";
import { ensureDir, exists, walk } from "@denoboot/x/std/fs.ts";
import {
  CompiledTemplate,
  TemplateDiscoveryOptions,
  TemplateSource,
  TenantConfig,
} from "./types.ts";
import { LayoutProcessor } from "./layout-system.ts";
import { ResolvedSource, TemplateSourceResolver } from "./resolver.ts";
import { Logger } from "@denoboot/logger";

export interface CompilationResult {
  compiledCount: number;
  compiledDir: string;
  templates: Map<string, CompiledTemplate>;
  errors: Array<{ source: string; error: Error }>;
}

export class TemplateCompiler {
  private layoutProcessor = new LayoutProcessor();
  private resolver: TemplateSourceResolver;
  private logger?: Logger;

  private readonly DEFAULT_TEMPLATE_DIRS = [
    "views",
    "templates",
    "src/views",
    "src/templates",
    "resources/views",
    "resources/templates",
  ];

  private readonly DEFAULT_PATTERNS = [
    "**/*.eta",
    "**/*.html",
    "**/views/**/*.eta",
    "**/templates/**/*.eta",
  ];

  constructor(resolver?: TemplateSourceResolver, logger?: Logger) {
    this.resolver = resolver || new TemplateSourceResolver();
    this.logger = logger;
  }

  /**
   * Compile templates from multiple sources into a single directory
   */
  async compile(
    sources: TemplateSource[],
    tenant?: TenantConfig,
    outputDir: string = ".denoboot/views",
  ): Promise<CompilationResult> {
    // Ensure output directory is absolute
    const absoluteOutputDir = resolve(outputDir);

    // Sort sources by priority (highest priority last)
    const sortedSources = [...sources].sort((a, b) => a.priority - b.priority);

    const templates = new Map<string, CompiledTemplate>();
    const errors: Array<{ source: string; error: Error }> = [];

    // Ensure output directory exists (but don't clear it yet)
    await ensureDir(absoluteOutputDir);

    // Process each source, with later sources overriding earlier ones
    for (const source of sortedSources) {
      try {
        // Resolve the source identifier to a local path
        const resolvedSource = await this.resolver.resolve(source.path);

        // Skip if this source is inside the output directory (avoid recursion)
        if (resolvedSource.path.startsWith(absoluteOutputDir)) {
          this.logger?.warn(
            `Skipping source inside compiled directory: ${source.path}`,
          );
          continue;
        }

        // Check if source exists
        if (!await exists(resolvedSource.path)) {
          this.logger?.warn(
            `Resolved source does not exist: ${resolvedSource.path} (from: ${source.path})`,
          );
          continue;
        }

        await this.processSource(
          resolvedSource,
          source.id,
          absoluteOutputDir,
          templates,
          tenant,
        );
      } catch (error) {
        errors.push({
          source: source.id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // Write compiled templates to filesystem
    await this.writeCompiledTemplates(templates, absoluteOutputDir);

    return {
      compiledCount: templates.size,
      compiledDir: outputDir,
      templates,
      errors,
    };
  }

  /**
   * Process a single template source directory
   */
  private async processSource(
    resolvedSource: ResolvedSource,
    sourceId: string,
    outputDir: string,
    templates: Map<string, CompiledTemplate>,
    tenant?: TenantConfig,
  ): Promise<void> {
    this.logger?.info(
      `Processing template source: ${sourceId} at ${resolvedSource.path} (type: ${resolvedSource.type})`,
    );

    // Discover template files in the source directory
    const templateFiles = await this.discoverTemplateFiles(resolvedSource.path);

    for (const filePath of templateFiles) {
      // Skip files in the output directory
      if (filePath.startsWith(outputDir)) {
        continue;
      }

      // Get relative path from source directory
      const relativePath = relative(resolvedSource.path, filePath);

      // Apply tenant-specific overrides if applicable
      const finalPath = this.applyTenantOverride(relativePath, tenant);

      // Read template content
      const content = await Deno.readTextFile(filePath);

      // Check for layout inheritance
      const isLayout = this.layoutProcessor.hasLayoutDirective(content);
      const blocks = this.layoutProcessor.extractBlocks(content);

      templates.set(finalPath, {
        compiledPath: join(outputDir, finalPath),
        sourceId,
        content,
        isLayout,
        blocks,
      });

      this.logger?.info(`Found template: ${relativePath}`);
    }
  }

  /**
   * Discover template files in a directory
   */
  private async discoverTemplateFiles(
    directory: string,
    options: TemplateDiscoveryOptions = {},
  ): Promise<string[]> {
    const templateFiles: string[] = [];
    const templateDirs = options.templateDirs || this.DEFAULT_TEMPLATE_DIRS;
    const patterns = options.patterns || this.DEFAULT_PATTERNS;

    // First, check if the directory itself contains templates
    try {
      for await (
        const entry of walk(directory, {
          exts: [".eta", ".html"],
          includeDirs: false,
          maxDepth: 1, // Only check immediate directory first
        })
      ) {
        templateFiles.push(entry.path);
      }
    } catch (error) {
      // Directory might not exist or be readable
      this.logger?.warn(
        `Cannot walk directory ${directory}:`,
        (error as Error).message,
      );
    }

    // Then check for standard template subdirectories
    for (const templateDir of templateDirs) {
      const templateDirPath = join(directory, templateDir);

      if (await exists(templateDirPath)) {
        try {
          for await (
            const entry of walk(templateDirPath, {
              exts: [".eta", ".html"],
              includeDirs: false,
              skip: [/node_modules/, /\.git/, /\.denoboot/], // Skip common non-template directories
            })
          ) {
            templateFiles.push(entry.path);
          }
        } catch (error) {
          this.logger?.warn(
            `Cannot walk template directory ${templateDirPath}:`,
            (error as Error).message,
          );
        }
      }
    }

    // Finally, do a general search for template patterns
    if (options.recursive !== false) {
      try {
        for await (
          const entry of walk(directory, {
            match: patterns.map((p) =>
              new RegExp(p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"))
            ),
            skip: [
              /node_modules/,
              /\.git/,
              /\.denoboot/,
              /\.cache/,
              /dist/,
              /build/,
            ],
          })
        ) {
          // Only add files that haven't been found already
          if (entry.isFile && !templateFiles.includes(entry.path)) {
            templateFiles.push(entry.path);
          }
        }
      } catch (error) {
        this.logger?.warn(
          `Cannot perform recursive search in ${directory}:`,
          (error as Error).message,
        );
      }
    }

    return templateFiles;
  }

  /**
   * Apply tenant-specific path overrides
   */
  private applyTenantOverride(
    relativePath: string,
    tenant?: TenantConfig,
  ): string {
    if (!tenant?.id) {
      return relativePath;
    }

    const ext = extname(relativePath);
    const baseName = basename(relativePath, ext);
    const dirName = dirname(relativePath);

    // For tenant overrides, we prefix with tenants/{tenantId}/
    const tenantPath = join("tenants", tenant.id, dirName, `${baseName}${ext}`);
    return tenantPath;
  }

  /**
   * Write compiled templates to filesystem
   */
  private async writeCompiledTemplates(
    templates: Map<string, CompiledTemplate>,
    outputDir: string,
  ): Promise<void> {
    // Create a temporary directory for safe compilation
    const tempDir = await Deno.makeTempDir({ prefix: "denoboot-views-" });

    try {
      // Write all templates to temp directory first
      for (const [relativePath, template] of templates) {
        const outputPath = join(tempDir, relativePath);
        await ensureDir(dirname(outputPath));
        await Deno.writeTextFile(outputPath, template.content);
      }

      // Clear existing compiled files (but keep directory structure)
      await this.clearCompiledDirectory(outputDir);

      // Copy from temp to final directory
      for await (const entry of walk(tempDir, { includeDirs: false })) {
        const relativePath = relative(tempDir, entry.path);
        const finalPath = join(outputDir, relativePath);
        await ensureDir(dirname(finalPath));
        await Deno.copyFile(entry.path, finalPath);
      }

      this.logger?.info(`Compiled ${templates.size} templates to ${outputDir}`);
    } finally {
      // Clean up temp directory
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Clear compiled directory safely
   */
  private async clearCompiledDirectory(dir: string): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        const entryPath = join(dir, entry.name);

        if (entry.isDirectory) {
          // Remove subdirectories recursively
          await Deno.remove(entryPath, { recursive: true });
        } else if (
          entry.isFile &&
          (entry.name.endsWith(".eta") || entry.name.endsWith(".html"))
        ) {
          // Remove template files
          await Deno.remove(entryPath);
        }
        // Keep other files (like .gitkeep, README, etc.)
      }
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        // Directory doesn't exist, that's fine
      } else {
        throw error;
      }
    }
  }

  /**
   * Create template sources with resolver support
   */
  createSources(
    frameworkPath: string,
    pluginPaths: string[] = [],
    appPath: string,
    themePaths: string[] = [],
  ): TemplateSource[] {
    const sources: TemplateSource[] = [];
    const compiledDir = resolve(".denoboot/views");

    const addSource = (id: string, priority: number, path: string) => {
      // Skip if this path is inside the compiled directory
      const absolutePath = resolve(path);
      if (absolutePath.startsWith(compiledDir)) {
        this.logger?.warn(
          `Source ${id} is inside compiled directory, skipping: ${path}`,
        );
        return;
      }

      sources.push({
        id,
        priority,
        path, // Keep as identifier, will be resolved later
      });
    };

    // Core framework templates (lowest priority)
    addSource("framework", 0, frameworkPath);

    // Plugin templates
    pluginPaths.forEach((path, index) => {
      addSource(`plugin-${index}`, 10 + index, path);
    });

    // Host application templates
    addSource("app", 100, appPath);

    // Theme templates
    themePaths.forEach((path, index) => {
      addSource(`theme-${index}`, 200 + index, path);
    });

    return sources;
  }

  /**
   * Get the resolver instance
   */
  getResolver(): TemplateSourceResolver {
    return this.resolver;
  }
}
