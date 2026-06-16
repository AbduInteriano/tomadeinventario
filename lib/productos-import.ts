import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";
import {
  cellToString,
  productoDataChanged,
  validateProductoInput,
  type ProductoInput,
} from "@/lib/productos";

const LOOKUP_CHUNK = 150;
const CREATE_BATCH = 250;
const UPDATE_BATCH = 80;

export interface ImportRowError {
  fila: number;
  motivo: string;
}

export interface ParsedImportRow extends ProductoInput {
  fila: number;
}

export interface ImportPreviewResult {
  creados: number;
  modificados: number;
  sinCambios: number;
  errores: ImportRowError[];
  totalFilas: number;
  filasValidas: number;
}

export interface ImportExecuteResult extends ImportPreviewResult {
  actualizados: number;
}

type CatalogMaps = {
  unidadByAbrev: Map<string, { id: string; abreviatura: string }>;
  categoriaByNombre: Map<string, { id: string; nombre: string }>;
};

export async function loadImportCatalogMaps(): Promise<CatalogMaps> {
  const [unidadesDb, categoriasDb] = await Promise.all([
    prisma.unidadMedida.findMany({
      where: { activo: true },
      select: { id: true, abreviatura: true },
    }),
    prisma.categoria.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
    }),
  ]);

  return {
    unidadByAbrev: new Map(
      unidadesDb.map((u) => [u.abreviatura.toUpperCase(), u])
    ),
    categoriaByNombre: new Map(
      categoriasDb.map((c) => [normalizeNombre(c.nombre).toLowerCase(), c])
    ),
  };
}

function resolveImportRow(
  row: unknown[],
  fila: number,
  maps: CatalogMaps
): { ok: true; data: ParsedImportRow } | { ok: false; error: ImportRowError } {
  const abreviaturaRaw = cellToString(row[3]);
  const categoriaNombreRaw = cellToString(row[4]);

  if (!abreviaturaRaw) {
    return {
      ok: false,
      error: {
        fila,
        motivo:
          "Unidad obligatoria. Usa la abreviatura registrada en Catálogo (ej. UN, KG).",
      },
    };
  }

  const unidad = maps.unidadByAbrev.get(abreviaturaRaw.toUpperCase());
  if (!unidad) {
    return {
      ok: false,
      error: {
        fila,
        motivo: `Unidad "${abreviaturaRaw}" no está registrada. Créala en Catálogo antes de importar.`,
      },
    };
  }

  if (!categoriaNombreRaw) {
    return {
      ok: false,
      error: {
        fila,
        motivo:
          "Categoría obligatoria. Regístrala en Catálogo y usa el nombre exacto en la plantilla.",
      },
    };
  }

  const categoria = maps.categoriaByNombre.get(
    normalizeNombre(categoriaNombreRaw).toLowerCase()
  );
  if (!categoria) {
    return {
      ok: false,
      error: {
        fila,
        motivo: `Categoría "${categoriaNombreRaw}" no está registrada. Créala en Catálogo antes de importar.`,
      },
    };
  }

  const validated = validateProductoInput({
    codigoBarras: cellToString(row[0]),
    codigoArticulo: cellToString(row[1]) || null,
    descripcion: cellToString(row[2]),
    unidadMedidaId: unidad.id,
    categoriaId: categoria.id,
  });

  if (validated.error || !validated.data) {
    return {
      ok: false,
      error: { fila, motivo: validated.error ?? "Datos inválidos" },
    };
  }

  return { ok: true, data: { fila, ...validated.data } };
}

function parseAllRows(rows: unknown[][], maps: CatalogMaps) {
  const errores: ImportRowError[] = [];
  const validRows: ParsedImportRow[] = [];
  const seenBarcodes = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const fila = i + 2;
    const resolved = resolveImportRow(rows[i], fila, maps);

    if (!resolved.ok) {
      errores.push(resolved.error);
      continue;
    }

    const key = resolved.data.codigoBarras.toLowerCase();
    const prevFila = seenBarcodes.get(key);
    if (prevFila != null) {
      errores.push({
        fila,
        motivo: `Código de barras duplicado en el archivo (ya aparece en fila ${prevFila})`,
      });
      continue;
    }
    seenBarcodes.set(key, fila);
    validRows.push(resolved.data);
  }

  return { validRows, errores };
}

