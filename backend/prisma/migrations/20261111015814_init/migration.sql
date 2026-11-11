-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CLIENTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoPaquete" AS ENUM ('RECIBIDO', 'EN_BODEGA', 'EN_TRANSITO', 'EN_ADUANA', 'ENTREGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoPrealerta" AS ENUM ('PENDIENTE', 'RECIBIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CanalNotificacion" AS ENUM ('WHATSAPP', 'SISTEMA');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('PENDIENTE', 'ENVIADA', 'FALLIDA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'CLIENTE',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Casillero" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "direccion" TEXT NOT NULL DEFAULT 'Barrio Latino, Centro, Cúcuta, Colombia',
    "ciudad" TEXT NOT NULL DEFAULT 'Cúcuta',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Casillero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prealerta" (
    "id" TEXT NOT NULL,
    "tienda" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "trackingTienda" TEXT,
    "valorDeclarado" INTEGER,
    "estado" "EstadoPrealerta" NOT NULL DEFAULT 'PENDIENTE',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prealerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "id" TEXT NOT NULL,
    "guia" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "largoCm" DOUBLE PRECISION,
    "anchoCm" DOUBLE PRECISION,
    "altoCm" DOUBLE PRECISION,
    "pesoVolumetrico" DOUBLE PRECISION,
    "pesoCobrable" DOUBLE PRECISION NOT NULL,
    "precio" INTEGER NOT NULL,
    "estado" "EstadoPaquete" NOT NULL DEFAULT 'RECIBIDO',
    "fotoUrl" TEXT,
    "observaciones" TEXT,
    "userId" TEXT NOT NULL,
    "prealertaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoPaquete" (
    "id" TEXT NOT NULL,
    "paqueteId" TEXT NOT NULL,
    "estado" "EstadoPaquete" NOT NULL,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoPaquete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paqueteId" TEXT,
    "canal" "CanalNotificacion" NOT NULL DEFAULT 'WHATSAPP',
    "destinoEnmascarado" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'PENDIENTE',
    "proveedorId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarifa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pesoHasta" DOUBLE PRECISION NOT NULL,
    "precio" INTEGER NOT NULL,
    "precioKgExcedente" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_rol_idx" ON "User"("rol");

-- CreateIndex
CREATE UNIQUE INDEX "Casillero_codigo_key" ON "Casillero"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Casillero_userId_key" ON "Casillero"("userId");

-- CreateIndex
CREATE INDEX "Casillero_codigo_idx" ON "Casillero"("codigo");

-- CreateIndex
CREATE INDEX "Prealerta_userId_estado_idx" ON "Prealerta"("userId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Paquete_guia_key" ON "Paquete"("guia");

-- CreateIndex
CREATE UNIQUE INDEX "Paquete_prealertaId_key" ON "Paquete"("prealertaId");

-- CreateIndex
CREATE INDEX "Paquete_userId_estado_idx" ON "Paquete"("userId", "estado");

-- CreateIndex
CREATE INDEX "Paquete_guia_idx" ON "Paquete"("guia");

-- CreateIndex
CREATE INDEX "EventoPaquete_paqueteId_createdAt_idx" ON "EventoPaquete"("paqueteId", "createdAt");

-- CreateIndex
CREATE INDEX "Notificacion_userId_createdAt_idx" ON "Notificacion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Tarifa_activo_pesoHasta_idx" ON "Tarifa"("activo", "pesoHasta");

-- AddForeignKey
ALTER TABLE "Casillero" ADD CONSTRAINT "Casillero_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prealerta" ADD CONSTRAINT "Prealerta_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_prealertaId_fkey" FOREIGN KEY ("prealertaId") REFERENCES "Prealerta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoPaquete" ADD CONSTRAINT "EventoPaquete_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_paqueteId_fkey" FOREIGN KEY ("paqueteId") REFERENCES "Paquete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
