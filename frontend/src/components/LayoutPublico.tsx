import type { ReactNode } from 'react';
import { api } from '../lib/api';
import type { InfoPublica } from '../lib/tipos';
import { useCarga } from '../lib/useCarga';
import { Pie } from './Pie';

export function LayoutPublico({ children }: { children: ReactNode }) {
  const { datos } = useCarga(() => api.get<InfoPublica>('/publico/info'));
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex-1">{children}</div>
      <Pie contacto={datos?.contacto} />
    </div>
  );
}
