-- Renombrar código interno → código artículo
ALTER TABLE "Producto" RENAME COLUMN "codigoInterno" TO "codigoArticulo";

DROP INDEX IF EXISTS "Producto_codigoInterno_idx";
CREATE INDEX "Producto_codigoArticulo_idx" ON "Producto"("codigoArticulo");
