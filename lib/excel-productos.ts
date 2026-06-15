import ExcelJS from "exceljs";
import { EXCEL_HEADERS } from "@/lib/productos";

export async function createProductoTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");

  sheet.addRow([...EXCEL_HEADERS]);
  sheet.getRow(1).font = { bold: true };

  EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function createProductosExportBuffer(
  productos: {
    codigoBarras: string;
    codigoInterno: string | null;
    descripcion: string;
    unidadMedida: string;
    categoria: string | null;
  }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Productos");

  sheet.addRow([...EXCEL_HEADERS]);
  sheet.getRow(1).font = { bold: true };

  for (const p of productos) {
    sheet.addRow([
      p.codigoBarras,
      p.codigoInterno ?? "",
      p.descripcion,
      p.unidadMedida,
      p.categoria ?? "",
    ]);
  }

  EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseProductoExcel(
  buffer: ArrayBuffer
): Promise<{ headers: unknown[]; rows: unknown[][] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("El archivo no contiene hojas de cálculo");
  }

  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1));
  });

  if (rows.length === 0) {
    throw new Error("El archivo está vacío");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1).filter((row) =>
    row.some((cell) => cellToString(cell) !== "")
  );

  return { headers, rows: dataRows };
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}
