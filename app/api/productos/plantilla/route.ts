import { NextResponse } from "next/server";
import { createProductoTemplateBuffer } from "@/lib/excel-productos";
import { requireSupervisorApi } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const buffer = await createProductoTemplateBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-productos.xlsx"',
    },
  });
}
