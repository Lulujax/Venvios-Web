import type { AnchorHTMLAttributes, ReactNode } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> & {
  href: string;
  children: ReactNode;
};

export function EnlaceExterno({ href, children, ...resto }: Props) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...resto}>
      {children}
    </a>
  );
}
