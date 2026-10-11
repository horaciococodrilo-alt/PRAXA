import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Chat } from '@/components/app/chat';
import { Configuracion } from '@/components/app/configuracion';
import { Diagnostico } from '@/components/app/diagnostico';
import { Perfil } from '@/components/app/perfil';
import { AppShell } from '@/components/app/shell';
import { UsoCostos } from '@/components/app/uso-costos';
import { usoEnCero } from '@/modules/app-data/mock';
import type { Diagnostico as DatosDiagnostico } from '@/modules/app-data/types';

/**
 * Comportamientos de la app que pide docs/praxa-app-diseno/PANTALLAS.md. Los datos son los
 * mocks de src/modules/app-data; acá se prueba la pantalla, no el backend.
 */

let pathname = '/app';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/components/landing/fonts', () => ({ manrope: { variable: '' }, jetbrainsMono: { variable: '' } }));

const guardarPerfilEmpresa = vi.fn();
const guardarNombreUsuario = vi.fn();
const enviarEnlaceDeContrasena = vi.fn();
vi.mock('@/components/auth/recovery', () => ({
  enviarEnlaceDeContrasena: (...args: unknown[]) => enviarEnlaceDeContrasena(...args),
}));
vi.mock('@/lib/env', () => ({ isSupabaseConfigured: () => true, getSiteUrl: () => 'http://localhost:3000' }));
const guardarFotoPerfil = vi.fn();
const eliminarFotoPerfil = vi.fn();
vi.mock('@/modules/identity/actions', () => ({
  guardarNombreUsuario: (...args: unknown[]) => guardarNombreUsuario(...args),
  guardarFotoPerfil: (...args: unknown[]) => guardarFotoPerfil(...args),
  eliminarFotoPerfil: () => eliminarFotoPerfil(),
}));
const subir = vi.fn();
const quitar = vi.fn();
const getUser = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser: () => getUser() },
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => subir(...a),
        remove: (...a: unknown[]) => quitar(...a),
      }),
    },
  }),
}));
vi.mock('@/modules/company/actions', () => ({
  guardarPerfilEmpresa: (...args: unknown[]) => guardarPerfilEmpresa(...args),
}));

describe('AppShell', () => {
  it('marca la sección actual y lleva avatar y fila de usuario a Mi perfil', () => {
    pathname = '/app/uso-y-costos';
    render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada={null} configPendiente={false}>
        <h1>Contenido</h1>
      </AppShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: 'Uso y costos' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Gonzalo, mi perfil' })).toHaveAttribute('href', '/app/perfil');
    // Uno en la barra superior de escritorio y otro en la barra móvil (el CSS muestra uno).
    const perfil = screen.getAllByRole('link', { name: 'Mi perfil' });
    expect(perfil).toHaveLength(2);
    for (const enlace of perfil) expect(enlace).toHaveAttribute('href', '/app/perfil');
    // Sin integraciones conectadas no hay chip, y nunca hay campana de notificaciones.
    expect(screen.queryByText(/conectado/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notificaci/i })).not.toBeInTheDocument();
    for (const fuera of ['Ventas', 'Marketing', 'Productos']) {
      expect(within(nav).queryByRole('link', { name: fuera })).not.toBeInTheDocument();
    }
  });

  it('muestra el chip de la integración conectada', () => {
    pathname = '/app';
    render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada="Meta Ads" configPendiente={false}>
        <p />
      </AppShell>,
    );
    expect(screen.getByText('Meta Ads conectado')).toBeInTheDocument();
  });

  it.each(['/app/integraciones', '/app/configuracion', '/app/chat'])(
    'el avatar de Mi perfil está siempre arriba, también en %s',
    (ruta) => {
      pathname = ruta;
      render(
        <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada="Meta Ads" configPendiente={false}>
          <p />
        </AppShell>,
      );
      // Uno en la barra superior de escritorio y otro en la barra móvil (el CSS muestra uno).
    const perfil = screen.getAllByRole('link', { name: 'Mi perfil' });
    expect(perfil).toHaveLength(2);
    for (const enlace of perfil) expect(enlace).toHaveAttribute('href', '/app/perfil');
      expect(screen.getByText('Meta Ads conectado')).toBeInTheDocument();
    },
  );
});

