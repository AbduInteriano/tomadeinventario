import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [conteos, noCatalogados, asignaciones, inventarios] = await Promise.all([
    prisma.conteoInventario.count(),
    prisma.productoNoCatalogado.count(),
    prisma.asignacionInventarioArea.count(),
    prisma.inventario.count(),
  ]);

  await prisma.inventario.deleteMany({});

  const productos = await prisma.producto.count({ where: { activo: true } });

  console.log("Limpieza completada:");
  console.log(`  Inventarios eliminados: ${inventarios}`);
  console.log(`  Tomas/asignaciones eliminadas: ${asignaciones}`);
  console.log(`  Conteos eliminados: ${conteos}`);
  console.log(`  No catalogados eliminados: ${noCatalogados}`);
  console.log(`  Productos conservados: ${productos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
