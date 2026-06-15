-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERVISOR', 'TOMADOR');

-- CreateEnum
CREATE TYPE "InventarioEstado" AS ENUM ('ABIERTO', 'EN_PROCESO', 'CERRADO');

-- CreateEnum
CREATE TYPE "AsignacionEstado" AS ENUM ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TOMADOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Punto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Punto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "puntoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL,
    "codigoBarras" TEXT NOT NULL,
    "codigoInterno" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "categoria" TEXT,
    "stockGlobal" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventario" (
    "id" TEXT NOT NULL,
    "estado" "InventarioEstado" NOT NULL DEFAULT 'ABIERTO',
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionInventarioArea" (
    "id" TEXT NOT NULL,
    "inventarioId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "estado" "AsignacionEstado" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsignacionInventarioArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConteoInventario" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidadContada" DECIMAL(12,3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConteoInventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoNoCatalogado" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "codigoEscaneado" TEXT NOT NULL,
    "descripcionLibre" TEXT NOT NULL,
    "cantidad" DECIMAL(12,3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoNoCatalogado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Area_puntoId_idx" ON "Area"("puntoId");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigoBarras_key" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "Producto_codigoBarras_idx" ON "Producto"("codigoBarras");

-- CreateIndex
CREATE INDEX "AsignacionInventarioArea_usuarioId_idx" ON "AsignacionInventarioArea"("usuarioId");

-- CreateIndex
CREATE INDEX "AsignacionInventarioArea_inventarioId_idx" ON "AsignacionInventarioArea"("inventarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionInventarioArea_inventarioId_areaId_key" ON "AsignacionInventarioArea"("inventarioId", "areaId");

-- CreateIndex
CREATE INDEX "ConteoInventario_asignacionId_idx" ON "ConteoInventario"("asignacionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConteoInventario_asignacionId_productoId_key" ON "ConteoInventario"("asignacionId", "productoId");

-- CreateIndex
CREATE INDEX "ProductoNoCatalogado_asignacionId_idx" ON "ProductoNoCatalogado"("asignacionId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_puntoId_fkey" FOREIGN KEY ("puntoId") REFERENCES "Punto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventario" ADD CONSTRAINT "Inventario_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionInventarioArea" ADD CONSTRAINT "AsignacionInventarioArea_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "Inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionInventarioArea" ADD CONSTRAINT "AsignacionInventarioArea_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionInventarioArea" ADD CONSTRAINT "AsignacionInventarioArea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoInventario" ADD CONSTRAINT "ConteoInventario_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionInventarioArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoInventario" ADD CONSTRAINT "ConteoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConteoInventario" ADD CONSTRAINT "ConteoInventario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoNoCatalogado" ADD CONSTRAINT "ProductoNoCatalogado_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionInventarioArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoNoCatalogado" ADD CONSTRAINT "ProductoNoCatalogado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
