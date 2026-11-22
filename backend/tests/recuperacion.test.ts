import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearEntorno, crearPersonalYEntrar, registrarCliente, type Entorno } from './ayudas';
import { CODIGO_DESARROLLO, CanalCodigoSupabase, type CanalCodigo } from '../src/services/CanalCodigo';
import { validarCodigoCorreo } from '../src/services/RecuperacionService';
import { sembrarCuentasDePersonal } from '../src/services/Semilla';

const entornoOriginal = { ...process.env };
const CLAVE_NUEVA = 'NuevaClave2026!';

afterEach(() => {
  process.env = { ...entornoOriginal };
});

class CanalEspia implements CanalCodigo {
  enviados: string[] = [];
  verificados: Array<{ email: string; codigo: string }> = [];
  fallaAlEnviar = false;
  codigoCorrecto = '654321';

  async enviarCodigo(email: string): Promise<void> {
    if (this.fallaAlEnviar) throw new Error('SMTP caído');
    this.enviados.push(email);
  }

  async verificarCodigo(email: string, codigo: string): Promise<boolean> {
    this.verificados.push({ email, codigo });
    const valido = this.enviados.includes(email) && codigo === this.codigoCorrecto;
    if (valido) this.enviados = this.enviados.filter((e) => e !== email);
    return valido;
  }
}

async function entornoConEspia(): Promise<{ entorno: Entorno; canal: CanalEspia }> {
  const canal = new CanalEspia();
  return { entorno: await crearEntorno({ canalCodigo: canal }), canal };
}

function pedir(entorno: Entorno, email: string) {
  return entorno.agente().post('/api/auth/olvide-clave').send({ email });
}

function restablecer(entorno: Entorno, email: string, codigo: string, nueva = CLAVE_NUEVA) {
  return entorno.agente().post('/api/auth/restablecer-clave').send({ email, codigo, nueva });
}

describe('pedir el código (RF-124)', () => {
  it('caso feliz: una cuenta existente recibe el código y la respuesta no dice nada más', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    const respuesta = await pedir(entorno, cliente.datos.email.toUpperCase());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ ok: true });
    expect(canal.enviados).toEqual([cliente.datos.email]);
  });

  it('error: un correo sin cuenta responde igual pero no envía ningún correo', async () => {
    const { entorno, canal } = await entornoConEspia();
    const respuesta = await pedir(entorno, 'nadie@correo.com');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ ok: true });
    expect(canal.enviados).toHaveLength(0);
  });

  it('error: una cuenta desactivada no recibe código y un correo mal escrito se rechaza', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    await admin.agente.patch(`/api/admin/usuarios/${cliente.usuario.id}`).send({ activo: false });
    expect((await pedir(entorno, cliente.datos.email)).status).toBe(200);
    expect(canal.enviados).toHaveLength(0);
    expect((await pedir(entorno, 'sin-arroba')).status).toBe(400);
  });

  it('límite: a la sexta petición seguida con el mismo correo se bloquea', async () => {
    const { entorno } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    for (let i = 0; i < 5; i += 1) expect((await pedir(entorno, cliente.datos.email)).status).toBe(200);
    expect((await pedir(entorno, cliente.datos.email)).status).toBe(429);
  });

  it('error: si el servicio de correo falla avisa con 503 y sin detalles técnicos', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    canal.fallaAlEnviar = true;
    const respuesta = await pedir(entorno, cliente.datos.email);
    expect(respuesta.status).toBe(503);
    expect(JSON.stringify(respuesta.body)).toContain('WhatsApp');
    expect(JSON.stringify(respuesta.body)).not.toContain('SMTP');
  });
});

