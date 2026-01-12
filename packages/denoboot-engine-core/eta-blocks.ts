// engine/core/eta-blocks.ts
export function withBlocks(data: Record<string, unknown>) {
  const blocks: Record<string, () => string> = {};

  return {
    ...data,

    define(name: string, fn: () => string) {
      blocks[name] = fn;
    },

    block(name: string) {
      return blocks[name]?.() ?? "";
    },
  };
}
