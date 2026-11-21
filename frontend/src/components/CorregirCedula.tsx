import { useState, type FormEvent } from 'react';
import { BuscadorCliente } from './BuscadorCliente';
import { Alerta, Campo, Seccion, useAviso } from './ui';
import { api, mensajeDeError } from '../lib/api';
import { formatearFecha } from '../lib/formato';
import type { EventoCuentaVista, Usuario } from '../lib/tipos';
import { validarCedula } from '../lib/validar';

const MIN_MOTIVO = 5;

export function CorregirCedula() {
  const avisar = useAviso();
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [cedula, setCedula] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ cedula?: string; motivo?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<EventoCuentaVista[]>([]);

  async function cargarHistorial(id: string) {
    try {
      const respuesta = await api.get<{ eventos: EventoCuentaVista[] }>(`/admin/clientes/${id}/historial`);
      setHistorial(respuesta.eventos);
    } catch {
      setHistorial([]);
    }
  }

  function elegir(elegido: Usuario | null) {
    setCliente(elegido);
    setCedula('');
    setMotivo('');
    setErrores({});
    setError(null);
    setHistorial([]);
    if (elegido) void cargarHistorial(elegido.id);
  }

  async function corregir(evento: FormEvent) {
    evento.preventDefault();
    if (!cliente) return;
    const fallos = {
      cedula: validarCedula(cedula) ?? undefined,
      motivo: motivo.trim().length < MIN_MOTIVO ? `Escribe el motivo (mínimo ${MIN_MOTIVO} letras).` : undefined,
    };
    setErrores(fallos);
    if (fallos.cedula || fallos.motivo) return;
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await api.put<{ cliente: Usuario }>(`/admin/clientes/${cliente.id}/cedula`, { cedula, motivo });
      setCliente(respuesta.cliente);
      setCedula('');
      setMotivo('');
      await cargarHistorial(cliente.id);
      avisar('Cédula corregida.');
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Seccion titulo="Corregir la cédula de un cliente">
      <div className="max-w-xl space-y-5">
        <p className="text-sm text-suave">El cliente no puede cambiar su cédula. Si se equivocó al registrarse, búscalo y corrígela aquí, con el motivo.</p>
        <BuscadorCliente cliente={cliente} onElegir={elegir} />
        {cliente && (
          <form onSubmit={corregir} className="space-y-4" noValidate>
            <p className="text-sm">Cédula actual: <span className="codigo">{cliente.cedulaEnmascarada}</span></p>
            <Campo etiqueta="Cédula nueva" inputMode="numeric" value={cedula} onChange={(e) => setCedula(e.target.value)} error={errores.cedula} />
            <Campo etiqueta="Motivo de la corrección" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={errores.motivo} />
            {error && <Alerta tono="error">{error}</Alerta>}
            <button type="submit" className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Corregir cédula'}</button>
          </form>
        )}
        {cliente && historial.length > 0 && (
          <div>
            <h3 className="mb-2 text-base">Historial de la cuenta</h3>
            <ul className="space-y-2 text-sm">
              {historial.map((evento) => (
                <li key={evento.id} className="rounded-2xl border border-linea px-4 py-2">
                  <p>{evento.detalle}</p>
                  <p className="text-xs text-suave">{formatearFecha(evento.creadoEn)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Seccion>
  );
}
