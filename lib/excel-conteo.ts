import ExcelJS from "exceljs";
import { decimalToNumber } from "@/lib/inventario";

export const CONTEO_EXCEL_HEADERS = [
  "Código de barras",
  "Código interno",
  "Descripción",
  "Unidad",
  "Cantidad contada",
] as const;

export interface ConteoExportRow {
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
  cantidadContada: { toNumber(): number } | number;
}

export interface ConteoExportBlock {
  label: string;
  conteos: ConteoExportRow[];
}

function addHeaderRow(sheet: ExcelJS.Worksheet) {
  const row = sheet.addRow([...CONTEO_EXCEL_HEADERS]);
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
}

function addConteoRows(sheet: ExcelJS.Worksheet, conteos: ConteoExportRow[]) {
  for (const c of conteos) {
    sheet.addRow([
      c.codigoBarras,
      c.codigoInterno ?? "",
      c.descripcion,
      c.unidadMedida,
      decimalToNumber(c.cantidadContada),
    ]);
  }
}

function addSeparatorRow(sheet: ExcelJS.Worksheet, label: string) {
  sheet.addRow([]);
  const row = sheet.addRow([label]);
  row.font = { bold: true, color: { argb: "FF1E40AF" } };
  sheet.mergeCells(row.number, 1, row.number, CONTEO_EXCEL_HEADERS.length);
  addHeaderRow(sheet);
}

export async function createConteoExportBuffer(block: ConteoExportBlock): Promise<Buffer> {
  return createConsolidatedConteoExportBuffer([block]);
}

export async function createConsolidatedConteoExportBuffer(
  blocks: ConteoExportBlock[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Conteo");

  const nonEmpty = blocks.filter((b) => b.conteos.length > 0);
  if (nonEmpty.length === 0) {
    addHeaderRow(sheet);
  } else {
    nonEmpty.forEach((block, index) => {
      if (index === 0) {
        const titleRow = sheet.addRow([block.label]);
        titleRow.font = { bold: true, size: 12 };
        sheet.mergeCells(titleRow.number, 1, titleRow.number, CONTEO_EXCEL_HEADERS.length);
        addHeaderRow(sheet);
        addConteoRows(sheet, block.conteos);
      } else {
        addSeparatorRow(sheet, block.label);
        addConteoRows(sheet, block.conteos);
      }
    });
  }

  sheet.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildConteoBlockLabel(meta: {
  punto: string;
  area: string;
  usuario: string;
  fecha: string;
}): string {
  return `${meta.punto} · ${meta.area} | ${meta.usuario} | ${meta.fecha}`;
}
