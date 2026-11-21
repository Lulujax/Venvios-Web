UPDATE "Paquete" p
SET "valorDeclaradoCentavos" = e."valorDeclaradoCentavos" / c.total
FROM "Envio" e
JOIN (SELECT "envioId", COUNT(*) AS total FROM "Paquete" GROUP BY "envioId") c ON c."envioId" = e.id
WHERE p."envioId" = e.id
  AND e.tipo = 'ALERTA'
  AND p."valorDeclaradoCentavos" = 0
  AND e."valorDeclaradoCentavos" > 0;
