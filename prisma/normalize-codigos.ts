/**
 * Normaliza códigos numéricos existentes (quita ceros a la izquierda).
 * Fusiona productos duplicados y desactiva el sobrante.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { stripLeadingZerosNumerico } from "../lib/codigo";

const BATCH_SIZE = 100;
const CONNECT_TIMEOUT_MS = 30_000;

function buildDatabaseUrl(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL o DIRECT_URL debe estar definida en el entorno");
  }

  const parsed = new URL(url);
  if (!parsed.searchParams.has("connect_timeout")) {
    parsed.searchParams.set("connect_timeout", "30");
  }
  if (!parsed.searchParams.has("pool_timeout")) {
    parsed.searchParams.set("pool_timeout", "30");
  }
  return parsed.toString();
}

const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
});

type ProductoRow = {
  id: string;
  codigoBarras: string;
  codigoArticulo: string | null;
  activo: boolean;
  _count: { conteos: number };
};

function barcodeKey(value: string): string {
  return stripLeadingZerosNumerico(value).toLowerCase();
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function connectWithTimeout(): Promise<void> {
  console.log("Conectando a la base de datos...");
  const usingDirect = Boolean(process.env.DIRECT_URL);
  console.log(`  Usando ${usingDirect ? "DIRECT_URL" : "DATABASE_URL"}`);

  await Promise.race([
    prisma.$connect(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Timeout de conexión (${CONNECT_TIMEOUT_MS}ms)`)),
        CONNECT_TIMEOUT_MS
      );
    }),
  ]);
  console.log("Conexión establecida.");
}

function pickKeeper(group: ProductoRow[]): ProductoRow {
  return [...group].sort((a, b) => {
    const aExact = barcodeKey(a.codigoBarras) === a.codigoBarras.toLowerCase();
    const bExact = barcodeKey(b.codigoBarras) === b.codigoBarras.toLowerCase();
    if (aExact !== bExact) return aExact ? -1 : 1;
    if (a.activo !== b.activo) return a.activo ? -1 : 1;
    return b._count.conteos - a._count.conteos;
  })[0];
}

async function mergeDuplicates(productos: ProductoRow[]) {
  console.log("Etapa 1/3: fusionando productos duplicados...");

  const groups = new Map<string, ProductoRow[]>();
  for (const p of productos) {
    const key = barcodeKey(p.codigoBarras);
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  const duplicateGroups = Array.from(groups.values()).filter((g) => g.length > 1);
  console.log(`  Grupos duplicados detectados: ${duplicateGroups.length}`);

  let totalMerged = 0;
  let totalDeactivated = 0;
  const batches = chunk(duplicateGroups, BATCH_SIZE);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  Procesando lote ${i + 1}/${batches.length} (${batch.length} grupos)...`);

    await prisma.$transaction(async (tx) => {
      for (const group of batch) {
        const keeper = pickKeeper(group);

        for (const dup of group) {
          if (dup.id === keeper.id) continue;

          if (dup._count.conteos > 0) {
            const result = await tx.conteoInventario.updateMany({
              where: { productoId: dup.id },
              data: { productoId: keeper.id },
            });
            totalMerged += result.count;
          }

          if (dup.activo) {
            await tx.producto.update({
              where: { id: dup.id },
              data: { activo: false },
            });
            totalDeactivated++;
          }
        }
      }
    });
  }

  console.log(`  Conteos reasignados: ${totalMerged}`);
  console.log(`  Productos desactivados: ${totalDeactivated}`);
  return { totalMerged, totalDeactivated };
}

async function countProductsNeedingNormalization(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "Producto"
    WHERE "activo" = true
      AND (
        ("codigoBarras" ~ '^[0-9]+$' AND "codigoBarras" ~ '^0')
        OR (
          "codigoArticulo" IS NOT NULL
          AND "codigoArticulo" ~ '^[0-9]+$'
          AND "codigoArticulo" ~ '^0'
        )
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

async function normalizeActiveProducts(): Promise<number> {
  console.log("Etapa 2/3: normalizando códigos de productos activos...");

  const pending = await countProductsNeedingNormalization();
  console.log(`  Procesando ${pending} productos...`);

  if (pending === 0) {
    console.log("  Nada que actualizar.");
    return 0;
  }

  const updated = await prisma.$executeRaw`
    UPDATE "Producto"
    SET
      "codigoBarras" = CASE
        WHEN "codigoBarras" ~ '^[0-9]+$' AND ltrim("codigoBarras", '0') = '' THEN '0'
        WHEN "codigoBarras" ~ '^[0-9]+$' THEN ltrim("codigoBarras", '0')
        ELSE "codigoBarras"
      END,
      "codigoArticulo" = CASE
        WHEN "codigoArticulo" IS NULL THEN NULL
        WHEN "codigoArticulo" ~ '^[0-9]+$' AND ltrim("codigoArticulo", '0') = '' THEN '0'
        WHEN "codigoArticulo" ~ '^[0-9]+$' THEN ltrim("codigoArticulo", '0')
        ELSE "codigoArticulo"
      END
    WHERE "activo" = true
      AND (
        ("codigoBarras" ~ '^[0-9]+$' AND "codigoBarras" ~ '^0')
        OR (
          "codigoArticulo" IS NOT NULL
          AND "codigoArticulo" ~ '^[0-9]+$'
          AND "codigoArticulo" ~ '^0'
        )
      )
  `;

  console.log(`  Productos actualizados: ${updated}`);
  return Number(updated);
}

async function countNoCatalogadosNeedingNormalization(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM "ProductoNoCatalogado"
    WHERE "codigoEscaneado" ~ '^[0-9]+$'
      AND "codigoEscaneado" ~ '^0'
  `;
  return Number(rows[0]?.count ?? 0);
}

async function normalizeNoCatalogados(): Promise<number> {
  console.log("Etapa 3/3: normalizando códigos no catalogados...");

  const pending = await countNoCatalogadosNeedingNormalization();
  console.log(`  Procesando ${pending} registros...`);

  if (pending === 0) {
    console.log("  Nada que actualizar.");
    return 0;
  }

  const updated = await prisma.$executeRaw`
    UPDATE "ProductoNoCatalogado"
    SET "codigoEscaneado" = CASE
      WHEN ltrim("codigoEscaneado", '0') = '' THEN '0'
      ELSE ltrim("codigoEscaneado", '0')
    END
    WHERE "codigoEscaneado" ~ '^[0-9]+$'
      AND "codigoEscaneado" ~ '^0'
  `;

  console.log(`  Registros actualizados: ${updated}`);
  return Number(updated);
}

async function main() {
  console.log("Iniciando normalización de códigos...");

  const productos = await prisma.producto.findMany({
    select: {
      id: true,
      codigoBarras: true,
      codigoArticulo: true,
      activo: true,
      _count: { select: { conteos: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total de productos en catálogo: ${productos.length}`);

  const { totalMerged, totalDeactivated } = await mergeDuplicates(productos);
  const productosActualizados = await normalizeActiveProducts();
  const noCatUpdated = await normalizeNoCatalogados();

  console.log("");
  console.log("Resumen:");
  console.log(`  Productos actualizados: ${productosActualizados}`);
  console.log(`  Conteos reasignados por duplicados: ${totalMerged}`);
  console.log(`  Productos duplicados desactivados: ${totalDeactivated}`);
  console.log(`  No catalogados actualizados: ${noCatUpdated}`);
  console.log("Normalización completada.");
}

async function run() {
  try {
    await connectWithTimeout();
    await main();
  } catch (error) {
    console.error("Error durante la normalización:", error);
    process.exitCode = 1;
  } finally {
    console.log("Cerrando conexión...");
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  }
}

run();
