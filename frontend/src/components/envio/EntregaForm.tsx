import { useState, type FormEvent } from 'react';
import { Alerta, Campo, Seleccion, useAviso } from '../ui';
import { api, mensajeDeError } from '../../lib/api';
import type { Envio } from '../../lib/tipos';
import { validarCedula, validarNombre, validarTelefono } from '../../lib/validar';

const ESTADOS_VENEZUELA = ['Amazonas', 'Anzoátegui', 'Apure', 'Aragua', 'Barinas', 'Bolívar', 'Carabobo', 'Cojedes', 'Delta Amacuro', 'Distrito Capital', 'Falcón', 'Guárico', 'La Guaira', 'Lara', 'Mérida', 'Miranda', 'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Táchira', 'Trujillo', 'Yaracuy', 'Zulia'];

export function EntregaForm({ envio, alCambiar, bloqueado }: { envio: Envio; alCambiar: (envio: Envio) => void; bloqueado: boolean }) {
  const avisar = useAviso();
  const [datos, setDatos] = useState({
    nombre: envio.entrega.nombre ?? '',
    cedula: envio.entrega.cedula ?? '',
    telefono: envio.entrega.telefono ?? '',
    agencia: envio.entrega.agencia ?? '',
    ciudad: envio.entrega.ciudad ?? '',
    estado: envio.entrega.estado ?? '',
  });
  const [errores, setErrores] = useState<Partial<Record<keyof typeof datos, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos((previo) => ({ ...previo, [campo]: e.target.value }));

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const requerido = (valor: string, texto: string) => (valor.trim() ? undefined : texto);
    const nuevos = {
      nombre: validarNombre(datos.nombre) ?? undefined,
      cedula: validarCedula(datos.cedula) ?? undefined,
      telefono: validarTelefono(datos.telefono) ?? undefined,
      agencia: requerido(datos.agencia, 'Indica la agencia por donde retira.'),
      ciudad: requerido(datos.ciudad, 'Indica la ciudad.'),
      estado: requerido(datos.estado, 'Elige el estado.'),
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await api.put<{ envio: Envio }>(`/envios/${envio.id}/entrega`, datos);
      alCambiar(respuesta.envio);
      avisar('Datos de entrega guardados.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4" noValidate>
      <p className="text-sm text-suave">Escribe los datos de quien va a retirar el paquete en Venezuela.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre y apellido de quien recibe" value={datos.nombre} onChange={cambiar('nombre')} error={errores.nombre} disabled={bloqueado} className="sm:col-span-2" />
        <Campo etiqueta="Cédula" inputMode="numeric" value={datos.cedula} onChange={cambiar('cedula')} error={errores.cedula} disabled={bloqueado} />
        <Campo etiqueta="Teléfono" type="tel" inputMode="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} disabled={bloqueado} />
        <Campo etiqueta="Agencia donde retira" value={datos.agencia} onChange={cambiar('agencia')} error={errores.agencia} disabled={bloqueado} placeholder="Ej. MRW Chacao" />
        <Campo etiqueta="Ciudad" value={datos.ciudad} onChange={cambiar('ciudad')} error={errores.ciudad} disabled={bloqueado} />
        <Seleccion etiqueta="Estado" value={datos.estado} onChange={cambiar('estado')} disabled={bloqueado} className="sm:col-span-2" opciones={[{ valor: '', texto: 'Elige un estado' }, ...ESTADOS_VENEZUELA.map((e) => ({ valor: e, texto: e }))]} />
        {errores.estado && <p className="ayuda font-semibold text-rojo sm:col-span-2">{errores.estado}</p>}
      </div>
      {error && <Alerta tono="error">{error}</Alerta>}
      {!bloqueado && <button type="submit" className="btn btn-primario w-full sm:w-auto" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar datos de entrega'}</button>}
    </form>
  );
}
