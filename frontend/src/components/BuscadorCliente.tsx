import { useRef, useState } from 'react';
import { Alerta, Campo } from './ui';
import { api, mensajeDeError } from '../lib/api';
import type { Usuario } from '../lib/tipos';

type ClienteMinimo = Pick<Usuario, 'id' | 'nombre' | 'codigo'>;

interface BuscadorClienteProps {
  cliente: ClienteMinimo | null;
  onElegir: (cliente: Usuario | null) => void;
  etiqueta?: string;
}

export function BuscadorCliente({ cliente, onElegir, etiqueta = 'Buscar cliente' }: BuscadorClienteProps) {
  const [consulta, setConsulta] = useState('');
  const [resultados, setResultados] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ultima = useRef(0);

  async function buscar(texto: string) {
    setConsulta(texto);
    if (texto.trim().length < 3) return setResultados([]);
    const numero = ++ultima.current;
    try {
      const respuesta = await api.get<{ clientes: Usuario[] }>(`/staff/clientes?q=${encodeURIComponent(texto.trim())}`);
      if (numero === ultima.current) setResultados(respuesta.clientes);
      setError(null);
    } catch (falla) {
      setError(mensajeDeError(falla));
    }
  }

  if (cliente) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-marino-50 px-4 py-3">
        <p className="min-w-0 text-sm"><b>{cliente.nombre}</b> · <span className="codigo">{cliente.codigo}</span></p>
        <button type="button" className="btn btn-suave btn-chico" onClick={() => onElegir(null)}>Cambiar</button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Campo etiqueta={etiqueta} value={consulta} onChange={(e) => void buscar(e.target.value)} autoComplete="off" ayuda="Número de casillero (VENV-123456), nombre, correo o cédula. Mínimo 3 caracteres." />
      {error && <Alerta tono="error">{error}</Alerta>}
      {consulta.trim().length >= 3 && resultados.length === 0 && !error && <p className="text-sm text-suave">No encontramos a nadie. El cliente debe tener cuenta.</p>}
      <ul className="space-y-2">
        {resultados.map((c) => (
          <li key={c.id}>
            <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-linea px-4 py-3 text-left text-sm hover:bg-marino-50" onClick={() => onElegir(c)}>
              <span className="min-w-0"><b>{c.nombre}</b> · <span className="codigo">{c.codigo}</span> · {c.cedulaEnmascarada}</span>
              <span className="font-bold text-marino">Elegir</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
