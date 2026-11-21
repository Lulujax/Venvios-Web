import { useState, type FormEvent } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { ContenidoCuenta, EncabezadoCuenta } from '../../components/CuentaPiezas';
import { Alerta, Campo, CampoContrasena, CampoTelefono, Cargando, ErrorCarga, RequisitosContrasenaLista, Seleccion, useAviso } from '../../components/ui';
import { api, mensajeDeError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { nombreTransportista } from '../../lib/formato';
import { componerTelefono, separarTelefono, validarTelefonoLocal } from '../../lib/telefono';
import type { DestinoEntrega, InfoPublica, PerfilVista, Transportista } from '../../lib/tipos';
import { useCarga } from '../../lib/useCarga';
import { validarCedula, validarContrasena, validarEmail, validarNombre, validarTelefono } from '../../lib/validar';
import { ESTADOS_VENEZUELA } from '../../lib/venezuela';

const TRANSPORTISTAS: Transportista[] = ['MRW', 'ZOOM'];

function EscribirAAdministracion() {
  const { datos } = useCarga(() => api.get<InfoPublica>('/publico/info'));
  if (!datos) return null;
  const enlace = `https://wa.me/${datos.contacto.whatsapp}?text=${encodeURIComponent('Hola Venvios Express, necesito corregir mi cédula.')}`;
  return (
    <a href={enlace} target="_blank" rel="noopener noreferrer" className="btn btn-suave btn-chico mt-2 inline-flex">
      <FaWhatsapp aria-hidden /> Escribir a administración
    </a>
  );
}

function MisDatos({ perfil, alGuardar }: { perfil: PerfilVista; alGuardar: (perfil: PerfilVista) => void }) {
  const avisar = useAviso();
  const { refrescar } = useAuth();
  const inicial = separarTelefono(perfil.datos.telefono);
  const [nombre, setNombre] = useState(perfil.datos.nombre);
  const [email, setEmail] = useState(perfil.datos.email);
  const [pais, setPais] = useState(inicial.pais);
  const [telefono, setTelefono] = useState(inicial.numero);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const telefonoCompleto = componerTelefono(pais, telefono);
  const cambiaCorreo = email.trim().toLowerCase() !== perfil.datos.email;
  const cambiaTelefono = telefonoCompleto !== perfil.datos.telefono;
  const pideClave = cambiaCorreo || cambiaTelefono || nueva.length > 0;

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const fallos = {
      nombre: validarNombre(nombre) ?? undefined,
      email: validarEmail(email) ?? undefined,
      telefono: validarTelefonoLocal(pais, telefono) ?? undefined,
      nueva: nueva ? (validarContrasena(nueva) ?? undefined) : undefined,
      actual: pideClave && !actual ? 'Escribe tu contraseña actual para confirmar el cambio.' : undefined,
    };
    setErrores(fallos);
    if (Object.values(fallos).some(Boolean)) return;
    setGuardando(true);
    setError(null);
    try {
      const cuerpo: Record<string, string> = { nombre, email: email.trim(), telefono: telefonoCompleto };
      if (pideClave) cuerpo.contrasenaActual = actual;
      if (nueva) cuerpo.contrasenaNueva = nueva;
      const respuesta = await api.put<PerfilVista>('/perfil/datos', cuerpo);
      alGuardar(respuesta);
      setActual('');
      setNueva('');
      await refrescar();
      avisar(nueva ? 'Datos guardados. Cerramos tu sesión en otros equipos.' : 'Datos guardados.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-mis-datos">
      <h2 id="titulo-mis-datos" className="text-xl">Mis datos</h2>
      <dl className="mt-4 grid gap-3 rounded-2xl bg-marino-50 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-suave">Número de casillero</dt>
          <dd className="codigo text-base">{perfil.datos.codigo}</dd>
        </div>
        <div>
          <dt className="text-suave">Cédula</dt>
          <dd className="codigo text-base">{perfil.datos.cedulaEnmascarada}</dd>
        </div>
        <div className="sm:col-span-2">
          <p className="text-suave">La cédula identifica tu cuenta y no se cambia aquí. Si necesitas corregirla, escribe a administración.</p>
          <EscribirAAdministracion />
        </div>
      </dl>
      <form onSubmit={guardar} className="mt-5 space-y-4" noValidate>
        <Campo etiqueta="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoComplete="name" />
        <Campo etiqueta="Correo electrónico" type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} autoComplete="email" />
        <CampoTelefono etiqueta="Teléfono de WhatsApp" pais={pais} numero={telefono} alCambiarPais={setPais} alCambiarNumero={setTelefono} error={errores.telefono} />
        <div className="space-y-4 rounded-2xl border border-linea p-4">
          <p className="text-sm text-suave">Si cambias el correo, el teléfono o la contraseña, escribe tu contraseña actual.</p>
          <CampoContrasena etiqueta="Contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} error={errores.actual} autoComplete="current-password" />
          <div>
            <CampoContrasena etiqueta="Contraseña nueva (opcional)" value={nueva} onChange={(e) => setNueva(e.target.value)} error={errores.nueva} autoComplete="new-password" />
            {nueva && <RequisitosContrasenaLista contrasena={nueva} />}
          </div>
        </div>
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar mis datos'}</button>
      </form>
    </section>
  );
}

type DestinoEditable = Record<keyof DestinoEntrega, string>;

function destinoInicial(destino: DestinoEntrega | null): DestinoEditable {
  return { agencia: destino?.agencia ?? '', ciudad: destino?.ciudad ?? '', estado: destino?.estado ?? '' };
}

function errorDestino(destino: DestinoEditable): string | undefined {
  const llenos = Object.values(destino).filter((valor) => valor.trim().length > 0).length;
  return llenos > 0 && llenos < 3 ? 'Completa la agencia, la ciudad y el estado, o deja los tres vacíos.' : undefined;
}

function MisDatosEntrega({ perfil, alGuardar }: { perfil: PerfilVista; alGuardar: (perfil: PerfilVista) => void }) {
  const avisar = useAviso();
  const { entrega } = perfil;
  const [otraPersona, setOtraPersona] = useState(entrega.receptor !== null);
  const [receptor, setReceptor] = useState(entrega.receptor ?? { nombre: '', cedula: '', telefono: '' });
  const [destinos, setDestinos] = useState<Record<Transportista, DestinoEditable>>({
    MRW: destinoInicial(entrega.destinos.MRW),
    ZOOM: destinoInicial(entrega.destinos.ZOOM),
  });
  const [errores, setErrores] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiarDestino = (transportista: Transportista, campo: keyof DestinoEntrega, valor: string) =>
    setDestinos((previo) => ({ ...previo, [transportista]: { ...previo[transportista], [campo]: valor } }));

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const fallos: Record<string, string | undefined> = {
      receptorNombre: otraPersona ? (validarNombre(receptor.nombre) ?? undefined) : undefined,
      receptorCedula: otraPersona ? (validarCedula(receptor.cedula) ?? undefined) : undefined,
      receptorTelefono: otraPersona ? (validarTelefono(receptor.telefono) ?? undefined) : undefined,
      MRW: errorDestino(destinos.MRW),
      ZOOM: errorDestino(destinos.ZOOM),
    };
    setErrores(fallos);
    if (Object.values(fallos).some(Boolean)) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await api.put<PerfilVista>('/perfil/entrega', {
        receptor: otraPersona ? receptor : null,
        MRW: destinos.MRW,
        ZOOM: destinos.ZOOM,
      });
      alGuardar(respuesta);
      avisar('Datos de entrega guardados.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="tarjeta p-5 sm:p-6" aria-labelledby="titulo-mis-entrega">
      <h2 id="titulo-mis-entrega" className="text-xl">Mis datos de entrega en Venezuela</h2>
      <p className="mt-1 text-sm text-suave">Los guardas una vez y los usamos en cada envío. Llena solo la transportista que usas.</p>
      <form onSubmit={guardar} className="mt-5 space-y-6" noValidate>
        <fieldset className="space-y-3">
          <legend className="etiqueta">¿Quién retira el paquete?</legend>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-linea px-4 py-2 has-[:checked]:border-marino has-[:checked]:bg-marino-50">
            <input type="radio" name="receptor" checked={!otraPersona} onChange={() => setOtraPersona(false)} />
            <span className="min-w-0 text-sm"><span className="block font-bold">Lo retiro yo</span><span className="block text-suave">Usamos tu nombre, tu cédula y tu teléfono.</span></span>
          </label>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-linea px-4 py-2 has-[:checked]:border-marino has-[:checked]:bg-marino-50">
            <input type="radio" name="receptor" checked={otraPersona} onChange={() => setOtraPersona(true)} />
            <span className="min-w-0 text-sm"><span className="block font-bold">Lo retira otra persona</span><span className="block text-suave">Escribe sus datos.</span></span>
          </label>
          {otraPersona && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre y apellido de quien retira" value={receptor.nombre} onChange={(e) => setReceptor({ ...receptor, nombre: e.target.value })} error={errores.receptorNombre} className="sm:col-span-2" />
              <Campo etiqueta="Cédula de quien retira" inputMode="numeric" value={receptor.cedula} onChange={(e) => setReceptor({ ...receptor, cedula: e.target.value })} error={errores.receptorCedula} />
              <Campo etiqueta="Teléfono de quien retira" type="tel" inputMode="tel" value={receptor.telefono} onChange={(e) => setReceptor({ ...receptor, telefono: e.target.value })} error={errores.receptorTelefono} ayuda="Con código de país, por ejemplo 584241234567." />
            </div>
          )}
        </fieldset>

        {TRANSPORTISTAS.map((transportista) => (
          <fieldset key={transportista} className="space-y-4 rounded-2xl border border-linea p-4">
            <legend className="flex items-center gap-2 px-2 text-base font-bold">
              {nombreTransportista(transportista)}
              <span className={`rounded-full px-2 py-0.5 text-xs ${entrega.completo[transportista] ? 'bg-verde-100 text-verde' : 'bg-marino-50 text-suave'}`}>
                {entrega.completo[transportista] ? 'Listo' : 'Sin llenar'}
              </span>
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta={`Agencia de ${nombreTransportista(transportista)} donde retira`} value={destinos[transportista].agencia} onChange={(e) => cambiarDestino(transportista, 'agencia', e.target.value)} placeholder="Ej. MRW Chacao" className="sm:col-span-2" />
              <Campo etiqueta="Ciudad" value={destinos[transportista].ciudad} onChange={(e) => cambiarDestino(transportista, 'ciudad', e.target.value)} />
              <Seleccion etiqueta="Estado" value={destinos[transportista].estado} onChange={(e) => cambiarDestino(transportista, 'estado', e.target.value)} opciones={[{ valor: '', texto: 'Elige un estado' }, ...ESTADOS_VENEZUELA.map((estado) => ({ valor: estado, texto: estado }))]} />
            </div>
            {errores[transportista] && <p className="ayuda font-semibold text-rojo">{errores[transportista]}</p>}
          </fieldset>
        ))}

        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos de entrega'}</button>
      </form>
    </section>
  );
}

export function Perfil() {
  const { datos, setDatos, cargando, error, recargar } = useCarga(() => api.get<PerfilVista>('/perfil'));

  return (
    <>
      <EncabezadoCuenta titulo="Mi perfil" subtitulo="Tus datos y a dónde enviamos tus paquetes en Venezuela." />
      <ContenidoCuenta>
        {cargando && !datos && <Cargando />}
        {error && <ErrorCarga mensaje={error} reintentar={() => void recargar()} />}
        {datos && (
          <div className="space-y-6">
            <MisDatos key={`datos-${datos.datos.email}-${datos.datos.telefono}-${datos.datos.nombre}`} perfil={datos} alGuardar={setDatos} />
            <MisDatosEntrega key={`entrega-${JSON.stringify(datos.entrega.completo)}`} perfil={datos} alGuardar={setDatos} />
          </div>
        )}
      </ContenidoCuenta>
    </>
  );
}
