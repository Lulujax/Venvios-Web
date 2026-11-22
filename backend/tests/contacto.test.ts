import { describe, expect, it } from 'vitest';
import { crearEntorno, crearPersonalYEntrar } from './ayudas';

const REDES = {
  instagram: 'https://instagram.com/venviosexpress',
  facebook: 'https://facebook.com/venviosexpress',
  tiktok: 'https://tiktok.com/@venviosexpress',
};

describe('contacto público', () => {
  it('arranca con el correo genérico y la dirección de la oficina', async () => {
    const entorno = await crearEntorno();
    const info = await entorno.agente().get('/api/publico/info');
    expect(info.status).toBe(200);
    expect(info.body.contacto.correo).toBe('contacto@venviosexpress.com');
    expect(info.body.contacto.direccion).toContain('Cúcuta');
    expect(info.body.contacto.whatsapp).toBe('573237968740');
  });

  it('el administrador guarda el correo y el público lo ve', async () => {
    const entorno = await crearEntorno();
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    const respuesta = await admin.agente.put('/api/admin/config/contacto').send({
      valor: { ...actual, correo: 'atencion@venviosexpress.com' },
    });
    expect(respuesta.status).toBe(200);
    const info = await entorno.agente().get('/api/publico/info');
    expect(info.body.contacto.correo).toBe('atencion@venviosexpress.com');
  });

  it('acepta el correo vacío', async () => {
    const entorno = await crearEntorno();
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    const respuesta = await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, correo: '' } });
    expect(respuesta.status).toBe(200);
    const info = await entorno.agente().get('/api/publico/info');
    expect(info.body.contacto.correo).toBe('');
  });

  it('rechaza un correo mal formado', async () => {
    const entorno = await crearEntorno();
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    const respuesta = await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, correo: 'sin-arroba' } });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain('correo');
  });

  it('completa el correo cuando la configuración guardada es vieja', async () => {
    const entorno = await crearEntorno();
    await entorno.contexto.repos.config.guardar('contacto', {
      whatsapp: '573001234567',
      direccion: 'Oficina de pruebas',
      ...REDES,
    });
    const info = await entorno.agente().get('/api/publico/info');
    expect(info.body.contacto.whatsapp).toBe('573001234567');
    expect(info.body.contacto.correo).toBe('contacto@venviosexpress.com');
  });
});

describe('horario de atención (spec 003, RF-22 a RF-25)', () => {
  it('caso feliz: arranca con el horario oficial y el administrador lo cambia', async () => {
    const entorno = await crearEntorno();
    const inicial = await entorno.agente().get('/api/publico/info');
    expect(inicial.body.contacto.horario).toContain('Lunes a sábado, 8:00 am a 5:00 pm');
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    const respuesta = await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, horario: '  Lunes a viernes, 9:00 am a 4:00 pm  ' } });
    expect(respuesta.status).toBe(200);
    const info = await entorno.agente().get('/api/publico/info');
    expect(info.body.contacto.horario).toBe('Lunes a viernes, 9:00 am a 4:00 pm');
  });

  it('límite: acepta el horario vacío y 200 caracteres justos', async () => {
    const entorno = await crearEntorno();
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    expect((await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, horario: '' } })).status).toBe(200);
    expect((await entorno.agente().get('/api/publico/info')).body.contacto.horario).toBe('');
    expect((await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, horario: 'H'.repeat(200) } })).status).toBe(200);
  });

  it('límite: una configuración vieja sin horario usa el inicial en la página pública y en el panel', async () => {
    const entorno = await crearEntorno();
    await entorno.contexto.repos.config.guardar('contacto', { whatsapp: '573001234567', direccion: 'Oficina de pruebas', ...REDES });
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    expect((await entorno.agente().get('/api/publico/info')).body.contacto.horario).toContain('Domingos y feriados');
    const panel = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    expect(panel.horario).toContain('Domingos y feriados');
    expect(panel.correo).toBe('contacto@venviosexpress.com');
  });

  it('error: rechaza un horario de más de 200 caracteres con mensaje claro', async () => {
    const entorno = await crearEntorno();
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const actual = (await admin.agente.get('/api/admin/config/contacto')).body.valor;
    const respuesta = await admin.agente.put('/api/admin/config/contacto').send({ valor: { ...actual, horario: 'H'.repeat(201) } });
    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.mensaje).toContain('horario');
  });
});
