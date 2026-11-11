import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARIFAS = [
  { nombre: 'Caja pequeña o documento', pesoHasta: 2, precio: 32000, precioKgExcedente: null },
  { nombre: 'Caja mediana', pesoHasta: 5, precio: 48000, precioKgExcedente: null },
  { nombre: 'Caja grande', pesoHasta: 10, precio: 72000, precioKgExcedente: null },
  { nombre: 'Carga consolidada', pesoHasta: 20, precio: 118000, precioKgExcedente: null },
  {
    nombre: 'Carga pesada',
    pesoHasta: 30,
    precio: 168000,
    precioKgExcedente: 4800,
  },
];

const ARGON_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

function diasAtras(dias: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - dias);
  return date;
}

async function seedTarifas(): Promise<void> {
  for (const tarifa of TARIFAS) {
    const existente = await prisma.tarifa.findFirst({ where: { pesoHasta: tarifa.pesoHasta } });
    if (existente) {
      await prisma.tarifa.update({
        where: { id: existente.id },
        data: { ...tarifa, activo: true },
      });
    } else {
      await prisma.tarifa.create({ data: { ...tarifa, activo: true } });
    }
  }
  console.log(`Tarifas listas: ${TARIFAS.length} tramos.`);
}

async function seedAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@venviosexpress.com').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'VenviosAdmin2026!';
  const nombre = process.env.ADMIN_NOMBRE ?? 'Operaciones Venvios';
  const telefono = process.env.ADMIN_TELEFONO ?? '+573237968740';
  const passwordHash = await argon2.hash(password, ARGON_OPTIONS);

  await prisma.user.upsert({
    where: { email },
    update: { nombre, telefono, passwordHash, rol: 'ADMIN', activo: true },
    create: { nombre, email, telefono, passwordHash, rol: 'ADMIN' },
  });
  console.log('Administrador asegurado.');
}

async function seedDemo(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('Datos de demostración omitidos en producción.');
    return;
  }

  const email = 'cliente@venviosexpress.com';
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log('Cliente de demostración ya existe; se omite.');
    return;
  }

  const passwordHash = await argon2.hash('Cliente2026!', ARGON_OPTIONS);
  const cliente = await prisma.user.create({
    data: {
      nombre: 'María Fernanda Rangel',
      email,
      telefono: '+573125550184',
      passwordHash,
      rol: 'CLIENTE',
      casillero: { create: { codigo: 'VEX-CUC-4827' } },
    },
  });

  const prealertaPendiente = await prisma.prealerta.create({
    data: {
      tienda: 'Falabella Colombia',
      descripcion: 'Zapatos talla 38 y dos camisetas',
      trackingTienda: 'FLB-889231',
      valorDeclarado: 289000,
      userId: cliente.id,
    },
  });

  const prealertaRecibida = await prisma.prealerta.create({
    data: {
      tienda: 'Decathlon Colombia',
      descripcion: 'Caja con calzado deportivo',
      trackingTienda: 'DEC-441908',
      valorDeclarado: 410000,
      estado: 'RECIBIDA',
      userId: cliente.id,
    },
  });

  const paqueteTransito = await prisma.paquete.create({
    data: {
      guia: 'VEX-2026-04217',
      descripcion: 'Caja Decathlon · calzado deportivo',
      pesoKg: 4.6,
      largoCm: 40,
      anchoCm: 30,
      altoCm: 25,
      pesoVolumetrico: 6,
      pesoCobrable: 6,
      precio: 72000,
      estado: 'EN_TRANSITO',
      userId: cliente.id,
      prealertaId: prealertaRecibida.id,
      createdAt: diasAtras(6),
      eventos: {
        create: [
          {
            estado: 'RECIBIDO',
            nota: 'Recibido y pesado en Barrio Latino.',
            createdAt: diasAtras(6),
          },
          {
            estado: 'EN_BODEGA',
            nota: 'Empacado para despacho. Pago confirmado.',
            createdAt: diasAtras(4),
          },
          {
            estado: 'EN_TRANSITO',
            nota: 'Despachado desde Cúcuta hacia San Cristóbal.',
            createdAt: diasAtras(2),
          },
        ],
      },
    },
  });

  await prisma.paquete.create({
    data: {
      guia: 'VEX-2026-04108',
      descripcion: 'Documentos notariales',
      pesoKg: 0.4,
      pesoCobrable: 0.4,
      precio: 32000,
      estado: 'ENTREGADO',
      userId: cliente.id,
      createdAt: diasAtras(14),
      eventos: {
        create: [
          { estado: 'RECIBIDO', nota: 'Documentos verificados.', createdAt: diasAtras(14) },
          { estado: 'EN_BODEGA', nota: 'Listo para despacho.', createdAt: diasAtras(13) },
          { estado: 'EN_TRANSITO', nota: 'En ruta a Venezuela.', createdAt: diasAtras(12) },
          { estado: 'ENTREGADO', nota: 'Entregado en San Cristóbal.', createdAt: diasAtras(9) },
        ],
      },
    },
  });

  await prisma.paquete.create({
    data: {
      guia: 'VEX-2026-04302',
      descripcion: 'Repuestos de moto en dos cajas',
      pesoKg: 12.4,
      largoCm: 55,
      anchoCm: 40,
      altoCm: 35,
      pesoVolumetrico: 15.4,
      pesoCobrable: 15.4,
      precio: 118000,
      estado: 'RECIBIDO',
      observaciones: 'Cliente avisó que llega sin prealerta.',
      userId: cliente.id,
      createdAt: diasAtras(1),
      eventos: {
        create: [
          {
            estado: 'RECIBIDO',
            nota: 'Recibido en sede. Pendiente confirmación de pago.',
            createdAt: diasAtras(1),
          },
        ],
      },
    },
  });

  await prisma.notificacion.createMany({
    data: [
      {
        userId: cliente.id,
        paqueteId: paqueteTransito.id,
        destinoEnmascarado: '+57******0184',
        mensaje: 'Venvios Express: recibimos tu paquete VEX-2026-04217. Peso cobrable 6 kg. Costo $72.000 COP.',
        estado: 'ENVIADA',
        createdAt: diasAtras(6),
      },
      {
        userId: cliente.id,
        paqueteId: paqueteTransito.id,
        destinoEnmascarado: '+57******0184',
        mensaje: 'Tu paquete VEX-2026-04217 salió de Cúcuta hacia Venezuela.',
        estado: 'ENVIADA',
        createdAt: diasAtras(2),
      },
      {
        userId: cliente.id,
        paqueteId: null,
        destinoEnmascarado: '+57******0184',
        mensaje: `Prealerta de ${prealertaPendiente.tienda} registrada. Te avisaremos cuando llegue a Cúcuta.`,
        estado: 'ENVIADA',
        createdAt: diasAtras(1),
      },
    ],
  });

  console.log('Cliente de demostración creado (solo entorno local).');
}

async function main(): Promise<void> {
  await seedTarifas();
  await seedAdmin();
  await seedDemo();
}

main()
  .catch((error) => {
    console.error('Error ejecutando el seed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
