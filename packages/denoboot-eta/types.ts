/**
 * Core types for the Eta template runtime
 */

export interface TemplateSource {
  /** Source identifier for debugging */
  id: string;
  /** Priority (lower number = lower priority) */
  priority: number;
  /** Absolute path to source directory */
  path: string;
  /** Optional filter for files to include */
  include?: (filePath: string) => boolean;
}

export interface TemplateCache {
  /** Map of compiled template functions */
  templates: Map<string, EtaFunction>;
  /** Map of template file hashes for change detection */
  hashes: Map<string, string>;
  /** Timestamp of last compilation */
  compiledAt: Date;
}

export type EtaFunction = (data: object) => string | Promise<string>;

export interface TemplateContext extends Record<string, unknown> {
  /** Block helper for layout inheritance */
  block: (name: string, defaultContent?: () => string) => string;
  /** Define helper for block definitions */
  define: (name: string, content: () => string) => void;
}

export interface TemplateEngineOptions {
  /** Eta configuration options */
  etaConfig?: Partial<import("eta").EtaConfig>;
  /** Whether to watch for changes in development */
  watch?: boolean;
  /** Whether to cache templates in production */
  cache?: boolean;
  /** Root directory for compiled views */
  viewsRoot?: string;
}

export interface TenantConfig {
  id: string;
  theme?: string;
  overridePath?: string;
}

export interface LayoutBlock {
  name: string;
  content: string | (() => string);
}

export interface CompiledTemplate {
  /** Absolute path in compiled directory */
  compiledPath: string;
  /** Source identifier */
  sourceId: string;
  /** Template content */
  content: string;
  /** Whether this is a layout template */
  isLayout: boolean;
  /** Detected blocks in template */
  blocks: string[];
}

export interface TemplateDiscoveryOptions {
  /** Directory patterns to search for templates */
  patterns?: string[];
  /** Default template directory names */
  templateDirs?: string[];
  /** Whether to search recursively */
  recursive?: boolean;
}

export interface PluginSource {
  /** Path to plugin directory */
  path: string;
  /** Optional specific template directory within plugin */
  templateDir?: string;
  /** Plugin identifier */
  id?: string;
}