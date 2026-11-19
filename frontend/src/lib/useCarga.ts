import { useCallback, useEffect, useRef, useState } from 'react';
import { mensajeDeError } from './api';

export function useCarga<T>(cargador: () => Promise<T>, dependencias: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vigente = useRef(0);

  const recargar = useCallback(async () => {
    const identificador = ++vigente.current;
    setCargando(true);
    setError(null);
    try {
      const resultado = await cargador();
      if (identificador === vigente.current) setDatos(resultado);
    } catch (falla) {
      if (identificador === vigente.current) setError(mensajeDeError(falla));
    } finally {
      if (identificador === vigente.current) setCargando(false);
    }
  }, dependencias);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { datos, setDatos, cargando, error, recargar };
}
