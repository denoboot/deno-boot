/**
 * Django-like layout and block system for Eta
 * This provides {% extends %} and {% block %} functionality
 */

import { TemplateContext } from "./types.ts";

/**
 * Block registry for template inheritance
 */
export class BlockRegistry {
  private blocks = new Map<string, (() => string) | string>();
  private definitions = new Map<string, string>();

  /**
   * Define a block's content
   */
  define(name: string, content: () => string): void {
    this.definitions.set(name, content.toString());
    this.blocks.set(name, content);
  }

  /**
   * Get a block's content, falling back to default
   */
  get(name: string, defaultContent?: () => string): string {
    const block = this.blocks.get(name);
    
    if (block) {
      if (typeof block === "function") {
        try {
          return block();
        } catch (error) {
          console.warn(`Error rendering block "${name}":`, error);
        }
      }
      return typeof block === "string" ? block : "";
    }

    if (defaultContent) {
      try {
        return defaultContent();
      } catch (error) {
        console.warn(`Error rendering default content for block "${name}":`, error);
      }
    }

    return "";
  }

  /**
   * Check if a block is defined
   */
  has(name: string): boolean {
    return this.blocks.has(name);
  }

  /**
   * Clear all blocks (for new template rendering)
   */
  clear(): void {
    this.blocks.clear();
    this.definitions.clear();
  }

  /**
   * Create the block helper for template context
   */
  createBlockHelper(): TemplateContext["block"] {
    return (name: string, defaultContent?: () => string) => {
      return this.get(name, defaultContent);
    };
  }

  /**
   * Create the define helper for template context
   */
  createDefineHelper(): TemplateContext["define"] {
    return (name: string, content: () => string) => {
      this.define(name, content);
    };
  }
}

/**
 * Layout processor that handles template inheritance
 */
export class LayoutProcessor {
  private blockRegistry = new BlockRegistry();

  /**
   * Process a template with layout inheritance
   */
  async processWithLayouts(
    templateContent: string,
    data: Record<string, unknown>,
    getTemplate: (name: string) => Promise<string | null>,
    etaInstance: import("eta").Eta
  ): Promise<string> {
    // Extract layout directive
    const layoutMatch = templateContent.match(/\{%\s*extends\s+['"]([^'"]+)['"]\s*%\}/);
    
    if (!layoutMatch) {
      // No layout, render directly
      return await etaInstance.renderAsync(templateContent, this.createContext(data));
    }

    // Remove the extends directive from child template
    const childContent = templateContent.replace(layoutMatch[0], "");
    
    // Render child template to capture blocks
    const childContext = this.createContext(data);
    await etaInstance.renderAsync(childContent, childContext);
    
    // Get and render parent layout
    const layoutName = layoutMatch[1];
    const layoutContent = await getTemplate(layoutName);
    
    if (!layoutContent) {
      throw new Error(`Layout not found: ${layoutName}`);
    }

    // Render layout with blocks from child
    const result = await etaInstance.renderAsync(layoutContent, {
      ...data,
      block: this.blockRegistry.createBlockHelper(),
      define: this.blockRegistry.createDefineHelper(),
    });

    // Clear blocks for next render
    this.blockRegistry.clear();
    
    return result;
  }

  /**
   * Create template context with block helpers
   */
  private createContext(data: Record<string, unknown>): TemplateContext {
    return {
      ...data,
      block: this.blockRegistry.createBlockHelper(),
      define: this.blockRegistry.createDefineHelper(),
    };
  }

  /**
   * Check if template uses layout inheritance
   */
  hasLayoutDirective(content: string): boolean {
    return /\{%\s*extends\s+['"][^'"]+['"]\s*%\}/.test(content);
  }

  /**
   * Extract blocks from template
   */
  extractBlocks(content: string): string[] {
    const blocks: string[] = [];
    const blockRegex = /\{%\s*block\s+([^\s%}]+)/g;
    let match;
    
    while ((match = blockRegex.exec(content)) !== null) {
      blocks.push(match[1]);
    }
    
    return blocks;
  }
}