ALTER TABLE "Paquete" ADD COLUMN "prealertaOrigenId" TEXT;

CREATE INDEX "Paquete_prealertaOrigenId_idx" ON "Paquete"("prealertaOrigenId");

ALTER TABLE "Paquete"
  ADD CONSTRAINT "Paquete_prealertaOrigenId_fkey"
  FOREIGN KEY ("prealertaOrigenId") REFERENCES "Envio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Paquete" AS p
SET "prealertaOrigenId" = e."id"
FROM "Envio" AS e
WHERE p."envioId" = e."id"
  AND e."tipo" = 'ALERTA'
  AND e."estado" <> 'CANCELADO'
  AND e."tienda" NOT IN ('Sin prealerta', 'Devuelto a bodega');
