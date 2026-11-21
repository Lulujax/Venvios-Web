import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BotonMenu, MenuDesplegable, useMenuDesplegable } from '../src/components/MenuDesplegable';

function Prueba() {
  const menu = useMenuDesplegable();
  return (
    <div>
      <BotonMenu alAbrir={menu.abrir} />
      <p>Contenido de fondo</p>
      <MenuDesplegable abierto={menu.abierto} alCerrar={menu.cerrar} etiqueta="Menú de prueba">
        <a href="#x">Opción</a>
      </MenuDesplegable>
    </div>
  );
}

function mostrar() {
  return render(
    <MemoryRouter>
      <Prueba />
    </MemoryRouter>,
  );
}

describe('Menú desplegable', () => {
  it('caso feliz: empieza cerrado, se abre encima del contenido y el fondo sigue en su sitio', () => {
    mostrar();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getByRole('dialog', { name: 'Menú de prueba' })).toBeTruthy();
    expect(screen.getByText('Contenido de fondo')).toBeTruthy();
  });

  it('límite: se cierra al tocar fuera o con la tecla Escape', () => {
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cerrar menú' })[0]!);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('error evitado: otras teclas no lo cierran', () => {
    mostrar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
