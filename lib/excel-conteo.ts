import ExcelJS from "exceljs";
import { decimalToNumber } from "@/lib/inventario";

export async function createConteoExportBuffer(data: {
  meta: {
    punto: string;
    area: string;
    usuario: string;
    fecha: string;
    estado: string;
  };
  conteos: {
    codigoBarras: string;
    codigoInterno: string | null;
    descripcion: string;
    unidadMedida: string;
    cantidadContada: { toNumber(): number } | number;
  }[];
  noCatalogados: {
    codigoEscaneado: string;
    descripcionLibre: string;
    cantidad: { toNumber(): number } | number;
  }[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const info = workbook.addWorksheet("Información");
  const conteos = workbook.addWorksheet("Conteos");
  const noCat = workbook.addWorksheet("No catalogados");

  info.addRow(["Campo", "Valor"]);
  info.addRow(["Punto", data.meta.punto]);
  info.addRow(["Área", data.meta.area]);
  info.addRow(["Tomador", data.meta.usuario]);
  info.addRow(["Fecha", data.meta.fecha]);
  info.addRow(["Estado", data.meta.estado]);
  info.getRow(1).font = { bold: true };

  conteos.addRow([
    "Código de barras",
    "Código interno",
    "Descripción",
    "Unidad",
    "Cantidad contada",
  ]);
  conteos.getRow(1).font = { bold: true };

  for (const c of data.conteos) {
    conteos.addRow([
      c.codigoBarras,
      c.codigoInterno ?? "",
      c.descripcion,
      c.unidadMedida,
      decimalToNumber(c.cantidadContada),
    ]);
  }

  noCat.addRow(["Código escaneado", "Descripción", "Cantidad"]);
  noCat.getRow(1).font = { bold: true };

  for (const n of data.noCatalogados) {
    noCat.addRow([
      n.codigoEscaneado,
      n.descripcionLibre,
      decimalToNumber(n.cantidad),
    ]);
  }

  [info, conteos, noCat].forEach((sheet) => {
    sheet.columns.forEach((col) => {
      col.width = 22;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
