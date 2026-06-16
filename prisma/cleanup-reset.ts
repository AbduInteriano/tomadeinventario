import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Reset para producción: conserva User y Punto.
 * Elimina inventarios, productos, categorías, unidades, áreas y todo el historial.
 */
async function main() {
  const before = await Promise.all([
    prisma.conteoInventario.count(),
    prisma.productoNoCatalogado.count(),
    prisma.asignacionInventarioArea.count(),
    prisma.producto.count(),
    prisma.categoria.count(),
    prisma.unidadMedida.count(),
    prisma.area.count(),
    prisma.punto.count(),
    prisma.user.count(),
  ]);

  await prisma.$transaction([
    prisma.conteoInventario.deleteMany(),
    prisma.productoNoCatalogado.deleteMany(),
    prisma.asignacionInventarioArea.deleteMany(),
    prisma.producto.deleteMany(),
    prisma.categoria.deleteMany(),
    prisma.unidadMedida.deleteMany(),
    prisma.area.deleteMany(),
  ]);

  const [users, puntos] = await Promise.all([
    prisma.user.count(),
    prisma.punto.count(),
  ]);

  console.log("Base de datos lista para producción.");
  console.log("");
  console.log("Eliminado:");
  console.log(`  Conteos:            ${before[0]}`);
  console.log(`  No catalogados:     ${before[1]}`);
  console.log(`  Tomas / historial:  ${before[2]}`);
  console.log(`  Productos:          ${before[3]}`);
  console.log(`  Categorías:         ${before[4]}`);
  console.log(`  Unidades de medida: ${before[5]}`);
  console.log(`  Áreas:              ${before[6]}`);
  console.log("");
  console.log("Conservado:");
  console.log(`  Usuarios:           ${users}`);
  console.log(`  Puntos:             ${puntos}`);
  console.log("");
  console.log("Siguiente: crear áreas en cada punto, unidades/categorías en catálogo, e importar productos.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
