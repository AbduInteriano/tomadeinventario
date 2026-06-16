import { NextRequest, NextResponse } from "next/server";
import { requireSupervisorApi } from "@/lib/api-auth";
import { parseProductoExcel } from "@/lib/excel-productos";
import { previewProductoImport } from "@/lib/productos-import";
import { validateExcelHeaders } from "@/lib/productos";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 10_000;

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

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 20 MB" },
      { status: 400 }
    );
  }

  let parsed: { headers: unknown[]; rows: unknown[][] };
  try {
    parsed = await parseProductoExcel(await file.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al leer Excel" },
      { status: 400 }
    );
  }

  if (!validateExcelHeaders(parsed.headers)) {
    return NextResponse.json(
      {
        error:
          "Plantilla inválida. Descarga la plantilla oficial y usa la hoja Productos.",
      },
      { status: 400 }
    );
  }

  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Máximo ${MAX_ROWS.toLocaleString("es-AR")} filas por archivo` },
      { status: 400 }
    );
  }

  const preview = await previewProductoImport(parsed.rows);

  return NextResponse.json(preview);
}
