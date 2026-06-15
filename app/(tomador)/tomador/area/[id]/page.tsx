import Link from "next/link";
import { notFound } from "next/navigation";
import { requireConteoRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { AppHeader, EstadoBadge } from "@/components/AppHeader";
import { ConteoAreaClient } from "@/components/ConteoAreaClient";

export default async function ConteoAreaPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireConteoRole();

  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
      area: {
        select: {
          nombre: true,
          punto: { select: { nombre: true } },
        },
      },
    },
  });

  if (!asignacion || asignacion.usuarioId !== session.user.id) {
    notFound();
  }

  const [conteos, noCatalogados] = await Promise.all([
    prisma.conteoInventario.findMany({
      where: { asignacionId: asignacion.id },
      select: {
        id: true,
        cantidadContada: true,
        producto: {
          select: {
            codigoBarras: true,
            descripcion: true,
            unidadMedida: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    }),
    prisma.productoNoCatalogado.findMany({
      where: { asignacionId: asignacion.id },
      select: {
        id: true,
        codigoEscaneado: true,
        descripcionLibre: true,
        cantidad: true,
      },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  return (
    <>
      <AppHeader
        title="Conteo"
        subtitle={`${asignacion.area.punto.nombre} · ${asignacion.area.nombre}`}
      />

      <div className="mx-auto flex max-w-lg items-center gap-2 px-4 pt-2">
        <Link
          href="/tomador"
          className="text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver
        </Link>
        <EstadoBadge estado={asignacion.estado} />
      </div>

      <ConteoAreaClient
        asignacionId={asignacion.id}
        areaNombre={asignacion.area.nombre}
        puntoNombre={asignacion.area.punto.nombre}
        estadoInicial={asignacion.estado}
        conteosIniciales={conteos.map((c) => ({
          id: c.id,
          codigoBarras: c.producto.codigoBarras,
          descripcion: c.producto.descripcion,
          unidadMedida: c.producto.unidadMedida,
          cantidadContada: decimalToNumber(c.cantidadContada),
        }))}
        noCatalogadosIniciales={noCatalogados.map((n) => ({
          id: n.id,
          codigoEscaneado: n.codigoEscaneado,
          descripcionLibre: n.descripcionLibre,
          cantidad: decimalToNumber(n.cantidad),
        }))}
      />
    </>
  );
}
