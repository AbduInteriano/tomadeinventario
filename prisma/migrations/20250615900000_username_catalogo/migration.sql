-- Usuario: email -> username
ALTER TABLE "User" RENAME COLUMN "email" TO "username";

UPDATE "User"
SET "username" = split_part("username", '@', 1)
WHERE "username" LIKE '%@%';

-- Catálogo: categorías y unidades de medida
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Categoria_nombre_key" ON "Categoria"("nombre");
CREATE INDEX "Categoria_activo_idx" ON "Categoria"("activo");

CREATE TABLE "UnidadMedida" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "abreviatura" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadMedida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnidadMedida_abreviatura_key" ON "UnidadMedida"("abreviatura");
CREATE INDEX "UnidadMedida_activo_idx" ON "UnidadMedida"("activo");

-- Unidades base
INSERT INTO "UnidadMedida" ("id", "nombre", "abreviatura", "activo", "updatedAt") VALUES
  ('unidad_un', 'Unidad', 'UN', true, CURRENT_TIMESTAMP),
  ('unidad_pq', 'Paquete', 'PQ', true, CURRENT_TIMESTAMP),
  ('unidad_cj', 'Caja', 'CJ', true, CURRENT_TIMESTAMP),
  ('unidad_kg', 'Kilogramo', 'KG', true, CURRENT_TIMESTAMP),
  ('unidad_lt', 'Litro', 'LT', true, CURRENT_TIMESTAMP),
  ('unidad_mt', 'Metro', 'MT', true, CURRENT_TIMESTAMP);

-- Migrar categorías existentes desde texto libre
INSERT INTO "Categoria" ("id", "nombre", "activo", "updatedAt")
SELECT
  'cat_' || md5(trim("categoria")),
  trim("categoria"),
  true,
  CURRENT_TIMESTAMP
FROM "Producto"
WHERE "categoria" IS NOT NULL AND trim("categoria") <> ''
GROUP BY trim("categoria")
ON CONFLICT ("nombre") DO NOTHING;

-- Nuevas columnas en Producto
ALTER TABLE "Producto" ADD COLUMN "categoriaId" TEXT;
ALTER TABLE "Producto" ADD COLUMN "unidadMedidaId" TEXT;

UPDATE "Producto" p
SET "unidadMedidaId" = u."id"
FROM "UnidadMedida" u
WHERE upper(trim(p."unidadMedida")) = u."abreviatura";

UPDATE "Producto"
SET "unidadMedidaId" = 'unidad_un'
WHERE "unidadMedidaId" IS NULL;

UPDATE "Producto" p
SET "categoriaId" = c."id"
FROM "Categoria" c
WHERE p."categoria" IS NOT NULL
  AND trim(p."categoria") <> ''
  AND c."nombre" = trim(p."categoria");

ALTER TABLE "Producto" ALTER COLUMN "unidadMedidaId" SET NOT NULL;

ALTER TABLE "Producto" DROP COLUMN "unidadMedida";
ALTER TABLE "Producto" DROP COLUMN "categoria";

DROP INDEX IF EXISTS "Producto_categoria_idx";

CREATE INDEX "Producto_categoriaId_idx" ON "Producto"("categoriaId");
CREATE INDEX "Producto_unidadMedidaId_idx" ON "Producto"("unidadMedidaId");

ALTER TABLE "Producto" ADD CONSTRAINT "Producto_categoriaId_fkey"
  FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Producto" ADD CONSTRAINT "Producto_unidadMedidaId_fkey"
  FOREIGN KEY ("unidadMedidaId") REFERENCES "UnidadMedida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
