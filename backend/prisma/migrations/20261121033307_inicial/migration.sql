-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'OPERADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('M1', 'M2');

-- CreateEnum
CREATE TYPE "Transportista" AS ENUM ('MRW', 'ZOOM');

-- CreateEnum
CREATE TYPE "TipoEnvio" AS ENUM ('ALERTA', 'CONSOLIDADO');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PREALERTADO', 'RECIBIDO_PARCIAL', 'RECIBIDO_COMPLETO', 'ARCHIVADO', 'POR_CONSOLIDAR', 'POR_PAGAR', 'POR_CONFIRMAR', 'PAGADO', 'DESPACHADO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoPaquete" AS ENUM ('ESPERADO', 'RECIBIDO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('BINANCE', 'PAGO_MOVIL', 'TRANSFERENCIA', 'MANUAL');

-- CreateEnum
CREATE TYPE "MonedaPago" AS ENUM ('USD', 'BS');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('POR_CONFIRMAR', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "FuenteTasa" AS ENUM ('API', 'MANUAL');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedulaCifrada" TEXT NOT NULL,
    "cedulaHuella" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "debeCambiarClave" BOOLEAN NOT NULL DEFAULT false,
    "sesionVersion" INTEGER NOT NULL DEFAULT 0,
    "perfilEntrega" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCuenta" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "actorId" TEXT,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "datos" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoCuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envio" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "tipo" "TipoEnvio" NOT NULL DEFAULT 'ALERTA',
    "clienteId" TEXT NOT NULL,
    "modalidad" "Modalidad" NOT NULL,
    "transportista" "Transportista" NOT NULL,
    "tienda" TEXT NOT NULL,
    "valorDeclaradoCentavos" INTEGER NOT NULL,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'PREALERTADO',
    "pesoTotalCentesimas" INTEGER,
    "pesoCobrableCentesimas" INTEGER,
    "fleteCentavos" INTEGER,
    "seguroCentavos" INTEGER,
    "seguroManualCentavos" INTEGER,
    "totalCentavos" INTEGER,
    "entregaNombreCifrado" TEXT,
    "entregaCedulaCifrada" TEXT,
    "entregaTelefonoCifrado" TEXT,
    "entregaAgencia" TEXT,
    "entregaCiudad" TEXT,
    "entregaEstado" TEXT,
    "guiaVenezolana" TEXT,
    "guiaFotoPath" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Envio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "id" TEXT NOT NULL,
    "envioId" TEXT NOT NULL,
    "trackingTexto" TEXT NOT NULL,
    "trackingNormalizado" TEXT NOT NULL,
    "estado" "EstadoPaquete" NOT NULL DEFAULT 'ESPERADO',
    "pesoCentesimas" INTEGER,
    "valorDeclaradoCentavos" INTEGER NOT NULL DEFAULT 0,
    "fotoPath" TEXT,
    "avisadoEn" TIMESTAMP(3),
    "avisadoPorId" TEXT,
    "recibidoPorId" TEXT,
    "recibidoEn" TIMESTAMP(3),

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaqueteHito" (
    "id" TEXT NOT NULL,
    "paqueteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaqueteHito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "envioId" TEXT NOT NULL,
    "montoUsdCentavos" INTEGER NOT NULL,
    "moneda" "MonedaPago" NOT NULL,
    "montoOriginalCentavos" INTEGER NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "referencia" TEXT,
    "comprobantePath" TEXT,
    "estado" "EstadoPago" NOT NULL DEFAULT 'POR_CONFIRMAR',
    "motivoRechazo" TEXT,
    "tasaBcv" DOUBLE PRECISION,
    "registradoPorId" TEXT NOT NULL,
    "confirmadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "envioId" TEXT NOT NULL,
    "actorId" TEXT,
    "tipo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "datos" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "TasaBcv" (
    "fecha" TEXT NOT NULL,
    "bolivaresPorUsd" DOUBLE PRECISION NOT NULL,
    "fuente" "FuenteTasa" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasaBcv_pkey" PRIMARY KEY ("fecha")
);

-- CreateTable
CREATE TABLE "IntentoAcceso" (
    "clave" TEXT NOT NULL,
    "cuenta" INTEGER NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntentoAcceso_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cedulaHuella_key" ON "Usuario"("cedulaHuella");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigo_key" ON "Usuario"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefono_key" ON "Usuario"("telefono");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "EventoCuenta_usuarioId_creadoEn_idx" ON "EventoCuenta"("usuarioId", "creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Envio_numero_key" ON "Envio"("numero");

-- CreateIndex
CREATE INDEX "Envio_clienteId_estado_idx" ON "Envio"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "Envio_estado_idx" ON "Envio"("estado");

-- CreateIndex
CREATE INDEX "Envio_creadoEn_idx" ON "Envio"("creadoEn");

-- CreateIndex
CREATE UNIQUE INDEX "Paquete_trackingNormalizado_key" ON "Paquete"("trackingNormalizado");

-- CreateIndex
CREATE INDEX "Paquete_envioId_idx" ON "Paquete"("envioId");

-- CreateIndex
CREATE INDEX "Paquete_fotoPath_idx" ON "Paquete"("fotoPath");

-- CreateIndex
CREATE INDEX "PaqueteHito_paqueteId_creadoEn_idx" ON "PaqueteHito"("paqueteId", "creadoEn");

-- CreateIndex
CREATE INDEX "Pago_envioId_estado_idx" ON "Pago"("envioId", "estado");

-- CreateIndex
CREATE INDEX "Evento_envioId_creadoEn_idx" ON "Evento"("envioId", "creadoEn");

-- AddForeignKey
ALTER TABLE "EventoCuenta" ADD CONSTRAINT "EventoCuenta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envio" ADD CONSTRAINT "Envio_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "Envio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaqueteHito" ADD CONSTRAINT "PaqueteHito_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "Envio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_envioId_fkey" FOREIGN KEY ("envioId") REFERENCES "Envio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
