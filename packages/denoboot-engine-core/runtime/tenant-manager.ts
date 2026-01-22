/**
 * Enhanced tenant support with proper directory structure
 */


import { basename, dirname, extname, join } from "@denoboot/x/std/path.ts";
import { TenantConfig } from "./types.ts";
import { ensureDir } from "@denoboot/x/std/fs.ts";


export class TenantManager {
  private tenants = new Map<string, TenantConfig>();
  private activeTenant?: string;

  /**
   * Register a tenant configuration
   */
  registerTenant(config: TenantConfig): void {
    this.tenants.set(config.id, config);
  }

  /**
   * Get tenant configuration
   */
  getTenant(id: string): TenantConfig | undefined {
    return this.tenants.get(id);
  }

  /**
   * Get active tenant
   */
  getActiveTenant(): TenantConfig | undefined {
    return this.activeTenant ? this.tenants.get(this.activeTenant) : undefined;
  }

  /**
   * Set active tenant
   */
  setActiveTenant(id: string): boolean {
    if (this.tenants.has(id)) {
      this.activeTenant = id;
      return true;
    }
    return false;
  }

  /**
   * Clear active tenant
   */
  clearActiveTenant(): void {
    this.activeTenant = undefined;
  }

  /**
   * Get tenant-specific template path
   */
  async getTenantTemplatePath(
    basePath: string,
    templatePath: string,
    tenant?: TenantConfig
  ): Promise<string> {
    if (!tenant) {
      return join(basePath, templatePath);
    }

    // Strategy 1: Check for tenant-specific directory
    const tenantDir = join(basePath, "tenants", tenant.id);
    const tenantFilePath = join(tenantDir, templatePath);
    
    try {
      await Deno.stat(tenantFilePath);
      return tenantFilePath;
    } catch {
      // File doesn't exist in tenant directory
    }
    
    // Strategy 2: Check for theme directory
    if (tenant.theme) {
      const themeDir = join(basePath, "themes", tenant.theme);
      const themeFilePath = join(themeDir, templatePath);
      
      try {
        await Deno.stat(themeFilePath);
        return themeFilePath;
      } catch {
        // File doesn't exist in theme directory
      }
    }
    
    // Fall back to regular path
    return join(basePath, templatePath);
  }

  /**
   * Get all template paths for a tenant (in priority order)
   */
  getTemplateSearchPaths(
    basePaths: string[],
    templateName: string,
    tenant?: TenantConfig
  ): string[] {
    const paths: string[] = [];
    
    for (const basePath of basePaths) {
      if (!tenant) {
        paths.push(join(basePath, templateName));
        continue;
      }
      
      // Highest priority: tenant-specific directory
      if (tenant.id) {
        paths.push(join(basePath, "tenants", tenant.id, templateName));
      }
      
      // Medium priority: theme-specific directory
      if (tenant.theme) {
        paths.push(join(basePath, "themes", tenant.theme, templateName));
      }
      
      // Lowest priority: regular file
      paths.push(join(basePath, templateName));
    }
    
    return paths;
  }

  /**
   * Create tenant directory structure
   */
  async createTenantStructure(baseDir: string, tenantId: string): Promise<void> {
    const tenantDir = join(baseDir, "tenants", tenantId);
    await ensureDir(tenantDir);
    
    // Create standard subdirectories
    await ensureDir(join(tenantDir, "layouts"));
    await ensureDir(join(tenantDir, "partials"));
    await ensureDir(join(tenantDir, "pages"));
  }

  /**
   * List all available tenants
   */
  listTenants(): TenantConfig[] {
    return Array.from(this.tenants.values());
  }
}