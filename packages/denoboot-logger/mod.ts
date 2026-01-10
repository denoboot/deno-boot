// deno-lint-ignore-file no-explicit-any
// modules/logger.ts
/**
 * Logger module
 * Provides structured logging with levels and metadata
 */


export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level?: LogLevel | string;
  prefix?: string;
  useColors?: boolean;
}

export interface Logger {
  log(message: string, meta?: Record<string, unknown>): void;
  log(message: string, ...meta: any[]): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, ...meta: any[]): void;
  info(message: string, meta?: Record<string, unknown>): void;
  info(message: string, ...meta: any[]): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, ...meta: any[]): void;
  error(message: string, meta?: Record<string, unknown>): void;
  error(message: string, ...meta: any[]): void;
  setLevel(level: LogLevel): void;
  setPrefix(prefix: string): void;
}

const LOG_COLORS = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

const LOG_LEVELS: Record<LogLevel | string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements Logger {
  private level: LogLevel | string;
  private prefix: string;
  private useColors: boolean;

  constructor(
    level: LogLevel | string = "info",
    prefix: string | undefined,
    useColors: boolean = true
  ) {
    this.level = level;
    this.prefix = prefix || "";
    this.useColors = useColors && Deno.stdout.isTerminal();
  }

  private shouldLog(level: LogLevel | string): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(
    level: LogLevel | string,
    message: string,
    meta?: Record<string, unknown> | any[]
  ): string {
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "/").split("/").reverse().join("/");
    const timeStr = new Date().toISOString().split("T")[1].substring(0, 5);
    const timestamp = `${dateStr} ${timeStr}`;
    const levelUpper = level.toUpperCase().padEnd(5).trim();
    
    let output = "";
    const color = LOG_COLORS[level as LogLevel];
    const reset = LOG_COLORS.reset;
    const dim = LOG_COLORS.dim;
    const bold = LOG_COLORS.bold;

    if (this.useColors) {
      if (this.prefix) {
        output = `${dim}${timestamp}${reset} ${bold}${color}[${levelUpper}]${reset} ${bold}${this.prefix}${reset} ${color}${message}${reset}`;
      } else {
        output = `${dim}${timestamp}${reset} ${bold}${color}[${levelUpper}]${reset} ${color}${message}${reset}`;
      }
    } else {
      if (this.prefix) {
        output = `${dim}${timestamp}${reset} ${bold}[${levelUpper}]${reset} ${bold}${this.prefix}${reset} ${message}`;
      } else {
        output = `${dim}${timestamp}${reset} ${bold}[${levelUpper}]${reset} ${message}`;
      }
    }

    if (Array.isArray(meta)) {
      const indent = "    ";
      for (const item of meta) {
        if (typeof item === "object" && item !== null) {
          const indent = "    ";
          for (const key in item) {
            output += `\n${indent}${color}${key}:${reset} ${color}${item[key]}${reset}`;
          }
        } else {
          output += `\n${indent}${color}${item}${reset}`;
        }
      }
    } else if (typeof meta === "object" && meta !== null) {
      const indent = "    ";
      for (const key in meta) {
        output += `\n${indent}${color}${key}:${reset} ${color}${meta[key]}${reset}`;
      }
    }
    
    return output;
  }

  private safeJsonReplacer(): (key: string, value: unknown) => unknown {
    const seen = new WeakSet();
    return (_key: string, value: unknown) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      
      // Handle special types
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      
      if (typeof value === "function") {
        return "[Function]";
      }
      
      if (typeof value === "bigint") {
        return value.toString() + "n";
      }
      
      return value;
    };
  }

  log(...data: any[]): void {
    console.log(...data);
  }

  debug(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, meta));
    }
  }

  info(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, meta));
    }
  }

  warn(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  error(message: string, meta?: Record<string, unknown> | any[]): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, meta));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getLevel(): LogLevel | string {
    return this.level;
  }

  getPrefix(): string {
    return this.prefix;
  }
}

/**
 * Null logger that does nothing (useful for testing)
 */
export class NullLogger implements Logger {
  log(..._data: any[]): void {}
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  setLevel(): void {}
  setPrefix(): void {}
}

/**
 * Logger that stores logs in memory (useful for testing)
 */
export class MemoryLogger implements Logger {
  private logs: Array<{
    level: LogLevel;
    message: string;
    meta?: Record<string, unknown> | any[];
    timestamp: Date;
  }> = [];

  private level: LogLevel = "info";
  protected prefix: string = "[Test]";

  log(..._data: any[]): void {
    // Don't log to console, just store in memory
  }

  debug(message: string, meta?: Record<string, unknown> | any[]): void {
    this._log("debug", message, meta);
  }

  info(message: string, meta?: Record<string, unknown> | any[]): void {
    this._log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown> | any[]): void {
    this._log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown> | any[]): void {
    this._log("error", message, meta);
  }

  private _log(level: LogLevel, message: string, meta?: Record<string, unknown> | any[]): void {
    if (LOG_LEVELS[level] >= LOG_LEVELS[this.level]) {
      this.logs.push({
        level,
        message,
        meta,
        timestamp: new Date(),
      });
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getLogs(): typeof this.logs {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  getLogsByLevel(level: LogLevel): typeof this.logs {
    return this.logs.filter(log => log.level === level);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  options?: LoggerOptions
): Logger {
  return new ConsoleLogger(options?.level, options?.prefix, options?.useColors);
}

/**
 * Create a logger from environment variables
 */
export function createLoggerFromEnv(prefix: string | undefined): Logger {
  const level = Deno.env.get("LOG_LEVEL") as LogLevel | undefined;
  
  return createLogger(
    {
      level: level || "info",
      prefix,
      useColors: true
    }
  );
}