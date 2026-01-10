import { BLOCK_FONT } from "./block-font.ts";
import { HASH_FONT } from "./hash-font.ts";

export function createBlockBanner(text: string): string {
  const chars = text.toUpperCase().split("");
  const height = 5;
  const lines = Array(height).fill("");

  for (const ch of chars) {
    const glyph = BLOCK_FONT[ch] ?? BLOCK_FONT[" "];
    glyph.forEach((line, i) => {
      lines[i] += line + " ";
    });
  }

  return lines.join("\n").trimEnd();
}


export function createHashBanner(text: string): string {
  const chars = text.toUpperCase().split("");
  const height = 5;
  const lines = Array(height).fill("");

  for (const ch of chars) {
    const glyph = HASH_FONT[ch] ?? HASH_FONT[" "];
    glyph.forEach((line, i) => {
      lines[i] += line + " ";
    });
  }

  return lines.join("\n").trimEnd();
}




export interface BannerOptions {
  variant?: "block" | "hash";
  padding?: number;
  border?: boolean;
  footer?: string;
}

export function createBanner(
  prefix: string,
  options: BannerOptions = {}
): string {
  const {
    variant = "block",
    padding = 1,
    border = true,
    footer,
  } = options;

  const content =
    variant === "hash"
      ? createHashBanner(prefix)
      : createBlockBanner(prefix);

  let lines = content.split("\n");

  if (footer) {
    lines.push("");
    lines.push(footer);
  }

  const pad = " ".repeat(padding);
  lines = lines.map((l) => pad + l + pad);

  if (!border) return lines.join("\n");

  const width = Math.max(...lines.map((l) => l.length));
  const top = `┌${"─".repeat(width)}┐`;
  const bottom = `└${"─".repeat(width)}┘`;

  const boxed = lines.map(
    (l) => `│${l.padEnd(width)}│`
  );

  return [top, ...boxed, bottom].join("\n");
}


