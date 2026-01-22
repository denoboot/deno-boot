export function fromDenoEnv() {
  return () => Deno.env.toObject();
}