describe('Menú móvil', () => {
  const shell = (configPendiente = false) =>
    render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada={null} configPendiente={configPendiente}>
        <p />
      </AppShell>,
    );

  it('☰ abre la navegación con el foco adentro y Esc la cierra devolviendo el foco', async () => {
    pathname = '/app';
    const user = userEvent.setup();
    shell();
    const boton = screen.getByRole('button', { name: 'Abrir menú' });
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveAttribute('aria-controls', nav.id);

    await user.click(boton);
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(nav).toHaveAttribute('data-abierto', 'true');
    expect(nav).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(boton).toHaveFocus();
  });

  it('elegir una sección cierra el menú, y no hay botón ✕', async () => {
    pathname = '/app';
    const user = userEvent.setup();
    shell();
    const boton = screen.getByRole('button', { name: 'Abrir menú' });

    await user.click(boton);
    expect(screen.queryByRole('button', { name: 'Cerrar menú' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Chat' }));
    expect(boton).toHaveAttribute('aria-expanded', 'false');
  });

  it('con datos pendientes, ☰ también lleva el punto rojo', () => {
    pathname = '/app';
    shell(true);
    const boton = screen.getByRole('button', { name: 'Abrir menú' });
    expect(boton.querySelector('[class*="alertDot"]')).not.toBeNull();
  });
});

describe('Aviso de Configuración', () => {
  it('con datos pendientes, Configuración lleva el punto rojo y lo anuncia', () => {
    pathname = '/app';
    const { container } = render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada={null} configPendiente>
        <p />
      </AppShell>,
    );
    const config = screen.getByRole('link', { name: 'Configuración' });
    expect(config).toHaveAttribute('href', '/app/configuracion');
    expect(config).toHaveAccessibleDescription('Faltan datos de la empresa');
    // Sobre Configuración y sobre ☰ (móvil).
    expect(container.querySelectorAll('[class*="alertDot"]')).toHaveLength(2);
  });

  it('sin datos pendientes no hay punto', () => {
    pathname = '/app';
    const { container } = render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada={null} configPendiente={false}>
        <p />
      </AppShell>,
    );
    expect(screen.getByRole('link', { name: 'Configuración' })).not.toHaveAttribute('aria-describedby');
    expect(container.querySelectorAll('[class*="alertDot"]')).toHaveLength(0);
  });
});

