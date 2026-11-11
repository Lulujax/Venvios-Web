import { cn } from '../../lib/cn';

interface BrandMarkProps {
  /** Se mantiene por compatibilidad: el logo propio ya trae su fondo. */
  light?: boolean;
  className?: string;
}

/**
 * Marca de Venvios Express con el logo oficial (public/logo.jpeg).
 * El archivo es un logo apilado (941×1115), así que se ajusta por altura.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/logo.jpeg"
      alt="Venvios Express"
      draggable={false}
      className={cn('h-10 w-auto select-none object-contain', className)}
    />
  );
}
