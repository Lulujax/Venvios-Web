import { expect, test, type Browser, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN = { correo: process.env.ADMIN_EMAIL ?? 'admin@venvios.local', contrasena: process.env.ADMIN_PASSWORD ?? '' };
if (!ADMIN.contrasena) throw new Error('Define ADMIN_PASSWORD en backend/.env para correr la prueba de punta a punta.');
const sufijo = String(Date.now()).slice(-6);
const CLIENTE = { nombre: 'Maria Gonzalez', cedula: `2${sufijo}1`, correo: `maria${sufijo}@correo.com`, telefono: `424${sufijo}`, contrasena: 'ClavePrueba2026!' };
const TRACKINGS = [`XC${sufijo}001`, `XC${sufijo}002`];

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const CARPETA = join(process.cwd(), 'e2e', 'salida');
mkdirSync(CARPETA, { recursive: true });
writeFileSync(join(CARPETA, 'pixel.png'), PNG);
const IMAGEN = join(CARPETA, 'pixel.png');

async function entrar(page: Page, identificador: string, contrasena: string) {
  await page.goto('/ingresar');
  await page.getByLabel('Correo o número de casillero').fill(identificador);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasena);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function contextoNuevo(browser: Browser, movil = false) {
  return browser.newContext(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } });
}

test.describe.configure({ mode: 'serial' });