describe('Configuración', () => {
  beforeEach(() => {
    guardarPerfilEmpresa.mockReset();
    localStorage.clear();
  });

  it('sin empresa, el formulario arranca vacío y Guardar manda los datos', async () => {
    guardarPerfilEmpresa.mockResolvedValue({ ok: true, message: 'Cambios guardados.' });
    const user = userEvent.setup();
    render(<Configuracion empresa={null} />);

    await user.type(screen.getByLabelText('Nombre de la empresa'), 'Mi Tienda');
    for (const [campo, opcion] of [
      ['Rubro', 'Belleza y salud'],
      ['País', 'Uruguay'],
      ['Moneda', 'Dólares'],
    ]) {
      const boton = screen.getByRole('button', { name: new RegExp(`^${campo}`) });
      expect(boton).toHaveAttribute('aria-haspopup', 'listbox');
      expect(boton).toHaveTextContent('Elegí una opción');
      await user.click(boton);
      await user.click(screen.getByRole('option', { name: opcion }));
      expect(boton).toHaveTextContent(opcion);
    }
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(guardarPerfilEmpresa).toHaveBeenCalledWith({
      nombre: 'Mi Tienda',
      rubro: 'Belleza y salud',
      pais: 'Uruguay',
      moneda: 'Dólares',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados.');
  });

  it('un rubro guardado que ya no está en la lista se sigue mostrando y se reenvía', async () => {
    guardarPerfilEmpresa.mockResolvedValue({ ok: true, message: 'Cambios guardados.' });
    const user = userEvent.setup();
    render(<Configuracion empresa={{ nombre: 'Mi Tienda', rubro: 'Ferretería', pais: 'Argentina', moneda: 'Pesos' }} />);
    expect(screen.getByRole('button', { name: /^Rubro/ })).toHaveTextContent('Ferretería');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardarPerfilEmpresa).toHaveBeenCalledWith(expect.objectContaining({ rubro: 'Ferretería' }));
  });

  it('muestra el error del servidor como alerta', async () => {
    guardarPerfilEmpresa.mockResolvedValue({ ok: false, message: 'No se pudieron guardar los cambios. Probá de nuevo.' });
    const user = userEvent.setup();
    render(<Configuracion empresa={{ nombre: 'Mi Tienda', rubro: null, pais: null, moneda: null }} />);
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar');
  });

  it('el tema cambia el de toda la app y queda guardado en el navegador', async () => {
    pathname = '/app/configuracion';
    const user = userEvent.setup();
    const { container } = render(
      <AppShell nombre="Gonzalo" iniciales="GM" foto={null} conectada={null} configPendiente={false}>
        <Configuracion empresa={null} />
      </AppShell>,
    );
    const raiz = container.querySelector('[data-pagina]');
    expect(raiz).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Claro' }));

    expect(raiz).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('praxa-app-tema')).toBe('light');

    await user.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(raiz).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('praxa-app-tema')).toBeNull();
  });
});

describe('Chat', () => {
  it('envía con Enter, agrega la burbuja con hora y no responde', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} />);
    const caja = screen.getByRole('textbox', { name: 'Tu pregunta' });
    const enviar = screen.getByRole('button', { name: 'Enviar' });
    expect(enviar).toBeDisabled();

    await user.type(caja, 'Hola{Enter}');

    const log = screen.getByRole('log', { name: 'Conversación' });
    expect(within(log).getByText('Hola')).toBeInTheDocument();
    expect(within(log).getByText(/^\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(caja).toHaveValue('');
    expect(enviar).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('Shift+Enter agrega un salto de línea y no envía', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} />);
    const caja = screen.getByRole('textbox', { name: 'Tu pregunta' });

    await user.type(caja, 'uno{Shift>}{Enter}{/Shift}dos');

    expect(caja).toHaveValue('uno\ndos');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
  });

  it('una sugerencia se copia al cuadro sin enviarse', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} />);

    await user.click(screen.getByRole('button', { name: '¿Por qué bajó el ROAS esta semana?' }));

    expect(screen.getByRole('textbox', { name: 'Tu pregunta' })).toHaveValue('¿Por qué bajó el ROAS esta semana?');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('sin conectores no muestra ninguna fuente; con conectores, una por cada uno', () => {
    const { rerender } = render(<Chat iniciales="GM" conectadas={[]} />);
    expect(screen.queryByRole('list', { name: 'Fuentes conectadas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Meta Ads')).not.toBeInTheDocument();

    rerender(<Chat iniciales="GM" conectadas={[{ id: 'meta_ads', nombre: 'Meta Ads' }]} />);
    const fuentes = screen.getByRole('list', { name: 'Fuentes conectadas' });
    expect(within(fuentes).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Meta Ads']);
  });

  it('el globo de buscar en internet se activa y desactiva', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} />);
    const globo = screen.getByRole('button', { name: 'Buscar en internet' });
    expect(globo).toHaveAttribute('aria-pressed', 'false');
    await user.click(globo);
    expect(globo).toHaveAttribute('aria-pressed', 'true');
    await user.click(globo);
    expect(globo).toHaveAttribute('aria-pressed', 'false');
  });

  it('solo espacios no se envía', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), '   {Enter}');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('con `pensando` muestra "Buscando en internet..." después de la pregunta', async () => {
    const user = userEvent.setup();
    render(<Chat iniciales="GM" conectadas={[]} pensando />);
    await user.type(screen.getByRole('textbox', { name: 'Tu pregunta' }), 'Hola{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Buscando en internet...');
  });
});