describe('restablecer con el código (RF-125, RF-126, RF-127)', () => {
  it('caso feliz: con el código correcto cambia la clave, cierra la sesión abierta y deja el historial sin secretos', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    await pedir(entorno, cliente.datos.email);
    const respuesta = await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto);
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);

    expect((await cliente.agente.get('/api/auth/yo')).status, 'la sesión abierta debía cerrarse').toBe(401);
    const vieja = await entorno.agente().post('/api/auth/login').send({ identificador: cliente.datos.email, contrasena: cliente.datos.contrasena });
    expect(vieja.status).toBe(401);
    const nueva = await entorno.agente().post('/api/auth/login').send({ identificador: cliente.datos.email, contrasena: CLAVE_NUEVA });
    expect(nueva.status).toBe(200);
    expect(nueva.body.usuario.debeCambiarClave).toBe(false);

    const admin = await crearPersonalYEntrar(entorno, 'ADMIN');
    const historial = await admin.agente.get(`/api/admin/clientes/${cliente.usuario.id}/historial`);
    const evento = historial.body.eventos.find((e: { tipo: string }) => e.tipo === 'CLAVE_RESTABLECIDA');
    expect(evento, 'falta CLAVE_RESTABLECIDA en el historial').toBeDefined();
    expect(JSON.stringify(historial.body)).not.toContain(canal.codigoCorrecto);
    expect(JSON.stringify(historial.body)).not.toContain(CLAVE_NUEVA);
  });

  it('caso feliz: también funciona para el personal y limpia la marca de cambiar clave', async () => {
    const { entorno, canal } = await entornoConEspia();
    const operador = await crearPersonalYEntrar(entorno, 'OPERADOR');
    await pedir(entorno, operador.datos.email);
    expect((await restablecer(entorno, operador.datos.email, canal.codigoCorrecto)).status).toBe(200);
    const entrada = await entorno.agente().post('/api/auth/login').send({ identificador: operador.datos.email, contrasena: CLAVE_NUEVA });
    expect(entrada.status).toBe(200);
  });

  it('error: un código incorrecto se rechaza con mensaje claro y la clave sigue igual', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    await pedir(entorno, cliente.datos.email);
    const respuesta = await restablecer(entorno, cliente.datos.email, '000000');
    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(respuesta.body)).toMatch(/incorrecto o ya venció/);
    expect(canal.verificados).toHaveLength(1);
    const sigue = await entorno.agente().post('/api/auth/login').send({ identificador: cliente.datos.email, contrasena: cliente.datos.contrasena });
    expect(sigue.status).toBe(200);
  });

  it('límite: el código sirve una sola vez', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    await pedir(entorno, cliente.datos.email);
    expect((await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto)).status).toBe(200);
    expect((await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto, 'OtraClave2026!')).status).toBe(400);
  });

  it('error: un correo sin cuenta nunca llega a consultar a Supabase y recibe el mismo mensaje', async () => {
    const { entorno, canal } = await entornoConEspia();
    const respuesta = await restablecer(entorno, 'nadie@correo.com', '123456');
    expect(respuesta.status).toBe(400);
    expect(JSON.stringify(respuesta.body)).toMatch(/incorrecto o ya venció/);
    expect(canal.verificados).toHaveLength(0);
  });

  it('error: contraseña débil o código mal formado se rechazan sin gastar el código', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    await pedir(entorno, cliente.datos.email);
    expect((await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto, 'debil')).status).toBe(400);
    expect((await restablecer(entorno, cliente.datos.email, 'abc')).status).toBe(400);
    expect(canal.verificados).toHaveLength(0);
    expect((await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto)).status).toBe(200);
  });

  it('límite: tras 5 códigos malos seguidos se bloquea, incluso con el código bueno', async () => {
    const { entorno, canal } = await entornoConEspia();
    const cliente = await registrarCliente(entorno);
    await pedir(entorno, cliente.datos.email);
    for (let i = 0; i < 5; i += 1) expect((await restablecer(entorno, cliente.datos.email, '111111')).status).toBe(400);
    expect((await restablecer(entorno, cliente.datos.email, canal.codigoCorrecto)).status).toBe(429);
  });
});

describe('modo desarrollo sin Supabase (RF-128)', () => {
  it('caso feliz: el canal de memoria acepta el código fijo solo después de pedirlo', async () => {
    const entorno = await crearEntorno();
    const cliente = await registrarCliente(entorno);
    expect((await restablecer(entorno, cliente.datos.email, CODIGO_DESARROLLO)).status).toBe(400);
    await pedir(entorno, cliente.datos.email);
    expect((await restablecer(entorno, cliente.datos.email, CODIGO_DESARROLLO)).status).toBe(200);
  });
});

describe('validarCodigoCorreo', () => {
  it('caso feliz y límites: acepta 6 a 10 números con espacios', () => {
    expect(validarCodigoCorreo(' 123 456 ')).toBe('123456');
    expect(validarCodigoCorreo('1234567890')).toBe('1234567890');
  });

  it('error: rechaza letras, vacío, muy corto y tipos que no son texto', () => {
    for (const malo of ['abc123', '', '12345', '12345678901', null, 123456]) expect(() => validarCodigoCorreo(malo)).toThrow(/código de 6 números/);
  });
});

