import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Reset operativo: conserva User y UnidadMedida.
 * Elimina tomas, conteos, productos, categorías, puntos y áreas.
 */
async function main() {
  const before = await Promise.all([
    prisma.conteoInventario.count(),
    prisma.productoNoCatalogado.count(),
    prisma.asignacionInventarioArea.count(),
    prisma.producto.count(),
    prisma.categoria.count(),
    prisma.area.count(),
    prisma.punto.count(),
    prisma.user.count(),
    prisma.unidadMedida.count(),
  ]);

  await prisma.$transaction([
    prisma.conteoInventario.deleteMany(),
    prisma.productoNoCatalogado.deleteMany(),
    prisma.asignacionInventarioArea.deleteMany(),
    prisma.producto.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.area.deleteMany(),
    prisma.punto.deleteMany(),
  ]);

  const [users, unidades] = await Promise.all([
    prisma.user.count(),
    prisma.unidadMedida.count(),
  ]);

  console.log("Base de datos reseteada.");
  console.log("");
  console.log("Eliminado:");
  console.log(`  Conteos:           ${before[0]}`);
  console.log(`  No catalogados:    ${before[1]}`);
  console.log(`  Tomas:             ${before[2]}`);
  console.log(`  Productos:         ${before[3]}`);
  console.log(`  Categorías:        ${before[4]}`);
  console.log(`  Áreas:             ${before[5]}`);
  console.log(`  Puntos:            ${before[6]}`);
  console.log("");
  console.log("Conservado:");
  console.log(`  Usuarios:          ${users}`);
  console.log(`  Unidades de medida: ${unidades}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
