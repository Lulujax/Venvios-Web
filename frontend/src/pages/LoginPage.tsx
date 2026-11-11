import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BRAND, whatsappLink } from '../config/brand';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Icon } from '../components/ui/Icon';
import { BrandMark } from '../components/ui/BrandMark';

type Modo = 'login' | 'registro';

const BENEFICIOS = [
  'Un código de casillero único',
  'Prealerta digital de cada compra',
  'Aviso por WhatsApp en cada estado',
];

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { usuario, cargando, iniciarSesion, registrar } = useAuth();

  const [modo, setModo] = useState<Modo>(params.get('modo') === 'registro' ? 'registro' : 'login');
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cargando && usuario) {
      navigate(usuario.rol === 'ADMIN' ? '/admin' : '/app', { replace: true });
    }
  }, [usuario, cargando, navigate]);

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setError(null);
    setErroresCampo({});
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previo) => ({ ...previo, [name]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setErroresCampo({});
    setEnviando(true);

    try {
      if (modo === 'login') {
        await iniciarSesion(form.email, form.password);
      } else {
        await registrar({
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono,
          password: form.password,
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErroresCampo(err.erroresPorCampo);
      } else {
        setError('Ocurrió un error inesperado. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-12">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy px-10 py-10 text-paper lg:col-span-5 lg:flex xl:px-14">
        <div
          className="pointer-events-none absolute inset-0 grid grid-cols-6"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="border-l border-paper/[0.06] last:border-r" />
          ))}
        </div>

        <div className="relative">
          <Link to="/" aria-label="Venvios Express, inicio">
            <BrandMark light />
          </Link>
        </div>

        <div className="relative max-w-[420px]">
          <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-paper/40">
            Manifiesto / Acceso
          </p>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,3.6vw,3.4rem)] font-extrabold leading-[0.98] tracking-tightest">
            Entra a tu manifiesto.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-paper/60">
            Tu casillero, tus prealertas y cada movimiento del paquete en un solo lugar. Sin llamadas
            para preguntar dónde va.
          </p>

          <ul className="mt-8 border-t border-paper/15">
            {BENEFICIOS.map((beneficio, index) => (
              <li
                key={beneficio}
                className="flex items-center gap-4 border-b border-paper/15 py-3.5 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/70"
              >
                <span className="text-gold">{String(index + 1).padStart(2, '0')}</span>
                {beneficio}
              </li>
            ))}
          </ul>

          <p className="mt-8 font-display text-lg font-bold text-gold">Tu mejor opción.</p>
        </div>

        <div className="relative flex flex-wrap items-end justify-between gap-4 border-t border-paper/15 pt-5">
          <div>
            <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-paper/35">
              Sede de recepción
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-paper/70">
              {BRAND.address.line1}
              <br />
              {BRAND.address.line2}
            </p>
          </div>
          <a
            href={whatsappLink('Hola, necesito ayuda con mi cuenta de Venvios Express.')}
            target="_blank"
            rel="noreferrer"
            className="footer-link inline-flex items-center gap-2 font-mono text-[10px] text-gold"
          >
            <Icon name="whatsapp" size={14} />
            {BRAND.whatsappDisplay}
          </a>
        </div>
      </aside>

      <main className="flex flex-col bg-paper lg:col-span-7">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 lg:px-10">
          <Link to="/" className="lg:hidden">
            <BrandMark />
          </Link>
          <Link
            to="/"
            className="footer-link ml-auto inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted"
          >
            <Icon name="chevronLeft" size={13} />
            Volver al inicio
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[440px]">
            <p className="eyebrow">§ Acceso / Cliente</p>
            <h1 className="display-md mt-3">
              {modo === 'login' ? 'Inicia sesión.' : 'Crea tu casillero.'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {modo === 'login'
                ? 'Usa el correo con el que registraste tu cuenta.'
                : 'Tarda menos de dos minutos. Al finalizar recibes tu código único VEX-CUC.'}
            </p>

            <div className="mt-7 grid grid-cols-2 border border-line" role="tablist" aria-label="Tipo de acceso">
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'login'}
                onClick={() => cambiarModo('login')}
                className={cn(
                  'py-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                  modo === 'login' ? 'bg-navy text-paper' : 'bg-white text-muted hover:text-ink',
                )}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modo === 'registro'}
                onClick={() => cambiarModo('registro')}
                className={cn(
                  'border-l border-line py-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                  modo === 'registro' ? 'bg-navy text-paper' : 'bg-white text-muted hover:text-ink',
                )}
              >
                Crear casillero
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
              {error && (
                <div className="flex items-start gap-3 border-l-2 border-red bg-red/[0.04] px-4 py-3">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-red" />
                  <p className="text-sm leading-snug text-red">{error}</p>
                </div>
              )}

              {modo === 'registro' && (
                <div>
                  <label htmlFor="nombre" className="field-label">
                    Nombre completo
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.nombre}
                    onChange={onChange}
                    className="field"
                    placeholder="María Fernanda Rangel"
                  />
                  {erroresCampo.nombre && <p className="field-error">{erroresCampo.nombre}</p>}
                </div>
              )}

              <div>
                <label htmlFor="email" className="field-label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={onChange}
                  className="field"
                  placeholder="tucorreo@dominio.com"
                />
                {erroresCampo.email && <p className="field-error">{erroresCampo.email}</p>}
              </div>

              {modo === 'registro' && (
                <div>
                  <label htmlFor="telefono" className="field-label">
                    WhatsApp de contacto
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    required
                    autoComplete="tel"
                    value={form.telefono}
                    onChange={onChange}
                    className="field font-mono"
                    placeholder="+57 300 123 4567"
                  />
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Solo lo usa la sede para avisarte. El operador no lo ve.
                  </p>
                  {erroresCampo.telefono && <p className="field-error">{erroresCampo.telefono}</p>}
                </div>
              )}

              <div>
                <label htmlFor="password" className="field-label">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={modo === 'registro' ? 8 : undefined}
                  autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={onChange}
                  className="field"
                  placeholder="••••••••"
                />
                {modo === 'registro' && (
                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    Mínimo 8 caracteres, con letra y número.
                  </p>
                )}
                {erroresCampo.password && <p className="field-error">{erroresCampo.password}</p>}
              </div>

              <button type="submit" disabled={enviando} className="btn btn-primary w-full disabled:opacity-60">
                {enviando
                  ? modo === 'login'
                    ? 'Verificando…'
                    : 'Creando casillero…'
                  : modo === 'login'
                    ? 'Entrar a mi panel'
                    : 'Crear mi casillero'}
                {!enviando && <Icon name="arrowRight" size={14} />}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2 border-t border-line pt-4">
              <Icon name="lock" size={13} className="mt-0.5 shrink-0 text-muted" />
              <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-muted">
                Sesión con cookie httpOnly. Tu teléfono queda fuera de la vista de los operadores.
              </p>
            </div>

            {modo === 'login' && (
              <p className="mt-4 text-sm text-muted">
                ¿Aún no tienes casillero?{' '}
                <button
                  type="button"
                  onClick={() => cambiarModo('registro')}
                  className="link-underline font-medium text-navy"
                >
                  Créalo aquí
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
