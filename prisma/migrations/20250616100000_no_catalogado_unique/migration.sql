-- Normalizar códigos escaneados
UPDATE "ProductoNoCatalogado"
SET "codigoEscaneado" = TRIM("codigoEscaneado")
WHERE "codigoEscaneado" <> TRIM("codigoEscaneado");

-- Fusionar duplicados por asignación + código (sumar cantidades)
UPDATE "ProductoNoCatalogado" AS p
SET "cantidad" = agg.total
FROM (
  SELECT "asignacionId", "codigoEscaneado",
         SUM("cantidad") AS total,
         MIN("id") AS keep_id
  FROM "ProductoNoCatalogado"
  GROUP BY "asignacionId", "codigoEscaneado"
  HAVING COUNT(*) > 1
) AS agg
WHERE p."id" = agg.keep_id;

DELETE FROM "ProductoNoCatalogado" AS p
USING (
  SELECT "asignacionId", "codigoEscaneado", MIN("id") AS keep_id
  FROM "ProductoNoCatalogado"
  GROUP BY "asignacionId", "codigoEscaneado"
  HAVING COUNT(*) > 1
) AS dup
WHERE p."asignacionId" = dup."asignacionId"
  AND p."codigoEscaneado" = dup."codigoEscaneado"
  AND p."id" <> dup.keep_id;

CREATE UNIQUE INDEX "ProductoNoCatalogado_asignacionId_codigoEscaneado_key"
ON "ProductoNoCatalogado" ("asignacionId", "codigoEscaneado");
