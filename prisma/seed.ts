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

const UNIDADES_INICIALES = [
  { nombre: "Unidad", abreviatura: "UN" },
  { nombre: "Paquete", abreviatura: "PQ" },
  { nombre: "Caja", abreviatura: "CJ" },
  { nombre: "Kilogramo", abreviatura: "KG" },
  { nombre: "Litro", abreviatura: "LT" },
  { nombre: "Metro", abreviatura: "MT" },
];

const CATEGORIAS_INICIALES = ["Limpieza", "Papel", "EPP"];

const PRODUCTOS_DEMO = [
  {
    codigoBarras: "7501234567890",
    codigoInterno: "PROD-001",
    descripcion: "Detergente líquido 1L",
    unidad: "UN",
    categoria: "Limpieza",
  },
  {
    codigoBarras: "7501234567891",
    codigoInterno: "PROD-002",
    descripcion: "Papel higiénico paquete 4 rollos",
    unidad: "PQ",
    categoria: "Papel",
  },
  {
    codigoBarras: "7501234567892",
    codigoInterno: "PROD-003",
    descripcion: "Guantes de nitrilo caja",
    unidad: "CJ",
    categoria: "EPP",
  },
];

async function main() {
  const adminPassword = await bcrypt.hash("AdminTech123!", 12);
  const supervisorPassword = await bcrypt.hash("Admin123!", 12);
  const tomadorPassword = await bcrypt.hash("Tomador123!", 12);

  await prisma.user.upsert({
    where: { username: "admin.tech" },
    update: {},
    create: {
      username: "admin.tech",
      password: adminPassword,
      nombre: "admin.tech",
      role: Role.ADMIN_TECNOLOGIA,
    },
  });

  await prisma.user.upsert({
    where: { username: "supervisor" },
    update: {},
    create: {
      username: "supervisor",
      password: supervisorPassword,
      nombre: "Supervisor Principal",
      role: Role.SUPERVISOR,
    },
  });

  await prisma.user.upsert({
    where: { username: "tomador" },
    update: {},
    create: {
      username: "tomador",
      password: tomadorPassword,
      nombre: "Tomador Demo",
      role: Role.TOMADOR,
    },
  });

  for (const u of UNIDADES_INICIALES) {
    await prisma.unidadMedida.upsert({
      where: { abreviatura: u.abreviatura },
      update: { nombre: u.nombre, activo: true },
      create: u,
    });
  }

  for (const nombre of CATEGORIAS_INICIALES) {
    await prisma.categoria.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre },
    });
  }

  for (const nombre of PUNTOS_INICIALES) {
    const exists = await prisma.punto.findFirst({ where: { nombre } });
    if (!exists) {
      await prisma.punto.create({ data: { nombre } });
    }
  }

  for (const producto of PRODUCTOS_DEMO) {
    const unidad = await prisma.unidadMedida.findUnique({
      where: { abreviatura: producto.unidad },
    });
    const categoria = await prisma.categoria.findUnique({
      where: { nombre: producto.categoria },
    });

    await prisma.producto.upsert({
      where: { codigoBarras: producto.codigoBarras },
      update: {
        descripcion: producto.descripcion,
        unidadMedidaId: unidad!.id,
        categoriaId: categoria!.id,
      },
      create: {
        codigoBarras: producto.codigoBarras,
        codigoInterno: producto.codigoInterno,
        descripcion: producto.descripcion,
        unidadMedidaId: unidad!.id,
        categoriaId: categoria!.id,
      },
    });
  }

  console.log("Seed completado:");
  console.log("  Admin tecnología: admin.tech / AdminTech123!");
  console.log("  Supervisor:       supervisor / Admin123!");
  console.log("  Tomador:          tomador / Tomador123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
