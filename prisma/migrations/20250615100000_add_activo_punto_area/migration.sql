-- AlterTable
ALTER TABLE "Punto" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Area" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Punto_activo_idx" ON "Punto"("activo");

-- CreateIndex
CREATE INDEX "Area_activo_idx" ON "Area"("activo");
