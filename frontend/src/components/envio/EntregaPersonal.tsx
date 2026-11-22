import { useState } from 'react';
import { Alerta, useAviso } from '../ui';
import { EntregaForm } from './EntregaForm';
import { api, mensajeDeError } from '../../lib/api';
import { crearRegistro } from '../../lib/registro';
import type { Envio } from '../../lib/tipos';

const registro = crearRegistro('entrega-personal');

const CAMPOS: Array<{ clave: keyof Envio['entrega']; etiqueta: string }> = [
  { clave: 'nombre', etiqueta: 'Quién recibe' },
  { clave: 'cedula', etiqueta: 'Cédula' },
  { clave: 'telefono', etiqueta: 'Teléfono' },
  { clave: 'agencia', etiqueta: 'Agencia' },
  { clave: 'ciudad', etiqueta: 'Ciudad' },
  { clave: 'estado', etiqueta: 'Estado' },
];

export function camposFaltantesDeEntrega(entrega: Envio['entrega']): string[] {
  return CAMPOS.filter(({ clave }) => !entrega[clave]?.trim()).map(({ etiqueta }) => etiqueta.toLowerCase());
}

interface Propiedades {
  envio: Envio;
  alCambiar: (envio: Envio) => void;
  bloqueado: boolean;
}

export function EntregaPersonal({ envio, alCambiar, bloqueado }: Propiedades) {
  const avisar = useAviso();
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [copiando, setCopiando] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const faltantes = camposFaltantesDeEntrega(envio.entrega);
  const completa = faltantes.length === 0;

  async function usarPerfil() {
    setCopiando(true);
    setErrorPerfil(null);
    registro.info('Copiando los datos de entrega del perfil del cliente');
    try {
      const r = await api.post<{ envio: Envio }>(`/envios/${envio.id}/entrega/perfil`);
      avisar('Datos de entrega copiados del perfil.');
      alCambiar(r.envio);
    } catch (falla) {
      registro.error('No se pudieron copiar los datos del perfil');
      setErrorPerfil(mensajeDeError(falla));
    } finally {
      setCopiando(false);
    }
  }

  if (!completa || (corrigiendo && !bloqueado)) {
    return (
      <div className="space-y-3">
        {!completa && <Alerta tono="aviso">Faltan datos de entrega: {faltantes.join(', ')}. Complétalos para poder despachar.</Alerta>}
        {!completa && !bloqueado && (
          <div className="space-y-2">
            <button type="button" className="btn btn-primario btn-chico" disabled={copiando} onClick={() => void usarPerfil()}>
              {copiando ? 'Copiando…' : `Usar los datos del perfil de ${envio.cliente.nombre}`}
            </button>
            {errorPerfil && <Alerta tono="error">{errorPerfil}</Alerta>}
          </div>
        )}
        <EntregaForm
          key={`${envio.entrega.cedula}-${envio.estado}`}
          envio={envio}
          alCambiar={(actualizado) => {
            registro.info('Datos de entrega corregidos por el personal');
            setCorrigiendo(false);
            alCambiar(actualizado);
          }}
          bloqueado={bloqueado}
        />
        {completa && (
          <button type="button" className="btn btn-suave btn-chico" onClick={() => setCorrigiendo(false)}>Cancelar</button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {CAMPOS.map(({ clave, etiqueta }) => (
          <div key={clave} className={clave === 'nombre' ? 'sm:col-span-2' : ''}>
            <dt className="text-xs font-bold uppercase tracking-wide text-suave">{etiqueta}</dt>
            <dd className="mt-0.5 font-semibold">{envio.entrega[clave]}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-suave">Estos datos vienen del perfil de {envio.cliente.nombre}. No hace falta escribirlos otra vez.</p>
      {!bloqueado && (
        <button type="button" className="btn btn-suave btn-chico" onClick={() => setCorrigiendo(true)}>Corregir datos</button>
      )}
    </div>
  );
}
