import ExcelJS from "exceljs";
import { EXCEL_HEADERS } from "@/lib/productos";
import { cellToString } from "@/lib/productos";

export interface PlantillaCatalogo {
  categorias: { nombre: string }[];
  unidades: { nombre: string; abreviatura: string }[];
}

export async function createProductoTemplateBuffer(
  catalogo: PlantillaCatalogo
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.addRow(["Importación masiva de productos"]);
  instrucciones.addRow([]);
  instrucciones.addRow(["1. Cree primero todas las categorías y unidades en Catálogo (/supervisor/catalogo)."]);
  instrucciones.addRow(["2. Complete la hoja Productos (no modifique los encabezados de la fila 1)."]);
  instrucciones.addRow(["3. Unidad = abreviatura exacta (ej. UN, KG). Categoría = nombre exacto registrado."]);
  instrucciones.addRow(["4. Ambas columnas son obligatorias en cada fila."]);
  instrucciones.addRow(["5. Las filas con categoría o unidad no registrada se omiten; el resto se importa."]);
  instrucciones.addRow(["6. Hasta 10.000 filas por archivo (.xlsx, máx. 20 MB)."]);
  instrucciones.getColumn(1).width = 90;

  const sheet = workbook.addWorksheet("Productos");
  sheet.addRow([...EXCEL_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  if (catalogo.unidades.length > 0 && catalogo.categorias.length > 0) {
    sheet.addRow([
      "0000000000001",
      "ART-001",
      "Producto de ejemplo",
      catalogo.unidades[0].abreviatura,
      catalogo.categorias[0].nombre,
    ]);
  }

  EXCEL_HEADERS.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 2 ? 36 : 20;
  });

  const catSheet = workbook.addWorksheet("Categorías válidas");
  catSheet.addRow(["Nombre (usar en columna Categoría)"]);
  catSheet.getRow(1).font = { bold: true };
  for (const c of catalogo.categorias) {
    catSheet.addRow([c.nombre]);
  }
  catSheet.getColumn(1).width = 40;

  const uniSheet = workbook.addWorksheet("Unidades válidas");
  uniSheet.addRow(["Abreviatura (columna Unidad)", "Nombre"]);
  uniSheet.getRow(1).font = { bold: true };
  for (const u of catalogo.unidades) {
    uniSheet.addRow([u.abreviatura, u.nombre]);
  }
  uniSheet.getColumn(1).width = 18;
  uniSheet.getColumn(2).width = 28;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function createProductosExportBuffer(
  productos: {
    codigoBarras: string;
    codigoArticulo: string | null;
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
      p.codigoArticulo ?? "",
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

  const sheet =
    workbook.getWorksheet("Productos") ?? workbook.worksheets[0];
  if (!sheet) {
    throw new Error("El archivo no contiene hojas de cálculo");
  }

  const rows: unknown[][] = [];
  sheet.eachRow((row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1));
  });

  if (rows.length === 0) {
    throw new Error("La hoja Productos está vacía");
  }

  const headers = rows[0];
  const dataRows = rows.slice(1).filter((row) =>
    row.some((cell) => cellToString(cell) !== "")
  );

  return { headers, rows: dataRows };
}
