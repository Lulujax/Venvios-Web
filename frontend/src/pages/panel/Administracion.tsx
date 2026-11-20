import { useEffect, useState, type FormEvent } from 'react';
import { Alerta, Campo, CampoTelefono, Cargando, ErrorCarga, RequisitosContrasenaLista, Seccion, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero } from '../../lib/formato';
import type { Contacto, DatosPago, Tarifas, TransportistaPublico, Usuario } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { PAIS_PREDETERMINADO, componerTelefono, validarTelefonoLocal } from '../../lib/telefono';
import { validarCedula, validarContrasena, validarEmail, validarNombre } from '../../lib/validar';

type Pestana = 'usuarios' | 'tarifas' | 'pagos' | 'mensajes' | 'transporte' | 'tasa';

const PESTANAS: Array<{ id: Pestana; texto: string }> = [
  { id: 'usuarios', texto: 'Usuarios' },
  { id: 'tarifas', texto: 'Tarifas' },
  { id: 'pagos', texto: 'Datos de pago' },
  { id: 'mensajes', texto: 'Mensajes' },
  { id: 'transporte', texto: 'Contacto y rastreo' },
  { id: 'tasa', texto: 'Tasa BCV' },
];

function useConfigClave<T>(clave: string) {
  const carga = useCarga(() => api.get<{ valor: T }>(`/admin/config/${clave}`).then((r) => r.valor), [clave]);
  const avisar = useAviso();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(valor: T) {
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/config/${clave}`, { valor });
      carga.setDatos(valor);
      avisar('Cambios guardados.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }
  return { ...carga, guardar, guardando, errorGuardar: error };
}

function Usuarios() {
  const avisar = useAviso();
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ usuarios: Usuario[] }>('/admin/usuarios').then((r) => r.usuarios));
  const [nuevo, setNuevo] = useState({ nombre: '', cedula: '', email: '', pais: PAIS_PREDETERMINADO, telefono: '', contrasena: '', rol: 'OPERADOR' });
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    const fallos = { nombre: validarNombre(nuevo.nombre) ?? undefined, cedula: validarCedula(nuevo.cedula) ?? undefined, email: validarEmail(nuevo.email) ?? undefined, telefono: validarTelefonoLocal(nuevo.pais, nuevo.telefono) ?? undefined, contrasena: validarContrasena(nuevo.contrasena) ?? undefined };
    setErrores(fallos);
    if (Object.values(fallos).some(Boolean)) return;
    setCreando(true);
    setErrorForm(null);
    try {
      await api.post('/admin/usuarios', { nombre: nuevo.nombre, cedula: nuevo.cedula, email: nuevo.email.trim(), telefono: componerTelefono(nuevo.pais, nuevo.telefono), contrasena: nuevo.contrasena, rol: nuevo.rol });
      setNuevo({ nombre: '', cedula: '', email: '', pais: PAIS_PREDETERMINADO, telefono: '', contrasena: '', rol: 'OPERADOR' });
      await recargar();
      avisar('Usuario creado. Deberá cambiar su contraseña al entrar.');
    } catch (falla) {
      setErrorForm(mensajeDeError(falla));
    } finally {
      setCreando(false);
    }
  }

  async function alternar(usuario: Usuario) {
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, { activo: !usuario.activo });
      await recargar();
    } catch (falla) {
      avisar(mensajeDeError(falla), 'error');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Seccion titulo="Personal">
        {cargando && <Cargando lineas={2} />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        <ul className="space-y-2">
          {datos?.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 rounded-2xl border border-linea px-4 py-3 text-sm">
              <div className="min-w-0"><p className="truncate font-bold">{u.nombre}</p><p className="text-suave">{u.rol === 'ADMIN' ? 'Administrador' : 'Operador'} · {u.email}</p></div>
              <button type="button" className={`btn btn-chico ${u.activo ? 'btn-suave' : 'btn-primario'}`} onClick={() => void alternar(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
            </li>
          ))}
        </ul>
      </Seccion>
      <Seccion titulo="Crear usuario del personal">
        <form onSubmit={crear} className="space-y-4" noValidate>
          <Campo etiqueta="Nombre y apellido" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} error={errores.nombre} />
          <Campo etiqueta="Cédula" inputMode="numeric" value={nuevo.cedula} onChange={(e) => setNuevo({ ...nuevo, cedula: e.target.value })} error={errores.cedula} />
          <Campo etiqueta="Correo electrónico" type="email" autoCapitalize="none" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} error={errores.email} />
          <CampoTelefono etiqueta="Teléfono de WhatsApp" pais={nuevo.pais} numero={nuevo.telefono} alCambiarPais={(pais) => setNuevo({ ...nuevo, pais })} alCambiarNumero={(telefono) => setNuevo({ ...nuevo, telefono })} error={errores.telefono} />
          <div>
            <Campo etiqueta="Contraseña temporal" type="text" value={nuevo.contrasena} onChange={(e) => setNuevo({ ...nuevo, contrasena: e.target.value })} error={errores.contrasena} ayuda="La persona la cambiará al entrar." />
            <RequisitosContrasenaLista contrasena={nuevo.contrasena} />
          </div>
          <div>
            <label htmlFor="rol-nuevo" className="etiqueta">Rol</label>
            <select id="rol-nuevo" className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}>
              <option value="OPERADOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          {errorForm && <Alerta tono="error">{errorForm}</Alerta>}
          <button type="submit" className="btn btn-primario" disabled={creando}>{creando ? 'Creando…' : 'Crear usuario'}</button>
        </form>
      </Seccion>
    </div>
  );
}

function EditorTarifas() {
  const { datos, cargando, error, guardar, guardando, errorGuardar } = useConfigClave<Tarifas>('tarifas');
  const [borrador, setBorrador] = useState<{ tramos: Array<{ desde: string; precio: string }>; m1Seguro: string; m1Minimo: string; m2Precio: string; m2Seguro: string; m2Minimo: string } | null>(null);

  useEffect(() => {
    if (!datos) return;
    setBorrador({
      tramos: datos.m1Tramos.map((t) => ({ desde: String(t.desdeKg), precio: (t.precioPorKgCentavos / 100).toFixed(2) })),
      m1Seguro: String(datos.m1SeguroPorcentaje),
      m1Minimo: String(datos.m1PesoMinimoKg),
      m2Precio: (datos.m2PrecioPorKgCentavos / 100).toFixed(2),
      m2Seguro: String(datos.m2SeguroPorcentaje),
      m2Minimo: String(datos.m2PesoMinimoKg),
    });
  }, [datos]);

  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} />;
  if (!borrador) return null;

  const cambiarTramo = (indice: number, campo: 'desde' | 'precio', valor: string) => setBorrador({ ...borrador, tramos: borrador.tramos.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) });

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!borrador) return;
    void guardar({
      m1Tramos: borrador.tramos.map((t) => ({ desdeKg: aNumero(t.desde), precioPorKgCentavos: Math.round(aNumero(t.precio) * 100) })),
      m1SeguroPorcentaje: aNumero(borrador.m1Seguro),
      m1PesoMinimoKg: aNumero(borrador.m1Minimo),
      m2PrecioPorKgCentavos: Math.round(aNumero(borrador.m2Precio) * 100),
      m2SeguroPorcentaje: aNumero(borrador.m2Seguro),
      m2PesoMinimoKg: aNumero(borrador.m2Minimo),
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-6 lg:grid-cols-2" noValidate>
      <Seccion titulo="Todo incluido (modalidad 1)">
        <div className="space-y-3">
          {borrador.tramos.map((tramo, indice) => (
            <div key={indice} className="grid grid-cols-2 gap-3">
              <Campo etiqueta={`Desde (kg) · tramo ${indice + 1}`} inputMode="decimal" value={tramo.desde} onChange={(e) => cambiarTramo(indice, 'desde', e.target.value)} />
              <Campo etiqueta="Precio por kg ($)" inputMode="decimal" value={tramo.precio} onChange={(e) => cambiarTramo(indice, 'precio', e.target.value)} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Seguro (%)" inputMode="decimal" value={borrador.m1Seguro} onChange={(e) => setBorrador({ ...borrador, m1Seguro: e.target.value })} />
            <Campo etiqueta="Peso mínimo (kg)" inputMode="decimal" value={borrador.m1Minimo} onChange={(e) => setBorrador({ ...borrador, m1Minimo: e.target.value })} />
          </div>
        </div>
      </Seccion>
      <Seccion titulo="Cobro a destino (modalidad 2)">
        <div className="space-y-3">
          <Campo etiqueta="Precio por kg ($)" inputMode="decimal" value={borrador.m2Precio} onChange={(e) => setBorrador({ ...borrador, m2Precio: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Seguro (%)" inputMode="decimal" value={borrador.m2Seguro} onChange={(e) => setBorrador({ ...borrador, m2Seguro: e.target.value })} />
            <Campo etiqueta="Peso mínimo (kg)" inputMode="decimal" value={borrador.m2Minimo} onChange={(e) => setBorrador({ ...borrador, m2Minimo: e.target.value })} />
          </div>
        </div>
      </Seccion>
      <div className="lg:col-span-2">
        {errorGuardar && <Alerta tono="error" className="mb-3">{errorGuardar}</Alerta>}
        <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar tarifas'}</button>
        <p className="ayuda">Los cambios aplican a los cálculos nuevos. Los envíos ya calculados se recalculan al cambiar su peso o modalidad.</p>
      </div>
    </form>
  );
}

function EditorDatosPago() {
  const { datos, cargando, error, guardar, guardando, errorGuardar } = useConfigClave<DatosPago>('datosPago');
  const [d, setD] = useState<DatosPago | null>(null);
  useEffect(() => { if (datos) setD(structuredClone(datos)); }, [datos]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} />;
  if (!d) return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); void guardar(d); }} className="space-y-6" noValidate>
      <label className="flex items-center gap-3 rounded-2xl bg-oro-50 px-4 py-3 text-sm font-bold">
        <input type="checkbox" className="h-5 w-5" checked={d.esPrueba} onChange={(e) => setD({ ...d, esPrueba: e.target.checked })} />
        Estos son datos de prueba (se muestra un aviso al cliente)
      </label>
      <div className="grid gap-6 lg:grid-cols-3">
        <Seccion titulo="Pago móvil">
          <div className="space-y-3">
            <Campo etiqueta="Banco" value={d.pagoMovil.banco} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, banco: e.target.value } })} />
            <Campo etiqueta="Cédula" value={d.pagoMovil.cedula} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, cedula: e.target.value } })} />
            <Campo etiqueta="Teléfono" value={d.pagoMovil.telefono} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, telefono: e.target.value } })} />
          </div>
        </Seccion>
        <Seccion titulo="Cuenta bancaria">
          <div className="space-y-3">
            <Campo etiqueta="Banco" value={d.cuenta.banco} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, banco: e.target.value } })} />
            <Campo etiqueta="Número de cuenta" value={d.cuenta.numero} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, numero: e.target.value } })} />
            <Campo etiqueta="Titular" value={d.cuenta.titular} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, titular: e.target.value } })} />
            <Campo etiqueta="Cédula del titular" value={d.cuenta.cedula} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, cedula: e.target.value } })} />
          </div>
        </Seccion>
        <Seccion titulo="Binance">
          <div className="space-y-3">
            <Campo etiqueta="Usuario o ID" value={d.binance.usuario} onChange={(e) => setD({ ...d, binance: { ...d.binance, usuario: e.target.value } })} />
            <Campo etiqueta="Correo" value={d.binance.correo} onChange={(e) => setD({ ...d, binance: { ...d.binance, correo: e.target.value } })} />
            <Campo etiqueta="Nota" value={d.binance.nota} onChange={(e) => setD({ ...d, binance: { ...d.binance, nota: e.target.value } })} />
          </div>
        </Seccion>
      </div>
      <Campo etiqueta="Nota de verificación" value={d.notaVerificacion} onChange={(e) => setD({ ...d, notaVerificacion: e.target.value })} />
      {errorGuardar && <Alerta tono="error">{errorGuardar}</Alerta>}
      <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos de pago'}</button>
    </form>
  );
}

const VARIABLES = '{nombre} {tracking} {resumen_paquetes} {linea_peso} {linea_total} {nota_modalidad} {enlace_cuenta} {enlace_consolidar} {transportista} {guia} {enlace_rastreo} {motivo}';
const MENSAJES: Array<{ clave: 'llegada' | 'cotizacion' | 'pagoVerificado' | 'pagoRechazado' | 'despacho'; titulo: string }> = [
  { clave: 'llegada', titulo: 'Llegó un paquete' },
  { clave: 'cotizacion', titulo: 'Total del envío consolidado' },
  { clave: 'pagoVerificado', titulo: 'Pago verificado (pide datos de entrega)' },
  { clave: 'pagoRechazado', titulo: 'Pago rechazado' },
  { clave: 'despacho', titulo: 'Envío despachado (guía)' },
];

function EditorMensajes() {
  const { datos, cargando, error, guardar, guardando, errorGuardar } = useConfigClave<Record<string, string>>('plantillas');
  const [p, setP] = useState<Record<string, string> | null>(null);
  useEffect(() => { if (datos) setP({ ...datos }); }, [datos]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} />;
  if (!p) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); void guardar(p); }} className="space-y-5" noValidate>
      <Alerta tono="info">Variables que puedes usar: <span className="font-mono text-xs">{VARIABLES}</span>. Las líneas que contienen solo una variable vacía se omiten.</Alerta>
      {MENSAJES.map((m) => (
        <div key={m.clave}>
          <label htmlFor={`plantilla-${m.clave}`} className="etiqueta">{m.titulo}</label>
          <textarea id={`plantilla-${m.clave}`} className="campo min-h-[150px] py-3 font-mono text-sm" value={p[m.clave] ?? ''} onChange={(e) => setP({ ...p, [m.clave]: e.target.value })} />
        </div>
      ))}
      {errorGuardar && <Alerta tono="error">{errorGuardar}</Alerta>}
      <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar mensajes'}</button>
    </form>
  );
}

function EditorTransporte() {
  const transportes = useConfigClave<TransportistaPublico[]>('transportistas');
  const contacto = useConfigClave<Contacto>('contacto');
  const [t, setT] = useState<TransportistaPublico[] | null>(null);
  const [c, setC] = useState<Contacto | null>(null);
  useEffect(() => { if (transportes.datos) setT(structuredClone(transportes.datos)); }, [transportes.datos]);
  useEffect(() => { if (contacto.datos) setC({ ...contacto.datos }); }, [contacto.datos]);
  if (transportes.cargando || contacto.cargando) return <Cargando />;
  if (!t || !c) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Seccion titulo="Rastreo de transportistas">
        <form onSubmit={(e) => { e.preventDefault(); void transportes.guardar(t); }} className="space-y-5" noValidate>
          {t.map((tr, i) => (
            <div key={tr.codigo} className="space-y-3 rounded-2xl border border-linea p-4">
              <Campo etiqueta={`Nombre (${tr.codigo})`} value={tr.nombre} onChange={(e) => setT(t.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
              <Campo etiqueta="Enlace de rastreo" type="url" value={tr.urlRastreo} onChange={(e) => setT(t.map((x, j) => (j === i ? { ...x, urlRastreo: e.target.value } : x)))} />
              <Campo etiqueta="Parámetro de la guía (opcional)" value={tr.parametroGuia ?? ''} onChange={(e) => setT(t.map((x, j) => (j === i ? { ...x, parametroGuia: e.target.value || null } : x)))} ayuda="Si el enlace acepta la guía, por ejemplo guia o tracking." />
            </div>
          ))}
          {transportes.errorGuardar && <Alerta tono="error">{transportes.errorGuardar}</Alerta>}
          <button type="submit" className="btn btn-primario" disabled={transportes.guardando}>Guardar rastreo</button>
        </form>
      </Seccion>
      <Seccion titulo="Contacto público">
        <form onSubmit={(e) => { e.preventDefault(); void contacto.guardar(c); }} className="space-y-4" noValidate>
          <Campo etiqueta="WhatsApp (solo dígitos con código de país)" value={c.whatsapp} onChange={(e) => setC({ ...c, whatsapp: e.target.value })} />
          <Campo etiqueta="Dirección" value={c.direccion} onChange={(e) => setC({ ...c, direccion: e.target.value })} />
          <Campo etiqueta="Instagram" type="url" value={c.instagram} onChange={(e) => setC({ ...c, instagram: e.target.value })} />
          <Campo etiqueta="Facebook" type="url" value={c.facebook} onChange={(e) => setC({ ...c, facebook: e.target.value })} />
          <Campo etiqueta="TikTok" type="url" value={c.tiktok} onChange={(e) => setC({ ...c, tiktok: e.target.value })} />
          {contacto.errorGuardar && <Alerta tono="error">{contacto.errorGuardar}</Alerta>}
          <button type="submit" className="btn btn-primario" disabled={contacto.guardando}>Guardar contacto</button>
        </form>
      </Seccion>
    </div>
  );
}

function EditorTasa() {
  const avisar = useAviso();
  const { datos, cargando, error, recargar } = useCarga(() => api.get<{ tasa: { bolivaresPorUsd: number; fecha: string; fuente: string; desactualizada: boolean } }>('/admin/tasa').then((r) => r.tasa));
  const [valor, setValor] = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const numero = aNumero(valor);
    if (!Number.isFinite(numero) || numero <= 0) return setErrorForm('Escribe una tasa mayor que cero.');
    setErrorForm(null);
    try {
      await api.put('/admin/tasa', { bolivaresPorUsd: numero });
      setValor('');
      await recargar();
      avisar('Tasa cargada a mano.');
    } catch (falla) {
      setErrorForm(mensajeDeError(falla));
    }
  }

  return (
    <Seccion titulo="Tasa BCV del día">
      {cargando && <Cargando lineas={1} />}
      {error && <Alerta tono="aviso">{error}</Alerta>}
      {datos && <p className="mb-4 text-lg font-bold">{datos.bolivaresPorUsd.toFixed(4)} Bs por dólar <span className="text-sm font-normal text-suave">· {datos.fecha} · {datos.fuente === 'MANUAL' ? 'cargada a mano' : 'de la API'}{datos.desactualizada ? ' · NO es la de hoy' : ''}</span></p>}
      <p className="mb-4 text-sm text-suave">El sistema la consulta solo cada día. Si la consulta falla, puedes cargarla aquí a mano.</p>
      <form onSubmit={guardar} className="flex max-w-md items-end gap-3" noValidate>
        <Campo className="flex-1" etiqueta="Cargar tasa a mano" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej. 917.7751" error={errorForm} />
        <button type="submit" className="btn btn-primario">Guardar</button>
      </form>
    </Seccion>
  );
}

export default function Administracion() {
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-5 text-3xl">Administración</h1>
      <div role="tablist" aria-label="Secciones de administración" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {PESTANAS.map((p) => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} type="button" onClick={() => setPestana(p.id)} className={`btn btn-chico shrink-0 ${pestana === p.id ? 'btn-primario' : 'btn-suave'}`}>{p.texto}</button>
        ))}
      </div>
      <div role="tabpanel">
        {pestana === 'usuarios' && <Usuarios />}
        {pestana === 'tarifas' && <EditorTarifas />}
        {pestana === 'pagos' && <EditorDatosPago />}
        {pestana === 'mensajes' && <EditorMensajes />}
        {pestana === 'transporte' && <EditorTransporte />}
        {pestana === 'tasa' && <EditorTasa />}
      </div>
    </div>
  );
}