describe('CanalCodigoSupabase (RF-124, RF-128)', () => {
  function respuesta(estado: number, cuerpo: unknown = {}): Response {
    return new Response(JSON.stringify(cuerpo), { status: estado });
  }

  function canalCon(manejador: (url: string, cuerpo: Record<string, unknown>) => Response) {
    const llamadas: Array<{ url: string; cuerpo: Record<string, unknown>; cabeceras: Record<string, string> }> = [];
    const peticion = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const cuerpo = JSON.parse(String(init?.body)) as Record<string, unknown>;
      llamadas.push({ url: String(url), cuerpo, cabeceras: init?.headers as Record<string, string> });
      return manejador(String(url), cuerpo);
    });
    return { canal: new CanalCodigoSupabase('https://proyecto.supabase.co/', 'llave-servicio', peticion as unknown as typeof fetch), llamadas };
  }

  it('caso feliz: crea la cuenta de correo, pide el código de recuperación y manda la llave', async () => {
    const { canal, llamadas } = canalCon(() => respuesta(200));
    await canal.enviarCodigo('ana@correo.com');
    expect(llamadas.map((l) => l.url)).toEqual(['https://proyecto.supabase.co/auth/v1/admin/users', 'https://proyecto.supabase.co/auth/v1/recover']);
    expect(llamadas[0]?.cuerpo).toEqual({ email: 'ana@correo.com', email_confirm: true });
    expect(llamadas[1]?.cuerpo).toEqual({ email: 'ana@correo.com' });
    expect(llamadas[1]?.cabeceras.apikey).toBe('llave-servicio');
  });

  it('límite: si el correo ya existe en Supabase (422) sigue y pide el código', async () => {
    const { canal, llamadas } = canalCon((url) => (url.endsWith('/admin/users') ? respuesta(422, { error_code: 'email_exists' }) : respuesta(200)));
    await expect(canal.enviarCodigo('ana@correo.com')).resolves.toBeUndefined();
    expect(llamadas).toHaveLength(2);
  });

  it('error: si Supabase rechaza el envío del correo lanza error', async () => {
    const { canal } = canalCon((url) => (url.endsWith('/recover') ? respuesta(500, { error_code: 'unexpected_failure' }) : respuesta(200)));
    await expect(canal.enviarCodigo('ana@correo.com')).rejects.toThrow(/no pudo enviar/);
    const { canal: sinPermiso } = canalCon(() => respuesta(401, { error_code: 'bad_jwt' }));
    await expect(sinPermiso.enviarCodigo('ana@correo.com')).rejects.toThrow();
  });

  it('caso feliz y errores: verifica con tipo recovery; 403 es código malo; 500 y 429 no se confunden con código malo', async () => {
    const buena = canalCon(() => respuesta(200, { access_token: 'x' }));
    expect(await buena.canal.verificarCodigo('ana@correo.com', '123456')).toBe(true);
    expect(buena.llamadas[0]?.url).toBe('https://proyecto.supabase.co/auth/v1/verify');
    expect(buena.llamadas[0]?.cuerpo).toEqual({ type: 'recovery', email: 'ana@correo.com', token: '123456' });
    expect(await canalCon(() => respuesta(403, { error_code: 'otp_expired' })).canal.verificarCodigo('ana@correo.com', '1')).toBe(false);
    await expect(canalCon(() => respuesta(500)).canal.verificarCodigo('ana@correo.com', '123456')).rejects.toThrow(/No pudimos verificar/);
    await expect(canalCon(() => respuesta(429)).canal.verificarCodigo('ana@correo.com', '123456')).rejects.toThrow(/No pudimos verificar/);
  });

  it('error: sin llave o sin dirección de Supabase no arranca y no llama a nadie', async () => {
    expect(() => new CanalCodigoSupabase('', 'llave')).toThrow(/SUPABASE_URL/);
    const peticion = vi.fn();
    const sinLlave = new CanalCodigoSupabase('https://proyecto.supabase.co', '', peticion as unknown as typeof fetch);
    await expect(sinLlave.enviarCodigo('ana@correo.com')).rejects.toThrow(/SUPABASE_SERVICE_KEY/);
    expect(peticion).not.toHaveBeenCalled();
  });
});

describe('cuentas sembradas piden cambiar la clave (RF-18)', () => {
  it('caso feliz: por defecto el admin sembrado debe cambiar su clave al entrar', async () => {
    const entorno = await crearEntorno();
    process.env.ADMIN_PASSWORD = 'AdminPrueba2026!';
    delete process.env.OPERADOR_PASSWORD;
    await sembrarCuentasDePersonal(entorno.contexto);
    const [admin] = await entorno.contexto.repos.usuarios.listar(['ADMIN']);
    expect(admin?.debeCambiarClave).toBe(true);
  });

  it('límite: en desarrollo sin base de datos se puede sembrar sin pedir el cambio', async () => {
    const entorno = await crearEntorno();
    process.env.ADMIN_PASSWORD = 'AdminPrueba2026!';
    delete process.env.OPERADOR_PASSWORD;
    await sembrarCuentasDePersonal(entorno.contexto, { tolerante: true, pedirCambioDeClave: false });
    const [admin] = await entorno.contexto.repos.usuarios.listar(['ADMIN']);
    expect(admin?.debeCambiarClave).toBe(false);
  });
});
