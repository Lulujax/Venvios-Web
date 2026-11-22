import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CorregirCedula } from '../../components/CorregirCedula';
import { Alerta, Campo, Cargando, ErrorCarga, Seccion, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { aNumero } from '../../lib/formato';
import { enlacePruebaWhatsApp, renderizarEjemplo, variablesDesconocidas } from '../../lib/plantillas';
import type { Contacto, DatosPago, Tarifas, TipoCuenta, TransportistaPublico } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import type { FiltroEstado } from '../../lib/usuarios';
import { ResumenAdmin, type Destino } from './ResumenAdmin';
import { UsuariosAdmin } from './UsuariosAdmin';

type Pestana = 'resumen' | 'usuarios' | 'clientes' | 'tarifas' | 'pagos' | 'mensajes' | 'transporte' | 'tasa';

const GRUPOS: Array<{ titulo: string; pestanas: Array<{ id: Pestana; texto: string }> }> = [
  { titulo: 'Personas', pestanas: [{ id: 'resumen', texto: 'Resumen' }, { id: 'usuarios', texto: 'Usuarios' }, { id: 'clientes', texto: 'Clientes' }] },
  { titulo: 'Negocio', pestanas: [{ id: 'tarifas', texto: 'Tarifas' }, { id: 'tasa', texto: 'Tasa BCV' }, { id: 'pagos', texto: 'Datos de pago' }] },
  { titulo: 'Comunicación', pestanas: [{ id: 'mensajes', texto: 'Mensajes' }, { id: 'transporte', texto: 'Contacto y rastreo' }] },
];

const IDS_PESTANA: Pestana[] = GRUPOS.flatMap((g) => g.pestanas.map((p) => p.id));

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

function InterruptorMetodo({ activo, alCambiar }: { activo: boolean; alCambiar: (activo: boolean) => void }) {
  return (
    <label className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${activo ? 'bg-marino-50 text-marino-900' : 'bg-linea/60 text-suave'}`}>
      <input type="checkbox" className="h-4 w-4" checked={activo} onChange={(e) => alCambiar(e.target.checked)} />
      {activo ? 'Visible para clientes' : 'Oculto'}
    </label>
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
      <div className="grid gap-6 lg:grid-cols-3">
        <Seccion titulo="Pago móvil" derecha={<InterruptorMetodo activo={d.pagoMovil.activo} alCambiar={(activo) => setD({ ...d, pagoMovil: { ...d.pagoMovil, activo } })} />}>
          <div className="space-y-3">
            <Campo etiqueta="Banco" value={d.pagoMovil.banco} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, banco: e.target.value } })} />
            <Campo etiqueta="Cédula" value={d.pagoMovil.cedula} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, cedula: e.target.value } })} />
            <Campo etiqueta="Teléfono" value={d.pagoMovil.telefono} onChange={(e) => setD({ ...d, pagoMovil: { ...d.pagoMovil, telefono: e.target.value } })} />
          </div>
        </Seccion>
        <Seccion titulo="Transferencia" derecha={<InterruptorMetodo activo={d.cuenta.activo} alCambiar={(activo) => setD({ ...d, cuenta: { ...d.cuenta, activo } })} />}>
          <div className="space-y-3">
            <div>
              <label htmlFor="tipo-cuenta" className="etiqueta">Tipo de cuenta</label>
              <select id="tipo-cuenta" className="campo" value={d.cuenta.tipo} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, tipo: e.target.value as TipoCuenta } })}>
                <option value="CORRIENTE">Corriente</option>
                <option value="AHORRO">Ahorro</option>
              </select>
            </div>
            <Campo etiqueta="Banco" value={d.cuenta.banco} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, banco: e.target.value } })} />
            <Campo etiqueta="Número de cuenta" value={d.cuenta.numero} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, numero: e.target.value } })} />
            <Campo etiqueta="Titular" value={d.cuenta.titular} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, titular: e.target.value } })} />
            <Campo etiqueta="Cédula del titular" value={d.cuenta.cedula} onChange={(e) => setD({ ...d, cuenta: { ...d.cuenta, cedula: e.target.value } })} />
          </div>
        </Seccion>
        <Seccion titulo="Binance" derecha={<InterruptorMetodo activo={d.binance.activo} alCambiar={(activo) => setD({ ...d, binance: { ...d.binance, activo } })} />}>
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
const MENSAJES: Array<{ clave: 'llegada' | 'cotizacion' | 'pagoVerificado' | 'pagoRechazado' | 'despacho'; titulo: string; corto: string }> = [
  { clave: 'llegada', titulo: 'Llegó un paquete', corto: 'Llegó paquete' },
  { clave: 'cotizacion', titulo: 'Total del envío consolidado', corto: 'Total' },
  { clave: 'pagoVerificado', titulo: 'Pago verificado (avisa que sale hacia Venezuela)', corto: 'Pago verificado' },
  { clave: 'pagoRechazado', titulo: 'Pago rechazado', corto: 'Pago rechazado' },
  { clave: 'despacho', titulo: 'En ruta (guía de la transportista)', corto: 'En ruta' },
];

function EditorMensajes() {
  const { datos, cargando, error, guardar, guardando, errorGuardar } = useConfigClave<Record<string, string>>('plantillas');
  const [p, setP] = useState<Record<string, string> | null>(null);
  const contacto = useConfigClave<Contacto>('contacto');
  const avisar = useAviso();
  const [actual, setActual] = useState<(typeof MENSAJES)[number]['clave']>(MENSAJES[0]!.clave);
  useEffect(() => { if (datos) setP({ ...datos }); }, [datos]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} />;
  if (!p) return null;
  const mensaje = MENSAJES.find((m) => m.clave === actual) ?? MENSAJES[0]!;
  const texto = p[mensaje.clave] ?? '';
  const desconocidas = variablesDesconocidas(texto);
  const vistaPrevia = texto.trim() ? renderizarEjemplo(texto) : '';

  function enviarPrueba() {
    const enlace = enlacePruebaWhatsApp(contacto.datos?.whatsapp ?? '', vistaPrevia);
    if (!enlace) {
      avisar('Para probar, primero carga el WhatsApp de la empresa en «Contacto y rastreo» y escribe el mensaje.', 'error');
      return;
    }
    window.open(enlace, '_blank', 'noopener');
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void guardar(p); }} className="space-y-5" noValidate>
      <Alerta tono="info">Variables que puedes usar: <span className="font-mono text-xs">{VARIABLES}</span>. Las líneas que contienen solo una variable vacía se omiten.</Alerta>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Mensaje a editar">
        {MENSAJES.map((m) => (
          <button key={m.clave} type="button" aria-pressed={m.clave === actual} onClick={() => setActual(m.clave)} className={`btn btn-chico shrink-0 ${m.clave === actual ? 'btn-primario' : 'btn-suave'}`}>{m.corto}</button>
        ))}
      </div>
      <div>
        <label htmlFor={`plantilla-${mensaje.clave}`} className="etiqueta">{mensaje.titulo}</label>
        <textarea id={`plantilla-${mensaje.clave}`} className="campo min-h-[220px] py-3 font-mono text-sm" value={p[mensaje.clave] ?? ''} onChange={(e) => setP({ ...p, [mensaje.clave]: e.target.value })} />
      </div>
      {desconocidas.length > 0 && <Alerta tono="aviso">Estas variables no existen y saldrán vacías: {desconocidas.map((v) => `{${v}}`).join(' ')}</Alerta>}
      <div className="rounded-2xl border border-linea bg-marino-50 p-4">
        <p className="mb-2 text-sm font-bold text-suave">Así lo leerá el cliente (con datos de ejemplo)</p>
        <p data-testid="vista-previa" className="whitespace-pre-wrap text-sm">{vistaPrevia || 'El mensaje está vacío.'}</p>
      </div>
      {errorGuardar && <Alerta tono="error">{errorGuardar}</Alerta>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar mensajes'}</button>
        <button type="button" className="btn btn-suave" onClick={enviarPrueba}>Enviarme una prueba</button>
      </div>
      <p className="ayuda">«Enviarme una prueba» abre WhatsApp con este mensaje hacia el número de la empresa, para que lo recibas como lo verá el cliente. No hace falta guardar antes.</p>
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
            </div>
          ))}
          {transportes.errorGuardar && <Alerta tono="error">{transportes.errorGuardar}</Alerta>}
          <button type="submit" className="btn btn-primario" disabled={transportes.guardando}>Guardar rastreo</button>
        </form>
      </Seccion>
      <Seccion titulo="Contacto público">
        <form onSubmit={(e) => { e.preventDefault(); void contacto.guardar(c); }} className="space-y-4" noValidate>
          <Campo etiqueta="WhatsApp (solo dígitos con código de país)" value={c.whatsapp} onChange={(e) => setC({ ...c, whatsapp: e.target.value })} />
          <Campo etiqueta="Correo de contacto" type="email" value={c.correo} onChange={(e) => setC({ ...c, correo: e.target.value })} ayuda="Se muestra en el pie y en las páginas legales." />
          <Campo etiqueta="Dirección de la oficina" value={c.direccion} onChange={(e) => setC({ ...c, direccion: e.target.value })} />
          <Campo etiqueta="Horario de atención" value={c.horario} maxLength={200} onChange={(e) => setC({ ...c, horario: e.target.value })} ayuda="Se muestra en la portada y en el pie. Déjalo vacío para no mostrarlo." />
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
  const [params, setParams] = useSearchParams();
  const pedida = params.get('seccion') as Pestana | null;
  const pestana: Pestana = pedida && IDS_PESTANA.includes(pedida) ? pedida : 'resumen';
  const estadoUsuarios: FiltroEstado = params.get('estado') === 'pendientes' ? 'PENDIENTES' : 'TODOS';

  function abrir(id: Pestana, estado?: string) {
    const siguiente: Record<string, string> = id === 'resumen' ? {} : { seccion: id };
    if (estado) siguiente.estado = estado;
    setParams(siguiente, { replace: true });
  }

  function irDesdeResumen(destino: Destino) {
    if (destino === 'pendientes') return abrir('usuarios', 'pendientes');
    abrir(destino);
  }

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <h1 className="mb-5 text-3xl">Administración</h1>
      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
        <nav role="tablist" aria-label="Secciones de administración" className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-24 lg:mb-0 lg:flex-col lg:gap-1 lg:self-start lg:overflow-visible">
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="flex shrink-0 gap-2 lg:flex-col lg:gap-1 lg:pb-3">
              <span className="hidden px-3 pb-1 text-xs font-bold uppercase tracking-wide text-suave lg:block">{g.titulo}</span>
              {g.pestanas.map((p) => (
                <button key={p.id} role="tab" aria-selected={pestana === p.id} type="button" onClick={() => abrir(p.id)} className={`btn btn-chico shrink-0 lg:w-full lg:justify-start ${pestana === p.id ? 'btn-primario' : 'btn-suave'}`}>{p.texto}</button>
              ))}
            </div>
          ))}
        </nav>
        <div role="tabpanel" className="min-w-0">
          {pestana === 'resumen' && <ResumenAdmin alIr={irDesdeResumen} />}
          {pestana === 'usuarios' && <UsuariosAdmin key={estadoUsuarios} estadoInicial={estadoUsuarios} />}
          {pestana === 'clientes' && <CorregirCedula />}
          {pestana === 'tarifas' && <EditorTarifas />}
          {pestana === 'pagos' && <EditorDatosPago />}
          {pestana === 'mensajes' && <EditorMensajes />}
          {pestana === 'transporte' && <EditorTransporte />}
          {pestana === 'tasa' && <EditorTasa />}
        </div>
      </div>
    </div>
  );
}
