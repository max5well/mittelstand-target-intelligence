const PSEUDO_ID_PREFIXES = ["manual:", "concess:"] as const;

/** True only for IDs that can be sent to the OpenRegister company endpoints. */
export function isOpenRegisterId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const id = value.trim();
  return (
    id.length > 0 &&
    !PSEUDO_ID_PREFIXES.some((prefix) => id.toLowerCase().startsWith(prefix))
  );
}
