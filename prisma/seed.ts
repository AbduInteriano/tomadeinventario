import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PUNTOS_INICIALES = [
  "Almacén Central",
  "Punto Norte",
  "Punto Sur",
  "Punto Este",
  "Punto Oeste",
  "Bodega A",
  "Bodega B",
  "Depósito",
];

const PRODUCTOS_DEMO = [
  {
    codigoBarras: "7501234567890",
    codigoInterno: "PROD-001",
    descripcion: "Detergente líquido 1L",
    unidadMedida: "UN",
    categoria: "Limpieza",
  },
  {
    codigoBarras: "7501234567891",
    codigoInterno: "PROD-002",
    descripcion: "Papel higiénico paquete 4 rollos",
    unidadMedida: "PQ",
    categoria: "Papel",
  },
  {
    codigoBarras: "7501234567892",
    codigoInterno: "PROD-003",
    descripcion: "Guantes de nitrilo caja",
    unidadMedida: "CJ",
    categoria: "EPP",
  },
];

async function main() {
  const supervisorPassword = await bcrypt.hash("Admin123!", 12);
  const tomadorPassword = await bcrypt.hash("Tomador123!", 12);

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@inventario.com" },
    update: {},
    create: {
      email: "supervisor@inventario.com",
      password: supervisorPassword,
      nombre: "Supervisor Principal",
      role: Role.SUPERVISOR,
    },
  });

  const tomador = await prisma.user.upsert({
    where: { email: "tomador@inventario.com" },
    update: {},
    create: {
      email: "tomador@inventario.com",
      password: tomadorPassword,
      nombre: "Tomador Demo",
      role: Role.TOMADOR,
    },
  });

  for (const nombre of PUNTOS_INICIALES) {
    const exists = await prisma.punto.findFirst({ where: { nombre } });
    if (!exists) {
      await prisma.punto.create({ data: { nombre } });
    }
  }

  for (const producto of PRODUCTOS_DEMO) {
    await prisma.producto.upsert({
      where: { codigoBarras: producto.codigoBarras },
      update: {
        descripcion: producto.descripcion,
      },
      create: producto,
    });
  }

  console.log("Seed completado:");
  console.log("  Supervisor: supervisor@inventario.com / Admin123!");
  console.log("  Tomador:    tomador@inventario.com / Tomador123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
