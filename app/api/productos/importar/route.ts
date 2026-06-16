import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import { parseProductoExcel } from "@/lib/excel-productos";
import {
  cellToString,
  validateExcelHeaders,
  validateProductoInput,
} from "@/lib/productos";

export const runtime = "nodejs";

interface ImportError {
  fila: number;
  motivo: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 10 MB" },
      { status: 400 }
    );
  }

  const name = file instanceof File ? file.name : "";
  if (name && !name.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json(
      { error: "Solo se aceptan archivos .xlsx" },
      { status: 400 }
    );
  }

  let parsed: { headers: unknown[]; rows: unknown[][] };
  try {
    const buffer = await file.arrayBuffer();
    parsed = await parseProductoExcel(buffer);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al leer el archivo Excel",
      },
      { status: 400 }
    );
  }

  if (!validateExcelHeaders(parsed.headers)) {
    return NextResponse.json(
      {
        error:
          "La plantilla no es válida. Descarga la plantilla oficial y verifica los encabezados.",
      },
      { status: 400 }
    );
  }

  let creados = 0;
  let actualizados = 0;
  const errores: ImportError[] = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const row = parsed.rows[i];
    const fila = i + 2;

    const abreviatura = cellToString(row[3]) || "UN";
    const categoriaNombre = cellToString(row[4]) || null;

    const unidad = await prisma.unidadMedida.findFirst({
      where: { abreviatura: { equals: abreviatura.toUpperCase(), mode: "insensitive" } },
    });
    if (!unidad) {
      errores.push({ fila, motivo: `Unidad "${abreviatura}" no existe` });
      continue;
    }

    let categoriaId: string | null = null;
    if (categoriaNombre) {
      const categoria = await prisma.categoria.findFirst({
        where: { nombre: { equals: normalizeNombre(categoriaNombre), mode: "insensitive" } },
      });
      if (!categoria) {
        errores.push({ fila, motivo: `Categoría "${categoriaNombre}" no existe` });
        continue;
      }
      categoriaId = categoria.id;
    }

    const validated = validateProductoInput({
      codigoBarras: cellToString(row[0]),
      codigoInterno: cellToString(row[1]) || null,
      descripcion: cellToString(row[2]),
      unidadMedidaId: unidad.id,
      categoriaId,
    });

    if (validated.error || !validated.data) {
      errores.push({ fila, motivo: validated.error ?? "Datos inválidos" });
      continue;
    }

    const { data } = validated;

    try {
      const existing = await prisma.producto.findFirst({
        where: {
          codigoBarras: { equals: data.codigoBarras, mode: "insensitive" },
        },
      });

      if (existing) {
        await prisma.producto.update({
          where: { id: existing.id },
          data: {
            codigoBarras: data.codigoBarras,
            codigoInterno: data.codigoInterno,
            descripcion: data.descripcion,
            unidadMedidaId: data.unidadMedidaId,
            categoriaId: data.categoriaId,
            activo: true,
          },
        });
        actualizados++;
      } else {
        await prisma.producto.create({
          data: {
            codigoBarras: data.codigoBarras,
            codigoInterno: data.codigoInterno,
            descripcion: data.descripcion,
            unidadMedidaId: data.unidadMedidaId,
            categoriaId: data.categoriaId,
          },
        });
        creados++;
      }
    } catch {
      errores.push({ fila, motivo: "Error al guardar en base de datos" });
    }
  }

  return NextResponse.json({
    creados,
    actualizados,
    modificados: actualizados,
    errores,
    totalFilas: parsed.rows.length,
  });
}
