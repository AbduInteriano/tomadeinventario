import ExcelJS from "exceljs";
import { formatCantidad } from "@/lib/cantidad";

export const CONTEO_EXCEL_HEADERS = [
  "Código de barras",
  "Código artículo",
  "Descripción",
  "Unidad",
  "Cantidad contada",
] as const;

export const NO_CATALOGADO_EXCEL_HEADERS = [
  "Código escaneado",
  "Descripción",
  "Cantidad",
] as const;

export interface ConteoExportRow {
  codigoBarras: string;
  codigoArticulo: string | null;
  descripcion: string;
  unidadMedida: string;
  cantidadContada: { toNumber(): number } | number;
}

export interface NoCatalogadoExportRow {
  codigoEscaneado: string;
  descripcionLibre: string;
  cantidad: { toNumber(): number } | number;
}

export interface ConteoExportBlock {
  label: string;
  conteos: ConteoExportRow[];
  noCatalogados?: NoCatalogadoExportRow[];
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
      c.codigoArticulo ?? "",
      c.descripcion,
      c.unidadMedida,
      formatCantidad(c.cantidadContada),
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

function addNoCatalogadoHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.addRow([...NO_CATALOGADO_EXCEL_HEADERS]);
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFEF3C7" },
  };
}

function addNoCatalogadoRows(sheet: ExcelJS.Worksheet, rows: NoCatalogadoExportRow[]) {
  for (const n of rows) {
    sheet.addRow([
      n.codigoEscaneado,
      n.descripcionLibre,
      formatCantidad(n.cantidad),
    ]);
  }
}

function addNoCatalogadoBlock(sheet: ExcelJS.Worksheet, block: ConteoExportBlock) {
  const rows = block.noCatalogados ?? [];
  if (rows.length === 0) return;
  sheet.addRow([]);
  const title = sheet.addRow([`No catalogados — ${block.label}`]);
  title.font = { bold: true, color: { argb: "FFB45309" } };
  sheet.mergeCells(title.number, 1, title.number, NO_CATALOGADO_EXCEL_HEADERS.length);
  addNoCatalogadoHeader(sheet);
  addNoCatalogadoRows(sheet, rows);
}

export async function createConteoExportBuffer(block: ConteoExportBlock): Promise<Buffer> {
  return createConsolidatedConteoExportBuffer([block]);
}

export async function createConsolidatedConteoExportBuffer(
  blocks: ConteoExportBlock[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Conteo");
  const noCatSheet = workbook.addWorksheet("No catalogados");

  const nonEmpty = blocks.filter(
    (b) => b.conteos.length > 0 || (b.noCatalogados?.length ?? 0) > 0
  );

  if (nonEmpty.length === 0) {
    addHeaderRow(sheet);
    addNoCatalogadoHeader(noCatSheet);
    if (blocks.length === 1) {
      const titleRow = sheet.addRow([blocks[0].label]);
      titleRow.font = { bold: true, size: 12 };
      sheet.mergeCells(titleRow.number, 1, titleRow.number, CONTEO_EXCEL_HEADERS.length);
    }
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
      addNoCatalogadoBlock(noCatSheet, block);
    });
  }

  (sheet.columns ?? []).forEach((col) => {
    col.width = 22;
  });
  if ((noCatSheet.rowCount ?? 0) === 0) {
    addNoCatalogadoHeader(noCatSheet);
  }
  (noCatSheet.columns ?? []).forEach((col) => {
    col.width = 24;
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
