/**
 * Quita ceros a la izquierda de códigos puramente numéricos.
 * "0005465" → "5465", "0" → "0". Códigos alfanuméricos no se modifican.
 */
export function stripLeadingZerosNumerico(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed;
  const stripped = trimmed.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}
