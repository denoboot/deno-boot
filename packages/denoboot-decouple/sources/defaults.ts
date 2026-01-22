export function fromDefaults(
  defaults: Record<string, string>,
) {
  return () => defaults;
}
