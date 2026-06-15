import { NextRequest, NextResponse } from "next/server";
import { requireSupervisorApi } from "@/lib/api-auth";
import { parseProductoExcel } from "@/lib/excel-productos";
import { previewImportRows, validateExcelHeaders } from "@/lib/productos";

export const runtime = "nodejs";

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
      { error: "Plantilla inválida. Descarga la plantilla oficial." },
      { status: 400 }
    );
  }

  const preview = await previewImportRows(parsed.rows);

  return NextResponse.json(preview);
}
