/**
 * Template source resolver with support for multiple URI schemes
 */

import { join, resolve, dirname, extname } from "@denoboot/x/std/path.ts";
import { ensureDir, exists } from "@denoboot/x/std/fs.ts";
import { crypto } from "@denoboot/x/std/crypto.ts";

export interface ResolvedSource {
  /** Original identifier */
  id: string;
  /** Absolute local path */
  path: string;
  /** Source type */
  type: 'local' | 'remote' | 'github' | 'npm' | 'jsr' | 'alias';
  /** Cache key for remote sources */
  cacheKey?: string;
  /** Whether this is a directory (vs file) */
  isDirectory: boolean;
  /** Metadata about the source */
  meta?: {
    url?: string;
    version?: string;
    package?: string;
    subpath?: string;
  };
}

export interface ResolverOptions {
  /** Cache directory for remote sources */
  cacheDir?: string;
  /** Timeout for remote fetches (ms) */
  timeout?: number;
  /** Whether to allow network access */
  allowNetwork?: boolean;
  /** Base directory for resolving relative paths */
  baseDir?: string;
  /** Custom alias mappings */
  aliases?: Record<string, string>;
}

export class TemplateSourceResolver {
  private options: Required<ResolverOptions>;
  private cache = new Map<string, ResolvedSource>();
  private defaultAliases = {
    // Deno Boot framework aliases
    // '@denoboot/core': 'https://deno.land/x/denoboot_core@latest/',
    // '@denoboot/engine': 'https://deno.land/x/denoboot_engine@latest/',
    // '@denoboot/views': 'https://deno.land/x/denoboot_views@latest/',
    
    // Common template aliases
    '@layouts': './layouts',
    '@partials': './partials',
    '@components': './components',
    '@pages': './pages',
    '@views': './views',
    '@plugins': './plugins',
  };

  constructor(options: ResolverOptions = {}) {
    this.options = {
      cacheDir: options.cacheDir ?? join(Deno.cwd(), '.denoboot', 'cache'),
      timeout: options.timeout ?? 10000,
      allowNetwork: options.allowNetwork ?? true,
      baseDir: options.baseDir ?? Deno.cwd(),
      aliases: { ...this.defaultAliases, ...options.aliases }
    };

    // Ensure cache directory exists
    ensureDir(this.options.cacheDir).catch(() => {});
  }

  /**
   * Resolve a template source identifier to a local path
   */
  async resolve(identifier: string): Promise<ResolvedSource> {
    // Check cache first
    const cacheKey = this.generateCacheKey(identifier);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Expand aliases first
    const expandedIdentifier = this.expandAliases(identifier);
    
    // Determine the type of source
    const resolved = await this.resolveByScheme(expandedIdentifier);
    
    // Cache the result
    this.cache.set(cacheKey, resolved);
    
    return resolved;
  }

  /**
   * Resolve multiple sources in parallel
   */
  async resolveAll(identifiers: string[]): Promise<ResolvedSource[]> {
    return Promise.all(identifiers.map(id => this.resolve(id)));
  }

  /**
   * Expand aliases in the identifier
   */
  private expandAliases(identifier: string): string {
    // Check for exact alias match
    if (this.options.aliases[identifier]) {
      return this.options.aliases[identifier];
    }

    // Check for alias with subpath
    for (const [alias, target] of Object.entries(this.options.aliases)) {
      if (identifier.startsWith(`${alias}/`)) {
        const subpath = identifier.slice(alias.length);
        return target.endsWith('/') 
          ? `${target}${subpath.slice(1)}`
          : `${target}${subpath}`;
      }
    }

    return identifier;
  }

  /**
   * Resolve based on URI scheme
   */
  private async resolveByScheme(identifier: string): Promise<ResolvedSource> {
    const scheme = this.getScheme(identifier);
    
    switch (scheme) {
      case 'file':
      case '':
        return await this.resolveLocal(identifier);
      
      case 'http':
      case 'https':
        return await this.resolveRemote(identifier);
      
      case 'npm':
        return await this.resolveNpm(identifier);
      
      case 'jsr':
        return await this.resolveJsr(identifier);
      
      case 'github':
        return await this.resolveGithub(identifier);
      
      default:
        throw new Error(`Unsupported scheme: ${scheme} in identifier: ${identifier}`);
    }
  }

