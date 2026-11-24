UPDATE "Usuario"
SET "codigo" = 'TMP-' || "id"
WHERE "ambito" = 'CLIENTE' AND "codigo" <> 'VENV-000000';

WITH disponibles AS (
  SELECT n, ROW_NUMBER() OVER (ORDER BY n) AS posicion
  FROM generate_series(1, (SELECT COUNT(*) FROM "Usuario") + 1) AS n
  WHERE 'VENV-' || LPAD(n::text, 6, '0') NOT IN (
    SELECT "codigo" FROM "Usuario" WHERE "ambito" = 'PERSONAL' OR "codigo" = 'VENV-000000'
  )
),
clientes AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "creadoEn", "id") AS posicion
  FROM "Usuario"
  WHERE "ambito" = 'CLIENTE' AND "codigo" LIKE 'TMP-%'
)
UPDATE "Usuario" AS u
SET "codigo" = 'VENV-' || LPAD(d.n::text, 6, '0')
FROM clientes AS c
JOIN disponibles AS d ON d.posicion = c.posicion
WHERE u."id" = c."id";
