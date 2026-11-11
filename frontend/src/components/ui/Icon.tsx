import type { ReactNode } from 'react';
import { FaFacebookF, FaInstagram, FaTiktok, FaWhatsapp } from 'react-icons/fa6';
import type { IconType } from 'react-icons';

const paths = {
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4 12 5 5L20 6" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" />
      <path d="M15 9V4H4v11h5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4H6v16h8" />
      <path d="M10 12h11M18 8l4 4-4 4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.4 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  scan: (
    <>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      <path d="M3 12h18" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.6-2.5h6.8L17 8h3v12H4V8Z" />
      <circle cx="12" cy="14" r="3.4" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v4h16v-4" />
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.2l8 4.6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6 7-11.5a7 7 0 1 0-14 0C5 15 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  external: <path d="M14 4h6v6M20 4 10 14M18 14v6H4V6h6" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.5 3.2 7.5 7.5 9 4.3-1.5 7.5-4.5 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6h11v10H3V6ZM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  phone: <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4c0 1-1 2-2 2C10 21 3 14 3 5c0-1 1-2 2-2Z" />,
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v5h4M9 13h6M9 17h4" />
    </>
  ),
  barcode: (
    <>
      <path d="M4 5v14M7 5v14M10 5v9M13 5v14M16 5v9M19 5v14" />
    </>
  ),
} as const;

type GlyphName = keyof typeof paths;

/** Logos de marca reales (react-icons) con la misma API del componente Icon. */
const MARCAS: Partial<Record<IconName, IconType>> = {
  whatsapp: FaWhatsapp,
  instagram: FaInstagram,
  facebook: FaFacebookF,
  tiktok: FaTiktok,
};

export type IconName = GlyphName | keyof typeof MARCAS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: 1.5 | 2;
}

export function Icon({ name, size = 18, className, strokeWidth = 1.5 }: IconProps): ReactNode {
  const Marca = MARCAS[name];
  if (Marca) {
    return (
      <Marca
        size={size}
        className={className}
        aria-hidden="true"
        focusable