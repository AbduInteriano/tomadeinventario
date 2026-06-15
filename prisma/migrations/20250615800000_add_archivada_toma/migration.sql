-- AlterTable
ALTER TABLE "AsignacionInventarioArea" ADD COLUMN "archivada" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AsignacionInventarioArea_archivada_idx" ON "AsignacionInventarioArea"("archivada");
