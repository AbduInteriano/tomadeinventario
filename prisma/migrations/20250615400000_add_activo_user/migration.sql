-- AlterTable
ALTER TABLE "User" ADD COLUMN "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "User_activo_idx" ON "User"("activo");
