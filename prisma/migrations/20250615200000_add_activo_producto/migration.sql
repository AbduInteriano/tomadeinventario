-- AlterTable
ALTER TABLE "Producto" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Producto_activo_idx" ON "Producto"("activo");