describe('Uso y costos', () => {
  const uso = usoEnCero(new Date());

  it('el desplegable y el control segmentado comparten el rango', async () => {
    const user = userEvent.setup();
    render(<UsoCostos uso={uso} kpis={null} />);
    const selector = screen.getByRole('button', { name: /Últimos 30 días/ });
    const segmentos = screen.getByRole('group', { name: 'Rango del gráfico' });
    expect(within(segmentos).getByRole('button', { name: '30 días' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(selector);
    expect(selector).toHaveAttribute('aria-expanded', 'true');
    const lista = screen.getByRole('listbox');
    expect(within(lista).getByRole('option', { name: 'Últimos 30 días' })).toHaveAttribute('aria-selected', 'true');
    await user.click(within(lista).getByRole('option', { name: 'Últimos 7 días' }));

    expect(selector).toHaveAttribute('aria-expanded', 'false');
    expect(selector).toHaveTextContent('Últimos 7 días');
    expect(within(segmentos).getByRole('button', { name: '7 días' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: /últimos 7 días: sin consultas/ })).toBeInTheDocument();

    await user.click(within(segmentos).getByRole('button', { name: '3 meses' }));
    expect(selector).toHaveTextContent('Últimos 90 días');
  });

  it('se maneja con el teclado: flechas para moverse y Enter para elegir', async () => {
    const user = userEvent.setup();
    render(<UsoCostos uso={uso} kpis={null} />);
    const selector = screen.getByRole('button', { name: /Últimos 30 días/ });
    selector.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(selector).toHaveTextContent('Últimos 90 días');
    expect(selector).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('el desplegable se cierra con Esc', async () => {
    const user = userEvent.setup();
    render(<UsoCostos uso={uso} kpis={null} />);
    const selector = screen.getByRole('button', { name: /Últimos 30 días/ });
    await user.click(selector);
    await user.keyboard('{Escape}');
    expect(selector).toHaveAttribute('aria-expanded', 'false');
    expect(selector).toHaveFocus();
  });
});

const DIAGNOSTICO_PRUEBA: DatosDiagnostico = {
  titular: { inicio: 'Titular de prueba,', destacado: 'con una parte destacada.' },
  parrafos: ['Primer párrafo de prueba.'],
  oportunidades: [{ titulo: 'Oportunidad de prueba', detalle: 'Detalle de prueba.', icono: 'barras' }],
  analisis: {
    titulo: 'Análisis de prueba',
    bloques: [
      { tipo: 'subtitulo', texto: 'Resumen ejecutivo' },
      { tipo: 'parrafo', texto: 'Texto de prueba.' },
      { tipo: 'lista', items: ['Uno', 'Dos'] },
    ],
  },
};

describe('Diagnóstico', () => {
  it('el análisis completo arranca abierto y se colapsa', async () => {
    const user = userEvent.setup();
    render(<Diagnostico datos={DIAGNOSTICO_PRUEBA} />);
    const boton = screen.getByRole('button', { name: 'Análisis completo del diagnóstico' });
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: 'Resumen ejecutivo' })).toBeInTheDocument();

    await user.click(boton);

    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: 'Resumen ejecutivo' })).not.toBeInTheDocument();
  });
});

const USUARIO = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'persona@ejemplo.com',
  nombre: null,
  apellido: null,
  miembroDesde: null,
  fotoUrl: null,
};

