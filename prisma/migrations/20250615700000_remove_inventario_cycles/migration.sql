-- DropForeignKey
ALTER TABLE "AsignacionInventarioArea" DROP CONSTRAINT IF EXISTS "AsignacionInventarioArea_inventarioId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "AsignacionInventarioArea_inventarioId_idx";
DROP INDEX IF EXISTS "AsignacionInventarioArea_inventarioId_areaId_key";

-- AlterTable: add fecha and creadoPorId
ALTER TABLE "AsignacionInventarioArea" ADD COLUMN IF NOT EXISTS "fecha" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "AsignacionInventarioArea" ADD COLUMN IF NOT EXISTS "creadoPorId" TEXT;

-- Backfill fecha from createdAt
UPDATE "AsignacionInventarioArea"
SET "fecha" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "fecha" IS NULL OR "fecha" = CURRENT_DATE;

-- Backfill creadoPorId from inventario or first supervisor
UPDATE "AsignacionInventarioArea" a
SET "creadoPorId" = i."creadoPorId"
FROM "Inventario" i
WHERE a."inventarioId" = i."id" AND a."creadoPorId" IS NULL;

UPDATE "AsignacionInventarioArea"
SET "creadoPorId" = (SELECT "id" FROM "User" WHERE "role" = 'SUPERVISOR' ORDER BY "createdAt" ASC LIMIT 1)
WHERE "creadoPorId" IS NULL;

-- Remove rows without assigned user
DELETE FROM "AsignacionInventarioArea" WHERE "usuarioId" IS NULL;

-- Drop inventarioId column
ALTER TABLE "AsignacionInventarioArea" DROP COLUMN IF EXISTS "inventarioId";

-- Make usuarioId required
ALTER TABLE "AsignacionInventarioArea" ALTER COLUMN "usuarioId" SET NOT NULL;
ALTER TABLE "AsignacionInventarioArea" ALTER COLUMN "creadoPorId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "AsignacionInventarioArea" ADD CONSTRAINT "AsignacionInventarioArea_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE IF EXISTS "Inventario";

-- DropEnum
DROP TYPE IF EXISTS "InventarioEstado";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AsignacionInventarioArea_fecha_idx" ON "AsignacionInventarioArea"("fecha");
CREATE INDEX IF NOT EXISTS "AsignacionInventarioArea_creadoPorId_idx" ON "AsignacionInventarioArea"("creadoPorId");
CREATE INDEX IF NOT EXISTS "AsignacionInventarioArea_estado_idx" ON "AsignacionInventarioArea"("estado");
CREATE INDEX IF NOT EXISTS "Producto_categoria_idx" ON "Producto"("categoria");