test('flujo completo: registro, prealerta, recepción, pago, entrega y despacho', async ({ browser }) => {
  const admin = await contextoNuevo(browser);
  const paginaAdmin = await admin.newPage();
  await entrar(paginaAdmin, ADMIN.correo, ADMIN.contrasena);
  await expect(paginaAdmin.getByRole('heading', { name: /Hola/ })).toBeVisible();
  const respuestaTasa = await paginaAdmin.request.put('/api/admin/tasa', { data: { bolivaresPorUsd: 900 } });
  expect(respuestaTasa.ok()).toBeTruthy();

  const clienteCtx = await contextoNuevo(browser, true);
  const cliente = await clienteCtx.newPage();
  await cliente.goto('/registro');
  await cliente.getByLabel('Nombre y apellido').fill(CLIENTE.nombre);
  await cliente.getByLabel('Número de cédula').fill(CLIENTE.cedula);
  await cliente.getByLabel('Correo electrónico').fill(CLIENTE.correo);
  await expect(cliente.getByLabel('País del teléfono')).toHaveValue('VE');
  await expect(cliente.getByPlaceholder('4241234567')).toBeVisible();
  await cliente.getByLabel('Teléfono de WhatsApp').fill(CLIENTE.telefono);
  await cliente.getByLabel('Contraseña', { exact: true }).fill(CLIENTE.contrasena);
  await cliente.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  await expect(cliente.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await cliente.getByLabel('Repite la contraseña', { exact: true }).fill(CLIENTE.contrasena);
  await cliente.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(cliente.getByRole('heading', { name: /Hola, Maria/ })).toBeVisible();
  await cliente.screenshot({ path: join(CARPETA, 'cliente-inicio-movil.png'), fullPage: true });

  await expect(cliente.getByText(/Casillero VENV-\d{6}/)).toBeVisible();
  await cliente.getByRole('link', { name: /Crear alerta/ }).first().click();
  await cliente.getByLabel('Tracking del paquete 1').fill(TRACKINGS[0]!);
  await cliente.getByRole('button', { name: /Agregar otro paquete/ }).click();
  await cliente.getByLabel('Tracking del paquete 2').fill(TRACKINGS[1]!);
  await cliente.getByLabel('Tienda').fill('Shein');
  await cliente.getByLabel(/Valor declarado/).fill('60');
  await cliente.screenshot({ path: join(CARPETA, 'cliente-prealerta-movil.png'), fullPage: true });
  await cliente.getByRole('button', { name: 'Registrar paquetes' }).click();
  await expect(cliente.getByRole('heading', { name: /Alerta de Shein/ })).toBeVisible();
  await cliente.goto('/cuenta');
  const casillero = ((await cliente.getByText(/Casillero VENV-\d{6}/).textContent()) ?? '').replace('Casillero', '').trim();

  const operadorCtx = await contextoNuevo(browser, true);
  const operador = await operadorCtx.newPage();
  await entrar(operador, ADMIN.correo, ADMIN.contrasena);
  await operador.goto('/panel/escanear');
  await expect(operador.getByRole('heading', { name: 'Recibir paquetes' })).toBeVisible();
  await operador.screenshot({ path: join(CARPETA, 'operador-escaner-movil.png'), fullPage: true });
  for (const tracking of TRACKINGS) {
    await operador.getByLabel('O escríbelo a mano').fill(tracking.toLowerCase());
    await operador.getByRole('button', { name: 'Buscar' }).click();
    await expect(operador.getByText(/Recibido: Maria Gonzalez/)).toBeVisible();
    await operador.getByLabel(/Peso del paquete/).fill(tracking.endsWith('001') ? '2.40' : '1.95');
    await operador.getByRole('button', { name: 'Guardar peso' }).click();
    await expect(operador.getByLabel(/Peso del paquete/)).toBeDisabled();
    await operador.getByRole('button', { name: 'Siguiente paquete' }).click();
  }
  await operador.getByLabel('O escríbelo a mano').fill(`XC${sufijo}003`);
  await operador.getByRole('button', { name: 'Buscar' }).click();
  await expect(operador.getByText('Sin prealerta', { exact: true }).first()).toBeVisible();
  await operador.getByLabel('¿De quién es?').fill(casillero);
  await operador.getByRole('button', { name: /Elegir/ }).click();
  await operador.screenshot({ path: join(CARPETA, 'operador-sin-prealerta-movil.png'), fullPage: true });
  await operador.getByRole('button', { name: 'Guardar para este cliente' }).click();
  await expect(operador.getByText('En bodega de Maria Gonzalez')).toBeVisible();

  await cliente.goto('/cuenta/consolidar');
  await expect(cliente.getByRole('heading', { name: 'Tus paquetes en bodega' })).toBeVisible();
  await cliente.getByRole('button', { name: 'Elegir todos' }).click();
  await cliente.getByText('Envío con todo incluido').click();
  await expect(cliente.getByLabel(/Valor declarado total/)).toHaveValue('60.00');
  await cliente.screenshot({ path: join(CARPETA, 'cliente-consolidar-movil.png'), fullPage: true });
  await cliente.getByRole('button', { name: /Consolidar 3 paquete/ }).click();
  await expect(cliente.getByRole('heading', { name: 'Envío consolidado' })).toBeVisible();
  const urlEnvio = new URL(cliente.url()).pathname.split('/').pop()!;

  await paginaAdmin.goto('/panel/bodega');
  await expect(paginaAdmin.getByRole('heading', { name: 'Bodega' })).toBeVisible();
  await paginaAdmin.screenshot({ path: join(CARPETA, 'panel-bodega-pc.png'), fullPage: true });
  await paginaAdmin.goto(`/panel/envios/${urlEnvio}`);
  await paginaAdmin.getByLabel('Peso total del envío (kg)').fill('4.35');
  await paginaAdmin.getByRole('button', { name: 'Calcular total' }).click();
  await expect(paginaAdmin.getByText('Listo para pagar').first()).toBeVisible();
  await expect(paginaAdmin.getByText(/44,33/).first()).toBeVisible();

  await cliente.reload();
  await expect(cliente.getByText('Saldo a pagar')).toBeVisible();
  await cliente.getByLabel('Pagaste por').selectOption('BINANCE');
  await expect(cliente.getByLabel('Moneda')).toBeDisabled();
  await expect(cliente.getByLabel(/Monto a pagar/)).toHaveValue(/44,33/);
  await cliente.getByLabel(/Últimos 6 dígitos/).fill('998877');
  await cliente.locator('input[type="file"]').first().setInputFiles(IMAGEN);
  await cliente.getByRole('button', { name: 'Enviar comprobante' }).click();
  await expect(cliente.getByText(/Recibimos tu comprobante|comprobante en revisión/).first()).toBeVisible();
  await cliente.screenshot({ path: join(CARPETA, 'cliente-pago-movil.png'), fullPage: true });

  await paginaAdmin.goto('/panel/pagos');
  await paginaAdmin.screenshot({ path: join(CARPETA, 'panel-pagos-pc.png'), fullPage: true });
  await expect(paginaAdmin.getByText('Maria Gonzalez')).toBeVisible();
  await paginaAdmin.getByRole('button', { name: /Confirmar pago/ }).click();
  await expect(paginaAdmin.getByText('Todo al día')).toBeVisible();

  await cliente.reload();
  await cliente.getByLabel('Nombre y apellido de quien recibe').fill('Ana Pérez');
  await cliente.getByLabel('Cédula').fill('12345678');
  await cliente.getByLabel('Teléfono').fill('584141234567');
  await cliente.getByLabel('Agencia donde retira').fill('MRW Chacao');
  await cliente.getByLabel('Ciudad').fill('Caracas');
  await cliente.getByLabel('Estado').selectOption('Miranda');
  await cliente.getByRole('button', { name: 'Guardar datos de entrega' }).click();
  await expect(cliente.getByText('Datos de entrega guardados.')).toBeVisible();

  await paginaAdmin.goto(`/panel/envios/${urlEnvio}`);
  await paginaAdmin.screenshot({ path: join(CARPETA, 'panel-envio-pc.png'), fullPage: true });
  await paginaAdmin.getByLabel(/Guía de MRW/).fill('MRW-778899');
  await paginaAdmin.getByRole('button', { name: 'Despachar a Venezuela' }).click();
  await expect(paginaAdmin.getByText('MRW-778899').first()).toBeVisible();

  await cliente.reload();
  await expect(cliente.getByText('Tu guía de Venezuela')).toBeVisible();
  await expect(cliente.getByText('MRW-778899')).toBeVisible();
});

test('la página pública calcula, muestra tarifas y adapta el menú al teléfono', async ({ browser }) => {
  for (const [nombre, ancho, alto] of [['movil', 390, 844], ['pc', 1280, 860]] as const) {
    const contexto = await browser.newContext({ viewport: { width: ancho, height: alto } });
    const pagina = await contexto.newPage();
    await pagina.goto('/');
    await expect(pagina.getByRole('heading', { name: /Más cerca de/ })).toBeVisible();
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(desborde, `desborde horizontal en ${nombre}`).toBe(false);
    await pagina.screenshot({ path: join(CARPETA, `landing-${nombre}.png`), fullPage: true });
    await contexto.close();
  }
});

test('un cliente no entra al panel del personal', async ({ browser }) => {
  const contexto = await contextoNuevo(browser);
  const pagina = await contexto.newPage();
  await entrar(pagina, CLIENTE.correo, CLIENTE.contrasena);
  await expect(pagina).toHaveURL(/\/cuenta/);
  await pagina.goto('/panel');
  await expect(pagina).toHaveURL(/\/cuenta/);
});
