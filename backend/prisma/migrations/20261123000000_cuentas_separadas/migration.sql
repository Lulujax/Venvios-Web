CREATE TYPE "Ambito" AS ENUM ('CLIENTE', 'PERSONAL');

ALTER TABLE "Usuario" ADD COLUMN "ambito" "Ambito" NOT NULL DEFAULT 'CLIENTE';

UPDATE "Usuario" SET "ambito" = 'PERSONAL' WHERE "rol" <> 'CLIENTE';

DROP INDEX "Usuario_cedulaHuella_key";
DROP INDEX "Usuario_email_key";
DROP INDEX "Usuario_telefono_key";

CREATE UNIQUE INDEX "Usuario_ambito_cedulaHuella_key" ON "Usuario"("ambito", "cedulaHuella");
CREATE UNIQUE INDEX "Usuario_ambito_email_key" ON "Usuario"("ambito", "email");
CREATE UNIQUE INDEX "Usuario_ambito_telefono_key" ON "Usuario"("ambito", "telefono");

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_ambito_coincide_con_rol"
  CHECK (
    ("ambito" = 'CLIENTE' AND "rol" = 'CLIENTE')
    OR ("ambito" = 'PERSONAL' AND "rol" IN ('OPERADOR', 'ADMIN'))
  );
