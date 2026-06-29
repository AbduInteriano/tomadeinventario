-- Ejecutar en Supabase → SQL Editor (una sola vez)
-- 1) Columnas de comentario (si aún no existen)

ALTER TABLE "ConteoInventario"
  ADD COLUMN IF NOT EXISTS "comentario" TEXT;

ALTER TABLE "ProductoNoCatalogado"
  ADD COLUMN IF NOT EXISTS "comentario" TEXT;

-- 2) Quitar ceros a la izquierda en códigos puramente numéricos

UPDATE "Producto"
SET "codigoBarras" = CASE
  WHEN ltrim("codigoBarras", '0') = '' THEN '0'
  ELSE ltrim("codigoBarras", '0')
END
WHERE "codigoBarras" ~ '^[0-9]+$'
  AND "codigoBarras" ~ '^0';

UPDATE "Producto"
SET "codigoArticulo" = CASE
  WHEN ltrim("codigoArticulo", '0') = '' THEN '0'
  ELSE ltrim("codigoArticulo", '0')
END
WHERE "codigoArticulo" IS NOT NULL
  AND "codigoArticulo" ~ '^[0-9]+$'
  AND "codigoArticulo" ~ '^0';

UPDATE "ProductoNoCatalogado"
SET "codigoEscaneado" = CASE
  WHEN ltrim("codigoEscaneado", '0') = '' THEN '0'
  ELSE ltrim("codigoEscaneado", '0')
END
WHERE "codigoEscaneado" ~ '^[0-9]+$'
  AND "codigoEscaneado" ~ '^0';

-- Nota: si hay productos duplicados tras normalizar (ej. "00001" y "1"),
-- ejecuta en tu PC: npm run db:normalize-codigos
-- Ese script fusiona duplicados y reasigna conteos automáticamente.