describe('Mi perfil', () => {
  beforeEach(() => {
    enviarEnlaceDeContrasena.mockReset();
    guardarNombreUsuario.mockReset();
    guardarFotoPerfil.mockReset();
    eliminarFotoPerfil.mockReset();
    subir.mockReset();
    quitar.mockReset();
    getUser.mockReset();
    quitar.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null });
    URL.createObjectURL = vi.fn(() => 'blob:foto');
  });

  const archivo = (nombre: string, tipo: string, bytes = 10) =>
    new File([new Uint8Array(bytes)], nombre, { type: tipo });
  const selector = (container: HTMLElement) =>
    container.querySelector<HTMLInputElement>('input[type="file"]')!;

  it('Subir nueva foto abre el selector de imágenes JPG y PNG', async () => {
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);
    const input = selector(container);
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: 'Subir nueva foto' }));
    expect(click).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Eliminar foto' })).toBeDisabled();
  });

  it('sube la foto a la carpeta del usuario, la registra y la muestra', async () => {
    subir.mockResolvedValue({ error: null });
    guardarFotoPerfil.mockResolvedValue({ ok: true, message: 'Foto actualizada.' });
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);

    await user.upload(selector(container), archivo('yo.png', 'image/png'));

    const [ruta, , opciones] = subir.mock.calls[0];
    expect(ruta).toMatch(new RegExp(`^${USUARIO.id}/[0-9a-f-]{36}\\.png$`));
    expect(opciones).toMatchObject({ contentType: 'image/png', upsert: false });
    expect(guardarFotoPerfil).toHaveBeenCalledWith(ruta);
    expect(await screen.findByText('Foto actualizada.')).toBeInTheDocument();
    expect(container.querySelectorAll('img[src="blob:foto"]').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Eliminar foto' })).toBeEnabled();
  });

  it.each([
    ['otro formato', 'yo.gif', 'image/gif', 10, 'La foto tiene que ser JPG o PNG.'],
    ['más de 5 MB', 'yo.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1, 'La foto puede pesar hasta 5 MB.'],
  ])('rechaza %s sin subir nada', async (_, nombre, tipo, bytes, mensaje) => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<Perfil usuario={USUARIO} />);
    await user.upload(selector(container), archivo(nombre, tipo, bytes));
    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(subir).not.toHaveBeenCalled();
  });

  it('si no se puede registrar, borra el archivo subido', async () => {
    subir.mockResolvedValue({ error: null });
    guardarFotoPerfil.mockResolvedValue({ ok: false, message: 'No se pudo guardar la foto.' });
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);
    await user.upload(selector(container), archivo('yo.jpg', 'image/jpeg'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar la foto.');
    expect(quitar).toHaveBeenCalledWith([subir.mock.calls[0][0]]);
  });

  it('si registrar la foto rechaza y Auth aún no apunta a ella, conserva el archivo hasta confirmar', async () => {
    subir.mockResolvedValue({ error: null });
    guardarFotoPerfil.mockRejectedValue(new Error('red interrumpida'));
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);

    await user.upload(selector(container), archivo('yo.png', 'image/png'));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar si la foto se guardó');
    expect(getUser).toHaveBeenCalled();
    expect(quitar).not.toHaveBeenCalled();
  });

  it('si la respuesta se pierde después de registrar la foto, conserva el archivo', async () => {
    subir.mockResolvedValue({ error: null });
    guardarFotoPerfil.mockRejectedValue(new Error('respuesta perdida'));
    getUser.mockImplementation(async () => ({
      data: { user: { user_metadata: { avatar_path: subir.mock.calls[0][0] } } },
      error: null,
    }));
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);

    await user.upload(selector(container), archivo('yo.png', 'image/png'));

    expect(await screen.findByText('Foto actualizada.')).toBeInTheDocument();
    expect(quitar).not.toHaveBeenCalled();
  });

  it('si Auth no puede verificar el resultado, no borra una foto que podría estar en uso', async () => {
    subir.mockResolvedValue({ error: null });
    guardarFotoPerfil.mockRejectedValue(new Error('respuesta perdida'));
    getUser.mockRejectedValue(new Error('sin red'));
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={USUARIO} />);

    await user.upload(selector(container), archivo('yo.png', 'image/png'));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar si la foto se guardó');
    expect(quitar).not.toHaveBeenCalled();
  });

  it('Eliminar foto la borra y vuelve a las iniciales', async () => {
    eliminarFotoPerfil.mockResolvedValue({ ok: true, message: 'Foto eliminada.' });
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={{ ...USUARIO, fotoUrl: 'https://firmada/foto' }} />);
    expect(container.querySelectorAll('img[src="https://firmada/foto"]').length).toBe(2);

    await user.click(screen.getByRole('button', { name: 'Eliminar foto' }));

    expect(eliminarFotoPerfil).toHaveBeenCalled();
    expect(await screen.findByText('Foto eliminada.')).toBeInTheDocument();
    expect(container.querySelectorAll('img[src="https://firmada/foto"]').length).toBe(0);
    expect(screen.getAllByText('P')).toHaveLength(2);
  });

  it('si falla la limpieza en Storage, refleja que la foto ya se quitó del perfil', async () => {
    eliminarFotoPerfil.mockResolvedValue({
      ok: false,
      fotoQuitada: true,
      message: 'La foto ya no aparece en tu perfil, pero no se pudo confirmar que el archivo se borró.',
    });
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={{ ...USUARIO, fotoUrl: 'https://firmada/foto' }} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar foto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La foto ya no aparece en tu perfil');
    expect(container.querySelectorAll('img[src="https://firmada/foto"]')).toHaveLength(0);
  });

  it('si Eliminar foto falla sin respuesta, lo avisa y conserva la foto', async () => {
    eliminarFotoPerfil.mockRejectedValue(new Error('respuesta perdida'));
    const user = userEvent.setup();
    const { container } = render(<Perfil usuario={{ ...USUARIO, fotoUrl: 'https://firmada/foto' }} />);

    await user.click(screen.getByRole('button', { name: 'Eliminar foto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar si la foto se eliminó');
    expect(container.querySelectorAll('img[src="https://firmada/foto"]').length).toBe(2);
    expect(screen.getByRole('button', { name: 'Eliminar foto' })).toBeEnabled();
  });

  it('recalcula las iniciales en vivo con nombre y apellido', async () => {
    const user = userEvent.setup();
    render(<Perfil usuario={USUARIO} />);
    expect(screen.getAllByText('P')).toHaveLength(2);
    expect(screen.queryByText(/Miembro desde/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Apellido'), 'Ruiz');

    expect(screen.getAllByText('AR')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
  });

  it('no tiene campo de Email: el correo solo se muestra', () => {
    render(<Perfil usuario={USUARIO} />);
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /mail/i })).not.toBeInTheDocument();
    expect(screen.getByText('persona@ejemplo.com', { selector: 'p' })).toBeInTheDocument();
  });

  it('Cambiar contraseña manda el enlace al correo de la cuenta', async () => {
    enviarEnlaceDeContrasena.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<Perfil usuario={USUARIO} />);

    await user.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));

    expect(enviarEnlaceDeContrasena).toHaveBeenCalledWith('persona@ejemplo.com');
    expect(await screen.findByText(/Te enviamos un correo a/)).toHaveTextContent('persona@ejemplo.com');
    expect(guardarNombreUsuario).not.toHaveBeenCalled();
  });

  it('si Supabase rechaza el pedido, muestra el error', async () => {
    enviarEnlaceDeContrasena.mockResolvedValue('Enviamos demasiados correos en poco tiempo.');
    const user = userEvent.setup();
    render(<Perfil usuario={USUARIO} />);
    await user.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enviamos demasiados correos');
  });

  it('Guardar cambios manda nombre y apellido y muestra el resultado', async () => {
    guardarNombreUsuario.mockResolvedValue({ ok: true, message: 'Cambios guardados.' });
    const user = userEvent.setup();
    render(<Perfil usuario={{ ...USUARIO, nombre: 'Ana' }} />);

    await user.type(screen.getByLabelText('Apellido'), 'Ruiz');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(guardarNombreUsuario).toHaveBeenCalledWith({ nombre: 'Ana', apellido: 'Ruiz' });
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados.');
  });
});
