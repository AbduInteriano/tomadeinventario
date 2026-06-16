-- Permitir varias líneas del mismo producto/código por toma (un registro por escaneo)
DROP INDEX IF EXISTS "ConteoInventario_asignacionId_productoId_key";
DROP INDEX IF EXISTS "ProductoNoCatalogado_asignacionId_codigoEscaneado_key";

CREATE INDEX "ConteoInventario_asignacionId_timestamp_idx" ON "ConteoInventario"("asignacionId", "timestamp" DESC);
CREATE INDEX "ProductoNoCatalogado_asignacionId_timestamp_idx" ON "ProductoNoCatalogado"("asignacionId", "timestamp" DESC);
