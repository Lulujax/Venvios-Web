import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alerta, Campo, CampoContrasena, RequisitosContrasenaLista } from '../components/ui';
import { api, mensajeDeError } from '../lib/api';
import { crearRegistro } from '../lib/registro';
import { validarCodigoCorreo, validarContrasena, validarEmail, validarRepeticion } from '../lib/validar';
import { MarcoAcceso } from './Acceso';

const registro = crearRegistro('recuperar');

type Paso = 'correo' | 'codigo' | 'listo';

const ENTRADA = '/ingresar';

export function RecuperarClave() {
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repeticion, setRepeticion] = useState('');
  const [errores, setErrores] = useState<{ correo?: string; codigo?: string; nueva?: string; repeticion?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo(evento: FormEvent) {
    evento.preventDefault();
    const falloCorreo = validarEmail(correo) ?? undefined;
    setErrores({ correo: falloCorreo });
    if (falloCorreo) return;
    setEnviando(true);
    setError(null);
    registro.info('Pidiendo el código de recuperación');
    try {
      await api.post('/auth/olvide-clave', { email: correo.trim() });
      registro.info('Código pedido; pasando a escribirlo');
      setPaso('codigo');
    } catch (falla) {
      registro.error('No se pudo pedir el código');
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  async function restablecer(evento: FormEvent) {
    evento.preventDefault();
    const fallos = {
      codigo: validarCodigoCorreo(codigo) ?? undefined,
      nueva: validarContrasena(nueva) ?? undefined,
      repeticion: validarRepeticion(nueva, repeticion) ?? undefined,
    };
    setErrores(fallos);
    if (Object.values(fallos).some(Boolean)) return;
    setEnviando(true);
    setError(null);
    registro.info('Enviando el código y la contraseña nueva');
    try {
      await api.post('/auth/restablecer-clave', { email: correo.trim(), codigo: codigo.replace(/\s+/g, ''), nueva });
      registro.info('Contraseña restablecida');
      setCodigo('');
      setNueva('');
      setRepeticion('');
      setPaso('listo');
    } catch (falla) {
      registro.error('El código fue rechazado o falló el servidor');
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  function pedirOtro() {
    setPaso('correo');
    setCodigo('');
    setErrores({});
    setError(null);
  }

  const pie = <Link to={ENTRADA} className="font-bold text-marino underline underline-offset-4">Volver a ingresar</Link>;

  if (paso === 'listo') {
    return (
      <MarcoAcceso titulo="Contraseña cambiada" subtitulo="Ya puedes entrar con tu contraseña nueva." pie={pie}>
        <Alerta tono="ok">Cerramos tu sesión en los demás equipos por seguridad.</Alerta>
        <Link to={ENTRADA} className="btn btn-primario mt-5 w-full">Ir a ingresar</Link>
      </MarcoAcceso>
    );
  }

  if (paso === 'codigo') {
    return (
      <MarcoAcceso titulo="Escribe el código" subtitulo="Si el correo está registrado, te enviamos un código de 6 números. Revisa también la carpeta de spam." pie={pie}>
        <form onSubmit={restablecer} className="space-y-4" noValidate>
          <Campo etiqueta="Código del correo" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} error={errores.codigo} placeholder="123456" />
          <div>
            <CampoContrasena etiqueta="Contraseña nueva" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} error={errores.nueva} />
            <RequisitosContrasenaLista contrasena={nueva} />
          </div>
          <CampoContrasena etiqueta="Repite la contraseña nueva" autoComplete="new-password" value={repeticion} onChange={(e) => setRepeticion(e.target.value)} error={errores.repeticion} />
          {error && <Alerta tono="error">{error}</Alerta>}
          <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
          <p className="text-center text-sm text-suave">
            ¿No llegó? Espera un minuto y <button type="button" className="font-bold text-marino underline underline-offset-4" onClick={pedirOtro}>pide otro código</button>.
          </p>
        </form>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo="Recupera tu contraseña" subtitulo="Escribe el correo de tu cuenta y te enviamos un código para crear una contraseña nueva." pie={pie}>
      <form onSubmit={pedirCodigo} className="space-y-4" noValidate>
        <Campo etiqueta="Correo electrónico" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} placeholder="nombre@correo.com" />
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar código'}</button>
      </form>
    </MarcoAcceso>
  );
}
