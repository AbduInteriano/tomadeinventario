import Link from "next/link";
import { notFound } from "next/navigation";
import { requireConteoRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { canViewAsignacion } from "@/lib/tomas";
import { AppHeader, EstadoBadge } from "@/components/AppHeader";
import { ConteoAreaClient } from "@/components/ConteoAreaClient";
import { canAccessSupervisor } from "@/lib/roles";
import { AsignacionEstado } from "@prisma/client";

export default async function ConteoAreaPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireConteoRole();

  const access = await canViewAsignacion(params.id, session.user.id, session.user.role);
  if ("error" in access) {
    notFound();
  }

  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
      usuario: { select: { nombre: true } },
      area: {
        select: {
          nombre: true,
          punto: { select: { nombre: true } },
        },
      },
    },
  });

  if (!asignacion) {
    notFound();
  }

  const esPropia = asignacion.usuarioId === session.user.id;
  const soloLectura = !esPropia || asignacion.estado === AsignacionEstado.COMPLETADA;

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
            unidadMedida: { select: { abreviatura: true } },
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

      <div className="mx-auto flex max-w-lg flex-wrap items-center gap-2 px-4 pt-2">
        <Link
          href="/tomador"
          className="text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver
        </Link>
        <EstadoBadge estado={asignacion.estado} />
        {!esPropia && canAccessSupervisor(session.user.role) && (
          <span className="text-xs text-slate-500">
            Asignada a {asignacion.usuario?.nombre ?? "sin usuario"}
          </span>
        )}
      </div>

      <ConteoAreaClient
        asignacionId={asignacion.id}
        areaNombre={asignacion.area.nombre}
        puntoNombre={asignacion.area.punto.nombre}
        estadoInicial={asignacion.estado}
        soloLectura={soloLectura}
        conteosIniciales={conteos.map((c) => ({
          id: c.id,
          codigoBarras: c.producto.codigoBarras,
          descripcion: c.producto.descripcion,
          unidadMedida: c.producto.unidadMedida.abreviatura,
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