async function loadExistingByBarcodes(barcodes: string[]) {
  const map = new Map<
    string,
    {
      id: string;
      codigoBarras: string;
      codigoArticulo: string | null;
      descripcion: string;
      unidadMedidaId: string;
      categoriaId: string | null;
      activo: boolean;
    }
  >();

  const unique = Array.from(new Set(barcodes));
  for (let i = 0; i < unique.length; i += LOOKUP_CHUNK) {
    const chunk = unique.slice(i, i + LOOKUP_CHUNK);
    const found = await prisma.producto.findMany({
      where: {
        OR: chunk.map((codigoBarras) => ({
          codigoBarras: { equals: codigoBarras, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        codigoBarras: true,
        codigoArticulo: true,
        descripcion: true,
        unidadMedidaId: true,
        categoriaId: true,
        activo: true,
      },
    });

    for (const p of found) {
      map.set(p.codigoBarras.toLowerCase(), p);
    }
  }

  return map;
}

function classifyRows(
  validRows: ParsedImportRow[],
  existingMap: Map<
    string,
    {
      id: string;
      codigoBarras: string;
      codigoArticulo: string | null;
      descripcion: string;
      unidadMedidaId: string;
      categoriaId: string | null;
      activo: boolean;
    }
  >
) {
  let creados = 0;
  let modificados = 0;
  let sinCambios = 0;
  const toCreate: ParsedImportRow[] = [];
  const toUpdate: { id: string; row: ParsedImportRow }[] = [];

  for (const row of validRows) {
    const existing = existingMap.get(row.codigoBarras.toLowerCase());
    if (!existing) {
      creados++;
      toCreate.push(row);
      continue;
    }

    if (productoDataChanged(existing, row)) {
      modificados++;
      toUpdate.push({ id: existing.id, row });
    } else {
      sinCambios++;
    }
  }

  return { creados, modificados, sinCambios, toCreate, toUpdate };
}

export async function previewProductoImport(
  rows: unknown[][]
): Promise<ImportPreviewResult> {
  const maps = await loadImportCatalogMaps();
  const { validRows, errores } = parseAllRows(rows, maps);

  if (validRows.length === 0) {
    return {
      creados: 0,
      modificados: 0,
      sinCambios: 0,
      errores,
      totalFilas: rows.length,
      filasValidas: 0,
    };
  }

  const existingMap = await loadExistingByBarcodes(
    validRows.map((r) => r.codigoBarras)
  );
  const stats = classifyRows(validRows, existingMap);

  return {
    creados: stats.creados,
    modificados: stats.modificados,
    sinCambios: stats.sinCambios,
    errores,
    totalFilas: rows.length,
    filasValidas: validRows.length,
  };
}

export async function executeProductoImport(
  rows: unknown[][]
): Promise<ImportExecuteResult> {
  const maps = await loadImportCatalogMaps();
  const { validRows, errores } = parseAllRows(rows, maps);

  if (validRows.length === 0) {
    return {
      creados: 0,
      modificados: 0,
      actualizados: 0,
      sinCambios: 0,
      errores,
      totalFilas: rows.length,
      filasValidas: 0,
    };
  }

  const existingMap = await loadExistingByBarcodes(
    validRows.map((r) => r.codigoBarras)
  );
  const { creados, modificados, sinCambios, toCreate, toUpdate } = classifyRows(
    validRows,
    existingMap
  );

  let creadosOk = 0;
  let actualizadosOk = 0;

  for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
    const batch = toCreate.slice(i, i + CREATE_BATCH);
    try {
      const result = await prisma.producto.createMany({
        data: batch.map((row) => ({
          codigoBarras: row.codigoBarras,
          codigoArticulo: row.codigoArticulo,
          descripcion: row.descripcion,
          unidadMedidaId: row.unidadMedidaId,
          categoriaId: row.categoriaId,
        })),
      });
      creadosOk += result.count;
    } catch {
      for (const row of batch) {
        try {
          await prisma.producto.create({
            data: {
              codigoBarras: row.codigoBarras,
              codigoArticulo: row.codigoArticulo,
              descripcion: row.descripcion,
              unidadMedidaId: row.unidadMedidaId,
              categoriaId: row.categoriaId,
            },
          });
          creadosOk++;
        } catch {
          errores.push({
            fila: row.fila,
            motivo: "Error al guardar en base de datos",
          });
        }
      }
    }
  }

  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    try {
      await prisma.$transaction(
        batch.map((item) =>
          prisma.producto.update({
            where: { id: item.id },
            data: {
              codigoBarras: item.row.codigoBarras,
              codigoArticulo: item.row.codigoArticulo,
              descripcion: item.row.descripcion,
              unidadMedidaId: item.row.unidadMedidaId,
              categoriaId: item.row.categoriaId,
              activo: true,
            },
          })
        )
      );
      actualizadosOk += batch.length;
    } catch {
      for (const item of batch) {
        try {
          await prisma.producto.update({
            where: { id: item.id },
            data: {
              codigoBarras: item.row.codigoBarras,
              codigoArticulo: item.row.codigoArticulo,
              descripcion: item.row.descripcion,
              unidadMedidaId: item.row.unidadMedidaId,
              categoriaId: item.row.categoriaId,
              activo: true,
            },
          });
          actualizadosOk++;
        } catch {
          errores.push({
            fila: item.row.fila,
            motivo: "Error al actualizar en base de datos",
          });
        }
      }
    }
  }

  return {
    creados: creadosOk,
    modificados: actualizadosOk,
    actualizados: actualizadosOk,
    sinCambios,
    errores,
    totalFilas: rows.length,
    filasValidas: validRows.length,
  };
}
