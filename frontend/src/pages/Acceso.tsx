import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alerta, Campo, Marca } from '../components/ui';
import { mensajeDeError } from '../lib/api';
import { rutaInicial, useAuth } from '../lib/auth';
import { validarCedula, validarContrasena, validarNombre, validarTelefono } from '../lib/validar';
import { api } from '../lib/api';

function MarcoAcceso({ titulo, subtitulo, children, pie }: { titulo: string; subtitulo: string; children: ReactNode; pie?: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-marino-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="cinta-diagonal absolute inset-0" aria-hidden />
        <Link to="/" className="relative"><Marca claro tamano="grande" /></Link>
        <div className="relative">
          <p className="font-display text-5xl font-bold leading-tight text-white">Más cerca de <span className="text-oro">quienes más quieres.</span></p>
          <p className="mt-4 max-w-md text-white/70">Tu casillero internacional de Colombia a Venezuela. Tu mejor opción.</p>
        </div>
        <p className="relative text-sm text-white/50">Cúcuta · Barrio Latino</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-entrar">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Marca /></Link>
          <h1 className="text-3xl sm:text-4xl">{titulo}</h1>
          <p className="mb-7 mt-2 text-suave">{subtitulo}</p>
          {children}
          {pie && <div className="mt-6 text-center text-sm text-suave">{pie}</div>}
        </div>
      </main>
    </div>
  );
}

export function Ingresar() {
  const { usuario, ingresar } = useAuth();
  const navegar = useNavigate();
  const [telefono, setTelefono] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={rutaInicial(usuario)} replace />;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const fallo = validarTelefono(telefono) ?? (contrasena ? null : 'Escribe tu contraseña.');
    if (fallo) return setError(fallo);
    setEnviando(true);
    setError(null);
    try {
      const entrado = await ingresar(telefono, contrasena);
      navegar(rutaInicial(entrado), { replace: true });
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso
      titulo="Ingresar"
      subtitulo="Entra con tu teléfono de WhatsApp y tu contraseña."
      pie={<>¿Aún no tienes cuenta? <Link to="/registro" className="font-bold text-marino underline underline-offset-4">Crea tu casillero</Link></>}
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo etiqueta="Teléfono" type="tel" inputMode="tel" autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="573001234567" />
        <Campo etiqueta="Contraseña" type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <p className="text-center text-sm text-suave">¿Olvidaste tu contraseña? Escríbenos por WhatsApp y te damos una temporal.</p>
      </form>
    </MarcoAcceso>
  );
}

export function Registro() {
  const { usuario, registrar } = useAuth();
  const navegar = useNavigate();
  const [datos, setDatos] = useState({ nombre: '', cedula: '', telefono: '', contrasena: '' });
  const [errores, setErrores] = useState<Partial<Record<keyof typeof datos, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={rutaInicial(usuario)} replace />;

  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos((previo) => ({ ...previo, [campo]: e.target.value }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const nuevos = {
      nombre: validarNombre(datos.nombre) ?? undefined,
      cedula: validarCedula(datos.cedula) ?? undefined,
      telefono: validarTelefono(datos.telefono) ?? undefined,
      contrasena: validarContrasena(datos.contrasena) ?? undefined,
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setEnviando(true);
    setError(null);
    try {
      const creado = await registrar(datos);
      navegar(rutaInicial(creado), { replace: true });
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso
      titulo="Crea tu casillero"
      subtitulo="Con tu cuenta registras tus paquetes y ves cuánto debes, todo en un solo lugar."
      pie={<>¿Ya tienes cuenta? <Link to="/ingresar" className="font-bold text-marino underline underline-offset-4">Ingresa</Link></>}
    >
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo etiqueta="Nombre y apellido" autoComplete="name" value={datos.nombre} onChange={cambiar('nombre')} error={errores.nombre} />
        <Campo etiqueta="Número de cédula" inputMode="numeric" value={datos.cedula} onChange={cambiar('cedula')} error={errores.cedula} ayuda="Solo el número, sin foto." />
        <Campo etiqueta="Teléfono de WhatsApp" type="tel" inputMode="tel" autoComplete="tel" value={datos.telefono} onChange={cambiar('telefono')} error={errores.telefono} ayuda="Con código de país: 584141234567 (Venezuela) o 573001234567 (Colombia)." />
        <Campo etiqueta="Contraseña" type="password" autoComplete="new-password" value={datos.contrasena} onChange={cambiar('contrasena')} error={errores.contrasena} ayuda="Mínimo 8 caracteres." />
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Creando…' : 'Crear mi cuenta'}</button>
      </form>
    </MarcoAcceso>
  );
}

export function CambiarClave() {
  const { usuario, refrescar } = useAuth();
  const navegar = useNavigate();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!usuario) return <Navigate to="/ingresar" replace />;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const fallo = validarContrasena(nueva) ?? (actual ? null : 'Escribe tu contraseña actual.');
    if (fallo) return setError(fallo);
    setEnviando(true);
    setError(null);
    try {
      await api.post('/auth/cambiar-clave', { actual, nueva });
      await refrescar();
      navegar('/', { replace: true });
    } catch (falla) {
      setError(mensajeDeError(falla));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoAcceso titulo="Cambia tu contraseña" subtitulo={usuario.debeCambiarClave ? 'Te dieron una contraseña temporal. Crea una propia para continuar.' : 'Elige una contraseña nueva.'}>
      <form onSubmit={enviar} className="space-y-4" noValidate>
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} />
        <Campo etiqueta="Contraseña nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} ayuda="Mínimo 8 caracteres." />
        {error && <Alerta tono="error">{error}</Alerta>}
        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </MarcoAcceso>
  );
}