  /**
   * Resolve local file paths
   */
  private async resolveLocal(identifier: string): Promise<ResolvedSource> {
    // Remove file:// prefix if present
    const cleanIdentifier = identifier.replace(/^file:\/\//, '');
    
    // Resolve to absolute path
    let absolutePath: string;
    
    if (cleanIdentifier.startsWith('/')) {
      absolutePath = cleanIdentifier;
    } else if (cleanIdentifier.startsWith('./') || cleanIdentifier.startsWith('../')) {
      absolutePath = resolve(this.options.baseDir, cleanIdentifier);
    } else {
      // Try relative to base dir
      absolutePath = resolve(this.options.baseDir, cleanIdentifier);
    }

    // Check if it exists
    const exists = await this.pathExists(absolutePath);
    
    if (!exists) {
      throw new Error(`Local path does not exist: ${absolutePath} (resolved from: ${identifier})`);
    }

    const stats = await Deno.stat(absolutePath);
    
    return {
      id: identifier,
      path: absolutePath,
      type: 'local',
      isDirectory: stats.isDirectory
    };
  }

  /**
   * Resolve remote HTTP/HTTPS URLs
   */
  private async resolveRemote(url: string): Promise<ResolvedSource> {
    if (!this.options.allowNetwork) {
      throw new Error('Network access is disabled');
    }

    const cacheKey = this.generateCacheKey(url);
    const cachePath = join(this.options.cacheDir, 'remote', cacheKey);
    
    // Check cache first
    if (await exists(cachePath)) {
      const stats = await Deno.stat(cachePath);
      return {
        id: url,
        path: cachePath,
        type: 'remote',
        cacheKey,
        isDirectory: stats.isDirectory,
        meta: { url }
      };
    }

    // Determine if this is a file or directory
    const ext = extname(new URL(url).pathname);
    const isLikelyFile = ext && ext !== '';
    
    if (isLikelyFile) {
      // Download single file
      return await this.downloadFile(url, cachePath);
    } else {
      // Download directory (assuming it's a GitHub-like URL)
      return await this.downloadDirectory(url, cachePath);
    }
  }

  /**
   * Resolve NPM packages (npm:package/path)
   */
  private async resolveNpm(identifier: string): Promise<ResolvedSource> {
    // npm:package@version/path
    const match = identifier.match(/^npm:([^@]+)(?:@([^/]+))?(?:\/(.*))?$/);
    
    if (!match) {
      throw new Error(`Invalid NPM identifier: ${identifier}`);
    }

    const [, pkg, version = 'latest', subpath = ''] = match;
    const cacheKey = this.generateCacheKey(`${pkg}@${version}`);
    const cachePath = join(this.options.cacheDir, 'npm', cacheKey);

    // Check cache
    if (await exists(cachePath)) {
      const stats = await Deno.stat(cachePath);
      return {
        id: identifier,
        path: join(cachePath, subpath),
        type: 'npm',
        cacheKey,
        isDirectory: true,
        meta: { package: pkg, version, subpath }
      };
    }

    // In production, we would fetch from npm registry
    // For now, we'll return a placeholder
    console.warn(`NPM package resolution not fully implemented: ${identifier}`);
    
    // Create placeholder directory
    await ensureDir(cachePath);
    
    return {
      id: identifier,
      path: join(cachePath, subpath),
      type: 'npm',
      cacheKey,
      isDirectory: true,
      meta: { package: pkg, version, subpath }
    };
  }

  /**
   * Resolve JSR packages (jsr:@scope/package/path)
   */
  private async resolveJsr(identifier: string): Promise<ResolvedSource> {
    // jsr:@scope/package@version/path
    const match = identifier.match(/^jsr:([^@]+)(?:@([^/]+))?(?:\/(.*))?$/);
    
    if (!match) {
      throw new Error(`Invalid JSR identifier: ${identifier}`);
    }

    const [, pkg, version = 'latest', subpath = ''] = match;
    const cacheKey = this.generateCacheKey(`jsr:${pkg}@${version}`);
    const cachePath = join(this.options.cacheDir, 'jsr', cacheKey);

    // Check cache
    if (await exists(cachePath)) {
      const stats = await Deno.stat(cachePath);
      return {
        id: identifier,
        path: join(cachePath, subpath),
        type: 'jsr',
        cacheKey,
        isDirectory: true,
        meta: { package: pkg, version, subpath }
      };
    }

    // In production, we would fetch from JSR
    // For now, we'll return a placeholder
    console.warn(`JSR package resolution not fully implemented: ${identifier}`);
    
    // Create placeholder directory
    await ensureDir(cachePath);
    
    return {
      id: identifier,
      path: join(cachePath, subpath),
      type: 'jsr',
      cacheKey,
      isDirectory: true,
      meta: { package: pkg, version, subpath }
    };
  }

  /**
   * Resolve GitHub URLs (github:owner/repo@ref/path)
   */
  private async resolveGithub(identifier: string): Promise<ResolvedSource> {
    // github:owner/repo@ref/path
    const match = identifier.match(/^github:([^/]+)\/([^@]+)(?:@([^/]+))?(?:\/(.*))?$/);
    
    if (!match) {
      throw new Error(`Invalid GitHub identifier: ${identifier}`);
    }

    const [, owner, repo, ref = 'main', subpath = ''] = match;
    const cacheKey = this.generateCacheKey(`${owner}/${repo}@${ref}`);
    const cachePath = join(this.options.cacheDir, 'github', cacheKey);

    // Check cache
    if (await exists(cachePath)) {
      const stats = await Deno.stat(cachePath);
      return {
        id: identifier,
        path: join(cachePath, subpath),
        type: 'github',
        cacheKey,
        isDirectory: true,
        meta: { url: `https://github.com/${owner}/${repo}/tree/${ref}`, subpath }
      };
    }

    // In production, we would fetch from GitHub API
    console.warn(`GitHub package resolution not fully implemented: ${identifier}`);
    
    // Create placeholder directory
    await ensureDir(cachePath);
    
    return {
      id: identifier,
      path: join(cachePath, subpath),
      type: 'github',
      cacheKey,
      isDirectory: true,
      meta: { url: `https://github.com/${owner}/${repo}/tree/${ref}`, subpath }
    };
  }

  /**
   * Download a single file
   */
  private async downloadFile(url: string, cachePath: string): Promise<ResolvedSource> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      const content = await response.text();
      await ensureDir(dirname(cachePath));
      await Deno.writeTextFile(cachePath, content);

      return {
        id: url,
        path: cachePath,
        type: 'remote',
        cacheKey: this.generateCacheKey(url),
        isDirectory: false,
        meta: { url }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Download a directory (placeholder)
   */
  private async downloadDirectory(url: string, cachePath: string): Promise<ResolvedSource> {
    // This would need to handle downloading entire directories
    // For now, we'll just create an empty directory
    console.warn(`Directory download not implemented: ${url}`);
    
    await ensureDir(cachePath);
    
    return {
      id: url,
      path: cachePath,
      type: 'remote',
      cacheKey: this.generateCacheKey(url),
      isDirectory: true,
      meta: { url }
    };
  }

  /**
   * Get URI scheme from identifier
   */
  private getScheme(identifier: string): string {
    // Check for explicit scheme
    const schemeMatch = identifier.match(/^([a-z]+):/);
    if (schemeMatch) {
      return schemeMatch[1];
    }

    // Check for URL patterns
    if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
      return identifier.split(':')[0];
    }

    // Default to local file
    return '';
  }

  /**
   * Generate cache key for identifier
   */
  private generateCacheKey(identifier: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(identifier);
    return Array.from(new Uint8Array(crypto.subtle.digestSync('SHA-256', data)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32);
  }

  /**
   * Check if path exists
   */
  private async pathExists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache for a specific identifier
   */
  async clearCache(identifier: string): Promise<void> {
    const cacheKey = this.generateCacheKey(identifier);
    const cachePath = join(this.options.cacheDir, cacheKey);
    
    try {
      await Deno.remove(cachePath, { recursive: true });
      this.cache.delete(cacheKey);
    } catch {
      // Ignore if cache doesn't exist
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      await Deno.remove(this.options.cacheDir, { recursive: true });
      this.cache.clear();
      await ensureDir(this.options.cacheDir);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Register a custom alias
   */
  registerAlias(alias: string, target: string): void {
    this.options.aliases[alias] = target;
    this.cache.clear(); // Clear cache since aliases changed
  }

  /**
   * Get all registered aliases
   */
  getAliases(): Record<string, string> {
    return { ...this.options.aliases };
  }

  /**
   * Get cache directory
   */
  getCacheDir(): string {
    return this.options.cacheDir;
  }
}