export function formatGermanRegisterReference(input: {
  registerType?: string | null;
  registerNumber?: string | null;
  openregisterCompanyId?: string | null;
}) {
  const idParts = input.openregisterCompanyId?.match(
    /^DE-([A-Z]+)-[^-]+-([A-Z0-9-]+)$/i,
  );
  const registerType = (input.registerType ?? idParts?.[1] ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const registerNumber = (input.registerNumber ?? idParts?.[2] ?? "")
    .toUpperCase()
    .replace(new RegExp(`^${registerType}\\s*`, "i"), "")
    .replace(/\s+/g, "");
  return registerType && registerNumber
    ? `${registerType}${registerNumber}`
    : "N/A";
}

export function formatGermanRegisterCourt(registerCourt?: string | null) {
  const court = registerCourt?.trim();
  if (!court) return "N/A";
  return /^amtsgericht\b/i.test(court) ? court : `Amtsgericht ${court}`;
}
