/** Zona horaria de la operación (inventarios locales). Configurable vía APP_TIMEZONE. */
export const APP_TIMEZONE =
  process.env.APP_TIMEZONE ?? "America/Argentina/Buenos_Aires";

/** Fecha de hoy en la zona de la app, formato YYYY-MM-DD */
export function fechaHoyIso(timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

/** Date @ noon UTC para almacenar en columna @db.Date sin desfase de día */
export function isoToFechaDate(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** Fecha de hoy como Date para Prisma @db.Date */
export function hoyApp(): Date {
  return isoToFechaDate(fechaHoyIso());
}

export function fechaToIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseFechaParam(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  return isoToFechaDate(`${match[1]}-${match[2]}-${match[3]}`);
}
